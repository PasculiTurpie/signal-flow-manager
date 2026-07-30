const mongoose = require("mongoose");

const PositionSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false }
);

const FlowNodeSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true },
    type: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },
    position: { type: PositionSchema, required: true },
  },
  { _id: false }
);

const FlowEdgeSchema = new mongoose.Schema(
  {
    edgeId: { type: String, required: true },
    type: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },
    source: { type: String, required: true },
    sourceHandle: { type: String, default: null },
    target: { type: String, required: true },
    targetHandle: { type: String, default: null },
  },
  { _id: false }
);

const FlowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    nodes: { type: [FlowNodeSchema], default: [] },
    edges: { type: [FlowEdgeSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Flow", FlowSchema);
