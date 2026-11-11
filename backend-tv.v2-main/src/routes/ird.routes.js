// routes/ird.routes.js
const express = require("express");
const IrdController = require("../controllers/ird.controller");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router
  .route("/irds")
  .get(IrdController.getIrd)
  .post(authRequired, requireAdmin, IrdController.createIrd);

router
  .route("/irds/:id")
  .get(IrdController.getIdIrd)
  .put(authRequired, requireAdmin, IrdController.updateIrd)
  .delete(authRequired, requireAdmin, IrdController.deleteIrd);

module.exports = router;