const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    // Quién
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userEmail: { type: String, index: true }, // email si autenticado, o "usuario no autenticado"
    role: { type: String },

    // Dónde/Qué
    action: { type: String, index: true },
    resource: { type: String, index: true }, // p.ej. "equipo", "channels"
    resourceId: { type: String, index: true }, // id del recurso si aplica
    endpoint: { type: String }, // req.originalUrl
    method: { type: String }, // GET/POST/PUT/DELETE...

    origin: { type: String, index: true },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", index: true },
    operation: { type: String, index: true },

    // Contexto
    ip: { type: String, index: true }, // IP real normalizada
    userAgent: { type: String },
    statusCode: { type: Number },

    // Cambios (si quieres, puedes guardar diffs)
    diff: { type: Object },
    summaryDiff: { type: Object },

    // Extra (query/params/body sanitizado, duration, forwardedFor, etc.)
    meta: { type: Object },
  },
  { timestamps: true, versionKey: false }
);

// Índices útiles
AuditLogSchema.index({ createdAt: -1, action: 1, resource: 1 });

const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
module.exports = AuditLog;
