// middlewares/requireAdmin.js
// Debe usarse después de authRequired (necesita req.user ya poblado).
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      error: "forbidden",
      message: "Esta acción requiere permisos de administrador.",
    });
  }
  return next();
}

module.exports = { requireAdmin };
