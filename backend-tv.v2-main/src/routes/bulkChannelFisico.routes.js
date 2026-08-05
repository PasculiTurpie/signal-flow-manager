const express = require("express");
const upload = require("../middleware/multerConfig");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");
const { bulkCreateChannelsFisico } = require("../controllers/bulkChannelFisico.controller");

const router = express.Router();

// Modo dry-run por defecto (no escribe nada, solo reporta).
// Para escribir de verdad: POST /channels/bulk-create-fisico?commit=true
router.post("/channels/bulk-create-fisico", authRequired, requireAdmin, upload.single("file"), bulkCreateChannelsFisico);

module.exports = router;
