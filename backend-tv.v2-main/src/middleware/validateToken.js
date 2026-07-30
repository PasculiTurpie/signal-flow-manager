const jwt = require("jsonwebtoken");
const User = require("../models/users.model");

const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || null;

function ensureJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error(
      "Missing JWT_ACCESS_SECRET environment variable. Configure your secrets before validating tokens."
    );
  }
}

function getTokenFromReq(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  if (req.cookies?.access_token) return req.cookies.access_token;
  if (req.cookies?.token) return req.cookies.token;
  if (req.headers?.["x-access-token"]) return req.headers["x-access-token"];
  return null;
}

async function authProfile(req, res, next) {
  try {
    ensureJwtSecret();

    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, JWT_SECRET);
    const uid = payload._id || payload.id || payload.sub;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(uid).lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = {
      _id: user._id,
      email: user.email || payload.email || null,
      role: user.role || payload.role || null,
      username: user.username || payload.username || null,
      profilePicture: user.profilePicture || null,
    };

    next();
  } catch (error) {
    if (error.message?.includes("Missing JWT_ACCESS_SECRET")) {
      return res.status(500).json({
        message:
          "JWT_ACCESS_SECRET no está configurado en el servidor. Contacta al administrador.",
      });
    }
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { authProfile };
