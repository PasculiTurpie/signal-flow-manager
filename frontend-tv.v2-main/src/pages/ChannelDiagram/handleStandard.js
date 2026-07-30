import normalizeHandle from "../../utils/normalizeHandle.js";
import { HANDLE_IDS, HANDLE_CONFIG_BY_TYPE } from "./handleConstants.js";

export const HANDLE_DIRECTIONS = Object.freeze({
  SOURCE: "source",
  TARGET: "target",
});

export const HANDLE_SIDES = Object.freeze(["top", "right", "bottom", "left"]);

const CANONICAL_HANDLE_IDS = new Set(
  Object.values(HANDLE_IDS)
    .map((value) => normalizeHandle(value))
    .filter(Boolean)
);

const TYPE_ALIASES = new Map(
  Object.entries({
    satelite: ["satélite", "sat", "satellite", "satelite"],
    router: ["routers", "rt", "rtr", "router"],
    switch: ["switches", "sw", "switch"],
    ird: ["ird"],
  }).flatMap(([key, aliases]) => aliases.map((alias) => [alias, key]))
);

const sanitizeString = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value).trim();
  return str;
};

export const toHandleTypeKey = (rawTipo) => {
  const base = (() => {
    if (!rawTipo) return "";
    if (typeof rawTipo === "string") return rawTipo;
    if (typeof rawTipo === "object") {
      if (rawTipo.tipoNombre) return rawTipo.tipoNombre;
      if (rawTipo.type) return rawTipo.type;
    }
    return String(rawTipo ?? "");
  })();

  const normalized = sanitizeString(base).toLowerCase();
  if (!normalized) return "default";
  if (TYPE_ALIASES.has(normalized)) return TYPE_ALIASES.get(normalized);
  return normalized;
};

export const inferNodeHandleType = (node) => {
  if (!node || typeof node !== "object") return "default";
  if (node.data?.equipoTipo) return toHandleTypeKey(node.data.equipoTipo);
  if (node.data?.equipo?.tipoNombre?.tipoNombre)
    return toHandleTypeKey(node.data.equipo.tipoNombre.tipoNombre);
  if (node.data?.type) return toHandleTypeKey(node.data.type);
  if (node.type) return toHandleTypeKey(node.type);
  return "default";
};

export const ensureHandleId = (handleId) => normalizeHandle(handleId) || undefined;

export const parseHandleDescriptor = (handleId) => {
  const normalized = ensureHandleId(handleId);
  if (!normalized) return null;
  const match = /^(in|out)-(top|right|bottom|left)-(\d+)$/.exec(normalized);
  if (!match) {
    return { id: normalized, direction: null, side: null, index: null };
  }
  return {
    id: normalized,
    direction: match[1] === "in" ? HANDLE_DIRECTIONS.TARGET : HANDLE_DIRECTIONS.SOURCE,
    side: match[2],
    index: Number.parseInt(match[3], 10) || 1,
  };
};

export const isCanonicalHandleId = (handleId) => {
  const normalized = ensureHandleId(handleId);
  return normalized ? CANONICAL_HANDLE_IDS.has(normalized) : false;
};

const getTypeConfig = (tipo) =>
  HANDLE_CONFIG_BY_TYPE[toHandleTypeKey(tipo)] || HANDLE_CONFIG_BY_TYPE.default;

const pickFirstHandleFromConfig = (configSection) => {
  for (const side of HANDLE_SIDES) {
    const list = configSection?.[side];
    if (Array.isArray(list) && list.length > 0) {
      const normalized = ensureHandleId(list[0]);
      if (normalized) return normalized;
    }
  }
  return undefined;
};

const matchHandleInConfig = (configSection, descriptor) => {
  if (!descriptor?.id) return undefined;
  const { id, side } = descriptor;
  if (side && Array.isArray(configSection?.[side]) && configSection[side].includes(id)) {
    return id;
  }
  for (const currentSide of HANDLE_SIDES) {
    const list = configSection?.[currentSide];
    if (Array.isArray(list) && list.includes(id)) {
      return id;
    }
  }
  return undefined;
};

export const ensureHandleForType = (
  tipo,
  handleId,
  direction = HANDLE_DIRECTIONS.SOURCE,
  sideHint
) => {
  const config = getTypeConfig(tipo);
  const descriptor = parseHandleDescriptor(handleId);
  const effectiveDirection = direction === HANDLE_DIRECTIONS.TARGET ? "target" : "source";
  const section = config[effectiveDirection] || {};

  const targetSide = sideHint || descriptor?.side || null;
  if (targetSide) {
    const candidates = section[targetSide];
    if (Array.isArray(candidates) && candidates.length > 0) {
      if (descriptor?.id && candidates.includes(descriptor.id)) {
        return descriptor.id;
      }
      const fallback = ensureHandleId(candidates[0]);
      if (fallback) return fallback;
    }
  }

  const matched = matchHandleInConfig(section, descriptor);
  if (matched) return matched;

  const fallback = pickFirstHandleFromConfig(section);
  if (fallback) return fallback;

  return descriptor?.id || undefined;
};

export const ensureEdgeHandlesForTypes = (
  edge,
  sourceType = "default",
  targetType = "default",
  defaults = {}
) => {
  const sourceCandidate = edge?.sourceHandle ?? defaults.sourceHandle ?? defaults.source;
  const targetCandidate = edge?.targetHandle ?? defaults.targetHandle ?? defaults.target;

  const sourceInfo = parseHandleDescriptor(sourceCandidate);
  const targetInfo = parseHandleDescriptor(targetCandidate);

  const sourceHandle = ensureHandleForType(
    sourceType,
    sourceInfo?.id ?? sourceCandidate,
    sourceInfo?.direction ?? HANDLE_DIRECTIONS.SOURCE,
    sourceInfo?.side
  );
  const targetHandle = ensureHandleForType(
    targetType,
    targetInfo?.id ?? targetCandidate,
    targetInfo?.direction ?? HANDLE_DIRECTIONS.TARGET,
    targetInfo?.side
  );

  return {
    sourceHandle,
    targetHandle,
  };
};

export const ensureEdgeHandlesForNodes = (edge, sourceNode, targetNode, defaults = {}) => {
  const sourceType = inferNodeHandleType(sourceNode);
  const targetType = inferNodeHandleType(targetNode);
  return ensureEdgeHandlesForTypes(edge, sourceType, targetType, defaults);
};

export const listCanonicalHandles = () => Array.from(CANONICAL_HANDLE_IDS.values());
