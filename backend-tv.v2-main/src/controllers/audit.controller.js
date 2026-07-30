const AuditLog = require("../models/auditLog.model");

function toRegex(val) {
  return val ? new RegExp(String(val).trim(), "i") : undefined;
}

exports.getAuditLogs = async (req, res) => {
  try {
    const {
      q,
      userId,
      email,
      action,
      method,
      ip,
      resource,
      status,
      statusMin,
      statusMax,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
      sort = "-createdAt",
    } = req.query;

    const query = {};

    if (q) {
      // búsqueda libre
      query.$or = [
        { userEmail: toRegex(q) },
        { resource: toRegex(q) },
        { endpoint: toRegex(q) },
        { ip: toRegex(q) },
        { action: toRegex(q) },
      ];
    }

    if (userId) query.userId = userId;
    if (email) query.userEmail = toRegex(email);
    if (action) query.action = action;
    if (method) query.method = method.toUpperCase();
    if (ip) query.ip = toRegex(ip);
    if (resource) query.resource = toRegex(resource);

    // status exacto o rango
    if (status) query.statusCode = Number(status);
    if (statusMin || statusMax) {
      query.statusCode = query.statusCode || {};
      if (statusMin) query.statusCode.$gte = Number(statusMin);
      if (statusMax) query.statusCode.$lte = Number(statusMax);
    }

    // rango de fechas
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const pg = Math.max(+page, 1);
    const lim = Math.max(+limit, 1);
    const skip = (pg - 1) * lim;

    const [data, total] = await Promise.all([
      AuditLog.find(query).sort(sort).skip(skip).limit(lim),
      AuditLog.countDocuments(query),
    ]);

    const pages = Math.max(Math.ceil(total / lim), 1);

    res.json({
      data,
      meta: { page: pg, pages, limit: lim, total, sort },
    });
  } catch (e) {
    console.error("getAuditLogs error:", e);
    res.status(500).json({ message: "Error al obtener auditoría" });
  }
};

exports.exportAuditCSV = async (_req, res) => {
  try {
    const logs = await AuditLog.find({}).sort("-createdAt").limit(5000);

    let csv =
      "createdAt,userEmail,action,method,resource,endpoint,statusCode,ip\n";
    for (const r of logs) {
      const line = [
        r.createdAt?.toISOString() || "",
        r.userEmail || "",
        r.action || "",
        r.method || "",
        r.resource || "",
        r.endpoint || "",
        r.statusCode ?? "",
        r.ip || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
      csv += line + "\n";
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit.csv"`);
    res.send(csv);
  } catch (e) {
    console.error("exportAuditCSV error:", e);
    res.status(500).json({ message: "No se pudo exportar CSV" });
  }
};
