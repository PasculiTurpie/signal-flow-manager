const {
  requestTitan,
  DEFAULT_TITAN_PATH,
  DEFAULT_TITAN_PROTOCOL,
} = require("../services/titans.service");

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeProtocol(rawProtocol) {
  if (!rawProtocol) return DEFAULT_TITAN_PROTOCOL;
  const normalized = String(rawProtocol).trim().toLowerCase();
  if (!normalized) return DEFAULT_TITAN_PROTOCOL;
  if (normalized !== "http" && normalized !== "https") {
    throw httpError(400, "Invalid 'protocol'. Only http or https are allowed");
  }
  return normalized;
}

const HOST_REGEX = /^[a-zA-Z0-9.-]+(?::\d+)?$/;

function normalizeHost(rawHost) {
  if (!rawHost) {
    throw httpError(400, "Missing required query parameter 'host'");
  }

  const host = String(rawHost).trim();

  if (!host) {
    throw httpError(400, "Missing required query parameter 'host'");
  }

  if (host.includes("//")) {
    throw httpError(400, "Host must not include protocol or slashes");
  }

  if (!HOST_REGEX.test(host)) {
    throw httpError(400, "Host contains invalid characters");
  }

  if (host.includes("..")) {
    throw httpError(400, "Host contains invalid characters");
  }

  return host;
}

function normalizeHostsList(rawHosts) {
  if (!rawHosts) {
    throw httpError(400, "Missing required query parameter 'hosts'");
  }

  const hosts = String(rawHosts)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeHost);

  if (!hosts.length) {
    throw httpError(400, "Parameter 'hosts' must include at least one host");
  }

  return hosts;
}

function normalizePath(rawPath) {
  const value = rawPath ? String(rawPath).trim() : DEFAULT_TITAN_PATH;
  const path = value || DEFAULT_TITAN_PATH;

  if (!path.startsWith("/")) {
    throw httpError(400, "Invalid 'path'. It must start with '/'");
  }

  if (path.includes("..")) {
    throw httpError(400, "Invalid 'path'. Directory traversal is not allowed");
  }

  try {
    const parsed = new URL(`http://placeholder${path}`);
    return parsed.pathname + parsed.search;
  } catch (error) {
    throw httpError(400, "Invalid 'path'. Unable to parse value");
  }
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;

  const value = String(rawUrl).trim();

  if (!value) {
    throw httpError(400, "Invalid 'url'. Unable to parse value");
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch (_error) {
    throw httpError(400, "Invalid 'url'. Unable to parse value");
  }

  const protocol = parsed.protocol.replace(/:$/, "").toLowerCase();

  if (protocol !== "http" && protocol !== "https") {
    throw httpError(400, "Invalid 'url'. Only http or https are allowed");
  }

  const host = normalizeHost(parsed.host);
  const path = normalizePath(parsed.pathname + parsed.search);

  return { protocol, host, path };
}

async function getServicesForHost(req, res) {
  try {
    const parsedUrl = normalizeUrl(req.query.url);

    const host = parsedUrl ? parsedUrl.host : normalizeHost(req.query.host);
    const path = parsedUrl ? parsedUrl.path : normalizePath(req.query.path);
    const protocol = parsedUrl
      ? parsedUrl.protocol
      : normalizeProtocol(req.query.protocol);

    const result = await requestTitan({ host, path, protocol });

    if (result.ok) {
      return res.status(result.status).json(result.data ?? null);
    }

    return res.status(result.status || 502).json({
      host,
      ok: false,
      error: result.error,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "Unexpected error",
    });
  }
}

async function getServicesForMultipleHosts(req, res) {
  try {
    const hosts = normalizeHostsList(req.query.hosts);
    const path = normalizePath(req.query.path);
    const protocol = normalizeProtocol(req.query.protocol);

    const results = await Promise.all(
      hosts.map(async (host) => {
        const result = await requestTitan({ host, path, protocol });
        if (result.ok) {
          return {
            host,
            ok: true,
            status: result.status,
            data: result.data ?? null,
          };
        }

        return {
          host,
          ok: false,
          status: result.status || 502,
          error: result.error,
        };
      })
    );

    return res.json(results);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "Unexpected error",
    });
  }
}

module.exports = {
  getServicesForHost,
  getServicesForMultipleHosts,
};
