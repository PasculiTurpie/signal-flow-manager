const { Router } = require("express");
const FlowController = require("../controllers/flow.controller");

const router = Router();

router.post("/flows", FlowController.createFlow);
router.get("/flows/:id", FlowController.getFlow);
router.patch("/flows/:id/nodes/:nodeId/position", FlowController.patchNodePosition);
router.patch("/flows/:id/edges/:edgeId/connection", FlowController.patchEdgeConnection);

module.exports = router;
