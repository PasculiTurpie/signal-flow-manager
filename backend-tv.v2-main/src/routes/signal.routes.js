const express = require("express");
const SignalController = require("../controllers/signal.controller");

const router = express.Router();

router
  .route("/signals")
  .get(SignalController.getSignal)
  .post(SignalController.createSignal);


router
  .route("/signals/:id")
  .get(SignalController.getIdSignal)
  .put(SignalController.updateSignal)
  .delete(SignalController.deleteSignal);

  router
  .get("/search",SignalController.searchSignals)


module.exports = router;
