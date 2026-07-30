import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import flowApi from "../../services/flow.api.js";

const LOCAL_STORAGE_KEY = "flow-demo-id";

const defaultNodes = [
  {
    id: "node-1",
    data: { label: "Origen" },
    position: { x: 0, y: 80 },
  },
  {
    id: "node-2",
    data: { label: "Destino" },
    position: { x: 320, y: 80 },
  },
];

const defaultEdges = [
  {
    id: "edge-1",
    source: "node-1",
    target: "node-2",
    sourceHandle: null,
    targetHandle: null,
    type: "smoothstep",
    data: { label: "Enlace" },
  },
];

function ensureFlowData(flow) {
  const nodes = Array.isArray(flow?.nodes) && flow.nodes.length > 0 ? flow.nodes : defaultNodes;
  const edges = Array.isArray(flow?.edges) && flow.edges.length > 0 ? flow.edges : defaultEdges;
  return {
    ...flow,
    nodes,
    edges,
  };
}

export default function FlowBuilder() {
  const [flowId, setFlowId] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const nodeTypes = useMemo(
    () => ({
      default: (props) => (
        <div className="rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm">
          <span className="text-sm font-medium text-slate-700">
            {props.data?.label ?? props.id}
          </span>
        </div>
      ),
    }),
    []
  );

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        const storedId = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        let flowResponse = null;

        if (storedId) {
          try {
            flowResponse = await flowApi.getFlow(storedId);
          } catch (err) {
            console.warn("No se pudo obtener el flujo almacenado", err);
            window.localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }

        if (!flowResponse?.data) {
          const created = await flowApi.createFlow({
            name: "Diagrama de ejemplo",
            nodes: defaultNodes.map((node) => ({
              nodeId: node.id,
              data: node.data,
              position: node.position,
            })),
            edges: defaultEdges.map((edge) => ({
              edgeId: edge.id,
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
              type: edge.type,
              data: edge.data,
            })),
          });
          flowResponse = await flowApi.getFlow(created.data._id);
          window.localStorage.setItem(LOCAL_STORAGE_KEY, created.data._id);
        }

        const flowData = ensureFlowData(flowResponse.data);
        setFlowId(flowData._id);
        setNodes(flowData.nodes);
        setEdges(flowData.edges);
        setError(null);
      } catch (err) {
        console.error("Error inicializando el flujo", err);
        setError("No se pudo cargar el diagrama");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [setEdges, setNodes]);

  const handleNodeDragStop = useCallback(
    async (_event, node) => {
      if (!flowId) return;
      setNodes((current) =>
        current.map((item) =>
          item.id === node.id ? { ...item, position: node.position } : item
        )
      );
      try {
        await flowApi.updateNodePosition(flowId, node.id, node.position);
      } catch (err) {
        console.error("No se pudo guardar la posición del nodo", err);
        setError("No se pudo guardar la posición del nodo");
      }
    },
    [flowId, setNodes]
  );

  const handleReconnect = useCallback(
    async ({ edge, connection }) => {
      if (!flowId || !edge) return;
      const payload = {
        source: connection.source ?? edge.source,
        sourceHandle: connection.sourceHandle ?? edge.sourceHandle,
        target: connection.target ?? edge.target,
        targetHandle: connection.targetHandle ?? edge.targetHandle,
      };
      try {
        const response = await flowApi.updateEdgeConnection(flowId, edge.id, payload);
        const updated = response?.data;
        if (updated) {
          setEdges((current) =>
            current.map((item) =>
              item.id === edge.id
                ? {
                    ...item,
                    source: updated.source,
                    sourceHandle: updated.sourceHandle,
                    target: updated.target,
                    targetHandle: updated.targetHandle,
                  }
                : item
            )
          );
        }
      } catch (err) {
        console.error("No se pudo actualizar la conexión", err);
        setError("No se pudo actualizar la conexión del enlace");
      }
    },
    [flowId, setEdges]
  );

  const handleErrorDismiss = useCallback(() => setError(null), []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-600">Cargando diagrama...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="bg-red-100 px-4 py-2 text-sm text-red-600">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleErrorDismiss}
              className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onReconnect={handleReconnect}
          fitView
        >
          <Background gap={20} size={1} color="#e2e8f0" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
