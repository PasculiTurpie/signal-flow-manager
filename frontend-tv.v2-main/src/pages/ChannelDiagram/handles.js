export const HANDLE_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9][0-9]*)$/;

const ALLOWED_KINDS = new Set(["in", "out"]);
const ALLOWED_SIDES = new Set(["left", "right", "top", "bottom"]);

export function makeHandle(kind, side, idx = 1) {
  const normalizedKind =
    kind === "target"
      ? "in"
      : kind === "source"
      ? "out"
      : String(kind || "").toLowerCase();
  const normalizedSide = String(side || "").toLowerCase();
  const safeKind = ALLOWED_KINDS.has(normalizedKind) ? normalizedKind : "out";
  const safeSide = ALLOWED_SIDES.has(normalizedSide) ? normalizedSide : "right";
  const index = Number(idx);
  const safeIndex = Number.isInteger(index) && index > 0 ? index : 1;
  return `${safeKind}-${safeSide}-${safeIndex}`;
}

export function isValidHandle(id) {
  if (typeof id !== "string") {
    return false;
  }
  const match = id.match(HANDLE_REGEX);
  if (!match) {
    return false;
  }
  const index = Number(match[3]);
  return Number.isInteger(index) && index > 0;
}

export function parseHandle(id) {
  if (!isValidHandle(id)) {
    return null;
  }
  const [, kind, side, index] = id.match(HANDLE_REGEX);
  return {
    kind,
    side,
    index: Number(index),
  };
}

export const NODE_HANDLE_MAP = Object.freeze({
  default: {
    in: ["in-top-1"],
    out: ["out-top-1"],
  },
  satelite: {
    in: [],
    out: ["out-right-1"],
  },
  ird: {
    in: ["in-left-1"],
    out: ["out-right-1"],
  },
  switch: {
    in: ["in-top-1", "in-bottom-1"],
    out: ["out-top-1", "out-bottom-1"],
  },
  router: {
    in: [
      "in-left-1",
      "in-left-2",
      "in-right-1",
      "in-right-2",
      "in-bottom-1",
    ],
    out: [
      "out-left-1",
      "out-left-2",
      "out-right-1",
      "out-right-2",
      "out-bottom-1",
    ],
  },
});

export function getHandlesForNodeType(type) {
  const key = typeof type === "string" ? type.toLowerCase() : "";
  const config = NODE_HANDLE_MAP[key] || NODE_HANDLE_MAP.default;
  return {
    in: Array.from(new Set(config.in || [])).filter(isValidHandle),
    out: Array.from(new Set(config.out || [])).filter(isValidHandle),
  };
}

export default {
  HANDLE_REGEX,
  makeHandle,
  isValidHandle,
  parseHandle,
  NODE_HANDLE_MAP,
  getHandlesForNodeType,
};
