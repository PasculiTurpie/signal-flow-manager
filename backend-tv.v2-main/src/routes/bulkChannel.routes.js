const express = require("express");
const upload = require("../middleware/multerConfig");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");
const { bulkCreateChannels, validateExcelFormat } = require("../controllers/bulkChannel.controller");

const router = express.Router();

router.post("/channels/validate-excel", authRequired, requireAdmin, upload.single("file"), validateExcelFormat);
router.post("/channels/bulk-create", authRequired, requireAdmin, upload.single("file"), bulkCreateChannels);

module.exports = router;
