// routes/tipoEquipo.routes.js
const express = require("express");
const TipoEquipoController = require("../controllers/tipoEquipo.controller");

const router = express.Router();

router
  .route("/tipo-equipo")
  .get(TipoEquipoController.getTipoEquipo)
  .post(TipoEquipoController.createTipoEquipo);

// ✅ NUEVO: buscar por nombre (antes de /:id)
router
  .route("/tipo-equipo/by-name/:name")
  .get(TipoEquipoController.getTipoEquipoByName);

router
  .route("/tipo-equipo/:id")
  .get(TipoEquipoController.getTipoEquipoById)
  .put(TipoEquipoController.updateTipoEquipo)
  .delete(TipoEquipoController.deleteTipoEquipo);

module.exports = router;
