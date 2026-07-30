// src/pages/ChannelDiagram/edges/EdgeWithTooltip.jsx
import { BaseEdge, getBezierPath } from "@xyflow/react";
import { useMemo, useState, useRef, useEffect } from "react";

export default function EdgeWithTooltip(props) {
  const {
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data = {},
    markerEnd, style
  } = props;

  const [edgePath, labelX, labelY] = useMemo(() => {
    return getBezierPath({
      sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    });
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const [hover, setHover] = useState(false);
  const [mouse, setMouse] = useState({ x: labelX, y: labelY });

  // Posición del tooltip: por defecto, cerca del "label point" de la curva,
  // pero si el mouse pasa por encima del stroke, lo seguimos.
  useEffect(() => {
    if (!hover) {
      setMouse({ x: labelX, y: labelY });
    }
  }, [hover, labelX, labelY]);

  const onMove = (e) => {
    // Coordenadas de mouse relativas al SVG ya están OK en eventos sobre el path
    // Usamos offsetX/offsetY si están disponibles; si no, basado en clientX/Y no es trivial convertir.
    if (typeof e.nativeEvent.offsetX === "number") {
      setMouse({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    }
  };

  return (
    <>
      {/* el path “visual” */}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />

      {/* path transparente y ancho para captar hover con facilidad */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={onMove}
      />

      {/* Tooltip HTML dentro del SVG */}
      {hover && (
        <foreignObject
          x={(mouse.x ?? labelX) + 8}
          y={(mouse.y ?? labelY) + 8}
          width={260}
          height={120}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              maxWidth: 240,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.78)",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.3,
              boxShadow: "0 6px 16px rgba(0,0,0,.25)",
              pointerEvents: "none", // no roba el mouse
            }}
          >
            {data?.tooltipTitle && (
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {data.tooltipTitle}
              </div>
            )}
            {data?.tooltip ? (
              <div>{data.tooltip}</div>
            ) : (
              <div>Sin descripción</div>
            )}
            {/* Ejemplo de campos técnicos opcionales */}
            {data?.multicast && (
              <div style={{ marginTop: 6, opacity: .9 }}>
                Multicast: {data.multicast}
              </div>
            )}
            {data?.direction && (
              <div style={{ opacity: .9 }}>
                Dirección: {data.direction}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
}
