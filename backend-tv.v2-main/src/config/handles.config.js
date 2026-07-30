/**
 * Configuración centralizada para el sistema de handles
 * Este archivo debe mantenerse sincronizado con el frontend
 */

const HANDLE_CONFIG = {
  MAX_HANDLES_PER_SIDE: {
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
  },

  HANDLE_SIDES: ["top", "right", "bottom", "left"],

  HANDLE_TYPES: ["source", "target"],

  HANDLE_KINDS: {
    IN: "in",
    OUT: "out",
  },

  // Formato: (in|out)-(left|right|top|bottom)-(index)
  HANDLE_ID_REGEX: /^(in|out)-(left|right|top|bottom)-([1-9]\d*)$/,

  // Máximo índice permitido por defecto (fallback)
  FALLBACK_MAX_HANDLE_INDEX: 4,
};

/**
 * Mapeo de kind a type
 */
const HANDLE_KIND_TO_TYPE = {
  in: "target",
  out: "source",
};

/**
 * Mapeo de type a kind
 */
const HANDLE_TYPE_TO_KIND = {
  target: "in",
  source: "out",
};

/**
 * Crea un ID de handle con el formato correcto
 * @param {string} kind - "in" o "out"
 * @param {string} side - "left", "right", "top", "bottom"
 * @param {number} index - Índice del handle (1-based)
 * @returns {string} ID del handle
 */
const makeHandleId = (kind, side, index) => {
  return `${kind}-${side}-${index}`;
};

/**
 * Parsea un ID de handle y extrae sus componentes
 * @param {string} handleId - ID del handle a parsear
 * @returns {object|null} { kind, side, index } o null si es inválido
 */
const parseHandleId = (handleId = "") => {
  const match = String(handleId).match(HANDLE_CONFIG.HANDLE_ID_REGEX);
  if (!match) return null;
  return {
    kind: match[1],
    side: match[2],
    index: Number(match[3]),
  };
};

/**
 * Valida si un ID de handle es válido
 * @param {string} handleId - ID del handle a validar
 * @returns {boolean} true si es válido
 */
const isValidHandleId = (handleId) => {
  return HANDLE_CONFIG.HANDLE_ID_REGEX.test(String(handleId || ""));
};

/**
 * Obtiene el tipo de handle (source/target) basado en el kind (in/out)
 * @param {string} kind - "in" o "out"
 * @returns {string} "source" o "target"
 */
const getHandleType = (kind) => {
  return HANDLE_KIND_TO_TYPE[kind] || null;
};

/**
 * Obtiene el kind (in/out) basado en el tipo de handle (source/target)
 * @param {string} type - "source" o "target"
 * @returns {string} "in" o "out"
 */
const getHandleKind = (type) => {
  return HANDLE_TYPE_TO_KIND[type] || null;
};

module.exports = {
  HANDLE_CONFIG,
  HANDLE_KIND_TO_TYPE,
  HANDLE_TYPE_TO_KIND,
  makeHandleId,
  parseHandleId,
  isValidHandleId,
  getHandleType,
  getHandleKind,
};
