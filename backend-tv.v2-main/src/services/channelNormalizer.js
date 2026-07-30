const { normalizeHandles, normalizeHandleId } = require("./handleSanitizer");

const cloneIfNeeded = (value) => {
  if (!value) return value;
  if (typeof value.toObject === "function") {
    return value.toObject({ getters: true, virtuals: true });
  }
  if (typeof value.toJSON === "function") {
    return value.toJSON({ getters: true, virtuals: true });
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneIfNeeded(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = cloneIfNeeded(value[key]);
      return acc;
    }, {});
  }
  return value;
};

const compareById = (a, b) => {
  const idA = String(a?.id ?? "").trim();
  const idB = String(b?.id ?? "").trim();
  if (!idA && !idB) return 0;
  if (!idA) return -1;
  if (!idB) return 1;
  return idA.localeCompare(idB, undefined, { sensitivity: "base", numeric: true });
};

const normalizePosition = (position) => {
  if (!position || typeof position !== "object") {
    return { x: 0, y: 0 };
  }
  const x = Number(position.x);
  const y = Number(position.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
};

const normalizeOptionalPosition = (position) => {
  if (!position || typeof position !== "object") {
    return null;
  }
  const x = Number(position.x);
  const y = Number(position.y);
  const hasX = Number.isFinite(x);
  const hasY = Number.isFinite(y);
  if (!hasX && !hasY) {
    return null;
  }
  return {
    x: hasX ? x : 0,
    y: hasY ? y : 0,
  };
};

const sanitizeLabel = (label) => {
  if (label === undefined || label === null) return "";
  const str = String(label);
  const trimmed = str.trim();
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
};

const buildCanonicalKey = (value) => {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : "";
};

const normalizeNode = (node) => {
  if (!node) return null;
  const cloned = cloneIfNeeded(node) || {};
  const id = String(cloned.id ?? cloned._id ?? "").trim();
  if (!id) return null;

  const normalized = {
    ...cloned,
    id,
    type: cloned.type || "custom",
    data: { ...(cloned.data || {}) },
    position: normalizePosition(cloned.position),
  };

  const handles = normalizeHandles(cloned.handles || cloned.data?.handles || []);
  if (handles.length) {
    normalized.handles = handles;
    if (normalized.data) {
      normalized.data.handles = handles;
    }
  } else {
    delete normalized.handles;
    if (normalized.data) {
      delete normalized.data.handles;
    }
  }

  if (normalized.data && typeof normalized.data === "object") {
    normalized.data.label = sanitizeLabel(
      normalized.data.label ?? cloned.label ?? id
    );
    if (normalized.data.labelPosition) {
      const { x, y } = normalizePosition(normalized.data.labelPosition);
      normalized.data.labelPosition = { x, y };
    }
  }

  normalized.label = sanitizeLabel(cloned.label ?? normalized.data?.label ?? id);

  return normalized;
};

const normalizeEdge = (edge) => {
  if (!edge) return null;
  const cloned = cloneIfNeeded(edge) || {};
  const id = String(cloned.id ?? cloned._id ?? "").trim();
  if (!id) return null;
  const source = String(cloned.source ?? "").trim();
  const target = String(cloned.target ?? "").trim();
  if (!source || !target) return null;

  const normalized = {
    ...cloned,
    id,
    source,
    target,
    data: { ...(cloned.data || {}) },
    style: cloned.style ? { ...cloned.style } : undefined,
  };

  const sourceHandle = normalizeHandleId(cloned.sourceHandle);
  const targetHandle = normalizeHandleId(cloned.targetHandle);
  if (sourceHandle) {
    normalized.sourceHandle = sourceHandle;
  } else if (cloned.sourceHandle !== undefined) {
    delete normalized.sourceHandle;
  }

  if (targetHandle) {
    normalized.targetHandle = targetHandle;
  } else if (cloned.targetHandle !== undefined) {
    delete normalized.targetHandle;
  }

  normalized.data.label = sanitizeLabel(
    normalized.data.label ?? cloned.label ?? id
  );
  normalized.label = normalized.data.label;

  if (Object.prototype.hasOwnProperty.call(normalized.data, "labelStart")) {
    const sanitized = sanitizeLabel(normalized.data.labelStart);
    if (sanitized) {
      normalized.data.labelStart = sanitized;
    } else {
      delete normalized.data.labelStart;
    }
  }

  if (Object.prototype.hasOwnProperty.call(normalized.data, "labelEnd")) {
    const sanitized = sanitizeLabel(normalized.data.labelEnd);
    if (sanitized) {
      normalized.data.labelEnd = sanitized;
    } else {
      delete normalized.data.labelEnd;
    }
  }

  if (normalized.data.labelPosition) {
    const { x, y } = normalizePosition(normalized.data.labelPosition);
    normalized.data.labelPosition = { x, y };
    normalized.labelPosition = { x, y };
  }

  if (normalized.data.multicastPosition) {
    const multicastPosition = normalizeOptionalPosition(
      normalized.data.multicastPosition
    );
    if (multicastPosition) {
      normalized.data.multicastPosition = multicastPosition;
    } else {
      delete normalized.data.multicastPosition;
    }
  }

  if (normalized.data.multicast !== undefined) {
    const sanitizedMulticast = sanitizeLabel(normalized.data.multicast);
    if (sanitizedMulticast) {
      normalized.data.multicast = sanitizedMulticast;
    } else {
      delete normalized.data.multicast;
    }
  }

  if (normalized.data.endpointLabelPositions) {
    const positions = normalized.data.endpointLabelPositions;
    ["source", "target"].forEach((key) => {
      const normalizedPoint = normalizeOptionalPosition(positions[key]);
      if (normalizedPoint) {
        positions[key] = normalizedPoint;
      } else {
        delete positions[key];
      }
    });
  }

  if (normalized.data.endpointLabels) {
    const labels = normalized.data.endpointLabels;
    ["source", "target"].forEach((key) => {
      if (labels[key] === null || labels[key] === undefined) {
        delete labels[key];
      } else {
        labels[key] = sanitizeLabel(labels[key]);
        if (key === "source" && !normalized.data.labelStart) {
          normalized.data.labelStart = labels[key];
        }
        if (key === "target" && !normalized.data.labelEnd) {
          normalized.data.labelEnd = labels[key];
        }
      }
    });
  }

  return normalized;
};

const resolveNodeIdFactory = (normalizedNodes) => {
  const nodeIdSet = new Set(normalizedNodes.map((node) => node.id));
  const canonicalMap = new Map();

  normalizedNodes.forEach((node) => {
    const key = buildCanonicalKey(node.id);
    if (!key) return;
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, new Set());
    }
    canonicalMap.get(key).add(node.id);
  });

  return (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (nodeIdSet.has(trimmed)) {
      return trimmed;
    }

    const key = buildCanonicalKey(trimmed);
    if (!key) return null;
    const candidates = canonicalMap.get(key);
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
};

const normalizeChannel = (channel) => {
  if (!channel) return null;
  const cloned = cloneIfNeeded(channel) || {};
  const result = {
    ...cloned,
    nodes: [],
    edges: [],
  };

  const nodes = Array.isArray(cloned.nodes) ? cloned.nodes : [];
  const normalizedNodes = nodes
    .map((node) => normalizeNode(node))
    .filter(Boolean)
    .sort(compareById);

  const resolveNodeId = resolveNodeIdFactory(normalizedNodes);

  const edges = Array.isArray(cloned.edges) ? cloned.edges : [];
  const normalizedEdges = edges
    .map((edge) => normalizeEdge(edge))
    .map((edge) => {
      if (!edge) return null;
      const resolvedSource = resolveNodeId(edge.source);
      const resolvedTarget = resolveNodeId(edge.target);
      if (!resolvedSource || !resolvedTarget) {
        return null;
      }
      if (resolvedSource === edge.source && resolvedTarget === edge.target) {
        return edge;
      }
      return { ...edge, source: resolvedSource, target: resolvedTarget };
    })
    .filter(Boolean)
    .sort(compareById);

  result.nodes = normalizedNodes;
  result.edges = normalizedEdges;
  return result;
};

const normalizeChannels = (channels) => {
  if (!Array.isArray(channels)) return [];
  return channels.map((channel) => normalizeChannel(channel)).filter(Boolean);
};

module.exports = {
  normalizeChannel,
  normalizeChannels,
  normalizeNode,
  normalizeEdge,
  compareById,
};
