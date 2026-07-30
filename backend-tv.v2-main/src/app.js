const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { errors: celebrateErrors, isCelebrateError } = require("celebrate");

const { attachUserIfPresent } = require("./middleware/attachUserIfPresent");
const validateTokenMaybe = require("./middleware/validateTokenMaybe");
const { autoAudit } = require("./middleware/autoAudit");
const { protectMutating } = require("./middleware/protectMutating");
const sanitizeRequest = require("./middleware/sanitizeRequest");

function applySecurityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-XSS-Protection", "0");
  next();
}

const AuthRoutes = require("./routes/auth.routes");
const UserRoutes = require("./routes/user.routes");
const IrdRoutes = require("./routes/ird.routes");
const SatelliteRoutes = require("./routes/satellite.routes");
const PolarizationRoutes = require("./routes/polarization.routes");
const ContactRoutes = require("./routes/contact.routes");
const ChannelRoutes = require("./routes/channel.routes");
const SignalRoutes = require("./routes/signal.routes");
const TipoTechRoutes = require("./routes/tipoTech.routes");
const EquipoRoutes = require("./routes/equipo.routes");
const TipoEquipoRoutes = require("./routes/tipoEquipo.routes");
const AuditRoutes = require("./routes/audit.routes");
const BulkIrdRoutes = require("./routes/bulkIrd.routes");
const TitanRoutes = require("./routes/titans.routes");
const DiagramRoutes = require("./routes/diagram.routes");
const FlowRoutes = require("./routes/flow.routes");

const API_PREFIX = "/api/v1";

const app = express();

app.set("trust proxy", true);
app.disable("x-powered-by");

const defaultOrigins = [
  'https://localhost:5000',
  'https://signal-operacionestv.grupogtd.com',  
  'https://172.25.18.37',
  'http://localhost:3000',
  'http://localhost:8000'
];

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const normalizeOrigin = (origin) => {
  if (!origin) return origin;
  try {
    const { protocol, host } = new URL(origin);
    return `${protocol}//${host}`;
  } catch (_error) {
    return origin;
  }
};

const allowedOriginsSet = new Set(
  [...defaultOrigins, ...configuredOrigins].map(normalizeOrigin)
);

const allowAllOrigins = allowedOriginsSet.has("*");
if (allowAllOrigins) {
  allowedOriginsSet.delete("*");
}

const isOriginAllowed = (origin) => {
  if (allowAllOrigins) return true;
  if (!origin) return true;
  if (allowedOriginsSet.has(origin)) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOriginsSet.has(normalized);
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options(
  "*",
  cors({
    origin: allowAllOrigins
      ? true
      : Array.from(allowedOriginsSet.values()),
    credentials: true,
  })
);

app.use(cookieParser());
app.use(
  express.json({
    limit: process.env.REQUEST_PAYLOAD_LIMIT || "1mb",
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));
app.use(applySecurityHeaders);
app.use(sanitizeRequest);

app.use(attachUserIfPresent);
app.use(validateTokenMaybe);
app.use(autoAudit());

app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({ status: "ok" });
});

app.use(`${API_PREFIX}/auth`, AuthRoutes);
app.use(`${API_PREFIX}/titans`, TitanRoutes);
app.use(
  API_PREFIX,
  protectMutating,
  UserRoutes,
  IrdRoutes,
  SatelliteRoutes,
  PolarizationRoutes,
  SignalRoutes,
  ContactRoutes,
  DiagramRoutes,
  ChannelRoutes,
  TipoTechRoutes,
  EquipoRoutes,
  TipoEquipoRoutes,
  AuditRoutes,
  BulkIrdRoutes,
  FlowRoutes
);

app.use((req, res, next) => {
  if (req.originalUrl.startsWith(API_PREFIX)) {
    return res.status(404).json({
      message: "Recurso no encontrado",
      path: req.originalUrl,
    });
  }
  return next();
});

app.use(celebrateErrors());

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (isCelebrateError(err)) {
    const details = [];
    for (const segment of err.details.values()) {
      details.push(...segment.details.map((detail) => detail.message));
    }
    return res.status(400).json({
      message: "Solicitud inválida",
      errors: details,
    });
  }

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({
      message: "Origen no permitido por CORS",
      origin: req.headers?.origin || null,
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    message: "Error interno del servidor",
  });
});

module.exports = app;
