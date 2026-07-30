const https = require("https");

const DEFAULT_TITAN_PROTOCOL = (process.env.TITAN_DEFAULT_PROTOCOL || "http").toLowerCase();
const DEFAULT_TITAN_PATH = process.env.TITAN_DEFAULT_PATH || "/api/v1/servicesmngt/services";
const TITAN_USERNAME =
  process.env.TITAN_USERNAME || process.env.TITAN_USER || "Operator";
const TITAN_PASSWORD =
  process.env.TITAN_PASSWORD || process.env.TITAN_PASS || "titan";
const TITAN_TIMEOUT_MS = Number(process.env.TITAN_TIMEOUT_MS || 8000);
const ALLOW_INSECURE_TLS =
  String(process.env.TITAN_ALLOW_INSECURE_TLS || "false").toLowerCase() ===
  "true";

function buildHeaders() {
  const headers = {
    Accept: "application/json, text/plain, */*",
  };

  if (TITAN_USERNAME && TITAN_PASSWORD) {
    const token = Buffer.from(`${TITAN_USERNAME}:${TITAN_PASSWORD}`).toString(
      "base64"
    );
    headers.Authorization = `Basic ${token}`;
  }

  return headers;
}

function getAgent(protocol) {
  if (protocol === "https" && ALLOW_INSECURE_TLS) {
    return new https.Agent({ rejectUnauthorized: false });
  }
  return undefined;
}

function normalizeProtocol(protocol) {
  const value = (protocol || DEFAULT_TITAN_PROTOCOL || "http").toLowerCase();
  if (value !== "http" && value !== "https") {
    return "http";
  }
  return value;
}

async function requestTitan({ host, path = DEFAULT_TITAN_PATH, protocol }) {
  const safeProtocol = normalizeProtocol(protocol);
  const url = new URL(`${safeProtocol}://${host}${path}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TITAN_TIMEOUT_MS);

  const options = {
    method: "GET",
    headers: buildHeaders(),
    signal: controller.signal,
  };

  const agent = getAgent(safeProtocol);
  if (agent) {
    options.agent = agent;
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let parsedBody = null;

    if (text) {
      try {
        parsedBody = JSON.parse(text);
      } catch (error) {
        parsedBody = text;
      }
    }

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        data: parsedBody,
      };
    }

    const errorPayload =
      parsedBody && typeof parsedBody === "object"
        ? parsedBody
        : {
            message:
              typeof parsedBody === "string" && parsedBody
                ? parsedBody
                : response.statusText || "Titan request failed",
          };

    return {
      ok: false,
      status: response.status,
      error: errorPayload,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        error: { message: "Titan request timed out" },
      };
    }

    return {
      ok: false,
      status: 502,
      error: { message: error.message || "Titan request failed" },
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  requestTitan,
  DEFAULT_TITAN_PATH,
  DEFAULT_TITAN_PROTOCOL,
};
