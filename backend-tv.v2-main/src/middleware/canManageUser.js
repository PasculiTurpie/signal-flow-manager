// middlewares/canManageUser.js
// Debe usarse después de authRequired. Permite la acción si:
// - el usuario autenticado es admin, o
// - el usuario autenticado edita su propio perfil y no intenta cambiar el rol.
function canManageUser(req, res, next) {
  const isAdmin = req.user?.role === "admin";
  if (isAdmin) return next();

  const requesterId = String(req.user?._id || req.user?.id || "");
  const targetId = String(req.params.id || "");
  const isSelf = requesterId && requesterId === targetId;

  if (isSelf && req.body?.role === undefined) return next();

  return res.status(403).json({
    error: "forbidden",
    message: "No tienes permisos para modificar este usuario.",
  });
}

module.exports = { canManageUser };
