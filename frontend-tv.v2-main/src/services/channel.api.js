import api from "../utils/api.js";

const toPosition = (value) => {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
};

const sanitizePayload = (payload = {}) => {
  const result = {};
  const labelPositions = {};
  const endpointLabelPositions = {};

  const nodesSource =
    payload && typeof payload === "object" && payload.nodes && typeof payload.nodes === "object"
      ? payload.nodes
      : {};
  const edgesSource =
    payload && typeof payload === "object" && payload.edges && typeof payload.edges === "object"
      ? payload.edges
      : {};
  const endpointSource =
    payload &&
    typeof payload === "object" &&
    payload.endpointLabelPositions &&
    typeof payload.endpointLabelPositions === "object"
      ? payload.endpointLabelPositions
      : {};

  const sanitizeEntry = (source) => {
    const entry = {};
    if (Object.prototype.hasOwnProperty.call(source, "labelPosition")) {
      const normalized = toPosition(source.labelPosition);
      entry.labelPosition = normalized ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(source, "multicastPosition")) {
      const normalized = toPosition(source.multicastPosition);
      entry.multicastPosition = normalized ?? null;
    }
    return Object.keys(entry).length ? entry : null;
  };

  Object.entries(nodesSource).forEach(([idValue, source]) => {
    const id = String(idValue ?? "").trim();
    if (!id) return;
    const entry = sanitizeEntry(source || {});
    if (entry) {
      labelPositions.nodes = labelPositions.nodes || {};
      labelPositions.nodes[id] = entry;
    }
  });

  Object.entries(edgesSource).forEach(([idValue, source]) => {
    const id = String(idValue ?? "").trim();
    if (!id) return;
    const entry = sanitizeEntry(source || {});
    if (entry) {
      labelPositions.edges = labelPositions.edges || {};
      labelPositions.edges[id] = entry;
    }
  });

  Object.entries(endpointSource).forEach(([idValue, source]) => {
    const id = String(idValue ?? "").trim();
    if (!id) return;
    if (!source || typeof source !== "object") return;
    const entry = {};
    ["source", "target"].forEach((endpointKey) => {
      if (Object.prototype.hasOwnProperty.call(source, endpointKey)) {
        const normalized = toPosition(source[endpointKey]);
        entry[endpointKey] = normalized ?? null;
      }
    });
    if (Object.keys(entry).length) {
      endpointLabelPositions[id] = entry;
    }
  });

  if (Object.keys(labelPositions).length) {
    result.labelPositions = labelPositions;
  }
  if (Object.keys(endpointLabelPositions).length) {
    result.endpointLabelPositions = endpointLabelPositions;
  }

  return result;
};

export function patchLabelPositions(channelId, payload, options = {}) {
  if (!channelId) {
    return Promise.reject(new Error("channelId is required"));
  }
  const body = sanitizePayload(payload);
  const config = {};
  if (options.origin) {
    config.headers = {
      ...(options.headers || {}),
      "x-diagram-origin": options.origin,
    };
  }
  return api.patchChannelLabelPositions(channelId, body, config);
}

export default {
  patchLabelPositions,
};
