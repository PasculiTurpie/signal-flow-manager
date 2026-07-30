// src/pages/ChannelDiagram/flowRules.js
import { HANDLE_IDS } from "./handleConstants.js";
import {
  ensureEdgeHandlesForNodes,
  ensureHandleId,
  inferNodeHandleType,
} from "./handleStandard.js";

/**
 * Normaliza sourceHandle/targetHandle de un edge en base al tipo real de los nodos.
 */
export function normalizeEdgeHandles(edge, nodes = []) {
  const srcNode = nodes.find((n) => String(n.id) === String(edge.source));
  const tgtNode = nodes.find((n) => String(n.id) === String(edge.target));

  const normalized = ensureEdgeHandlesForNodes(
    {
      ...edge,
      sourceHandle: ensureHandleId(edge.sourceHandle),
      targetHandle: ensureHandleId(edge.targetHandle),
    },
    srcNode,
    tgtNode,
    edge
  );

  const next = { ...edge };
  if (normalized.sourceHandle) next.sourceHandle = normalized.sourceHandle;
  else delete next.sourceHandle;

  if (normalized.targetHandle) next.targetHandle = normalized.targetHandle;
  else delete next.targetHandle;

  return next;
}

/**
 * Regla negocio: SATÉLITE -> IRD fuerza out-right-1 → in-left-1
 */
export function enforceSateliteToIrd(edge, nodes = []) {
  const srcNode = nodes.find((n) => String(n.id) === String(edge.source));
  const tgtNode = nodes.find((n) => String(n.id) === String(edge.target));
  if (!srcNode || !tgtNode) return edge;

  const srcTipo = inferNodeHandleType(srcNode);
  const tgtTipo = inferNodeHandleType(tgtNode);

  if (srcTipo === "satelite" && tgtTipo === "ird") {
    return {
      ...edge,
      sourceHandle: ensureHandleId(HANDLE_IDS.OUT_RIGHT_PRIMARY),
      targetHandle: ensureHandleId(HANDLE_IDS.IN_LEFT_PRIMARY),
    };
  }
  return edge;
}

/**
 * Asegura/propaga labels para UX consistente.
 */
export function autoLabelEdge(edge) {
  const direction = edge?.data?.direction || (edge.style?.stroke === "green" ? "vuelta" : "ida");
  const fallbackLabel = edge.label || edge?.data?.label || edge.id;
  const nextData = {
    ...(edge.data || {}),
    direction,
    label: fallbackLabel,
  };

  let endpointLabels = { ...(nextData.endpointLabels || {}) };
  if (nextData.labelStart) endpointLabels.source = nextData.labelStart;
  if (nextData.labelEnd) endpointLabels.target = nextData.labelEnd;
  if (Object.keys(endpointLabels).length) {
    nextData.endpointLabels = endpointLabels;
  } else if (nextData.endpointLabels) {
    delete nextData.endpointLabels;
  }

  return {
    ...edge,
    label: fallbackLabel,
    data: nextData,
  };
}
