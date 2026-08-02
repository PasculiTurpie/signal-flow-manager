const express = require("express");
const upload = require("../middleware/multerConfig");
const { bulkCreateEquipos, validateExcelFormat } = require("../controllers/bulkEquipo.controller");

const router = express.Router();

router.post("/equipos/validate-excel", upload.single("file"), validateExcelFormat);
router.post("/equipos/bulk-create", upload.single("file"), bulkCreateEquipos);

module.exports = router;
