// Mapea "in-left" -> "in-left-1", "out-right" -> "out-right-1", etc.
// Si ya viene con índice (-1, -2, …), lo deja igual.
// Consulta `pages/ChannelDiagram/handleConstants.js` para la lista de IDs canónicos.
const SIDES = new Set(["top", "bottom", "left", "right"]);

const buildCanonicalId = (direction, side, index) => {
  if (!direction || !side || !SIDES.has(side)) return null;
  const numericIndex = Number.parseInt(index, 10);
  const safeIndex = Number.isFinite(numericIndex) && numericIndex > 0 ? numericIndex : 1;
  return `${direction}-${side}-${safeIndex}`;
};

const normalizeHandle = (handle) => {
  if (handle === undefined || handle === null) return undefined;

  const value = String(handle).trim();
  if (!value) return undefined;

  const lower = value.toLowerCase();

  // ✨ Descartar literales inválidos comunes
  if (lower === "null" || lower === "undefined" || lower === "none" || lower === "na") {
    return undefined;
  }

  const canonical = lower.replace(/[_\s]+/g, "-");

  const directMatch = /^(in|out)-(top|bottom|left|right)(?:-(\d+))?$/.exec(canonical);
  if (directMatch) {
    return buildCanonicalId(directMatch[1], directMatch[2], directMatch[3]);
  }

  const srcPrefixMatch = /^(src|source)-(top|bottom|left|right)(?:-(\d+))?$/.exec(canonical);
  if (srcPrefixMatch) {
    return buildCanonicalId("out", srcPrefixMatch[2], srcPrefixMatch[3]);
  }

  const tgtPrefixMatch = /^(tgt|target)-(top|bottom|left|right)(?:-(\d+))?$/.exec(canonical);
  if (tgtPrefixMatch) {
    return buildCanonicalId("in", tgtPrefixMatch[2], tgtPrefixMatch[3]);
  }

  const srcSuffixMatch = /^(top|bottom|left|right)-(src|source)(?:-(\d+))?$/.exec(canonical);
  if (srcSuffixMatch) {
    return buildCanonicalId("out", srcSuffixMatch[1], srcSuffixMatch[3]);
  }

  const tgtSuffixMatch = /^(top|bottom|left|right)-(tgt|target)(?:-(\d+))?$/.exec(canonical);
  if (tgtSuffixMatch) {
    return buildCanonicalId("in", tgtSuffixMatch[1], tgtSuffixMatch[3]);
  }

  const collapsed = canonical.replace(/-/g, "");

  const directCollapsedMatch = /^(in|out)(top|bottom|left|right)(\d+)?$/.exec(collapsed);
  if (directCollapsedMatch) {
    return buildCanonicalId(
      directCollapsedMatch[1],
      directCollapsedMatch[2],
      directCollapsedMatch[3]
    );
  }

  const srcCollapsedMatch = /^(src|source)(top|bottom|left|right)(\d+)?$/.exec(collapsed);
  if (srcCollapsedMatch) {
    return buildCanonicalId("out", srcCollapsedMatch[2], srcCollapsedMatch[3]);
  }

  const tgtCollapsedMatch = /^(tgt|target)(top|bottom|left|right)(\d+)?$/.exec(collapsed);
  if (tgtCollapsedMatch) {
    return buildCanonicalId("in", tgtCollapsedMatch[2], tgtCollapsedMatch[3]);
  }

  // Mantiene el identificador original para manejadores personalizados
  // (ya filtramos "null"/"undefined"/"none"/"na" arriba).
  return value;
};

export default normalizeHandle;
