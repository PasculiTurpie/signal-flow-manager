const express = require("express");
const {
  getServicesForHost,
  getServicesForMultipleHosts,
} = require("../controllers/titans.controller");

const router = express.Router();

router.get("/services", getServicesForHost);
router.get("/services/multi", getServicesForMultipleHosts);

module.exports = router;
