const express = require("express");
const upload = require("../middleware/multerConfig");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");
const { bulkCreateTipoEquipos, validateExcelFormat } = require("../controllers/bulkTipoEquipo.controller");

const router = express.Router();

router.post("/tipoequipos/validate-excel", authRequired, requireAdmin, upload.single("file"), validateExcelFormat);
router.post("/tipoequipos/bulk-create", authRequired, requireAdmin, upload.single("file"), bulkCreateTipoEquipos);

module.exports = router;
