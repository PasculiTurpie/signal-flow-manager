/**
 * Configuración centralizada para el sistema de handles de React Flow
 * Este archivo debe mantenerse sincronizado con el backend
 */

export const HANDLE_CONFIG = {
  MAX_HANDLES_PER_SIDE: {
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
  },

  HANDLE_SIDES: ["top", "right", "bottom", "left"],

  HANDLE_TYPES: {
    SOURCE: "source",
    TARGET: "target",
  },

  HANDLE_KINDS: {
    IN: "in",
    OUT: "out",
  },

  // Formato: (in|out)-(left|right|top|bottom)-(index)
  // Ejemplos: in-left-1, out-right-3
  HANDLE_ID_REGEX: /^(in|out)-(left|right|top|bottom)-([1-9]\d*)$/,

  // Posiciones por defecto para handles en cada lado (porcentajes)
  HANDLE_POSITIONS: {
    left: [10, 35, 60, 85],
    right: [10, 35, 60, 85],
    top: [10, 40, 70, 90],
    bottom: [10, 40, 70, 90],
  },
};

/**
 * Crea un ID de handle con el formato correcto
 * @param {string} kind - "in" o "out"
 * @param {string} side - "left", "right", "top", "bottom"
 * @param {number} index - Índice del handle (1-based)
 * @returns {string} ID del handle
 */
export const makeHandleId = (kind, side, index) => {
  return `${kind}-${side}-${index}`;
};

/**
 * Parsea un ID de handle y extrae sus componentes
 * @param {string} handleId - ID del handle a parsear
 * @returns {object|null} { kind, side, index } o null si es inválido
 */
export const parseHandleId = (handleId = "") => {
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
export const isValidHandleId = (handleId) => {
  return HANDLE_CONFIG.HANDLE_ID_REGEX.test(String(handleId || ""));
};

/**
 * Obtiene el tipo de handle (source/target) basado en el kind (in/out)
 * @param {string} kind - "in" o "out"
 * @returns {string} "source" o "target"
 */
export const getHandleType = (kind) => {
  return kind === HANDLE_CONFIG.HANDLE_KINDS.OUT
    ? HANDLE_CONFIG.HANDLE_TYPES.SOURCE
    : HANDLE_CONFIG.HANDLE_TYPES.TARGET;
};

/**
 * Obtiene el kind (in/out) basado en el tipo de handle (source/target)
 * @param {string} type - "source" o "target"
 * @returns {string} "in" o "out"
 */
export const getHandleKind = (type) => {
  return type === HANDLE_CONFIG.HANDLE_TYPES.SOURCE
    ? HANDLE_CONFIG.HANDLE_KINDS.OUT
    : HANDLE_CONFIG.HANDLE_KINDS.IN;
};
