// routes/tipoEquipo.routes.js
const express = require("express");
const TipoEquipoController = require("../controllers/tipoEquipo.controller");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router
  .route("/tipo-equipo")
  .get(TipoEquipoController.getTipoEquipo)
  .post(authRequired, requireAdmin, TipoEquipoController.createTipoEquipo);

// ✅ NUEVO: buscar por nombre (antes de /:id)
router
  .route("/tipo-equipo/by-name/:name")
  .get(TipoEquipoController.getTipoEquipoByName);

router
  .route("/tipo-equipo/:id")
  .get(TipoEquipoController.getTipoEquipoById)
  .put(authRequired, requireAdmin, TipoEquipoController.updateTipoEquipo)
  .delete(authRequired, requireAdmin, TipoEquipoController.deleteTipoEquipo);

module.exports = router;
