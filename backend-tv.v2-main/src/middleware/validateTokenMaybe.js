// Intenta decodificar el token y popular req.user,
// pero NUNCA corta el flujo (no responde 401).
// Soporta Authorization: Bearer, cookie access_token, x-access-token.

const { verifyAccess } = require("../../utils/jwt");

function getToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) {
    const tok = h.slice(7).trim();
    if (tok) return tok;
  }
  if (req.cookies?.access_token) return req.cookies.access_token;
  if (req.cookies?.token) return req.cookies.token; // compat
  if (req.headers?.["x-access-token"]) return req.headers["x-access-token"];
  return null;
}

function normalizePayload(p) {
  if (!p || typeof p !== "object") return null;
  const id = p._id || p.id || p.sub || null;
  return {
    _id: id || null,
    id: id || null,
    email: p.email || p.userEmail || null,
    username: p.username || p.name || null,
    role: p.role || null,
  };
}

module.exports = function validateTokenMaybe(req, _res, next) {
  try {
    const token = getToken(req);
    if (!token) {
      req.user = null;
      return next();
    }
    const payload = verifyAccess(token);
    req.user = normalizePayload(payload);
    return next();
  } catch (_e) {
    req.user = null;
    return next();
  }
};
