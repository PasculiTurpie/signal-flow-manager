const AuditLog = require("../src/models/auditLog.model");

module.exports.getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      resource,
      userEmail,
      resourceId,
      from, // ISO date string
      to, // ISO date string
      q, // texto libre: buscar en endpoint / meta / userAgent
    } = req.query;

    const filter = {};

    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (userEmail) filter.userEmail = new RegExp(userEmail, "i");
    if (resourceId) filter.resourceId = resourceId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (q) {
      filter.$or = [
        { endpoint: new RegExp(q, "i") },
        { userAgent: new RegExp(q, "i") },
        { "meta.query": new RegExp(q, "i") }, // si guardaste query string en meta
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      items,
    });
  } catch (error) {
    console.error("getAuditLogs error:", error);
    res.status(500).json({ message: "Error al obtener auditoría" });
  }
};
