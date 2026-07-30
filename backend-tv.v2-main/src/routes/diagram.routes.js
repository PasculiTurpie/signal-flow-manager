const { Router } = require("express");
const DiagramController = require("../controllers/diagram.controller");

const router = Router();

router.get("/diagrams/:id/nodes", DiagramController.listNodes);
router.post("/diagrams/:id/nodes", DiagramController.createNode);
router.put("/diagrams/:id/nodes/:nodeId", DiagramController.updateNode);
router.delete("/diagrams/:id/nodes/:nodeId", DiagramController.deleteNode);

router.get("/diagrams/:id/edges", DiagramController.listEdges);
router.post("/diagrams/:id/edges", DiagramController.createEdge);
router.put("/diagrams/:id/edges/:edgeId", DiagramController.updateEdge);
router.delete("/diagrams/:id/edges/:edgeId", DiagramController.deleteEdge);

module.exports = router;
