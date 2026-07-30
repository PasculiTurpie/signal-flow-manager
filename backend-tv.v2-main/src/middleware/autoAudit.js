const mongoose = require("mongoose");
const AuditLog = require("../models/auditLog.model");
const User = require("../models/users.model"); // para lookup de email si falta
const { verifyAccess } = require("../../utils/jwt");

/* ------------------ Helpers token/usuario ------------------ */
function getTokenFromReq(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (typeof h === "string" && h.startsWith("Bearer "))
    return h.slice(7).trim();
  if (req.cookies?.access_token) return req.cookies.access_token;
  if (req.cookies?.token) return req.cookies.token;
  if (req.headers?.["x-access-token"]) return req.headers["x-access-token"];
  return null;
}

// Devuelve { userId, userEmail, role }.
// Si el email falta pero tenemos id, intenta buscarlo en DB.
async function pickUserFromReq(req) {
  // 1) Si ya tenemos req.user poblado por validateTokenMaybe
  if (req.user && (req.user._id || req.user.id)) {
    const userId = String(req.user._id || req.user.id);
    let userEmail = req.user.email || null;

    if (!userEmail && userId) {
      try {
        const u = await User.findById(userId).select("email").lean();
        if (u?.email) userEmail = u.email;
      } catch {}
    }
    return { userId, userEmail, role: req.user.role || null };
  }

  // 2) Intentar decodificar el token manualmente
  const token = getTokenFromReq(req);
  if (token) {
    try {
      const p = verifyAccess(token);
      const id = p._id || p.id || p.sub || null;
      let userEmail = p.email || p.userEmail || null;
      if (!userEmail && id) {
        try {
          const u = await User.findById(id).select("email").lean();
          if (u?.email) userEmail = u.email;
        } catch {}
      }
      return {
        userId: id ? String(id) : null,
        userEmail,
        role: p.role || null,
      };
    } catch {}
  }

  // 3) Fallback durante login (POST /auth/login)
  const isLogin = /\/auth\/login(?:\?|$|\/)/.test(req.originalUrl || "");
  if (isLogin && req.method === "POST" && req.body?.email) {
    return { userId: null, userEmail: req.body.email, role: null };
  }

  // 4) No hay usuario
  return { userId: null, userEmail: null, role: null };
}

/* ------------------ Helpers acción/recurso ------------------ */
function inferAction(method, path) {
  if (/\/auth\/login(?:\?|$|\/)/.test(path)) return "login";
  if (/\/auth\/logout(?:\?|$|\/)/.test(path)) return "logout";
  switch (method) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return "read";
  }
}

function safeBody(body) {
  if (!body || typeof body !== "object") return body;
  const clone = { ...body };
  ["password", "pass", "pwd", "secret"].forEach((k) => {
    if (k in clone) clone[k] = "***";
  });
  return clone;
}

function deriveResourceAndId(req) {
  const full = (req.originalUrl || "").split("?")[0];
  const cleaned = full.replace(/^\/api\/v2\/?/, "/").replace(/^\/api\/?/, "/");
  const parts = cleaned.split("/").filter(Boolean);
  const resource = parts[0] || null;

  let resourceId = req.params?.id || null;
  if (!resourceId && parts.length > 1) {
    const maybeId = parts[1];
    if (/^[0-9a-fA-F]{24}$/.test(maybeId)) resourceId = maybeId;
  }
  return { resource, resourceId };
}

/* ------------------ Helpers IP ------------------ */
// Normaliza IP, soporta cadenas con comas (XFF), ::ffff:, puertos, ::1 → 127.0.0.1
function normalizeIp(ip) {
  if (!ip) return ip;
  let out = String(ip).trim();

  if (out.includes(",")) out = out.split(",")[0].trim(); // primera IP
  const portIdx = out.lastIndexOf(":");
  const hasPortV4 =
    portIdx > -1 && out.indexOf(":") === portIdx && out.includes(".");
  if (hasPortV4) out = out.slice(0, portIdx); // quitar :port
  out = out.replace(/^::ffff:/i, ""); // ipv6 mapped
  if (out === "::1") return "127.0.0.1"; // loopback
  return out;
}

function getClientIp(req) {
  // Cloudflare
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return normalizeIp(cf);

  // Cadena de proxies estándar
  const xff = req.headers["x-forwarded-for"];
  if (xff) return normalizeIp(xff);

  // Nginx / Proxy
  const xri = req.headers["x-real-ip"];
  if (xri) return normalizeIp(xri);

  // Conexión directa
  const ra =
    req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
  return normalizeIp(ra);
}

/* ------------------ Middleware ------------------ */
const autoAudit = (fixedAction) => {
  return async (req, res, next) => {
    const started = Date.now();

    res.on("finish", async () => {
      try {
        const { userId, userEmail, role } = await pickUserFromReq(req);
        const finalEmail = userEmail || "usuario no autenticado";
        const { resource, resourceId } = deriveResourceAndId(req);
        const clientIp = getClientIp(req);

        const context =
          (res.locals && res.locals.auditContext) || req.auditContext || {};

        const resolveObjectId = (value) => {
          if (!value) return undefined;
          try {
            if (mongoose.Types.ObjectId.isValid(value)) {
              return new mongoose.Types.ObjectId(value);
            }
          } catch (error) {
            return undefined;
          }
          return undefined;
        };

        const enrichedMeta = {
          query: req.query,
          params: req.params,
          body: req.method === "GET" ? undefined : safeBody(req.body),
          durationMs: Date.now() - started,
          forwardedFor: req.headers["x-forwarded-for"] || null, // trazabilidad
          ...(context.meta ? { audit: context.meta } : {}),
        };

        await AuditLog.create({
          userId,
          userEmail: finalEmail,
          role,
          action: context.action || fixedAction || inferAction(req.method, req.originalUrl || ""),
          resource: context.resource || resource,
          resourceId: context.resourceId || resourceId,
          endpoint: req.originalUrl,
          method: req.method,
          origin: context.origin,
          channelId: resolveObjectId(context.channelId),
          operation: context.operation,
          ip: clientIp,
          userAgent: req.headers["user-agent"] || null,
          statusCode: res.statusCode,
          summaryDiff: context.summaryDiff,
          meta: enrichedMeta,
        });
      } catch (e) {
        console.error("autoAudit error:", e.message);
      }
    });

    next();
  };
};

module.exports = { autoAudit };
