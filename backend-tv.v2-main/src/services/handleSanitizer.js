const HANDLE_SIDES = Object.freeze(["top", "right", "bottom", "left"]);
const HANDLE_TYPES = Object.freeze(["source", "target"]);

const HANDLE_DEFAULTS = Object.freeze({
  top: { topPct: 0, leftPct: 50 },
  right: { topPct: 50, leftPct: 100 },
  bottom: { topPct: 100, leftPct: 50 },
  left: { topPct: 50, leftPct: 0 },
});

const HANDLE_SIDE_SET = new Set(HANDLE_SIDES);

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const buildCanonicalHandleId = (direction, side, index) => {
  if (!direction || !side || !HANDLE_SIDE_SET.has(side)) return null;
  const numericIndex = Number.parseInt(index, 10);
  const safeIndex = Number.isFinite(numericIndex) && numericIndex > 0 ? numericIndex : 1;
  return `${direction}-${side}-${safeIndex}`;
};

const normalizeHandleId = (handleId) => {
  if (handleId === undefined || handleId === null) return undefined;

  const value = String(handleId).trim();
  if (!value) return undefined;

  const lower = value.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "none" || lower === "na") {
    return undefined;
  }

  const canonical = lower.replace(/[_\s]+/g, "-");

  const directMatch = /^(in|out)-(top|bottom|left|right)(?:-(\d+))?$/.exec(canonical);
  if (directMatch) {
    return buildCanonicalHandleId(directMatch[1], directMatch[2], directMatch[3]);
  }

  const srcPrefixMatch = /^(src|source)-(top|bottom|left|right)(?:-(\d+))?$/.exec(canonical);
  if (srcPrefixMatch) {
    return buildCanonicalHandleId("out", srcPrefixMatch[2], srcPrefixMatch[3]);
  }

  const tgtPrefixMatch = /^(tgt|target)-(top|bottom|left|right)(?:-(\d+))?$/.exec(canonical);
  if (tgtPrefixMatch) {
    return buildCanonicalHandleId("in", tgtPrefixMatch[2], tgtPrefixMatch[3]);
  }

  const srcSuffixMatch = /^(top|bottom|left|right)-(src|source)(?:-(\d+))?$/.exec(canonical);
  if (srcSuffixMatch) {
    return buildCanonicalHandleId("out", srcSuffixMatch[1], srcSuffixMatch[3]);
  }

  const tgtSuffixMatch = /^(top|bottom|left|right)-(tgt|target)(?:-(\d+))?$/.exec(canonical);
  if (tgtSuffixMatch) {
    return buildCanonicalHandleId("in", tgtSuffixMatch[1], tgtSuffixMatch[3]);
  }

  const collapsed = canonical.replace(/-/g, "");

  const directCollapsedMatch = /^(in|out)(top|bottom|left|right)(\d+)?$/.exec(collapsed);
  if (directCollapsedMatch) {
    return buildCanonicalHandleId(
      directCollapsedMatch[1],
      directCollapsedMatch[2],
      directCollapsedMatch[3]
    );
  }

  const srcCollapsedMatch = /^(src|source)(top|bottom|left|right)(\d+)?$/.exec(collapsed);
  if (srcCollapsedMatch) {
    return buildCanonicalHandleId("out", srcCollapsedMatch[2], srcCollapsedMatch[3]);
  }

  const tgtCollapsedMatch = /^(tgt|target)(top|bottom|left|right)(\d+)?$/.exec(collapsed);
  if (tgtCollapsedMatch) {
    return buildCanonicalHandleId("in", tgtCollapsedMatch[2], tgtCollapsedMatch[3]);
  }

  const indexedFallback = /^(in|out)-(top|bottom|left|right)-(\d+)$/.exec(canonical);
  if (indexedFallback) {
    return buildCanonicalHandleId(indexedFallback[1], indexedFallback[2], indexedFallback[3]);
  }

  const sideOnlyFallback = /^(in|out)-(top|bottom|left|right)$/.exec(canonical);
  if (sideOnlyFallback) {
    return buildCanonicalHandleId(sideOnlyFallback[1], sideOnlyFallback[2], 1);
  }

  return value;
};

const inferTypeFromHandleId = (handleId) => {
  const normalized = normalizeString(handleId);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower.startsWith("in-")) return "target";
  if (lower.startsWith("out-")) return "source";
  return null;
};

const inferSideFromHandleId = (handleId) => {
  const normalized = normalizeString(handleId);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower.includes("-left")) return "left";
  if (lower.includes("-right")) return "right";
  if (lower.includes("-top")) return "top";
  if (lower.includes("-bottom")) return "bottom";
  return null;
};

const clampPercentage = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return Number(fallback ?? 0);
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Number(num.toFixed(3));
};

const sanitizeHandleEntry = (entry = {}, fallback = {}) => {
  const rawId = normalizeString(entry.id ?? fallback.id);
  const id = normalizeHandleId(rawId);
  if (!id) return null;

  const candidateType =
    normalizeString(entry.type ?? fallback.type) || inferTypeFromHandleId(id);
  const type = candidateType ? candidateType.toLowerCase() : null;
  if (!type || !HANDLE_TYPES.includes(type)) return null;

  const candidateSide =
    normalizeString(entry.side ?? fallback.side) || inferSideFromHandleId(id);
  const side = candidateSide ? candidateSide.toLowerCase() : null;
  if (!side || !HANDLE_SIDES.includes(side)) return null;

  const defaults = HANDLE_DEFAULTS[side] || { topPct: 50, leftPct: 50 };
  const topPct = clampPercentage(entry.topPct, fallback.topPct ?? defaults.topPct);
  const leftPct = clampPercentage(entry.leftPct, fallback.leftPct ?? defaults.leftPct);

  return {
    id,
    type,
    side,
    topPct,
    leftPct,
  };
};

const iterateHandles = (handles, visitor) => {
  if (Array.isArray(handles)) {
    handles.forEach((entry) => visitor(entry));
    return;
  }

  if (handles && typeof handles === "object") {
    HANDLE_TYPES.forEach((type) => {
      const entries = handles?.[type];
      HANDLE_SIDES.forEach((side) => {
        const list = Array.isArray(entries?.[side]) ? entries[side] : [];
        list.forEach((value) => {
          if (typeof value === "string") {
            visitor({ id: value, type, side });
          } else if (value && typeof value === "object") {
            visitor({ ...value, type: value.type ?? type, side: value.side ?? side });
          }
        });
      });
    });
  }
};

const sanitizeHandles = (handles = [], fallback = []) => {
  const fallbackMap = new Map();
  (Array.isArray(fallback) ? fallback : []).forEach((item) => {
    const candidate =
      typeof item === "string" ? item : item?.id ?? item?.handleId;
    const normalizedId = normalizeHandleId(candidate);
    if (normalizedId) {
      fallbackMap.set(normalizedId, item);
    }
  });

  const seen = new Set();
  const result = [];
  iterateHandles(handles, (entry) => {
    const fallbackKey = normalizeHandleId(entry?.id ?? entry?.handleId);
    const normalized = sanitizeHandleEntry(
      entry,
      fallbackKey ? fallbackMap.get(fallbackKey) || {} : {}
    );
    if (!normalized) return;
    const dedupeKey = `${normalized.id}|${normalized.type}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push(normalized);
  });

  return result.slice(0, 64);
};

const normalizeHandles = (handles = []) => sanitizeHandles(handles);

module.exports = {
  HANDLE_SIDES,
  HANDLE_TYPES,
  HANDLE_DEFAULTS,
  normalizeHandleId,
  inferTypeFromHandleId,
  inferSideFromHandleId,
  clampPercentage,
  sanitizeHandleEntry,
  sanitizeHandles,
  normalizeHandles,
};
