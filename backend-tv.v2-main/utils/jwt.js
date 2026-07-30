// utils/jwt.js
const jwt = require("jsonwebtoken");

const isProd = process.env.NODE_ENV === "production";
const sameSite = isProd ? "None" : "Lax";
const DEV_FALLBACK_SECRET = "dev_insecure_secret_change_me";

function requireSecret(value, name) {
  if (!value) {
    if (!isProd) {
      console.warn(
        `[jwt] Missing ${name} in environment, using insecure fallback secret.`
      );
      return DEV_FALLBACK_SECRET;
    }
    throw new Error(`Missing required JWT secret: ${name}`);
  }
  return value;
}

function getAccessSecret() {
  return requireSecret(
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    "JWT_ACCESS_SECRET"
  );
}

function getRefreshSecret() {
  return requireSecret(
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    "JWT_REFRESH_SECRET"
  );
}

function signAccessToken(payload, expiresIn) {
  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: expiresIn || process.env.JWT_ACCESS_EXPIRES || "7d",
  });
}

function signRefreshToken(payload, expiresIn) {
  return jwt.sign(payload, getRefreshSecret(), {
    expiresIn: expiresIn || process.env.JWT_REFRESH_EXPIRES || "7d",
  });
}

function verifyAccess(token) {
  return jwt.verify(token, getAccessSecret());
}

function verifyRefresh(token) {
  return jwt.verify(token, getRefreshSecret());
}

function toMaxAge(epochSeconds) {
  if (!epochSeconds) return undefined;
  const ms = epochSeconds * 1000 - Date.now();
  if (!Number.isFinite(ms)) return undefined;
  return ms > 0 ? ms : 0;
}

function cookieOptions(overrides = {}) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    ...overrides,
  };
}

function setAuthCookies(
  res,
  { accessToken, refreshToken, accessExpEpoch, refreshExpEpoch }
) {
  res.cookie(
    "access_token",
    accessToken,
    cookieOptions({ path: "/", maxAge: toMaxAge(accessExpEpoch) })
  );

  res.cookie(
    "refresh_token",
    refreshToken,
    cookieOptions({
      path: "/api/v1/auth/refresh",
      maxAge: toMaxAge(refreshExpEpoch),
    })
  );

  res.cookie("at_exp", String(accessExpEpoch), {
    httpOnly: false,
    secure: isProd,
    sameSite,
    path: "/",
    maxAge: toMaxAge(accessExpEpoch),
  });
}

function clearAuthCookies(res) {
  const base = { secure: isProd, sameSite };
  res.clearCookie("access_token", { ...base, path: "/" });
  res.clearCookie("refresh_token", {
    ...base,
    path: "/api/v1/auth/refresh",
  });
  res.clearCookie("at_exp", { ...base, path: "/" });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccess,
  verifyRefresh,
  setAuthCookies,
  clearAuthCookies,
};
