// src/pages/ChannelDiagram/diagramUtils.js
import { getSmoothStepPath } from "@xyflow/react";
import { autoLabelEdge, enforceSateliteToIrd, normalizeEdgeHandles } from "./flowRules.js";
import { ensureHandleId } from "./handleStandard.js";

export const ARROW_CLOSED = { type: "arrowclosed" };

export const MAX_LABEL_LENGTH = 200;

const ROUTER_HANDLE_SIDES = ["left", "right", "bottom"];
const ROUTER_HANDLE_COUNT = 3;

export const ROUTER_OUT_CLASS = "edge-outgoing";
export const ROUTER_IN_CLASS = "edge-incoming";

const ROUTER_OUT_COLOR = "#e11d48";
const ROUTER_IN_COLOR = "#16a34a";

export const isRouterNode = (node) =>
  (node?.type || node?.data?.type || "") === "router";

export const parseRouterHandleId = (handleId) => {
  if (!handleId || typeof handleId !== "string") return null;
  const normalized = ensureHandleId(handleId);
  const match = /^(in|out)-(left|right|bottom)-(\d+)$/i.exec(normalized);
  if (!match) return null;
  return {
    kind: match[1] === "in" ? "in" : "out",
    side: match[2],
    index: Number(match[3]),
  };
};

const createRouterHandleDefinitions = () => {
  const handles = [];
  ROUTER_HANDLE_SIDES.forEach((side) => {
    for (let i = 1; i <= ROUTER_HANDLE_COUNT; i += 1) {
      handles.push({
        id: `out-${side}-${i}`,
        kind: "out",
        side,
        index: i,
      });
      handles.push({
        id: `in-${side}-${i}`,
        kind: "in",
        side,
        index: i,
      });
    }
  });
  return handles;
};

export const ROUTER_HANDLE_DEFINITIONS = Object.freeze(
  createRouterHandleDefinitions()
);

const routerComboKey = ({ direction, side, index }) =>
  `${direction}:${side}:${index}`;

const getRouterCombos = () => {
  const combos = [];
  ROUTER_HANDLE_SIDES.forEach((side) => {
    for (let index = 1; index <= ROUTER_HANDLE_COUNT; index += 1) {
      combos.push({ direction: "out", side, index });
      combos.push({ direction: "in", side, index });
    }
  });
  return combos;
};

const routerEdgeId = (nodeId, { direction, side, index }) =>
  `${nodeId}:${direction}-${side}-${index}`;

const baseRouterEdge = (node, combo) => {
  const { direction, side, index } = combo;
  const isOut = direction === "out";
  const color = isOut ? ROUTER_OUT_COLOR : ROUTER_IN_COLOR;
  const className = isOut ? ROUTER_OUT_CLASS : ROUTER_IN_CLASS;
  const label = isOut ? "IDA" : "RETORNO";
  const sourceHandle = `out-${side}-${index}`;
  const targetHandle = `in-${side}-${index}`;

  return {
    id: routerEdgeId(node.id, combo),
    type: "smoothstep",
    source: node.id,
    target: node.id,
    sourceHandle,
    targetHandle,
    animated: true,
    className,
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: withMarkerColor({ type: "arrowclosed" }, color),
    reconnectable: true,
    data: {
      label,
      direction,
      pending: true,
      routerTemplate: node.id,
    },
  };
};

const detectRouterComboFromEdge = (nodeId, edge) => {
  if (!edge) return null;
  if (edge.source !== nodeId && edge.target !== nodeId) return null;
  const data = edge.data || {};
  const declaredDirection =
    data.direction === "in"
      ? "in"
      : data.direction === "out"
      ? "out"
      : null;

  if (declaredDirection === "out") {
    const info = parseRouterHandleId(edge.sourceHandle);
    if (info && info.kind === "out") {
      return { direction: "out", side: info.side, index: info.index };
    }
  }

  if (declaredDirection === "in") {
    const info = parseRouterHandleId(edge.targetHandle);
    if (info && info.kind === "in") {
      return { direction: "in", side: info.side, index: info.index };
    }
  }

  if (data.routerTemplate === nodeId) {
    const id = String(edge.id || "");
    const match = /:(out|in)-(left|right|bottom)-(\d+)$/i.exec(id);
    if (match) {
      return {
        direction: match[1] === "in" ? "in" : "out",
        side: match[2],
        index: Number(match[3]),
      };
    }
  }

  return null;
};

export const ensureRouterTemplateEdges = (node, edges, { force = false } = {}) => {
  if (!isRouterNode(node)) {
    return { toAdd: [], toRemove: [], missingCombos: [] };
  }

  const combos = getRouterCombos();
  const existingByCombo = new Map();
  const ownedEdges = [];

  edges.forEach((edge) => {
    const combo = detectRouterComboFromEdge(node.id, edge);
    if (!combo) return;
    const key = routerComboKey(combo);
    if (!existingByCombo.has(key)) {
      existingByCombo.set(key, edge);
    }
    if (edge.data?.routerTemplate === node.id) {
      ownedEdges.push(edge);
    }
  });

  const toAdd = [];
  const missingCombos = [];
  combos.forEach((combo) => {
    const key = routerComboKey(combo);
    if (!existingByCombo.has(key) || force) {
      toAdd.push(baseRouterEdge(node, combo));
      missingCombos.push(combo);
    }
  });

  const toRemove = force ? ownedEdges : [];

  return { toAdd, toRemove, missingCombos };
};

export const summarizeRouterEdges = (node, edges) => {
  const expected = ROUTER_HANDLE_SIDES.length * ROUTER_HANDLE_COUNT * 2;
  const combos = getRouterCombos();
  const existing = new Set();
  edges.forEach((edge) => {
    const combo = detectRouterComboFromEdge(node?.id, edge);
    if (!combo) return;
    existing.add(routerComboKey(combo));
  });
  const missingCombos = combos.filter(
    (combo) => !existing.has(routerComboKey(combo))
  );
  return {
    expected,
    existing: expected - missingCombos.length,
    missing: missingCombos.length,
    missingCombos,
  };
};

export const getNodeHandleUsage = (node, edges) => {
  if (!node) return [];
  const map = new Map();

  const ensureEntry = (handleId, fallbackKind = "out") => {
    if (!map.has(handleId)) {
      const parsed = parseRouterHandleId(handleId);
      map.set(handleId, {
        id: handleId,
        kind: parsed?.kind || fallbackKind,
        side: parsed?.side || null,
        index: parsed?.index || null,
        connections: [],
      });
    }
    return map.get(handleId);
  };

  if (isRouterNode(node)) {
    ROUTER_HANDLE_DEFINITIONS.forEach((handle) => {
      ensureEntry(handle.id, handle.kind);
    });
  }

  edges.forEach((edge) => {
    if (edge.source === node.id) {
      const handleId = ensureHandleId(edge.sourceHandle || "out");
      if (handleId) {
        const entry = ensureEntry(handleId, "out");
        entry.connections.push({
          edgeId: edge.id,
          direction: edge.data?.direction || "out",
          counterpart: edge.target,
          counterpartHandle: ensureHandleId(edge.targetHandle || ""),
          label: edge.data?.label || edge.label || "",
          multicast: edge.data?.multicast || null,
          pending: !!edge.data?.pending,
        });
      }
    }
    if (edge.target === node.id) {
      const handleId = ensureHandleId(edge.targetHandle || "in");
      if (handleId) {
        const entry = ensureEntry(handleId, "in");
        entry.connections.push({
          edgeId: edge.id,
          direction: edge.data?.direction || "in",
          counterpart: edge.source,
          counterpartHandle: ensureHandleId(edge.sourceHandle || ""),
          label: edge.data?.label || edge.label || "",
          multicast: edge.data?.multicast || null,
          pending: !!edge.data?.pending,
        });
      }
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
};

export const collectNodeMulticastConflicts = (nodeId, edges) => {
  if (!nodeId) return [];
  const lookup = new Map();
  const normalized = (value) => {
    if (!value) return "";
    return String(value).trim().toLowerCase();
  };

  edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .forEach((edge) => {
      const multicast = normalized(edge.data?.multicast || edge.data?.label);
      if (!multicast) return;
      const list = lookup.get(multicast) || [];
      list.push(edge);
      lookup.set(multicast, list);
    });

  return Array.from(lookup.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, edges: list }));
};

export const toNumberOr = (val, def = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
};

export const normalizeMarker = (marker) => {
  if (!marker || typeof marker !== "object") return { ...ARROW_CLOSED };
  const { type, ...rest } = marker;
  if (type === "arrowclosed" || type === "arrow") {
    return { type, ...rest };
  }
  if (type === 1 || type === "1") {
    return { type: "arrowclosed", ...rest };
  }
  if (type === 0 || type === "0") {
    return { type: "arrow", ...rest };
  }
  return { type: "arrowclosed", ...rest };
};

export const getEdgeColor = (style, direction) =>
  style?.stroke || (direction === "vuelta" ? "green" : "blue");

export const withMarkerColor = (marker, color) => ({
  ...normalizeMarker(marker || ARROW_CLOSED),
  color,
});

export const safeArray = (val) => (Array.isArray(val) ? val : []);

const compareById = (a, b) => {
  const idA = String(a?.id ?? "").trim();
  const idB = String(b?.id ?? "").trim();
  if (!idA && !idB) return 0;
  if (!idA) return -1;
  if (!idB) return 1;
  return idA.localeCompare(idB, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

export const sortNodesById = (nodes) =>
  safeArray(nodes)
    .map((node) => ({ ...node }))
    .sort(compareById);

export const sortEdgesById = (edges) =>
  safeArray(edges)
    .map((edge) => ({ ...edge }))
    .sort(compareById);

const clampLabel = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  const trimmed = str.trim();
  return trimmed.length > MAX_LABEL_LENGTH
    ? trimmed.slice(0, MAX_LABEL_LENGTH)
    : trimmed;
};

const extractEquipoId = (rawValue) => {
  if (rawValue === undefined || rawValue === null) return null;

  if (typeof rawValue === "string" || typeof rawValue === "number") {
    const normalized = String(rawValue).trim();
    return normalized ? normalized : null;
  }

  if (Array.isArray(rawValue)) {
    for (const value of rawValue) {
      const extracted = extractEquipoId(value);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof rawValue === "object") {
    const candidateKeys = [
      "_id",
      "id",
      "value",
      "key",
      "equipoId",
      "equipoID",
      "equipo",
      "idEquipo",
    ];
    for (const key of candidateKeys) {
      if (!Object.prototype.hasOwnProperty.call(rawValue, key)) continue;
      const extracted = extractEquipoId(rawValue[key]);
      if (extracted) return extracted;
    }
    return null;
  }

  return null;
};

const toPointOrNull = (point) => {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
};

const HANDLE_SIDES = new Set(["top", "right", "bottom", "left"]);
const HANDLE_TYPES = new Set(["source", "target"]);

const HANDLE_DEFAULTS = Object.freeze({
  top: { topPct: 0, leftPct: 50 },
  right: { topPct: 50, leftPct: 100 },
  bottom: { topPct: 100, leftPct: 50 },
  left: { topPct: 50, leftPct: 0 },
});

const clampHandlePercentage = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Number(num.toFixed(3));
};

const inferTypeFromHandleId = (handleId) => {
  if (!handleId) return null;
  const normalized = ensureHandleId(handleId);
  if (!normalized) return null;
  if (normalized.startsWith("in-")) return "target";
  if (normalized.startsWith("out-")) return "source";
  if (normalized.endsWith("-target")) return "target";
  if (normalized.endsWith("-source")) return "source";
  if (normalized.startsWith("tgt-")) return "target";
  if (normalized.startsWith("src-")) return "source";
  const suffixMatch = /-(target|source)-\d+$/.exec(normalized);
  if (suffixMatch) {
    return suffixMatch[1] === "target" ? "target" : "source";
  }
  const prefixMatch =
    /^(top|bottom|left|right)-(target|source)(?:-|$)/.exec(normalized);
  if (prefixMatch) {
    return prefixMatch[2] === "target" ? "target" : "source";
  }
  return null;
};

const inferSideFromHandleId = (handleId) => {
  if (!handleId) return null;
  const normalized = ensureHandleId(handleId);
  if (!normalized) return null;
  const sideMatch = /(top|bottom|left|right)/.exec(normalized);
  return sideMatch ? sideMatch[1] : null;
};

export const normalizeHandlesArray = (handles) => {
  const seen = new Set();
  const result = [];

  const pushHandle = (entry, typeHint, sideHint) => {
    if (!entry || typeof entry !== "object") return;
    const rawId = entry.id ?? entry.handleId ?? entry;
    if (rawId === undefined || rawId === null) return;
    const id = String(rawId).trim();
    if (!id) return;

    const candidateType =
      typeof entry.type === "string" ? entry.type.toLowerCase() : typeHint;
    const inferredType = inferTypeFromHandleId(id);
    const type = HANDLE_TYPES.has(candidateType) ? candidateType : inferredType;
    if (!type) return;

    const candidateSide =
      typeof entry.side === "string" ? entry.side.toLowerCase() : sideHint;
    const inferredSide = inferSideFromHandleId(id);
    const side = HANDLE_SIDES.has(candidateSide) ? candidateSide : inferredSide;
    if (!side) return;

    const defaults = HANDLE_DEFAULTS[side] || { topPct: 50, leftPct: 50 };
    const topPct = clampHandlePercentage(entry.topPct, defaults.topPct);
    const leftPct = clampHandlePercentage(entry.leftPct, defaults.leftPct);

    const canonicalId = ensureHandleId(id);
    if (!canonicalId) return;

    const dedupeKey = `${canonicalId}|${type}|${side}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    result.push({ id: canonicalId, type, side, topPct, leftPct });
  };

  if (Array.isArray(handles)) {
    handles.forEach((entry) => pushHandle(entry));
    return result;
  }

  if (handles && typeof handles === "object") {
    HANDLE_TYPES.forEach((type) => {
      const entries = handles?.[type];
      HANDLE_SIDES.forEach((side) => {
        const list = Array.isArray(entries?.[side]) ? entries[side] : [];
        list.forEach((value) => {
          if (typeof value === "string" || typeof value === "object") {
            pushHandle(
              typeof value === "string" ? { id: value } : value,
              type,
              side
            );
          }
        });
      });
    });
  }

  return result;
};

export const mapNodeFromApi = (node) => {
  if (!node) return null;
  const id = String(node.id ?? node._id ?? node.key ?? "");
  if (!id) return null;

  const rawData = node.data || {};
  const getPos = (val, index) => {
    if (val !== undefined && val !== null) return val;
    if (Array.isArray(node.position)) return node.position[index];
    return undefined;
  };

  const label = clampLabel(rawData.label ?? node.label ?? id);
  const equipoId =
    extractEquipoId(node.equipo) ??
    extractEquipoId(node.equipoId) ??
    extractEquipoId(rawData.equipo) ??
    extractEquipoId(rawData.equipoId);

  const normalizeType = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed.toLowerCase() : null;
  };

  const resolvedType =
    normalizeType(node.type) || normalizeType(rawData.type) || "custom";

  const data = {
    ...rawData,
    label,
    labelPosition: toPointOrNull(rawData.labelPosition),
    multicastPosition: toPointOrNull(rawData.multicastPosition),
    ...(resolvedType ? { type: resolvedType } : {}),
  };

  if (equipoId) {
    data.equipoId = equipoId;
  }

  const handles = normalizeHandlesArray(node.handles || rawData.handles);
  if (handles.length) {
    data.handles = handles;
  } else if (data.handles) {
    delete data.handles;
  }

  return {
    id,
    type: resolvedType,
    data,
    handles,
    position: {
      x: toNumberOr(getPos(node.position?.x, 0), 0),
      y: toNumberOr(getPos(node.position?.y, 1), 0),
    },
    ...(equipoId ? { equipo: equipoId } : {}),
  };
};

const normalizeEdgeType = (type) => {
  if (!type && type !== 0) {
    return "smoothstep";
  }

  const raw = String(type).trim().toLowerCase();
  if (!raw) return "smoothstep";

  const compact = raw.replace(/[^a-z]/g, "");

  if (compact.startsWith("directional")) return "directional";
  if (compact === "direction") return "directional";
  if (compact.startsWith("waypoint")) return "waypoint";
  if (compact === "way" || compact === "waypoints" || compact === "waypointedge")
    return "waypoint";
  if (compact.startsWith("smoothstep")) return "smoothstep";
  if (compact === "smooth" || compact === "default") return "smoothstep";

  return "smoothstep";
};

const normalizeLabelPosition = (edge) => {
  const dataPosition = edge?.data?.labelPosition || edge?.data?.labelPos || null;
  if (dataPosition && typeof dataPosition === "object") {
    const { x, y } = dataPosition;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  const legacy = edge?.labelPosition;
  if (legacy && typeof legacy === "object") {
    const { x, y } = legacy;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }
  return null;
};

const normalizeEndpointLabelPositions = (rawPositions) => {
  if (!rawPositions || typeof rawPositions !== "object") return {};
  const normalizePoint = (point) => {
    if (!point || typeof point !== "object") return undefined;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return { x, y };
  };

  const result = {};
  const source = normalizePoint(rawPositions.source);
  const target = normalizePoint(rawPositions.target);
  if (source) result.source = source;
  if (target) result.target = target;
  return result;
};

const normalizeEndpointLabels = (rawLabels) => {
  if (!rawLabels || typeof rawLabels !== "object") return {};
  const result = {};
  if (rawLabels.source !== undefined && rawLabels.source !== null) {
    result.source = clampLabel(rawLabels.source);
  }
  if (rawLabels.target !== undefined && rawLabels.target !== null) {
    result.target = clampLabel(rawLabels.target);
  }
  return result;
};

/* 🔥 AQUÍ VIENE LA FUNCIÓN MODIFICADA */
export const mapEdgeFromApi = (edge) => {
  if (!edge) return null;
  const id = String(edge.id ?? edge._id ?? "");
  if (!id || !edge.source || !edge.target) return null;

  const rawData = edge.data || {};

  // direction: si no viene, inferimos por color
  const direction =
    rawData.direction || (edge.style?.stroke === "green" ? "vuelta" : "ida");

  // label principal del edge
  const label = clampLabel(edge.label || rawData.label || id);

  // color según dirección
  const color = getEdgeColor(edge.style, direction);
  const style = edge.style
    ? { ...edge.style, stroke: edge.style.stroke || color }
    : { stroke: color, strokeWidth: 2 };

  // posición del label central
  const labelPosition = normalizeLabelPosition(edge);

  // labels de endpoints
  let endpointLabels = normalizeEndpointLabels(rawData.endpointLabels);

  const rawEndpointPositions = {
    ...(edge.endpointLabelPositions &&
    typeof edge.endpointLabelPositions === "object"
      ? edge.endpointLabelPositions
      : {}),
    ...(rawData.endpointLabelPositions &&
    typeof rawData.endpointLabelPositions === "object"
      ? rawData.endpointLabelPositions
      : {}),
  };

  const endpointLabelPositions =
    normalizeEndpointLabelPositions(rawEndpointPositions);
  const multicastPosition = toPointOrNull(rawData.multicastPosition);

  // puertos de origen/destino
  const labelStart = clampLabel(
    rawData.labelStart || endpointLabels.source || ""
  );
  const labelEnd = clampLabel(rawData.labelEnd || endpointLabels.target || "");
  if (labelStart) {
    endpointLabels = { ...endpointLabels, source: labelStart };
  }
  if (labelEnd) {
    endpointLabels = { ...endpointLabels, target: labelEnd };
  }

  // handles saneados
  const sourceHandle = ensureHandleId(edge.sourceHandle) || undefined;
  const targetHandle = ensureHandleId(edge.targetHandle) || undefined;

  const data = {
    ...rawData,
    label,
    direction,
    labelPosition,
    endpointLabels,
    endpointLabelPositions,
    multicastPosition,
  };

  if (labelStart) {
    data.labelStart = labelStart;
  } else if (Object.prototype.hasOwnProperty.call(data, "labelStart")) {
    delete data.labelStart;
  }
  if (labelEnd) {
    data.labelEnd = labelEnd;
  } else if (Object.prototype.hasOwnProperty.call(data, "labelEnd")) {
    delete data.labelEnd;
  }

  // 🔹 Nuevo: tooltipTitle y tooltip coherentes para ida/vuelta
  const tooltipTitle = rawData.tooltipTitle || label;

  let tooltip = rawData.tooltip;
  if (!tooltip) {
    if (labelStart && labelEnd) {
      tooltip = `Puerto origen: ${labelStart} \u2192 Puerto destino: ${labelEnd}`;
    } else if (labelStart || labelEnd) {
      tooltip = labelStart || labelEnd;
    } else if (rawData.multicast) {
      tooltip = String(rawData.multicast);
    }
  }

  data.tooltipTitle = tooltipTitle;
  if (tooltip) {
    data.tooltip = tooltip;
  } else if (Object.prototype.hasOwnProperty.call(data, "tooltip")) {
    delete data.tooltip;
  }

  return {
    id,
    source: String(edge.source),
    target: String(edge.target),
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    type: normalizeEdgeType(edge.type),
    label,
    data,
    style,
    markerEnd: withMarkerColor(edge.markerEnd, color),
    markerStart: edge.markerStart
      ? withMarkerColor(edge.markerStart, color)
      : undefined,
    animated: edge.animated ?? true,
    reconnectable: true,
  };
};
/* 🔥 FIN mapEdgeFromApi MODIFICADA */

export const toApiNode = (node) => {
  const label = clampLabel(node.data?.label ?? node.label ?? node.id);
  const data = {
    ...(node.data || {}),
    label,
  };
  if (node.data?.labelPosition) {
    data.labelPosition = node.data.labelPosition;
  }
  if (node.data?.multicastPosition) {
    data.multicastPosition = node.data.multicastPosition;
  }

  const equipoId =
    extractEquipoId(node.equipo) ??
    extractEquipoId(node.equipoId) ??
    extractEquipoId(node.data?.equipo) ??
    extractEquipoId(node.data?.equipoId);

  if (equipoId) {
    data.equipoId = equipoId;
  } else if (data.equipoId) {
    const normalized = extractEquipoId(data.equipoId);
    if (normalized) {
      data.equipoId = normalized;
    } else {
      delete data.equipoId;
    }
  }

  const handles = normalizeHandlesArray(node.handles || node.data?.handles);
  if (handles.length) {
    data.handles = handles;
  } else if (data.handles) {
    delete data.handles;
  }

  return {
    id: node.id,
    type: node.type || "custom",
    label,
    data,
    handles,
    ...(equipoId ? { equipo: equipoId } : {}),
    position: {
      x: Number.isFinite(+node.position?.x) ? +node.position.x : 0,
      y: Number.isFinite(+node.position?.y) ? +node.position.y : 0,
    },
  };
};

export const toApiEdge = (edge) => {
  const label = clampLabel(edge.data?.label || edge.label || edge.id);
  const direction = edge.data?.direction || "ida";
  const color = getEdgeColor(edge.style, direction);
  const labelPosition = edge.data?.labelPosition || null;
  const endpointLabels = edge.data?.endpointLabels || {};
  const endpointLabelPositions = edge.data?.endpointLabelPositions || {};
  const multicastPosition = edge.data?.multicastPosition || null;
  const labelStart = clampLabel(
    edge.data?.labelStart || endpointLabels.source || ""
  );
  const labelEnd = clampLabel(
    edge.data?.labelEnd || endpointLabels.target || ""
  );
  const sourceHandle = ensureHandleId(edge.sourceHandle);
  const targetHandle = ensureHandleId(edge.targetHandle);

  const data = {
    ...(edge.data || {}),
    label,
    direction,
    labelPosition,
    endpointLabels,
    endpointLabelPositions,
    multicastPosition,
  };

  if (labelStart) {
    data.labelStart = labelStart;
    data.endpointLabels = { ...data.endpointLabels, source: labelStart };
  } else if (Object.prototype.hasOwnProperty.call(data, "labelStart")) {
    delete data.labelStart;
  }

  if (labelEnd) {
    data.labelEnd = labelEnd;
    data.endpointLabels = { ...data.endpointLabels, target: labelEnd };
  } else if (Object.prototype.hasOwnProperty.call(data, "labelEnd")) {
    delete data.labelEnd;
  }

  const payload = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label,
    type: normalizeEdgeType(edge.type),
    style: edge.style || { stroke: color, strokeWidth: 2 },
    markerEnd: withMarkerColor(edge.markerEnd, color),
    markerStart: edge.markerStart
      ? withMarkerColor(edge.markerStart, color)
      : undefined,
    data,
    animated: edge.animated ?? true,
    reconnectable: true,
  };

  if (sourceHandle) {
    payload.sourceHandle = sourceHandle;
  }
  if (targetHandle) {
    payload.targetHandle = targetHandle;
  }

  if (labelPosition) {
    payload.labelPosition = labelPosition;
  }

  return payload;
};

export const prepareDiagramState = (diagram) => {
  if (!diagram) {
    return { nodes: [], edges: [] };
  }

  const mappedNodes = safeArray(diagram.nodes).map(mapNodeFromApi).filter(Boolean);
  const mappedEdges = safeArray(diagram.edges).map(mapEdgeFromApi).filter(Boolean);

  const sortedNodes = sortNodesById(mappedNodes);
  const nodeIdSet = new Set(sortedNodes.map((node) => node.id));
  const canonicalNodeIds = new Map();
  sortedNodes.forEach((node) => {
    const key =
      typeof node.id === "string"
        ? node.id.trim().toLowerCase()
        : String(node.id ?? "").trim().toLowerCase();
    if (!key) return;
    if (!canonicalNodeIds.has(key)) {
      canonicalNodeIds.set(key, new Set());
    }
    canonicalNodeIds.get(key).add(node.id);
  });

  const normalizeNodeId = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
  };

  const resolveCanonicalNodeId = (value) => {
    const trimmed = normalizeNodeId(value);
    if (!trimmed) return null;
    if (nodeIdSet.has(trimmed)) return trimmed;
    const key = trimmed.toLowerCase();
    if (!key) return null;
    const candidates = canonicalNodeIds.get(key);
    if (!candidates || candidates.size === 0) return null;
    if (candidates.size === 1) {
      return [...candidates][0];
    }
    const lower = trimmed.toLowerCase();
    const matching = [...candidates].filter(
      (id) => id.toLowerCase() === lower
    );
    if (matching.length === 1) {
      return matching[0];
    }
    return null;
  };

  const sanitizedEdges = [];
  sortEdgesById(mappedEdges).forEach((edge) => {
    const source = resolveCanonicalNodeId(edge.source);
    const target = resolveCanonicalNodeId(edge.target);
    if (!source || !target) return;

    const originalSource = normalizeNodeId(edge.source);
    const originalTarget = normalizeNodeId(edge.target);
    const needsChange =
      source !== (originalSource ?? edge.source) ||
      target !== (originalTarget ?? edge.target) ||
      (typeof edge.source === "string" &&
        edge.source.trim() !== edge.source) ||
      (typeof edge.target === "string" &&
        edge.target.trim() !== edge.target);

    if (needsChange) {
      sanitizedEdges.push({ ...edge, source, target });
    } else {
      sanitizedEdges.push(edge);
    }
  });

  const normalizedEdges = sanitizedEdges.map((edge) => {
    const withHandles = normalizeEdgeHandles(edge, sortedNodes);
    const enforced = enforceSateliteToIrd(withHandles, sortedNodes);
    return autoLabelEdge(enforced, sortedNodes);
  });

  return { nodes: sortedNodes, edges: normalizedEdges };
};

export const clampPositionWithinBounds = (pos, bounds) => {
  if (!pos || typeof pos !== "object") return pos;
  const next = { x: Number(pos.x), y: Number(pos.y) };
  if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) {
    return { x: 0, y: 0 };
  }
  if (!bounds) return next;
  const { minX, maxX, minY, maxY } = bounds;
  const clamp = (value, min, max) => {
    if (!Number.isFinite(value)) return value;
    let clamped = value;
    if (Number.isFinite(min)) clamped = Math.max(clamped, min);
    if (Number.isFinite(max)) clamped = Math.min(clamped, max);
    return clamped;
  };
  return {
    x: clamp(next.x, minX, maxX),
    y: clamp(next.y, minY, maxY),
  };
};

const mergePatch = (target, source) => {
  const result = { ...target };
  Object.keys(source || {}).forEach((key) => {
    const value = source[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = mergePatch(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

export const createPatchScheduler = (executor, { delay = 320 } = {}) => {
  const timeouts = new Map();
  const payloads = new Map();
  const contexts = new Map();

  const flush = async (key) => {
    const payload = payloads.get(key);
    const context = contexts.get(key);
    timeouts.delete(key);
    payloads.delete(key);
    contexts.delete(key);
    if (!payload) return;
    try {
      const result = await executor(key, payload);
      context?.onSuccess?.(result, payload);
    } catch (error) {
      console.error("Patch scheduler error:", error);
      try {
        context?.onError?.(error, payload);
      } catch (callbackError) {
        console.error("Patch scheduler rollback error:", callbackError);
      }
    }
  };

  const schedule = (key, patch, options = {}) => {
    if (!key) return;
    const current = payloads.get(key) || {};
    payloads.set(key, mergePatch(current, patch));

    const existingContext = contexts.get(key) || {};
    contexts.set(key, {
      onSuccess: options.onSuccess ?? existingContext.onSuccess,
      onError: options.onError ?? existingContext.onError,
    });

    if (timeouts.has(key)) {
      clearTimeout(timeouts.get(key));
    }

    timeouts.set(
      key,
      setTimeout(() => {
        flush(key);
      }, delay)
    );
  };

  const cancelAll = () => {
    for (const timeout of timeouts.values()) {
      clearTimeout(timeout);
    }
    timeouts.clear();
    payloads.clear();
    contexts.clear();
  };

  return { schedule, cancelAll, flush };
};

export const computeParallelPath = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  isReverse,
  offset = 10,
}) => {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const vertical = Math.abs(dy) >= Math.abs(dx);

  const sign = isReverse ? 1 : -1;
  const ox = vertical ? sign * offset : 0;
  const oy = vertical ? 0 : sign * offset;

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: sourceX + ox,
    sourceY: sourceY + oy,
    targetX: targetX + ox,
    targetY: targetY + oy,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  return [path, labelX + ox, labelY + oy, { ox, oy }];
};

export const resolveLabelPosition = (
  position,
  defaultPosition,
  clampPositionFn
) => {
  const basePosition =
    position &&
    typeof position === "object" &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
      ? position
      : defaultPosition;
  if (!basePosition) {
    return { x: 0, y: 0 };
  }
  return clampPositionFn ? clampPositionFn(basePosition) : basePosition;
};
