const express = require("express");
const upload = require("../middleware/multerConfig");
const { bulkCreateChannels, validateExcelFormat } = require("../controllers/bulkChannel.controller");

const router = express.Router();

router.post("/channels/validate-excel", upload.single("file"), validateExcelFormat);
router.post("/channels/bulk-create", upload.single("file"), bulkCreateChannels);

module.exports = router;
