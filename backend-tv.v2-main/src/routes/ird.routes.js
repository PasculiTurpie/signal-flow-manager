// routes/ird.routes.js
const express = require("express");
const IrdController = require("../controllers/ird.controller");

const router = express.Router();

router
  .route("/irds")
  .get(IrdController.getIrd)
  .post(IrdController.createIrd);

router
  .route("/irds/:id")
  .get(IrdController.getIdIrd)
  .put(IrdController.updateIrd)
  .delete(IrdController.deleteIrd);

module.exports = router;