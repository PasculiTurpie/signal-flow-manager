const Joi = require("joi");
const mongoose = require("mongoose");
const {
  createFlow,
  getFlowById,
  updateNodePosition,
  updateEdgeConnection,
} = require("../services/flow.service");

const idSchema = Joi.alternatives(Joi.string().trim().min(1), Joi.number()).required();

const positionSchema = Joi.object({
  x: Joi.number().required(),
  y: Joi.number().required(),
}).required();

const nodeSchema = Joi.object({
  nodeId: idSchema,
  type: Joi.string().optional(),
  data: Joi.object().unknown(true).optional(),
  position: positionSchema,
});

const edgeSchema = Joi.object({
  edgeId: idSchema,
  type: Joi.string().optional(),
  data: Joi.object().unknown(true).optional(),
  source: idSchema,
  sourceHandle: Joi.any().optional(),
  target: idSchema,
  targetHandle: Joi.any().optional(),
});

const createFlowSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  description: Joi.string().allow("", null),
  nodes: Joi.array().items(nodeSchema).default([]),
  edges: Joi.array().items(edgeSchema).default([]),
});

const edgeReconnectSchema = Joi.object({
  source: idSchema.optional(),
  sourceHandle: Joi.alternatives(Joi.string().allow(""), Joi.number(), Joi.valid(null)).optional(),
  target: idSchema.optional(),
  targetHandle: Joi.alternatives(Joi.string().allow(""), Joi.number(), Joi.valid(null)).optional(),
})
  .custom((value, helpers) => {
    if (
      value.source === undefined &&
      value.target === undefined &&
      value.sourceHandle === undefined &&
      value.targetHandle === undefined
    ) {
      return helpers.error("object.min");
    }
    return value;
  })
  .messages({
    "object.min": "Se requiere al menos un campo para actualizar la conexión",
  });

function handleValidation(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    const details = error.details.map((detail) => detail.message);
    return { error: details };
  }
  return { value };
}

function normalizeObjectId(id) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

module.exports.createFlow = async (req, res) => {
  const { error, value } = handleValidation(createFlowSchema, req.body || {});
  if (error) {
    return res.status(400).json({ ok: false, message: "Solicitud inválida", errors: error });
  }

  try {
    const result = await createFlow(value);
    res.locals.auditContext = {
      action: "create",
      resource: "flow",
      resourceId: result.flow._id,
      meta: {
        name: result.flow.name,
      },
    };
    return res.status(201).json({ ok: true, data: result.flow });
  } catch (err) {
    console.error("Error al crear flujo", err);
    return res.status(500).json({ ok: false, message: "Error al crear el flujo" });
  }
};

module.exports.getFlow = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ ok: false, message: "Identificador inválido" });
  }

  try {
    const flow = await getFlowById(id);
    if (!flow) {
      return res.status(404).json({ ok: false, message: "Flujo no encontrado" });
    }
    return res.json({ ok: true, data: flow });
  } catch (err) {
    console.error("Error al obtener flujo", err);
    return res.status(500).json({ ok: false, message: "Error al obtener el flujo" });
  }
};

module.exports.patchNodePosition = async (req, res) => {
  const { id, nodeId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ ok: false, message: "Identificador inválido" });
  }

  const { error, value } = handleValidation(
    Joi.object({ position: positionSchema }),
    req.body || {}
  );

  if (error) {
    return res.status(400).json({ ok: false, message: "Solicitud inválida", errors: error });
  }

  try {
    const result = await updateNodePosition(id, nodeId, value.position);
    if (result === null) {
      return res.status(404).json({ ok: false, message: "Flujo no encontrado" });
    }

    res.locals.auditContext = {
      action: "move",
      resource: "flow-node",
      resourceId: normalizeObjectId(id),
      meta: {
        nodeId: String(nodeId),
        position: value.position,
      },
    };

    return res.json({ ok: true, data: { nodeId: result.node.nodeId, position: result.node.position } });
  } catch (err) {
    console.error("Error al actualizar posición del nodo", err);
    return res
      .status(500)
      .json({ ok: false, message: "Error al actualizar la posición del nodo" });
  }
};

module.exports.patchEdgeConnection = async (req, res) => {
  const { id, edgeId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ ok: false, message: "Identificador inválido" });
  }

  const { error, value } = handleValidation(edgeReconnectSchema, req.body || {});
  if (error) {
    return res.status(400).json({ ok: false, message: "Solicitud inválida", errors: error });
  }

  try {
    const result = await updateEdgeConnection(id, edgeId, value);
    if (result === null) {
      return res.status(404).json({ ok: false, message: "Flujo no encontrado" });
    }
    if (result === undefined) {
      return res.status(404).json({ ok: false, message: "Conexión no encontrada" });
    }

    res.locals.auditContext = {
      action: "reconnect",
      resource: "flow-edge",
      resourceId: normalizeObjectId(id),
      meta: {
        edgeId: String(edgeId),
        update: value,
      },
    };

    return res.json({
      ok: true,
      data: {
        edgeId: result.edge.edgeId,
        source: result.edge.source,
        sourceHandle: result.edge.sourceHandle,
        target: result.edge.target,
        targetHandle: result.edge.targetHandle,
      },
    });
  } catch (err) {
    console.error("Error al actualizar conexión del edge", err);
    return res
      .status(500)
      .json({ ok: false, message: "Error al actualizar la conexión del edge" });
  }
};
