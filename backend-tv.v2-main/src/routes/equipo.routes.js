const express = require("express");
const EquipoController = require("../controllers/equipo.controller");

const router = express.Router();

router
  .route("/equipos")
  .get(EquipoController.getEquipo)
  .post(EquipoController.createEquipo);

router
  .route("/equipos/:id")
  .get(EquipoController.getIdEquipo)
  .put(EquipoController.updateEquipo)
  .delete(EquipoController.deleteEquipo);

module.exports = router;
