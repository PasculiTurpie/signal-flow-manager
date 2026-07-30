// src/middleware/attachUserIfPresent.js
const { verifyAccess } = require("../../utils/jwt");

function extractToken(req) {
  if (req.cookies?.access_token) return req.cookies.access_token;
  if (req.cookies?.token) return req.cookies.token;

  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1];

  if (req.headers?.["x-access-token"]) return req.headers["x-access-token"];

  return null;
}

function attachUserIfPresent(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = verifyAccess(token);

    req.user = {
      _id: decoded.id || decoded._id || decoded.userId || null,
      id: decoded.id || decoded._id || decoded.userId || null,
      email: decoded.email || decoded.userEmail || decoded.username || null,
      role: decoded.role || null,
    };

    return next();
  } catch (_error) {
    return next();
  }
}

module.exports = { attachUserIfPresent };
