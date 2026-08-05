const express = require("express");
const router = express.Router();
const upload = require("../middleware/multerConfig");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");
const {
  bulkCreateIrds,
  validateExcelFormat,
} = require("../controllers/bulkIrd.controller");

// Ruta para validar formato del Excel
router.post("/irds/validate-excel", authRequired, requireAdmin, upload.single("file"), validateExcelFormat);

// Ruta para carga masiva
router.post("/irds/bulk-create", authRequired, requireAdmin, upload.single("file"), bulkCreateIrds);

module.exports = router;
