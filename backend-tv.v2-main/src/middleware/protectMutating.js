// middlewares/protectMutating.js
const { authRequired } = require("./authRequired");

// Métodos que requieren autenticación
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Allowlist para endpoints públicos (ej. login/refresh)
const ALLOWLIST = [
  { method: "POST", regex: /^\/api\/v2\/auth\/login\/?$/i },
  { method: "POST", regex: /^\/api\/v2\/auth\/refresh\/?$/i },
  // Puedes decidir si logout es público o protegido. Si quieres público, descomenta:
  // { method: "POST", regex: /^\/api\/v2\/auth\/logout\/?$/i },
];

function isAllowed(req) {
  return ALLOWLIST.some(
    (r) => r.method === req.method && r.regex.test(req.originalUrl)
  );
}

function protectMutating(req, res, next) {
  // Bypass para OPTIONS/HEAD
  if (req.method === "OPTIONS" || req.method === "HEAD") return next();

  // Si está en allowlist, no protegemos
  if (isAllowed(req)) return next();

  // Si es mutante, exigir auth; si no, pasar de largo
  if (MUTATING.has(req.method)) {
    return authRequired(req, res, next);
  }
  return next();
}

module.exports = { protectMutating };
