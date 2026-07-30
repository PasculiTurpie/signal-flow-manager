const { normalizeHandleId } = require("./handleSanitizer");

const MAX_LABEL_LENGTH = 200;

const clampLabel = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  const trimmed = str.trim();
  return trimmed.length > MAX_LABEL_LENGTH ? trimmed.slice(0, MAX_LABEL_LENGTH) : trimmed;
};

const clampCoordinate = (val) => {
  if (val === undefined || val === null) return null;
  if (typeof val === "string" && val.trim() === "") return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  const bounded = Math.max(-1_000_000, Math.min(1_000_000, num));
  return Number.isFinite(bounded) ? bounded : 0;
};

const sanitizePosition = (point) => {
  if (!point || typeof point !== "object") return null;
  const x = clampCoordinate(point.x);
  const y = clampCoordinate(point.y);
  if (x === null || y === null) return null;
  return { x, y };
};

const sanitizeEndpointLabels = (payload = {}) => {
  const result = {};
  if (Object.prototype.hasOwnProperty.call(payload, "source")) {
    const value = payload.source;
    if (value === null) {
      result.source = null;
    } else if (value !== undefined) {
      const sanitized = clampLabel(value);
      result.source = sanitized || null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "target")) {
    const value = payload.target;
    if (value === null) {
      result.target = null;
    } else if (value !== undefined) {
      const sanitized = clampLabel(value);
      result.target = sanitized || null;
    }
  }
  return result;
};

const sanitizeEndpointPositions = (payload = {}) => {
  const result = {};
  if (Object.prototype.hasOwnProperty.call(payload, "source")) {
    const sanitized = sanitizePosition(payload.source);
    result.source = sanitized;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "target")) {
    const sanitized = sanitizePosition(payload.target);
    result.target = sanitized;
  }
  return result;
};

const ensureObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const sanitizeNodePayload = (node) => {
  if (!node || typeof node !== "object") return null;
  const id = String(node.id ?? node._id ?? "").trim();
  if (!id) return null;

  const position = sanitizePosition(node.position) || { x: 0, y: 0 };
  const data = { ...ensureObject(node.data) };
  const label = clampLabel(data.label ?? node.label ?? id);
  data.label = label;

  const labelPositionInput =
    data.labelPosition !== undefined
      ? data.labelPosition
      : node.labelPosition !== undefined
      ? node.labelPosition
      : undefined;

  if (labelPositionInput !== undefined) {
    const sanitized = sanitizePosition(labelPositionInput);
    if (sanitized) {
      data.labelPosition = sanitized;
    } else {
      delete data.labelPosition;
    }
  }

  const multicastPositionInput =
    data.multicastPosition !== undefined ? data.multicastPosition : undefined;

  if (multicastPositionInput !== undefined) {
    const sanitized = sanitizePosition(multicastPositionInput);
    if (sanitized) {
      data.multicastPosition = sanitized;
    } else {
      delete data.multicastPosition;
    }
  }

  const payload = {
    ...node,
    id,
    type: node.type || "custom",
    position,
    data,
    label,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "labelPosition")) {
    delete payload.labelPosition;
  }

  return payload;
};

const mergeEndpointPayload = (edge) => ({
  ...(ensureObject(edge.endpointLabels)),
  ...(ensureObject(edge.data?.endpointLabels)),
});

const mergeEndpointPositionsPayload = (edge) => ({
  ...(ensureObject(edge.endpointLabelPositions)),
  ...(ensureObject(edge.data?.endpointLabelPositions)),
});

const sanitizeEdgePayload = (edge) => {
  if (!edge || typeof edge !== "object") return null;
  const id = String(edge.id ?? edge._id ?? "").trim();
  const source = String(edge.source ?? "").trim();
  const target = String(edge.target ?? "").trim();
  if (!id || !source || !target) return null;

  const data = { ...ensureObject(edge.data) };
  const style = edge.style && typeof edge.style === "object" ? { ...edge.style } : undefined;
  const payload = {
    ...edge,
    id,
    source,
    target,
    data,
  };

  const animated =
    edge.animated !== undefined ? Boolean(edge.animated) : true;
  payload.animated = animated;
  if (style) payload.style = style;

  const sanitizedSourceHandle = normalizeHandleId(edge.sourceHandle);
  const sanitizedTargetHandle = normalizeHandleId(edge.targetHandle);

  if (sanitizedSourceHandle) {
    payload.sourceHandle = sanitizedSourceHandle;
  } else if (Object.prototype.hasOwnProperty.call(payload, "sourceHandle")) {
    delete payload.sourceHandle;
  }

  if (sanitizedTargetHandle) {
    payload.targetHandle = sanitizedTargetHandle;
  } else if (Object.prototype.hasOwnProperty.call(payload, "targetHandle")) {
    delete payload.targetHandle;
  }

  const label = clampLabel(data.label ?? edge.label ?? id);
  data.label = label;
  payload.label = label;

  const labelPositionInput =
    data.labelPosition !== undefined
      ? data.labelPosition
      : edge.labelPosition !== undefined
      ? edge.labelPosition
      : undefined;
  if (labelPositionInput !== undefined) {
    const sanitized = sanitizePosition(labelPositionInput);
    if (sanitized) {
      data.labelPosition = sanitized;
      payload.labelPosition = sanitized;
    } else {
      delete data.labelPosition;
      if (payload.labelPosition !== undefined) delete payload.labelPosition;
    }
  } else if (payload.labelPosition !== undefined) {
    const sanitized = sanitizePosition(payload.labelPosition);
    if (sanitized) {
      data.labelPosition = sanitized;
      payload.labelPosition = sanitized;
    } else {
      delete payload.labelPosition;
    }
  }

  const mergedLabels = mergeEndpointPayload(edge);
  if (Object.prototype.hasOwnProperty.call(data, "labelStart")) {
    mergedLabels.source = data.labelStart;
  }
  if (Object.prototype.hasOwnProperty.call(data, "labelEnd")) {
    mergedLabels.target = data.labelEnd;
  }

  const sanitizedLabels = sanitizeEndpointLabels(mergedLabels);
  const nextLabels = {};
  if (sanitizedLabels.source) {
    nextLabels.source = sanitizedLabels.source;
    data.labelStart = sanitizedLabels.source;
  } else if (Object.prototype.hasOwnProperty.call(data, "labelStart")) {
    delete data.labelStart;
  }
  if (sanitizedLabels.target) {
    nextLabels.target = sanitizedLabels.target;
    data.labelEnd = sanitizedLabels.target;
  } else if (Object.prototype.hasOwnProperty.call(data, "labelEnd")) {
    delete data.labelEnd;
  }

  if (Object.keys(nextLabels).length) {
    data.endpointLabels = nextLabels;
  } else if (data.endpointLabels !== undefined) {
    delete data.endpointLabels;
  }

  const mergedPositions = mergeEndpointPositionsPayload(edge);
  const sanitizedPositions = sanitizeEndpointPositions(mergedPositions);
  const nextPositions = {};
  if (sanitizedPositions.source) nextPositions.source = sanitizedPositions.source;
  if (sanitizedPositions.target) nextPositions.target = sanitizedPositions.target;
  if (Object.keys(nextPositions).length) {
    data.endpointLabelPositions = nextPositions;
  } else if (data.endpointLabelPositions !== undefined) {
    delete data.endpointLabelPositions;
  }

  if (data.multicast !== undefined) {
    const sanitizedMulticast = clampLabel(data.multicast);
    if (sanitizedMulticast) {
      data.multicast = sanitizedMulticast;
    } else {
      delete data.multicast;
    }
  }

  const multicastPositionInput =
    data.multicastPosition !== undefined
      ? data.multicastPosition
      : edge.multicastPosition !== undefined
      ? edge.multicastPosition
      : undefined;
  if (multicastPositionInput !== undefined) {
    const sanitized = sanitizePosition(multicastPositionInput);
    if (sanitized) {
      data.multicastPosition = sanitized;
    } else {
      delete data.multicastPosition;
    }
  }

  [
    "endpointLabels",
    "endpointLabelPositions",
    "multicast",
    "multicastPosition",
    "labelStart",
    "labelEnd",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      delete payload[key];
    }
  });

  return payload;
};

const canonicalKey = (value) => {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : "";
};

const sanitizeDiagramPayload = ({ nodes, edges } = {}) => {
  const sanitizedNodes = Array.isArray(nodes)
    ? nodes.map((node) => sanitizeNodePayload(node)).filter(Boolean)
    : [];

  const nodeIdSet = new Set(sanitizedNodes.map((node) => node.id));
  const canonicalNodeIds = new Map();
  sanitizedNodes.forEach((node) => {
    const key = canonicalKey(node.id);
    if (!key) return;
    if (!canonicalNodeIds.has(key)) {
      canonicalNodeIds.set(key, new Set());
    }
    canonicalNodeIds.get(key).add(node.id);
  });

  const resolveNodeId = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (nodeIdSet.has(trimmed)) return trimmed;
    const key = canonicalKey(trimmed);
    if (!key) return null;
    const candidates = canonicalNodeIds.get(key);
    if (!candidates || candidates.size === 0) return null;
    if (candidates.size === 1) {
      return [...candidates][0];
    }
    const lower = trimmed.toLowerCase();
    const matching = [...candidates].filter((id) => id.toLowerCase() === lower);
    if (matching.length === 1) {
      return matching[0];
    }
    return null;
  };

  const sanitizedEdges = Array.isArray(edges)
    ? edges
        .map((edge) => sanitizeEdgePayload(edge))
        .map((edge) => {
          if (!edge) return null;
          const resolvedSource = resolveNodeId(edge.source);
          const resolvedTarget = resolveNodeId(edge.target);
          if (!resolvedSource || !resolvedTarget) return null;
          if (resolvedSource === edge.source && resolvedTarget === edge.target) {
            return edge;
          }
          return { ...edge, source: resolvedSource, target: resolvedTarget };
        })
        .filter(Boolean)
    : [];

  return { nodes: sanitizedNodes, edges: sanitizedEdges };
};

module.exports = {
  clampLabel,
  sanitizePosition,
  sanitizeEndpointLabels,
  sanitizeEndpointPositions,
  sanitizeNodePayload,
  sanitizeEdgePayload,
  sanitizeDiagramPayload,
};
