const mongoose = require("mongoose");

const DiagramAuditSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["node", "edge"],
      required: true,
      index: true,
    },
    entityId: { type: String, required: true, index: true },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["move", "reconnect", "edit"],
      required: true,
      index: true,
    },
    before: { type: Object, default: null },
    after: { type: Object, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

DiagramAuditSchema.index({ channelId: 1, createdAt: -1 });

const DiagramAudit = mongoose.model("DiagramAudit", DiagramAuditSchema);
module.exports = DiagramAudit;
