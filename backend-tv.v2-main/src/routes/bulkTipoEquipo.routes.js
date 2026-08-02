const express = require("express");
const upload = require("../middleware/multerConfig");
const { bulkCreateTipoEquipos, validateExcelFormat } = require("../controllers/bulkTipoEquipo.controller");

const router = express.Router();

router.post("/tipoequipos/validate-excel", upload.single("file"), validateExcelFormat);
router.post("/tipoequipos/bulk-create", upload.single("file"), bulkCreateTipoEquipos);

module.exports = router;
