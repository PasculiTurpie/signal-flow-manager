const express = require("express");
const SatelliteController = require("../controllers/satellite.controller");

const router = express.Router();

router
  .route("/satellites")
  .get(SatelliteController.getSatellites)
  .post(SatelliteController.postSatellite);

router
  .route("/satellites/:id")
  .get(SatelliteController.getSatelliteById)
  .put(SatelliteController.updateSatellite)
  .delete(SatelliteController.deleteSatellite);

module.exports = router;
