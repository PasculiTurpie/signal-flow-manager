const express = require("express");
const ChannelController = require("../controllers/channel.controller");
const ChannelDiagramController = require("../controllers/channelController");

const router = express.Router();

router
  .route("/channels")
  .post(ChannelController.createChannel)
  .get(ChannelController.getChannel);

router
  .route("/channels/:id")
  .get(ChannelController.getChannelId)
  .put(ChannelController.updateChannel)
  .delete(ChannelController.deleteChannel);


router.put("/channels/:id/flow", ChannelController.updateChannelFlow);
router
  .route("/channels/:id/diagram")
  .get(ChannelDiagramController.getChannel)
  .put(ChannelDiagramController.updateDiagram);

// Endpoints de edges
router.post("/channels/:id/edges", ChannelController.createEdge);

// Endpoints de nodos
router.patch("/channels/:id/node/:nodeId", ChannelController.patchNode);
router.patch(
  "/channels/:id/node/:nodeId/position",
  ChannelController.patchNodePosition
);
router.patch(
  "/channels/:id/node/:nodeId/handles",
  ChannelController.patchNodeHandles
);
router.patch("/channels/:id/edge/:edgeId", ChannelController.patchEdge);
router.patch(
  "/channels/:id/edge/:edgeId/reconnect",
  ChannelController.patchEdgeReconnect
);
router.patch(
  "/channels/:id/edge/:edgeId/tooltip",
  ChannelController.patchEdgeTooltip
);
router.patch(
  "/channels/:id/label-positions",
  ChannelController.patchLabelPositions
);

module.exports = router;
