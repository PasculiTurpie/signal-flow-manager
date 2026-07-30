const express = require("express");
const TipoTechController = require("../controllers/tipoTech.controller");

const router = express.Router();

const basePaths = ["/type-tech"]; // alias para compatibilidad

basePaths.forEach((path) => {
  router
    .route(path)
    .get(TipoTechController.getTech)
    .post(TipoTechController.createTech);

  router
    .route(`${path}/:id`)
    .get(TipoTechController.getTechById)
    .put(TipoTechController.updateTech)
    .delete(TipoTechController.deleteTech);
});

module.exports = router;
