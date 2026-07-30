const express = require("express");
const router = express.Router();
const upload = require("../middleware/multerConfig");
const {
  bulkCreateIrds,
  validateExcelFormat,
} = require("../controllers/bulkIrd.controller");

// Ruta para validar formato del Excel
router.post("/irds/validate-excel", upload.single("file"), validateExcelFormat);

// Ruta para carga masiva
router.post("/irds/bulk-create", upload.single("file"), bulkCreateIrds);

module.exports = router;
