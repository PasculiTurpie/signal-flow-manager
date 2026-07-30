const mongoose = require("mongoose");
const Channel = require("../models/channel.model");
const DiagramAudit = require("../models/diagramAudit.model");

const isValidObjectId = (value) => {
  if (!value) return false;
  try {
    return mongoose.Types.ObjectId.isValid(String(value));
  } catch (error) {
    return false;
  }
};

const isTransactionNotSupportedError = (error) => {
  if (!error) return false;
  const message = String(error.message || "");
  return (
    error.code === 20 ||
    error.code === 251 ||
    message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
    message.includes("Transactions are not allowed while connected to a standalone mongod")
  );
};

const executeWithOptionalTransaction = async (handler) => {
  const session = await mongoose.startSession();
  let transactionStarted = false;
  try {
    session.startTransaction();
    transactionStarted = true;
    const result = await handler(session);
    if (!result?.ok) {
      await session.abortTransaction().catch(() => {});
      return result;
    }
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (transactionStarted) {
      await session.abortTransaction().catch(() => {});
    }
    if (isTransactionNotSupportedError(error)) {
      try {
        return await handler(null);
      } catch (fallbackError) {
        return handleMongooseError(fallbackError);
      }
    }
    return handleMongooseError(error);
  } finally {
    session.endSession();
  }
};

/**
 * Maneja errores de Mongoose y retorna un objeto de respuesta apropiado
 * @param {Error} error - Error de Mongoose
 * @returns {object} { ok: false, status: number, message: string }
 */
function handleMongooseError(error) {
  // Errores de validación
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors || {}).map((err) => err.message);
    return {
      ok: false,
      status: 400,
      message: messages.join(", ") || "Error de validación",
    };
  }

  // Errores de clave duplicada
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "campo";
    return {
      ok: false,
      status: 409,
      message: `Ya existe un registro con ese ${field}`,
    };
  }

  // Errores de cast (por ejemplo, ObjectId inválido)
  if (error.name === "CastError") {
    return {
      ok: false,
      status: 400,
      message: `Valor inválido para ${error.path}: ${error.value}`,
    };
  }

  // Error genérico del servidor
  return {
    ok: false,
    status: 500,
    message: error.message || "Error interno del servidor",
  };
}

const normalizeId = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const sanitizePosition = (position) => {
  if (!position || typeof position !== "object") return null;
  const { x, y } = position;
  const parsedX = Number(x);
  const parsedY = Number(y);
  if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) return null;
  return { x: parsedX, y: parsedY };
};

const HANDLE_ID_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9]\d*)$/;
const HANDLE_KIND_TO_TYPE = { in: "target", out: "source" };
const FALLBACK_MAX_HANDLE_INDEX = 4;

const collectHandles = (node) => {
  if (!node) return [];
  const handles = [];
  if (Array.isArray(node.handles)) handles.push(...node.handles);
  if (Array.isArray(node.data?.handles)) handles.push(...node.data.handles);
  const byId = new Map();
  handles
    .filter((h) => h && typeof h === "object")
    .forEach((handle) => {
      const id = String(handle.id || "").trim();
      if (!id || byId.has(id)) return;
      byId.set(id, {
        id,
        type: String(handle.type || "").trim().toLowerCase(),
        side: handle.side,
      });
    });
  return Array.from(byId.values());
};

const ensureHandle = (node, handleId, expectedType) => {
  if (!handleId) {
    return {
      ok: true,
      handleId: handleId === null ? null : undefined,
    };
  }
  const normalized = String(handleId).trim();
  if (!normalized) {
    return { ok: true, handleId: null };
  }
  const available = collectHandles(node);
  const validateFallback = () => {
    const match = normalized.match(HANDLE_ID_REGEX);
    if (!match) {
      return {
        ok: false,
        error: `Handle ${normalized} no está definido en el nodo ${node?.id || ""}`,
        code: "handle_missing",
      };
    }
    const [, kind, , indexRaw] = match;
    const inferredType = HANDLE_KIND_TO_TYPE[kind] || null;
    const targetType = expectedType ? String(expectedType).trim().toLowerCase() : null;
    if (targetType && inferredType && inferredType !== targetType) {
      return {
        ok: false,
        error: `Handle ${normalized} en nodo ${node?.id || ""} es tipo ${inferredType} y se esperaba ${targetType}`,
        code: "handle_type_mismatch",
      };
    }
    const index = Number(indexRaw);
    if (!Number.isFinite(index) || index < 1 || index > FALLBACK_MAX_HANDLE_INDEX) {
      return {
        ok: false,
        error: `Handle ${normalized} no existe en el nodo ${node?.id || ""}`,
        code: "handle_invalid",
      };
    }
    return { ok: true, handleId: normalized };
  };

  if (available.length === 0) {
    return validateFallback();
  }
  const found = available.find((h) => h.id === normalized);
  if (!found) {
    return validateFallback();
  }
  const foundType = found.type ? String(found.type).trim().toLowerCase() : null;
  const targetType = expectedType ? String(expectedType).trim().toLowerCase() : null;
  if (targetType && foundType && foundType !== targetType) {
    return {
      ok: false,
      error: `Handle ${normalized} en nodo ${node?.id || ""} es tipo ${foundType} y se esperaba ${targetType}`,
      code: "handle_type_mismatch",
    };
  }
  return { ok: true, handleId: normalized };
};

const createAudit = async ({ session, entityType, entityId, channelId, action, before, after, userId }) => {
  const payload = {
    entityType,
    entityId,
    channelId,
    action,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
    userId: userId && isValidObjectId(userId) ? userId : undefined,
  };
  const options = session ? { session } : {};
  const audit = await DiagramAudit.create([payload], options);
  return audit[0];
};

async function updateNodePosition({ channelId, nodeId, position, userId }) {
  if (!isValidObjectId(channelId)) {
    return { ok: false, status: 400, message: "Canal inválido" };
  }
  const normalizedNodeId = normalizeId(nodeId);
  if (!normalizedNodeId) {
    return { ok: false, status: 400, message: "Nodo inválido" };
  }
  const sanitizedPosition = sanitizePosition(position);
  if (!sanitizedPosition) {
    return { ok: false, status: 400, message: "Posición inválida" };
  }

  const process = async (session) => {
    const query = Channel.findById(channelId).select({ nodes: 1 });
    if (session) {
      query.session(session);
    }
    const channel = await query.lean({ getters: true, virtuals: true });

    if (!channel) {
      return { ok: false, status: 404, message: "Channel no encontrado" };
    }

    const node = (channel.nodes || []).find(
      (n) => normalizeId(n?.id) === normalizedNodeId
    );
    if (!node) {
      return { ok: false, status: 404, message: "Nodo no encontrado" };
    }

    const before = { position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 } };

    const updateOptions = { runValidators: true };
    if (session) {
      updateOptions.session = session;
    }

    await Channel.updateOne(
      { _id: channelId, "nodes.id": normalizedNodeId },
      {
        $set: {
          "nodes.$.position.x": sanitizedPosition.x,
          "nodes.$.position.y": sanitizedPosition.y,
        },
      },
      updateOptions
    );

    const after = { position: sanitizedPosition };

    const audit = await createAudit({
      session,
      entityType: "node",
      entityId: normalizedNodeId,
      channelId,
      action: "move",
      before,
      after,
      userId,
    });

    return {
      ok: true,
      node: { id: normalizedNodeId, position: sanitizedPosition },
      auditId: audit?._id?.toString() || null,
    };
  };

  return executeWithOptionalTransaction(process);
}

async function reconnectEdge({ channelId, edgeId, patch = {}, userId }) {
  if (!isValidObjectId(channelId)) {
    return { ok: false, status: 400, message: "Canal inválido" };
  }
  const normalizedEdgeId = normalizeId(edgeId);
  if (!normalizedEdgeId) {
    return { ok: false, status: 400, message: "Edge inválido" };
  }
  const allowedKeys = ["source", "sourceHandle", "target", "targetHandle"];
  const hasAny = allowedKeys.some((key) => patch[key] !== undefined);
  if (!hasAny) {
    return { ok: false, status: 400, message: "Sin cambios para aplicar" };
  }

  const process = async (session) => {
    const query = Channel.findById(channelId).select({ nodes: 1, edges: 1 });
    if (session) {
      query.session(session);
    }
    const channel = await query.lean({ getters: true, virtuals: true });

    if (!channel) {
      return { ok: false, status: 404, message: "Channel no encontrado" };
    }

    const edge = (channel.edges || []).find(
      (e) => normalizeId(e?.id) === normalizedEdgeId
    );
    if (!edge) {
      return { ok: false, status: 404, message: "Edge no encontrado" };
    }

    const nodes = new Map(
      (channel.nodes || [])
        .map((n) => [normalizeId(n?.id), n])
        .filter(([key]) => Boolean(key))
    );

    const before = {
      source: normalizeId(edge.source) ?? edge.source,
      target: normalizeId(edge.target) ?? edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
    };

    const next = {
      ...before,
      source: normalizeId(before.source) ?? before.source,
      target: normalizeId(before.target) ?? before.target,
    };

    if (patch.source !== undefined) {
      const newSource = normalizeId(patch.source);
      if (!newSource) {
        return { ok: false, status: 400, message: "Source inválido" };
      }
      if (!nodes.has(newSource)) {
        return { ok: false, status: 404, message: `Nodo source ${newSource} inexistente` };
      }
      next.source = newSource;
    }

    if (patch.target !== undefined) {
      const newTarget = normalizeId(patch.target);
      if (!newTarget) {
        return { ok: false, status: 400, message: "Target inválido" };
      }
      if (!nodes.has(newTarget)) {
        return { ok: false, status: 404, message: `Nodo target ${newTarget} inexistente` };
      }
      next.target = newTarget;
    }

    const sourceNode = nodes.get(normalizeId(next.source));
    const targetNode = nodes.get(normalizeId(next.target));

    if (patch.sourceHandle !== undefined) {
      const check = ensureHandle(sourceNode, patch.sourceHandle, "source");
      if (!check.ok) {
        return { ok: false, status: 409, message: check.error };
      }
      next.sourceHandle = check.handleId ?? null;
    } else if (next.source !== before.source) {
      const check = ensureHandle(sourceNode, before.sourceHandle, "source");
      if (!check.ok) {
        return { ok: false, status: 409, message: check.error };
      }
      next.sourceHandle = check.handleId ?? null;
    }

    if (patch.targetHandle !== undefined) {
      const check = ensureHandle(targetNode, patch.targetHandle, "target");
      if (!check.ok) {
        return { ok: false, status: 409, message: check.error };
      }
      next.targetHandle = check.handleId ?? null;
    } else if (next.target !== before.target) {
      const check = ensureHandle(targetNode, before.targetHandle, "target");
      if (!check.ok) {
        return { ok: false, status: 409, message: check.error };
      }
      next.targetHandle = check.handleId ?? null;
    }

    const updateOptions = { runValidators: true };
    if (session) {
      updateOptions.session = session;
    }

    await Channel.updateOne(
      { _id: channelId, "edges.id": normalizedEdgeId },
      {
        $set: {
          "edges.$.source": next.source,
          "edges.$.target": next.target,
          "edges.$.sourceHandle": next.sourceHandle ?? null,
          "edges.$.targetHandle": next.targetHandle ?? null,
        },
      },
      updateOptions
    );

    const audit = await createAudit({
      session,
      entityType: "edge",
      entityId: normalizedEdgeId,
      channelId,
      action: "reconnect",
      before,
      after: next,
      userId,
    });

    return {
      ok: true,
      edge: {
        id: normalizedEdgeId,
        source: next.source,
        target: next.target,
        sourceHandle: next.sourceHandle ?? null,
        targetHandle: next.targetHandle ?? null,
      },
      auditId: audit?._id?.toString() || null,
    };
  };

  return executeWithOptionalTransaction(process);
}

async function updateEdgeTooltip({ channelId, edgeId, tooltipTitle, tooltip, userId }) {
  if (!isValidObjectId(channelId)) {
    return { ok: false, status: 400, message: "Canal inválido" };
  }
  const normalizedEdgeId = normalizeId(edgeId);
  if (!normalizedEdgeId) {
    return { ok: false, status: 400, message: "Edge inválido" };
  }

  const process = async (session) => {
    const query = Channel.findById(channelId).select({ edges: 1 });
    if (session) {
      query.session(session);
    }
    const channel = await query.lean({ getters: true, virtuals: true });

    if (!channel) {
      return { ok: false, status: 404, message: "Channel no encontrado" };
    }

    const edge = (channel.edges || []).find(
      (e) => normalizeId(e?.id) === normalizedEdgeId
    );
    if (!edge) {
      return { ok: false, status: 404, message: "Edge no encontrado" };
    }

    const before = {
      tooltipTitle: edge?.data?.tooltipTitle || null,
      tooltip: edge?.data?.tooltip || null,
    };

    const sanitized = {};
    if (tooltipTitle !== undefined) {
      const title = String(tooltipTitle ?? "").trim();
      sanitized.tooltipTitle = title || null;
    }
    if (tooltip !== undefined) {
      const body = String(tooltip ?? "").trim();
      sanitized.tooltip = body || null;
    }

    const updateOptions = { runValidators: true };
    if (session) {
      updateOptions.session = session;
    }

    await Channel.updateOne(
      { _id: channelId, "edges.id": normalizedEdgeId },
      {
        $set: {
          ...(tooltipTitle !== undefined
            ? { "edges.$.data.tooltipTitle": sanitized.tooltipTitle }
            : {}),
          ...(tooltip !== undefined
            ? { "edges.$.data.tooltip": sanitized.tooltip }
            : {}),
        },
      },
      updateOptions
    );

    const after = {
      tooltipTitle:
        tooltipTitle !== undefined ? sanitized.tooltipTitle : before.tooltipTitle,
      tooltip: tooltip !== undefined ? sanitized.tooltip : before.tooltip,
    };

    const audit = await createAudit({
      session,
      entityType: "edge",
      entityId: normalizedEdgeId,
      channelId,
      action: "edit",
      before,
      after,
      userId,
    });

    return {
      ok: true,
      edge: { id: normalizedEdgeId, data: after },
      auditId: audit?._id?.toString() || null,
    };
  };

  return executeWithOptionalTransaction(process);
}

/**
 * Crea un nuevo edge en un channel
 * @param {object} params - Parámetros para crear el edge
 * @param {string} params.channelId - ID del channel
 * @param {object} params.edge - Datos del edge a crear
 * @param {string} params.userId - ID del usuario (opcional)
 * @returns {object} { ok: boolean, edge?: object, auditId?: string }
 */
async function createEdge({ channelId, edge, userId }) {
  if (!isValidObjectId(channelId)) {
    return { ok: false, status: 400, message: "Canal inválido" };
  }

  const normalizedEdgeId = normalizeId(edge?.id);
  if (!normalizedEdgeId) {
    return { ok: false, status: 400, message: "Edge ID inválido" };
  }

  const source = normalizeId(edge?.source);
  const target = normalizeId(edge?.target);

  if (!source || !target) {
    return { ok: false, status: 400, message: "Source y target son requeridos" };
  }

  const process = async (session) => {
    const query = Channel.findById(channelId).select({ nodes: 1, edges: 1 });
    if (session) {
      query.session(session);
    }
    const channel = await query.lean({ getters: true, virtuals: true });

    if (!channel) {
      return { ok: false, status: 404, message: "Channel no encontrado" };
    }

    const existingEdge = (channel.edges || []).find(
      (e) => normalizeId(e?.id) === normalizedEdgeId
    );
    if (existingEdge) {
      return { ok: false, status: 409, message: "Ya existe un edge con ese ID" };
    }

    const nodes = new Map(
      (channel.nodes || [])
        .map((n) => [normalizeId(n?.id), n])
        .filter(([key]) => Boolean(key))
    );

    if (!nodes.has(source)) {
      return { ok: false, status: 404, message: `Nodo source ${source} inexistente` };
    }

    if (!nodes.has(target)) {
      return { ok: false, status: 404, message: `Nodo target ${target} inexistente` };
    }

    const sourceNode = nodes.get(source);
    const targetNode = nodes.get(target);

    if (edge.sourceHandle) {
      const check = ensureHandle(sourceNode, edge.sourceHandle, "source");
      if (!check.ok) {
        return { ok: false, status: 409, message: check.error };
      }
    }

    if (edge.targetHandle) {
      const check = ensureHandle(targetNode, edge.targetHandle, "target");
      if (!check.ok) {
        return { ok: false, status: 409, message: check.error };
      }
    }

    const newEdge = {
      id: normalizedEdgeId,
      source,
      target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      type: edge.type || "smoothstep",
      animated: edge.animated !== undefined ? edge.animated : true,
      data: edge.data || {},
      style: edge.style || {},
      markerEnd: edge.markerEnd || undefined,
      markerStart: edge.markerStart || undefined,
    };

    const updateOptions = { runValidators: true };
    if (session) {
      updateOptions.session = session;
    }

    await Channel.updateOne(
      { _id: channelId },
      { $push: { edges: newEdge } },
      updateOptions
    );

    const audit = await createAudit({
      session,
      entityType: "edge",
      entityId: normalizedEdgeId,
      channelId,
      action: "create",
      before: null,
      after: newEdge,
      userId,
    });

    return {
      ok: true,
      edge: newEdge,
      auditId: audit?._id?.toString() || null,
    };
  };

  return executeWithOptionalTransaction(process);
}

module.exports = {
  updateNodePosition,
  reconnectEdge,
  updateEdgeTooltip,
  createEdge,
};
