const PROHIBITED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function shouldStripKey(key) {
  if (!key) return false;
  if (PROHIBITED_KEYS.has(key)) return true;
  return key.startsWith("$");
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeObject(input) {
  if (Array.isArray(input)) {
    return input.map(sanitizeValue);
  }

  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (shouldStripKey(key)) {
      continue;
    }

    output[key] = sanitizeValue(value);
  }

  return output;
}

function sanitizeTarget(target) {
  if (!target || typeof target !== "object") {
    return target;
  }

  return sanitizeObject(target);
}

module.exports = function sanitizeRequest(req, _res, next) {
  if (req.body) {
    req.body = sanitizeTarget(req.body);
  }

  if (req.query) {
    req.query = sanitizeTarget(req.query);
  }

  if (req.params) {
    req.params = sanitizeTarget(req.params);
  }

  return next();
};
