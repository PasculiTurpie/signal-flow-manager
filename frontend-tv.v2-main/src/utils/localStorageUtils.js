/**
 * Default set of keys that should be preserved when clearing localStorage.
 * Adjust this list to match the data your application needs to keep.
 */
const DEFAULT_PRESERVE_LOCAL_STORAGE_KEYS = [
  "auth:user",
  "theme",
  "ui:sidebarOpen",
  "reactflow:viewport",
  "persist:store",
];

const toPreserveKeySet = (preserveKeys) => {
  if (preserveKeys instanceof Set) {
    return preserveKeys;
  }
  if (Array.isArray(preserveKeys)) {
    return new Set(preserveKeys);
  }
  if (typeof preserveKeys === "string") {
    return new Set([preserveKeys]);
  }
  if (preserveKeys && typeof preserveKeys === "object") {
    return new Set(Object.values(preserveKeys));
  }
  return new Set();
};

const clearLocalStorage = (preserveKeys = DEFAULT_PRESERVE_LOCAL_STORAGE_KEYS) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    const storage = window.localStorage;
    const keysToKeep = toPreserveKeySet(preserveKeys);

    if (keysToKeep.size === 0) {
      storage.clear();
    } else {
      const keys = Object.keys(storage);
      keys.forEach((key) => {
        if (!keysToKeep.has(key)) {
          storage.removeItem(key);
        }
      });
    }

    return true;
  } catch (error) {
    console.warn("No se pudo limpiar localStorage:", error);
    return false;
  }
};

export { DEFAULT_PRESERVE_LOCAL_STORAGE_KEYS, clearLocalStorage };
