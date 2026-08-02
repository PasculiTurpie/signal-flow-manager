const express = require("express");
const upload = require("../middleware/multerConfig");
const { bulkCreateSignals, validateExcelFormat } = require("../controllers/bulkSignal.controller");

const router = express.Router();

router.post("/signals/validate-excel", upload.single("file"), validateExcelFormat);
router.post("/signals/bulk-create", upload.single("file"), bulkCreateSignals);

module.exports = router;
