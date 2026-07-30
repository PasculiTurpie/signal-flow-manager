const Flow = require("../models/flow.model");

const normalizeId = (value) => String(value ?? "").trim();

const toNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid numeric value");
  }
  return parsed;
};

const cloneData = (data) => {
  if (data === undefined) return undefined;
  if (data === null) return null;
  if (typeof data !== "object") return data;
  return JSON.parse(JSON.stringify(data));
};

async function createFlow(payload, auditContext = {}) {
  const flowDoc = await Flow.create({
    name: payload.name,
    description: payload.description,
    nodes: normalizeNodes(payload.nodes || []),
    edges: normalizeEdges(payload.edges || []),
  });
  const flow = flowDoc && typeof flowDoc.toObject === "function" ? flowDoc.toObject() : flowDoc;

  return { flow, auditContext };
}

async function getFlowById(id) {
  const flow = await Flow.findById(id).lean();
  return flow;
}

async function updateNodePosition(flowId, nodeId, position) {
  const normalizedId = normalizeId(nodeId);
  const flow = await Flow.findById(flowId);
  if (!flow) {
    return null;
  }

  let node = flow.nodes.find((entry) => entry.nodeId === normalizedId);
  if (!node) {
    node = { nodeId: normalizedId, position: { ...position } };
    flow.nodes.push(node);
  } else {
    node.position.x = position.x;
    node.position.y = position.y;
  }

  await flow.save();

  return { flow, node };
}

async function updateEdgeConnection(flowId, edgeId, update) {
  const normalizedId = normalizeId(edgeId);
  const flow = await Flow.findById(flowId);
  if (!flow) {
    return null;
  }

  const edge = flow.edges.find((entry) => entry.edgeId === normalizedId);
  if (!edge) {
    return undefined;
  }

  if (update.source !== undefined) {
    edge.source = normalizeId(update.source);
  }
  if (update.sourceHandle !== undefined) {
    edge.sourceHandle = sanitizeHandle(update.sourceHandle);
  }
  if (update.target !== undefined) {
    edge.target = normalizeId(update.target);
  }
  if (update.targetHandle !== undefined) {
    edge.targetHandle = sanitizeHandle(update.targetHandle);
  }

  await flow.save();

  return { flow, edge };
}

function sanitizeHandle(handle) {
  if (handle === null) return null;
  if (handle === undefined) return undefined;
  const trimmed = String(handle).trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeNodes(nodes) {
  return nodes.map((node) => ({
    nodeId: normalizeId(node.nodeId),
    type: node.type,
    data: cloneData(node.data),
    position: {
      x: toNumber(node.position?.x),
      y: toNumber(node.position?.y),
    },
  }));
}

function normalizeEdges(edges) {
  return edges.map((edge) => ({
    edgeId: normalizeId(edge.edgeId),
    type: edge.type,
    data: cloneData(edge.data),
    source: normalizeId(edge.source),
    sourceHandle: sanitizeHandle(edge.sourceHandle),
    target: normalizeId(edge.target),
    targetHandle: sanitizeHandle(edge.targetHandle),
  }));
}

module.exports = {
  createFlow,
  getFlowById,
  updateNodePosition,
  updateEdgeConnection,
};
