// src/pages/ChannelDiagram/CustomNode.jsx
import { Handle, Position } from "@xyflow/react";
import "./CustomNode.css";

const CustomNode = ({ data = {}, selected }) => {
  const leftPerc = [10, 35, 60, 85];
  const rightPerc = [10, 35, 60, 85];
  const topPerc = [10, 40, 70, 90];
  const bottomPerc = [10, 40, 70, 90];
  const isSaving = Boolean(data.savingPosition);

  return (
    <div
      className={`custom-node ${selected ? "selected" : ""}`}
      style={{
        border: selected ? "2px solid #007bff" : "1px solid #ccc",
        borderRadius: "5px",
        padding: "10px",
        width: "120px",
        textAlign: "center",
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "relative",
      }}
    >
      {isSaving && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            fontSize: 10,
            color: "#0d6efd",
            fontWeight: 600,
          }}
        >
          Guardando…
        </div>
      )}
      {/* LEFT */}
      {leftPerc.map((p, i) => (
        <Handle
          key={`in-left-${i + 1}`}
          id={`in-left-${i + 1}`}
          type="target"
          position={Position.Left}
          style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 0 }}
        />
      ))}
      {leftPerc.map((p, i) => (
        <Handle
          key={`out-left-${i + 1}`}
          id={`out-left-${i + 1}`}
          type="source"
          position={Position.Left}
          style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 0 }}
        />
      ))}

      {/* RIGHT */}
      {rightPerc.map((p, i) => (
        <Handle
          key={`out-right-${i + 1}`}
          id={`out-right-${i + 1}`}
          type="source"
          position={Position.Right}
          style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 0 }}
        />
      ))}
      {rightPerc.map((p, i) => (
        <Handle
          key={`in-right-${i + 1}`}
          id={`in-right-${i + 1}`}
          type="target"
          position={Position.Right}
          style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 0 }}
        />
      ))}

      {/* TOP */}
      {topPerc.map((p, i) => (
        <Handle
          key={`out-top-${i + 1}`}
          id={`out-top-${i + 1}`}
          type="source"
          position={Position.Top}
          style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 0 }}
        />
      ))}
      {topPerc.map((p, i) => (
        <Handle
          key={`in-top-${i + 1}`}
          id={`in-top-${i + 1}`}
          type="target"
          position={Position.Top}
          style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 0 }}
        />
      ))}

      {/* BOTTOM */}
      {bottomPerc.map((p, i) => (
        <Handle
          key={`in-bottom-${i + 1}`}
          id={`in-bottom-${i + 1}`}
          type="target"
          position={Position.Bottom}
          style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 0 }}
        />
      ))}
      {bottomPerc.map((p, i) => (
        <Handle
          key={`out-bottom-${i + 1}`}
          id={`out-bottom-${i + 1}`}
          type="source"
          position={Position.Bottom}
          style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 0 }}
        />
      ))}

      {/* Imagen */}
      <div style={{ marginBottom: "2px" }} className="container__image">
        <img
          src={data.image}
          alt={data.label}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Etiqueta */}
      <span className="title__image">{data.label}</span>
    </div>
  );
};

export default CustomNode;
