import api from "../utils/api.js";

const normalizeId = (value) => String(value ?? "").trim();

const mapNode = (node) => ({
  id: normalizeId(node.nodeId),
  type: node.type || undefined,
  data: node.data || {},
  position: {
    x: Number(node.position?.x) || 0,
    y: Number(node.position?.y) || 0,
  },
});

const mapEdge = (edge) => ({
  id: normalizeId(edge.edgeId),
  type: edge.type || undefined,
  data: edge.data || {},
  source: normalizeId(edge.source),
  sourceHandle: edge.sourceHandle ?? null,
  target: normalizeId(edge.target),
  targetHandle: edge.targetHandle ?? null,
});

export async function createFlow(payload) {
  const response = await api._axios.post("/flows", payload);
  return response.data;
}

export async function getFlow(flowId) {
  const response = await api._axios.get(`/flows/${flowId}`);
  const data = response.data?.data;
  if (!data) {
    return response.data;
  }
  return {
    ...response.data,
    data: {
      ...data,
      nodes: Array.isArray(data.nodes) ? data.nodes.map(mapNode) : [],
      edges: Array.isArray(data.edges) ? data.edges.map(mapEdge) : [],
    },
  };
}

export async function updateNodePosition(flowId, nodeId, position) {
  const response = await api._axios.patch(
    `/flows/${flowId}/nodes/${nodeId}/position`,
    { position }
  );
  return response.data;
}

export async function updateEdgeConnection(flowId, edgeId, payload) {
  const response = await api._axios.patch(
    `/flows/${flowId}/edges/${edgeId}/connection`,
    payload
  );
  return response.data;
}

export default {
  createFlow,
  getFlow,
  updateNodePosition,
  updateEdgeConnection,
};
