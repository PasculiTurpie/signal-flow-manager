const express = require("express");
const upload = require("../middleware/multerConfig");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");
const { bulkCreateSignals, validateExcelFormat } = require("../controllers/bulkSignal.controller");

const router = express.Router();

router.post("/signals/validate-excel", authRequired, requireAdmin, upload.single("file"), validateExcelFormat);
router.post("/signals/bulk-create", authRequired, requireAdmin, upload.single("file"), bulkCreateSignals);

module.exports = router;
