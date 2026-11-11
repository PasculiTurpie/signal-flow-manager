const express = require("express");
const SatelliteController = require("../controllers/satellite.controller");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router
  .route("/satellites")
  .get(SatelliteController.getSatellites)
  .post(authRequired, requireAdmin, SatelliteController.postSatellite);

router
  .route("/satellites/:id")
  .get(SatelliteController.getSatelliteById)
  .put(authRequired, requireAdmin, SatelliteController.updateSatellite)
  .delete(authRequired, requireAdmin, SatelliteController.deleteSatellite);

module.exports = router;
