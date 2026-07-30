const express = require("express");
const router = express.Router();
const {
  getAuditLogs,
  exportAuditCSV,
} = require("../controllers/audit.controller");
const { authProfile } = require("../middleware/validateToken");

// Listado + filtros (público o protegido, según prefieras)
router.get("/audits", getAuditLogs);

// Export CSV (mantengo protegido con authProfile)
router.get("/audits/export", authProfile, exportAuditCSV);

module.exports = router;
