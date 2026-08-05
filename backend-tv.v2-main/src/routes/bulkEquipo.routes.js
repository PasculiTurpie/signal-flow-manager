const express = require("express");
const upload = require("../middleware/multerConfig");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");
const { bulkCreateEquipos, validateExcelFormat } = require("../controllers/bulkEquipo.controller");

const router = express.Router();

router.post("/equipos/validate-excel", authRequired, requireAdmin, upload.single("file"), validateExcelFormat);
router.post("/equipos/bulk-create", authRequired, requireAdmin, upload.single("file"), bulkCreateEquipos);

module.exports = router;
