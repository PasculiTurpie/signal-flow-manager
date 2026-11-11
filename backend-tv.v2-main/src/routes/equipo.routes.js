const express = require("express");
const EquipoController = require("../controllers/equipo.controller");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router
  .route("/equipos")
  .get(EquipoController.getEquipo)
  .post(authRequired, requireAdmin, EquipoController.createEquipo);

router
  .route("/equipos/:id")
  .get(EquipoController.getIdEquipo)
  .put(authRequired, requireAdmin, EquipoController.updateEquipo)
  .delete(authRequired, requireAdmin, EquipoController.deleteEquipo);

module.exports = router;
