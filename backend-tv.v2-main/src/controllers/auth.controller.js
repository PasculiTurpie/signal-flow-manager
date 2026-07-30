// controllers/auth.controller.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/users.model");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
  setAuthCookies,
  clearAuthCookies,
} = require("../../utils/jwt");

const isProd = process.env.NODE_ENV === "production";
const INVALID_CREDENTIALS = {
  error: "Credenciales inválidas",
};

// Helper: el `exp` del JWT ya viene en epoch (segundos)
const expToEpoch = (exp) => exp;

/**
 * POST /auth/login
 * - Valida credenciales
 * - Emite access/refresh tokens
 * - Setea cookies: access_token (httpOnly), refresh_token (httpOnly, path:/auth/refresh) y at_exp (legible en front)
 * - DEV: permite headers opcionales para forzar expiración corta:
 *      x-dev-access-exp: "20s" | "60" | "1m" ...
 *      x-dev-refresh-exp: "2m" | "120" ...
 */
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Credenciales requeridas" });

    const user = await User.findOne({ email })
      .select("email password username role profilePicture")
      .lean();

    if (!user) {
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    const userId = String(user._id);

    const accessToken = signAccessToken({
      id: userId,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken({ id: userId });
    const { exp: accessExp } = jwt.decode(accessToken);
    const { exp: refreshExp } = jwt.decode(refreshToken) || {};

    setAuthCookies(res, {
      accessToken,
      refreshToken,
      accessExpEpoch: accessExp,
      refreshExpEpoch: refreshExp,
    });

    req.user = {
      _id: userId,
      email: user.email,
      role: user.role,
    };

    return res.json({
      message: "Login ok",
      user: {
        id: userId,
        email: user.email,
        username: user.username,
        role: user.role,
        profilePicture: user.profilePicture,
      },
      access_expires_at: accessExp,
    });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

/**
 * POST /auth/refresh
 * - Usa refresh_token (cookie httpOnly) para emitir nuevos access/refresh
 * - Rota refresh cada vez (simple; si quieres anti-reutilización, guarda/valida en DB)
 * - Setea nuevamente cookies y actualiza at_exp
 * - DEV: admite overrides por headers (mismos que en login) para pruebas
 */
module.exports.refresh = async (req, res) => {
  try {
    const rt = req.cookies?.refresh_token;
    if (!rt) return res.status(401).json({ error: "no_refresh" });

    const decoded = verifyRefresh(rt); // { id: ... }

    const devAccessExp = !isProd && req.headers["x-dev-access-exp"];
    const devRefreshExp = !isProd && req.headers["x-dev-refresh-exp"];

    const accessToken = signAccessToken({ id: decoded.id }, devAccessExp || undefined);
    const refreshToken = signRefreshToken(
      { id: decoded.id },
      devRefreshExp || undefined
    );

    const { exp: accessExp } = jwt.decode(accessToken) || {};
    const { exp: refreshExp } = jwt.decode(refreshToken) || {};
    if (!accessExp) return res.status(500).json({ error: "decode_failed" });

    setAuthCookies(res, {
      accessToken,
      refreshToken,
      accessExpEpoch: expToEpoch(accessExp),
      refreshExpEpoch: expToEpoch(refreshExp),
    });

    return res.json({ message: "refreshed", access_expires_at: accessExp });
  } catch (e) {
    // refresh inválido o expirado → limpiar cookies y exigir re-login
    clearAuthCookies(res);
    return res.status(401).json({ error: "invalid_refresh" });
  }
};

/**
 * POST /auth/logout
 * - Limpia todas las cookies de auth
 */
module.exports.logout = (_req, res) => {
  try {
    clearAuthCookies(res);
    return res.json({ message: "logout_ok" });
  } catch (error) {
    console.error("Error en logout:", error);
    return res.status(500).json({ error: "No se ha podido cerrar sesión" });
  }
};

/**
 * GET /auth/profile o /auth/me
 * - Requiere middleware que valide access_token (cookie) y setee req.user
 * - Devuelve el perfil del usuario sin el hash de contraseña
 */
module.exports.profile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "no_token" });
    }
    const user = await User.findById(req.user._id).select("-password").lean();
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    return res.json({
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("Profile error:", error);
    return res.status(500).json({ error: "Error al obtener el perfil" });
  }
};

// Alias si prefieres /auth/me en las rutas
module.exports.me = module.exports.profile;
