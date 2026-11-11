const express = require("express");
const ChannelController = require("../controllers/channel.controller");
const ChannelDiagramController = require("../controllers/channelController");
const { authRequired } = require("../middleware/authRequired");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router
  .route("/channels")
  .post(authRequired, requireAdmin, ChannelController.createChannel)
  .get(ChannelController.getChannel);

router
  .route("/channels/:id")
  .get(ChannelController.getChannelId)
  .put(authRequired, requireAdmin, ChannelController.updateChannel)
  .delete(authRequired, requireAdmin, ChannelController.deleteChannel);


router.put("/channels/:id/flow", authRequired, requireAdmin, ChannelController.updateChannelFlow);
router
  .route("/channels/:id/diagram")
  .get(ChannelDiagramController.getChannel)
  .put(authRequired, requireAdmin, ChannelDiagramController.updateDiagram);

// Endpoints de edges
router.post("/channels/:id/edges", authRequired, requireAdmin, ChannelController.createEdge);

// Endpoints de nodos
router.patch("/channels/:id/node/:nodeId", authRequired, requireAdmin, ChannelController.patchNode);
router.patch(
  "/channels/:id/node/:nodeId/position",
  authRequired,
  requireAdmin,
  ChannelController.patchNodePosition
);
router.patch(
  "/channels/:id/node/:nodeId/handles",
  authRequired,
  requireAdmin,
  ChannelController.patchNodeHandles
);
router.patch("/channels/:id/edge/:edgeId", authRequired, requireAdmin, ChannelController.patchEdge);
router.patch(
  "/channels/:id/edge/:edgeId/reconnect",
  authRequired,
  requireAdmin,
  ChannelController.patchEdgeReconnect
);
router.patch(
  "/channels/:id/edge/:edgeId/tooltip",
  authRequired,
  requireAdmin,
  ChannelController.patchEdgeTooltip
);
router.patch(
  "/channels/:id/label-positions",
  authRequired,
  requireAdmin,
  ChannelController.patchLabelPositions
);

module.exports = router;
