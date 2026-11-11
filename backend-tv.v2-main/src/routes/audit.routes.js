const express = require("express");
const router = express.Router();
const {
  getAuditLogs,
  exportAuditCSV,
} = require("../controllers/audit.controller");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");

// Listado + filtros — antes era público, ahora solo admin (son logs sensibles)
router.get("/audits", authRequired, requireAdmin, getAuditLogs);

// Export CSV
router.get("/audits/export", authRequired, requireAdmin, exportAuditCSV);

module.exports = router;
