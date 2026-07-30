// middlewares/authRequired.js
const { verifyAccess } = require("../../utils/jwt");

function authRequired(req, res, next) {
  try {
    // 1) Leer access token DESDE COOKIE (httpOnly)
    const token = req.cookies?.access_token;

    if (!token) {
      // No hay cookie -> no hay sesión
      return res.status(401).json({
        error: "no_token",
        message:
          "Modo de solo lectura: inicia sesión para editar diagramas o etiquetas.",
      });
    }

    // 2) Verificar firma y expiración
    const decoded = verifyAccess(token);

    // 3) Inyectar identidad en req.user
    //    Incluimos los campos más usados; ajusta si guardas más en el access token
    req.user = {
      _id: decoded.id || decoded._id,
      id: decoded.id || decoded._id, // por compatibilidad
      email: decoded.email,
      role: decoded.role,
    };

    // 4) Continuar
    return next();
  } catch (err) {
    // Firmas/expiración
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "token_expired",
        message:
          "La sesión expiró. Inicia sesión nuevamente para editar diagramas o etiquetas.",
      });
    }
    return res.status(401).json({
      error: "invalid_token",
      message:
        "No pudimos validar tu sesión. Inicia sesión para salir del modo de solo lectura.",
    });
  }
}

module.exports = { authRequired };
