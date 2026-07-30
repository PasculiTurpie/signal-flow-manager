// server/models/channel.model.js
const mongoose = require("mongoose");

/* ---------------------------------- Utils --------------------------------- */

const posDef = {
  x: { type: Number },
  y: { type: Number },
};

const HANDLE_SIDES = ["top", "right", "bottom", "left"];
const HANDLE_TYPES = ["source", "target"];

// Formato estándar de tus handles: in|out - side - index
// ej: in-left-1, out-right-3
const HANDLE_ID_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9][0-9]*)$/;

/* ------------------------------ Sub-esquemas ------------------------------ */

const HandleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true }, // in-left-1, out-right-2, etc.
    type: { type: String, enum: HANDLE_TYPES, required: true }, // source|target
    side: { type: String, enum: HANDLE_SIDES, required: true },
    topPct: { type: Number, min: 0, max: 100, default: 50 },
    leftPct: { type: Number, min: 0, max: 100, default: 50 },
  },
  { _id: false }
);

const NodeDataSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    image: String,
    labelPosition: { ...posDef },
    multicast: { type: String },
    multicastPosition: { ...posDef },
    // Si defines handles por nodo, será validado al reconectar edges.
    // Si no los defines, el modelo permite reconectar igual (modo tolerante).
    handles: { type: [HandleSchema], default: undefined },
  },
  { _id: false, strict: false, minimize: false }
);

const NodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: { type: String, default: "image", trim: true },
    equipo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipo",
      required: true,
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    data: { type: NodeDataSchema, required: true },
    // (opcional) handles a nivel nodo (duplicado de data.handles), útil si prefieres fuera de data
    handles: { type: [HandleSchema], default: [] },
  },
  { _id: false, minimize: false }
);

const EdgeDataSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    labelStart: { type: String, trim: true },
    labelEnd: { type: String, trim: true },
    direction: {
      type: String,
      enum: ["ida", "vuelta", "bi"],
      default: "ida",
    },
    // posición libre del label en el canvas
    labelPosition: { ...posDef },

    // labels/posiciones por endpoint (si usas micro-etiquetas)
    endpointLabels: { type: mongoose.Schema.Types.Mixed, default: {} },
    endpointLabelPositions: { type: mongoose.Schema.Types.Mixed, default: {} },

    // campos de negocio
    multicast: { type: String, trim: true },
    multicastPosition: { ...posDef },

    // (opcional pro) vértices si luego agregas “waypoints”
    waypoints: { type: [{ x: Number, y: Number }], default: undefined },
  },
  { _id: false, strict: false, minimize: false }
);

const EdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    target: { type: String, required: true, trim: true },
    type: { type: String, default: "smoothstep", trim: true },
    animated: { type: Boolean, default: true },
    style: { type: mongoose.Schema.Types.Mixed, default: {} },

    // handles seleccionados (reconexión por drag suelta acá)
    sourceHandle: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => !value || HANDLE_ID_REGEX.test(value),
        message: "sourceHandle must match the handle format",
      },
    },
    targetHandle: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => !value || HANDLE_ID_REGEX.test(value),
        message: "targetHandle must match the handle format",
      },
    },

    // compatibilidad con ReactFlow (legacy)
    label: { type: String, trim: true },
    labelPosition: { ...posDef },

    markerStart: { type: mongoose.Schema.Types.Mixed, default: undefined },
    markerEnd: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // payload extendido
    data: { type: EdgeDataSchema, default: {} },
  },
  { _id: false, minimize: false }
);

/* ------------------- Esquemas "diagram" (si los usas aparte) ------------------ */

const DiagramNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: { type: String, default: "default", trim: true },
    position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false, minimize: false }
);

const DiagramEdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    target: { type: String, required: true, trim: true },
    sourceHandle: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => HANDLE_ID_REGEX.test(value),
        message: "sourceHandle must match the handle format",
      },
    },
    targetHandle: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => HANDLE_ID_REGEX.test(value),
        message: "targetHandle must match the handle format",
      },
    },
    type: { type: String, default: "customDirectional", trim: true },
    label: { type: String, default: "", trim: true },
    data: {
      labelStart: { type: String, default: "", trim: true },
      labelEnd: { type: String, default: "", trim: true },
      direction: { type: String, enum: ["ida", "vuelta", "bi"], default: "ida" },
    },
    style: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false, minimize: false }
);

const DiagramSchema = new mongoose.Schema(
  {
    nodes: { type: [DiagramNodeSchema], default: [] },
    edges: { type: [DiagramEdgeSchema], default: [] },
    viewport: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false, minimize: false }
);

/* -------------------------------- Canal ----------------------------------- */

const ContactSchema = new mongoose.Schema(
  {
    nombreContact: { type: String, trim: true },
    email: { type: String, trim: true },
    telefono: { type: String, trim: true },
  },
  { _id: false, minimize: false }
);

const ChannelSchema = new mongoose.Schema(
  {
    signal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signal",
      required: true,
    },
    nameChannel: { type: String, trim: true },
    numberChannelSur: { type: String, trim: true },
    numberChannelCn: { type: String, trim: true },
    logoChannel: { type: String, trim: true },
    severidadChannel: { type: String, trim: true },
    tipoTecnologia: { type: String, trim: true },
    contacto: { type: [ContactSchema], default: undefined },
    // Representación principal usada en el front
    nodes: [NodeSchema],
    edges: [EdgeSchema],

    // Si además mantienes una “vista” paralela (opcional)
    diagram: { type: DiagramSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

/* --------------------------------- Índices -------------------------------- */

ChannelSchema.index({ "nodes.id": 1 }, { background: true });
ChannelSchema.index({ "edges.id": 1 }, { background: true });
ChannelSchema.index({ "nodes.data.label": 1 }, { background: true, sparse: true });
// Acceso rápido por endpoints
ChannelSchema.index({ "edges.source": 1 }, { background: true });
ChannelSchema.index({ "edges.target": 1 }, { background: true });

/* -------------------------- Validaciones de negocio ------------------------ */
/**
 * - Evita ids duplicados en nodes/edges.
 * - Verifica que source/target existan.
 * - Si el nodo define handles (en data.handles o handles[]),
 *   valida que sourceHandle/targetHandle pertenezcan al nodo
 *   y que su tipo (in/out) sea coherente con source/target.
 *   Si el nodo no define handles, se permite (modo tolerante).
 */
ChannelSchema.pre("validate", function (next) {
  const nodesList = Array.isArray(this.nodes) ? this.nodes : [];
  const edgesList = Array.isArray(this.edges) ? this.edges : [];

  const nodeIds = nodesList.map((n) => n.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (uniqueNodeIds.size !== nodeIds.length) {
    return next(new Error("Duplicate node ids are not allowed within a channel"));
  }

  const edgeIds = edgesList.map((e) => e.id);
  const uniqueEdgeIds = new Set(edgeIds);
  if (uniqueEdgeIds.size !== edgeIds.length) {
    return next(new Error("Duplicate edge ids are not allowed within a channel"));
  }

  // Mapa rápido de nodos por id
  const nodeMap = new Map(nodesList.map((n) => [n.id, n]));

  // Helper: obtener set de handle ids válidos de un nodo (si existen)
  const getHandleSets = (node) => {
    const fromData = Array.isArray(node?.data?.handles) ? node.data.handles : [];
    const fromRoot = Array.isArray(node?.handles) ? node.handles : [];
    const all = [...fromData, ...fromRoot];

    const setAll = new Set(all.map((h) => h.id));
    const setIn = new Set(all.filter((h) => h.id.startsWith("in-")).map((h) => h.id));
    const setOut = new Set(all.filter((h) => h.id.startsWith("out-")).map((h) => h.id));
    return { setAll, setIn, setOut, declared: all.length > 0 };
  };

  for (const edge of edgesList) {
    // Source/Target existen
    if (!nodeMap.has(edge.source)) {
      return next(new Error(`Edge source "${edge.source}" does not exist in nodes`));
    }
    if (!nodeMap.has(edge.target)) {
      return next(new Error(`Edge target "${edge.target}" does not exist in nodes`));
    }

    // Validación regex ya está en el schema; aquí validamos pertenencia si el nodo declara handles.
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    const srcSets = getHandleSets(srcNode);
    const tgtSets = getHandleSets(tgtNode);

    // sourceHandle debe ser "out-..." si existen handles declarados
    if (edge.sourceHandle) {
      if (!HANDLE_ID_REGEX.test(edge.sourceHandle)) {
        return next(new Error(`Invalid sourceHandle "${edge.sourceHandle}"`));
      }
      if (srcSets.declared) {
        if (!srcSets.setAll.has(edge.sourceHandle)) {
          return next(
            new Error(
              `sourceHandle "${edge.sourceHandle}" is not declared in source node "${edge.source}"`
            )
          );
        }
        if (!edge.sourceHandle.startsWith("out-")) {
          return next(
            new Error(`sourceHandle "${edge.sourceHandle}" must start with "out-" (source side)`)
          );
        }
      }
    }

    // targetHandle debe ser "in-..." si existen handles declarados
    if (edge.targetHandle) {
      if (!HANDLE_ID_REGEX.test(edge.targetHandle)) {
        return next(new Error(`Invalid targetHandle "${edge.targetHandle}"`));
      }
      if (tgtSets.declared) {
        if (!tgtSets.setAll.has(edge.targetHandle)) {
          return next(
            new Error(
              `targetHandle "${edge.targetHandle}" is not declared in target node "${edge.target}"`
            )
          );
        }
        if (!edge.targetHandle.startsWith("in-")) {
          return next(
            new Error(`targetHandle "${edge.targetHandle}" must start with "in-" (target side)`)
          );
        }
      }
    }
  }

  next();
});

/* ------------------------------- Exportación ------------------------------ */

const Channel = mongoose.model("Channel", ChannelSchema);
module.exports = Channel;
