const Channel = require("../models/channel.model");
const { sanitizeHandles } = require("../services/handleSanitizer");

const projectNodes = { nodes: 1 };
const projectEdges = { edges: 1 };

const sanitizeNodeUpdate = (node, payload = {}) => {
  const result = { ...node };
  if (payload.type !== undefined) result.type = payload.type;
  if (payload.position !== undefined) {
    const nextPosition = payload.position || {};
    result.position = {
      x: Number.isFinite(nextPosition.x) ? Number(nextPosition.x) : node.position?.x || 0,
      y: Number.isFinite(nextPosition.y) ? Number(nextPosition.y) : node.position?.y || 0,
    };
  }
  if (payload.data !== undefined) {
    result.data = { ...(node.data || {}), ...(payload.data || {}) };
  }
  if (payload.handles !== undefined) {
    const sanitizedHandles = sanitizeHandles(
      payload.handles,
      node.handles || node.data?.handles || []
    );
    result.handles = sanitizedHandles;
    if (result.data) {
      result.data.handles = sanitizedHandles;
    }
  }
  return result;
};

const sanitizeEdgeUpdate = (edge, payload = {}) => {
  const result = { ...edge };
  if (payload.type !== undefined) result.type = payload.type;
  if (payload.source !== undefined) result.source = payload.source;
  if (payload.target !== undefined) result.target = payload.target;
  if (payload.sourceHandle !== undefined) result.sourceHandle = payload.sourceHandle;
  if (payload.targetHandle !== undefined) result.targetHandle = payload.targetHandle;
  if (payload.style !== undefined) result.style = payload.style || {};
  if (payload.animated !== undefined) {
    result.animated = Boolean(payload.animated);
  } else if (result.animated === undefined) {
    result.animated = true;
  }
  if (payload.markerStart !== undefined) result.markerStart = payload.markerStart;
  if (payload.markerEnd !== undefined) result.markerEnd = payload.markerEnd;
  if (payload.data !== undefined) {
    result.data = { ...(edge.data || {}), ...(payload.data || {}) };
  }
  return result;
};

exports.listNodes = async (req, res) => {
  const { id } = req.params;
  const diagram = await Channel.findById(id, projectNodes).lean();
  if (!diagram) {
    return res.status(404).json({ error: "Diagram not found" });
  }
  return res.json({ nodes: Array.isArray(diagram.nodes) ? diagram.nodes : [] });
};

exports.createNode = async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  if (!payload.id) {
    return res.status(400).json({ error: "Node id is required" });
  }

  try {
    const update = await Channel.findByIdAndUpdate(
      id,
      { $push: { nodes: payload } },
      { new: true, runValidators: true, select: projectNodes }
    )
      .lean()
      .exec();

    if (!update) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    return res.status(201).json({ nodes: update.nodes });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateNode = async (req, res) => {
  const { id, nodeId } = req.params;
  const payload = req.body || {};

  try {
    const snapshot = await Channel.findOne({ _id: id, "nodes.id": nodeId }, { "nodes.$": 1 })
      .lean()
      .exec();

    if (!snapshot || !Array.isArray(snapshot.nodes) || !snapshot.nodes.length) {
      return res.status(404).json({ error: "Node not found" });
    }

    const existing = snapshot.nodes[0];
    const merged = sanitizeNodeUpdate(existing, payload);

    await Channel.updateOne(
      { _id: id, "nodes.id": nodeId },
      { $set: { "nodes.$": merged } },
      { runValidators: true }
    ).exec();

    return res.json({ node: merged });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteNode = async (req, res) => {
  const { id, nodeId } = req.params;
  try {
    const result = await Channel.updateOne(
      { _id: id },
      {
        $pull: {
          nodes: { id: nodeId },
          edges: { $or: [{ source: nodeId }, { target: nodeId }] },
        },
      }
    ).exec();

    const modifiedCount = typeof result.modifiedCount === "number" ? result.modifiedCount : result.nModified || 0;

    if (!modifiedCount) {
      return res.status(404).json({ error: "Node not found" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.listEdges = async (req, res) => {
  const { id } = req.params;
  const diagram = await Channel.findById(id, projectEdges).lean();
  if (!diagram) {
    return res.status(404).json({ error: "Diagram not found" });
  }
  return res.json({ edges: Array.isArray(diagram.edges) ? diagram.edges : [] });
};

exports.createEdge = async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  if (!payload.id) {
    return res.status(400).json({ error: "Edge id is required" });
  }
  if (!payload.source || !payload.target) {
    return res.status(400).json({ error: "Edge source and target are required" });
  }

  try {
    const edgePayload = {
      ...payload,
      animated:
        payload.animated !== undefined ? Boolean(payload.animated) : true,
    };

    const update = await Channel.findByIdAndUpdate(
      id,
      { $push: { edges: edgePayload } },
      { new: true, runValidators: true, select: projectEdges }
    )
      .lean()
      .exec();

    if (!update) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    return res.status(201).json({ edges: update.edges });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateEdge = async (req, res) => {
  const { id, edgeId } = req.params;
  const payload = req.body || {};

  try {
    const snapshot = await Channel.findOne({ _id: id, "edges.id": edgeId }, { "edges.$": 1 })
      .lean()
      .exec();

    if (!snapshot || !Array.isArray(snapshot.edges) || !snapshot.edges.length) {
      return res.status(404).json({ error: "Edge not found" });
    }

    const merged = sanitizeEdgeUpdate(snapshot.edges[0], payload);

    await Channel.updateOne(
      { _id: id, "edges.id": edgeId },
      { $set: { "edges.$": merged } },
      { runValidators: true }
    ).exec();

    return res.json({ edge: merged });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteEdge = async (req, res) => {
  const { id, edgeId } = req.params;
  try {
    const result = await Channel.updateOne(
      { _id: id },
      { $pull: { edges: { id: edgeId } } }
    ).exec();

    const modifiedCount = typeof result.modifiedCount === "number" ? result.modifiedCount : result.nModified || 0;

    if (!modifiedCount) {
      return res.status(404).json({ error: "Edge not found" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
