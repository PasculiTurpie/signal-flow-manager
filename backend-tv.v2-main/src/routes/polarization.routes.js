const express = require("express");
const PolarizationController = require("../controllers/polarization.controller");

const router = express.Router();

router
  .route("/polarizations")
  .get(PolarizationController.getPolarization)
  .post(PolarizationController.createPolarization);

module.exports = router;
