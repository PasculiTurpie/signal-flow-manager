const Channel = require("../models/channel.model");
const Signal = require("../models/signal.model");
const {
  normalizeChannel,
  normalizeChannels,
  normalizeNode,
  normalizeEdge,
} = require("../services/channelNormalizer");
const {
  clampLabel,
  sanitizePosition,
  sanitizeEndpointLabels,
  sanitizeEndpointPositions,
  sanitizeDiagramPayload,
} = require("../services/diagramSanitizer");
const { sanitizeHandles, normalizeHandleId } = require("../services/handleSanitizer");
const {
  updateNodePosition,
  reconnectEdge,
  updateEdgeTooltip,
  createEdge,
} = require("../services/channelPersistence.service");
const Equipo = require("../models/equipo.model");

const extractEquipoId = (rawValue) => {
  if (rawValue === undefined || rawValue === null) return null;

  if (typeof rawValue === "string" || typeof rawValue === "number") {
    const normalized = String(rawValue).trim();
    return normalized ? normalized : null;
  }

  if (Array.isArray(rawValue)) {
    for (const value of rawValue) {
      const extracted = extractEquipoId(value);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof rawValue === "object") {
    const candidateKeys = [
      "_id",
      "id",
      "value",
      "key",
      "equipoId",
      "equipoID",
      "equipo",
      "idEquipo",
    ];
    for (const key of candidateKeys) {
      if (!Object.prototype.hasOwnProperty.call(rawValue, key)) continue;
      const extracted = extractEquipoId(rawValue[key]);
      if (extracted) return extracted;
    }
    return null;
  }

  return null;
};

const resolveTipoNombre = (equipoDoc) => {
  if (!equipoDoc) return null;
  const { tipoNombre } = equipoDoc;
  if (!tipoNombre) return null;
  if (typeof tipoNombre === "string") {
    const trimmed = tipoNombre.trim();
    return trimmed || null;
  }
  if (typeof tipoNombre === "object") {
    const candidates = ["tipoNombre", "nombre", "name", "value"];
    for (const key of candidates) {
      if (!Object.prototype.hasOwnProperty.call(tipoNombre, key)) continue;
      const value = tipoNombre[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return null;
};

const attachEquipoDataToChannels = async (channels) => {
  const channelArray = Array.isArray(channels) ? channels : [channels].filter(Boolean);
  if (!channelArray.length) {
    return Array.isArray(channels) ? [] : null;
  }

  const equipoIds = new Set();

  channelArray.forEach((channel) => {
    const nodes = Array.isArray(channel?.nodes) ? channel.nodes : [];
    nodes.forEach((node) => {
      const candidateId =
        extractEquipoId(node?.equipo) ??
        extractEquipoId(node?.equipoId) ??
        extractEquipoId(node?.data?.equipoId) ??
        extractEquipoId(node?.data?.equipo);
      if (candidateId) {
        equipoIds.add(String(candidateId));
      }
    });
  });

  if (!equipoIds.size) {
    return Array.isArray(channels) ? channelArray : channelArray[0];
  }

  const equipos = await Equipo.find({ _id: { $in: [...equipoIds] } })
    .populate("tipoNombre")
    .populate("irdRef")
    .populate({
      path: "satelliteRef",
      populate: [{ path: "satelliteType", select: "typePolarization" }],
    })
    .lean({ getters: true, virtuals: true });

  const equipoMap = new Map(
    equipos.map((equipo) => [String(equipo?._id), equipo])
  );

  const mapNode = (node) => {
    const rawId =
      extractEquipoId(node?.equipo) ??
      extractEquipoId(node?.equipoId) ??
      extractEquipoId(node?.data?.equipoId) ??
      extractEquipoId(node?.data?.equipo);
    if (!rawId) return node;

    const equipoDoc = equipoMap.get(String(rawId));
    if (!equipoDoc) return node;

    const data = { ...(node?.data || {}) };
    data.equipo = equipoDoc;
    data.equipoId = String(equipoDoc._id);
    if (equipoDoc?.nombre) {
      data.equipoNombre = equipoDoc.nombre;
    }
    const tipoNombre = resolveTipoNombre(equipoDoc);
    if (tipoNombre) {
      data.equipoTipo = tipoNombre;
    }

    return {
      ...node,
      equipo: equipoDoc,
      data,
    };
  };

  const mapChannel = (channel) => {
    if (!channel) return channel;
    const nodes = Array.isArray(channel.nodes) ? channel.nodes : [];
    if (!nodes.length) return channel;
    return {
      ...channel,
      nodes: nodes.map((node) => mapNode(node)),
    };
  };

  if (Array.isArray(channels)) {
    return channelArray.map((channel) => mapChannel(channel));
  }

  return mapChannel(channelArray[0]);
};

const sanitizeHandleId = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = normalizeHandleId(value);
  if (normalized === undefined || normalized === null) {
    return null;
  }
  const str = String(normalized).trim();
  return str.length ? str : null;
};

const sanitizePlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
};

const sanitizeSerializable = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSerializable(entry));
  }
  if (typeof value === "object") {
    const plain = sanitizePlainObject(value);
    return plain === null ? null : plain;
  }
  return value;
};


const buildChannelFilter = (query = {}) => {
  const filter = {};
  const signal = query.signal || query.signalId;
  if (signal) {
    filter.signal = String(signal).trim();
  }
  return filter;
};

// Crear canal
module.exports.createChannel = async (req, res) => {
  try {
    const channel = new Channel(req.body);
    const saved = await channel.save();
    const rawChannel = saved.toObject({ getters: true, virtuals: true });
    const withEquipo = await attachEquipoDataToChannels(rawChannel);
    const payload = normalizeChannel(withEquipo);
    res.status(201).json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener todos los canales
module.exports.getChannel = async (req, res) => {
  try {
    const filter = buildChannelFilter(req.query);
    const channels = await Channel.find(filter)
      .select(
        "signal nodes.id nodes.type nodes.position nodes.data nodes.handles nodes.equipo edges.id edges.source edges.target edges.sourceHandle edges.targetHandle edges.type edges.style edges.data edges.label createdAt updatedAt"
      )
      .sort({ updatedAt: -1, _id: 1 })
      .lean({ getters: true, virtuals: true });

    const signalIds = Array.from(
      new Set(
        channels
          .map((channel) =>
            channel?.signal ? String(channel.signal).trim() : null
          )
          .filter(Boolean)
      )
    );

    let signals = [];
    if (signalIds.length) {
      signals = await Signal.find({ _id: { $in: signalIds } })
        .select("nameChannel numberChannelSur numberChannelCn logoChannel severidadChannel tipoServicio source nombre tipoTecnologia contact")
        .populate({ path: "contact", select: "nombre email telefono phone" })
        .lean({ getters: true, virtuals: true });
    }

    const signalMap = new Map(
      signals.map((signal) => [String(signal._id), signal])
    );

    const enriched = channels.map((channel) => {
      const rawSignal = channel?.signal;
      const signalId = rawSignal ? String(rawSignal).trim() : null;
      const resolvedSignal = signalId ? signalMap.get(signalId) || rawSignal : rawSignal;
      return {
        ...channel,
        signal: resolvedSignal,
      };
    });

    const withEquipo = await attachEquipoDataToChannels(enriched);

    res.json(normalizeChannels(withEquipo));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { signal, nodes, edges } = req.body;

    const updated = await Channel.findByIdAndUpdate(
      id,
      { signal, nodes, edges },
      { new: true, runValidators: true }
    ).lean({ getters: true, virtuals: true });

    if (!updated) {
      return res.status(404).json({ error: "Channel no encontrado" });
    }

    const withEquipo = await attachEquipoDataToChannels(updated);

    res.json(normalizeChannel(withEquipo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// controllers/channel.controller.js
module.exports.getChannelId = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .select(
        "signal nodes.id nodes.type nodes.position nodes.data nodes.handles nodes.equipo edges.id edges.source edges.target edges.sourceHandle edges.targetHandle edges.type edges.style edges.data edges.label createdAt updatedAt"
      )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const signalId = channel?.signal ? String(channel.signal).trim() : null;
    let resolvedSignal = channel.signal;
    if (signalId) {
      resolvedSignal = await Signal.findById(signalId)
        .select("nameChannel nombre tipoTecnologia logoChannel contact")
        .populate({ path: "contact", select: "nombre email telefono phone" })
        .lean({ getters: true, virtuals: true })
        .exec();
    }

    const channelWithSignal = {
      ...channel,
      signal: resolvedSignal || channel.signal,
    };

    const withEquipo = await attachEquipoDataToChannels(channelWithSignal);

    res.json(normalizeChannel(withEquipo));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};




/* +++++++++++++++++++++++++++++++ */

// Obtener canal por ID

// Actualizar canal


// Eliminar canal
module.exports.deleteChannel = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedChannel = await Channel.findByIdAndDelete(id);
    if (!deletedChannel) {
      return res.status(404).json({ message: "Canal no encontrado para eliminar" });
    }
    res.status(200).json({ message: "Canal eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el canal", error: error.message });
  }
};

/* UPDATE CHANNEL */

exports.updateChannelFlow = async (req, res) => {
  try {
    const { nodes: rawNodes, edges: rawEdges } = req.body || {};
    const { nodes, edges } = sanitizeDiagramPayload({
      nodes: rawNodes,
      edges: rawEdges,
    });

    const updatedChannel = await Channel.findByIdAndUpdate(
      req.params.id,
      { nodes, edges },
      { new: true, runValidators: true }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!updatedChannel) {
      return res.status(404).json({ error: "Channel no encontrado" });
    }

    const withEquipo = await attachEquipoDataToChannels(updatedChannel);

    res.json(normalizeChannel(withEquipo));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.patchNode = async (req, res) => {
  const { id, nodeId } = req.params;
  const { label, labelPosition, position } = req.body || {};

  const setUpdate = {};
  const unsetUpdate = {};

  if (label !== undefined) {
    const sanitizedLabel = clampLabel(label);
    setUpdate["nodes.$.data.label"] = sanitizedLabel;
    setUpdate["nodes.$.label"] = sanitizedLabel;
  }

  if (labelPosition !== undefined) {
    if (labelPosition === null) {
      unsetUpdate["nodes.$.data.labelPosition"] = "";
    } else {
      const sanitizedPosition = sanitizePosition(labelPosition);
      if (sanitizedPosition) {
        setUpdate["nodes.$.data.labelPosition"] = sanitizedPosition;
      } else {
        unsetUpdate["nodes.$.data.labelPosition"] = "";
      }
    }
  }

  if (position !== undefined) {
    const sanitizedPosition = sanitizePosition(position);
    if (!sanitizedPosition) {
      return res.status(400).json({ error: "Posición de nodo inválida" });
    }
    setUpdate["nodes.$.position.x"] = sanitizedPosition.x;
    setUpdate["nodes.$.position.y"] = sanitizedPosition.y;
  }

  const update = {};
  if (Object.keys(setUpdate).length > 0) update.$set = setUpdate;
  if (Object.keys(unsetUpdate).length > 0) update.$unset = unsetUpdate;

  if (!update.$set && !update.$unset) {
    return res.status(400).json({ error: "No hay cambios para aplicar" });
  }

  try {
    const updateResult = await Channel.updateOne(
      { _id: id, "nodes.id": nodeId },
      update,
      { runValidators: true }
    ).exec();

    const matchedCount =
      typeof updateResult.matchedCount === "number"
        ? updateResult.matchedCount
        : updateResult.n || 0;

    if (!matchedCount) {
      return res.status(404).json({ error: "Nodo no encontrado" });
    }

    const refreshed = await Channel.findOne(
      { _id: id, "nodes.id": nodeId },
      { _id: 1, nodes: { $elemMatch: { id: nodeId } } }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!refreshed || !Array.isArray(refreshed.nodes) || refreshed.nodes.length === 0) {
      return res.status(404).json({ error: "Nodo no encontrado" });
    }

    return res.json({ node: normalizeNode(refreshed.nodes[0]) });
  } catch (error) {
    console.error("patchNode error", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.patchNodeHandles = async (req, res) => {
  const { id, nodeId } = req.params;
  const payload = Array.isArray(req.body?.handles) ? req.body.handles : req.body;

  try {
    const snapshot = await Channel.findOne(
      { _id: id, "nodes.id": nodeId },
      { "nodes.$": 1 }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!snapshot || !Array.isArray(snapshot.nodes) || snapshot.nodes.length === 0) {
      return res.status(404).json({ error: "Nodo no encontrado" });
    }

    const existingNode = snapshot.nodes[0];
    const fallbackHandles = existingNode.handles || existingNode.data?.handles || [];
    const sanitized = sanitizeHandles(payload, fallbackHandles);

    await Channel.updateOne(
      { _id: id, "nodes.id": nodeId },
      {
        $set: {
          "nodes.$.handles": sanitized,
          "nodes.$.data.handles": sanitized,
        },
      },
      { runValidators: true }
    ).exec();

    const refreshed = await Channel.findOne(
      { _id: id, "nodes.id": nodeId },
      { _id: 1, nodes: { $elemMatch: { id: nodeId } } }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!refreshed || !Array.isArray(refreshed.nodes) || refreshed.nodes.length === 0) {
      return res.status(404).json({ error: "Nodo no encontrado" });
    }

    const normalizedNode = normalizeNode(refreshed.nodes[0]);
    return res.json({
      node: normalizedNode,
      handles: normalizedNode?.handles || [],
    });
  } catch (error) {
    console.error("patchNodeHandles error", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.patchEdge = async (req, res) => {
  const { id, edgeId } = req.params;
  const {
    label,
    labelPosition,
    endpointLabels,
    endpointLabelPositions,
    multicast,
    multicastPosition,
    source,
    target,
    sourceHandle,
    targetHandle,
    style,
    markerStart,
    markerEnd,
    animated,
    type: edgeType,
    data: rawData,
  } = req.body || {};

  const dataPayload =
    rawData && typeof rawData === "object" && !Array.isArray(rawData) ? rawData : null;

  const resolvedLabel =
    label !== undefined
      ? label
      : dataPayload && Object.prototype.hasOwnProperty.call(dataPayload, "label")
      ? dataPayload.label
      : undefined;

  const resolvedLabelPosition =
    labelPosition !== undefined
      ? labelPosition
      : dataPayload && Object.prototype.hasOwnProperty.call(dataPayload, "labelPosition")
      ? dataPayload.labelPosition
      : undefined;

  const resolvedEndpointLabels =
    endpointLabels !== undefined
      ? endpointLabels
      : dataPayload && Object.prototype.hasOwnProperty.call(dataPayload, "endpointLabels")
      ? dataPayload.endpointLabels
      : undefined;

  const resolvedEndpointLabelPositions =
    endpointLabelPositions !== undefined
      ? endpointLabelPositions
      : dataPayload &&
        Object.prototype.hasOwnProperty.call(dataPayload, "endpointLabelPositions")
      ? dataPayload.endpointLabelPositions
      : undefined;

  const resolvedMulticast =
    multicast !== undefined
      ? multicast
      : dataPayload && Object.prototype.hasOwnProperty.call(dataPayload, "multicast")
      ? dataPayload.multicast
      : undefined;

  const resolvedMulticastPosition =
    multicastPosition !== undefined
      ? multicastPosition
      : dataPayload &&
        Object.prototype.hasOwnProperty.call(dataPayload, "multicastPosition")
      ? dataPayload.multicastPosition
      : undefined;

  const setUpdate = {};
  const unsetUpdate = {};

  if (resolvedLabel !== undefined) {
    const sanitizedLabel = clampLabel(resolvedLabel);
    setUpdate["edges.$.label"] = sanitizedLabel;
    setUpdate["edges.$.data.label"] = sanitizedLabel;
  }

  if (source !== undefined) {
    const sanitizedSource = String(source ?? "").trim();
    if (!sanitizedSource) {
      return res.status(400).json({ error: "Source inválido" });
    }
    setUpdate["edges.$.source"] = sanitizedSource;
  }

  if (target !== undefined) {
    const sanitizedTarget = String(target ?? "").trim();
    if (!sanitizedTarget) {
      return res.status(400).json({ error: "Target inválido" });
    }
    setUpdate["edges.$.target"] = sanitizedTarget;
  }

  if (sourceHandle !== undefined) {
    const sanitizedSourceHandle = sanitizeHandleId(sourceHandle);
    if (sanitizedSourceHandle) {
      setUpdate["edges.$.sourceHandle"] = sanitizedSourceHandle;
    } else {
      unsetUpdate["edges.$.sourceHandle"] = "";
    }
  }

  if (targetHandle !== undefined) {
    const sanitizedTargetHandle = sanitizeHandleId(targetHandle);
    if (sanitizedTargetHandle) {
      setUpdate["edges.$.targetHandle"] = sanitizedTargetHandle;
    } else {
      unsetUpdate["edges.$.targetHandle"] = "";
    }
  }

  if (style !== undefined) {
    const sanitizedStyle = sanitizePlainObject(style);
    if (sanitizedStyle && Object.keys(sanitizedStyle).length) {
      setUpdate["edges.$.style"] = sanitizedStyle;
    } else {
      unsetUpdate["edges.$.style"] = "";
    }
  }

  if (markerStart !== undefined) {
    const sanitizedMarkerStart = sanitizePlainObject(markerStart);
    if (sanitizedMarkerStart && Object.keys(sanitizedMarkerStart).length) {
      setUpdate["edges.$.markerStart"] = sanitizedMarkerStart;
    } else {
      unsetUpdate["edges.$.markerStart"] = "";
    }
  }

  if (markerEnd !== undefined) {
    const sanitizedMarkerEnd = sanitizePlainObject(markerEnd);
    if (sanitizedMarkerEnd && Object.keys(sanitizedMarkerEnd).length) {
      setUpdate["edges.$.markerEnd"] = sanitizedMarkerEnd;
    } else {
      unsetUpdate["edges.$.markerEnd"] = "";
    }
  }

  if (animated !== undefined) {
    setUpdate["edges.$.animated"] = Boolean(animated);
  }

  if (edgeType !== undefined) {
    const sanitizedType = String(edgeType ?? "").trim();
    if (sanitizedType) {
      setUpdate["edges.$.type"] = sanitizedType;
    }
  }

  if (resolvedLabelPosition !== undefined) {
    if (resolvedLabelPosition === null) {
      unsetUpdate["edges.$.labelPosition"] = "";
      unsetUpdate["edges.$.data.labelPosition"] = "";
    } else {
      const sanitizedPosition = sanitizePosition(resolvedLabelPosition);
      if (sanitizedPosition) {
        setUpdate["edges.$.labelPosition"] = sanitizedPosition;
        setUpdate["edges.$.data.labelPosition"] = sanitizedPosition;
      } else {
        unsetUpdate["edges.$.labelPosition"] = "";
        unsetUpdate["edges.$.data.labelPosition"] = "";
      }
    }
  }

  if (resolvedEndpointLabels !== undefined) {
    const sanitized = sanitizeEndpointLabels(resolvedEndpointLabels);
    if (Object.prototype.hasOwnProperty.call(sanitized, "source")) {
      if (sanitized.source === null) {
        unsetUpdate["edges.$.data.endpointLabels.source"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabels.source"] = sanitized.source;
      }
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, "target")) {
      if (sanitized.target === null) {
        unsetUpdate["edges.$.data.endpointLabels.target"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabels.target"] = sanitized.target;
      }
    }
  }

  if (resolvedEndpointLabelPositions !== undefined) {
    const sanitized = sanitizeEndpointPositions(resolvedEndpointLabelPositions);
    if (Object.prototype.hasOwnProperty.call(sanitized, "source")) {
      if (!sanitized.source) {
        unsetUpdate["edges.$.data.endpointLabelPositions.source"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabelPositions.source"] = sanitized.source;
      }
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, "target")) {
      if (!sanitized.target) {
        unsetUpdate["edges.$.data.endpointLabelPositions.target"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabelPositions.target"] = sanitized.target;
      }
    }
  }

  if (resolvedMulticast !== undefined) {
    const sanitized = clampLabel(resolvedMulticast).trim();
    if (!sanitized) {
      unsetUpdate["edges.$.data.multicast"] = "";
    } else {
      setUpdate["edges.$.data.multicast"] = sanitized;
    }
  }

  if (resolvedMulticastPosition !== undefined) {
    if (resolvedMulticastPosition === null) {
      unsetUpdate["edges.$.data.multicastPosition"] = "";
    } else {
      const sanitizedPosition = sanitizePosition(resolvedMulticastPosition);
      if (sanitizedPosition) {
        setUpdate["edges.$.data.multicastPosition"] = sanitizedPosition;
      } else {
        unsetUpdate["edges.$.data.multicastPosition"] = "";
      }
    }
  }

  if (dataPayload) {
    Object.keys(dataPayload).forEach((key) => {
      if (key === "labelStart" || key === "labelEnd") {
        const rawValue = dataPayload[key];
        const sanitized = rawValue === null ? null : clampLabel(rawValue);
        const dataPath = `edges.$.data.${key}`;
        const endpointKey = key === "labelStart" ? "source" : "target";
        const endpointPath = `edges.$.data.endpointLabels.${endpointKey}`;
        if (sanitized) {
          setUpdate[dataPath] = sanitized;
          setUpdate[endpointPath] = sanitized;
        } else {
          unsetUpdate[dataPath] = "";
          unsetUpdate[endpointPath] = "";
        }
        return;
      }
      if (
        key === "label" ||
        key === "labelPosition" ||
        key === "endpointLabels" ||
        key === "endpointLabelPositions" ||
        key === "multicast" ||
        key === "multicastPosition"
      ) {
        return;
      }
      let value = dataPayload[key];
      if (key === "direction" && typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        value = normalized === "vuelta" ? "vuelta" : "ida";
      } else {
        value = sanitizeSerializable(value);
      }
      if (value === undefined) return;
      if (value === null) {
        unsetUpdate[`edges.$.data.${key}`] = "";
      } else {
        setUpdate[`edges.$.data.${key}`] = value;
      }
    });
  }

  const update = {};
  if (Object.keys(setUpdate).length > 0) update.$set = setUpdate;
  if (Object.keys(unsetUpdate).length > 0) update.$unset = unsetUpdate;

  if (!update.$set && !update.$unset) {
    return res.status(400).json({ error: "No hay cambios para aplicar" });
  }

  try {
    const updateResult = await Channel.updateOne(
      { _id: id, "edges.id": edgeId },
      update,
      { runValidators: true }
    ).exec();

    const matchedCount =
      typeof updateResult.matchedCount === "number"
        ? updateResult.matchedCount
        : updateResult.n || 0;

    if (!matchedCount) {
      return res.status(404).json({ error: "Enlace no encontrado" });
    }

    const refreshed = await Channel.findOne(
      { _id: id, "edges.id": edgeId },
      { _id: 1, edges: { $elemMatch: { id: edgeId } } }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!refreshed || !Array.isArray(refreshed.edges) || refreshed.edges.length === 0) {
      return res.status(404).json({ error: "Enlace no encontrado" });
    }

    return res.json({ edge: normalizeEdge(refreshed.edges[0]) });
  } catch (error) {
    console.error("patchEdge error", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.patchNodePosition = async (req, res) => {
  const { id: channelId, nodeId } = req.params;
  const position = req.body?.position;

  const result = await updateNodePosition({
    channelId,
    nodeId,
    position,
    userId: req.user?._id || req.user?.id || null,
  });

  if (!result.ok) {
    return res
      .status(result.status || 500)
      .json({ ok: false, message: result.message || "Error interno" });
  }

  res.locals.auditContext = {
    action: "update",
    resource: "channels",
    resourceId: channelId,
    channelId,
    operation: "diagram",
    summaryDiff: {
      entityType: "node",
      entityId: nodeId,
      action: "move",
      position: result.node?.position || null,
    },
  };

  return res.json({ ok: true, node: result.node, auditId: result.auditId });
};

exports.patchEdgeReconnect = async (req, res) => {
  const { id: channelId, edgeId } = req.params;
  const patch = req.body || {};

  const result = await reconnectEdge({
    channelId,
    edgeId,
    patch,
    userId: req.user?._id || req.user?.id || null,
  });

  if (!result.ok) {
    return res
      .status(result.status || 500)
      .json({ ok: false, message: result.message || "Error interno" });
  }

  res.locals.auditContext = {
    action: "update",
    resource: "channels",
    resourceId: channelId,
    channelId,
    operation: "diagram",
    summaryDiff: {
      entityType: "edge",
      entityId: edgeId,
      action: "reconnect",
      next: result.edge,
    },
  };

  return res.json({ ok: true, edge: result.edge, auditId: result.auditId });
};

exports.patchEdgeTooltip = async (req, res) => {
  const { id: channelId, edgeId } = req.params;
  const { tooltipTitle, tooltip } = req.body || {};

  const result = await updateEdgeTooltip({
    channelId,
    edgeId,
    tooltipTitle,
    tooltip,
    userId: req.user?._id || req.user?.id || null,
  });

  if (!result.ok) {
    return res
      .status(result.status || 500)
      .json({ ok: false, message: result.message || "Error interno" });
  }

  res.locals.auditContext = {
    action: "update",
    resource: "channels",
    resourceId: channelId,
    channelId,
    operation: "diagram",
    summaryDiff: {
      entityType: "edge",
      entityId: edgeId,
      action: "edit",
      tooltip: result.edge?.data || null,
    },
  };

  return res.json({ ok: true, edge: result.edge, auditId: result.auditId });
};

/**
 * POST /channels/:id/edges
 * Crea un nuevo edge en el channel
 */
exports.createEdge = async (req, res) => {
  const { id: channelId } = req.params;
  const edge = req.body || {};

  if (!edge.id) {
    return res.status(400).json({ ok: false, message: "Edge ID es requerido" });
  }

  if (!edge.source || !edge.target) {
    return res.status(400).json({ ok: false, message: "Source y target son requeridos" });
  }

  const result = await createEdge({
    channelId,
    edge,
    userId: req.user?._id || req.user?.id || null,
  });

  if (!result.ok) {
    return res
      .status(result.status || 500)
      .json({ ok: false, message: result.message || "Error interno" });
  }

  res.locals.auditContext = {
    action: "create",
    resource: "channels",
    resourceId: channelId,
    channelId,
    operation: "diagram",
    summaryDiff: {
      entityType: "edge",
      entityId: edge.id,
      action: "create",
      edge: result.edge,
    },
  };

  return res.status(201).json({ ok: true, edge: result.edge, auditId: result.auditId });
};

module.exports.patchLabelPositions = async (req, res) => {
  const channelId = req.params.id || req.params.channelId;
  if (!channelId) {
    return res.status(400).json({ error: "ChannelId es requerido" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const labelPositionsInput =
    body.labelPositions && typeof body.labelPositions === "object"
      ? body.labelPositions
      : {};
  const nodesInput =
    labelPositionsInput.nodes && typeof labelPositionsInput.nodes === "object"
      ? labelPositionsInput.nodes
      : {};
  const edgesInput =
    labelPositionsInput.edges && typeof labelPositionsInput.edges === "object"
      ? labelPositionsInput.edges
      : {};
  const endpointInput =
    body.endpointLabelPositions &&
    typeof body.endpointLabelPositions === "object"
      ? body.endpointLabelPositions
      : {};

  const existingChannel = await Channel.findById(channelId)
    .select({
      _id: 1,
      nodes: 1,
      edges: 1,
    })
    .lean({ getters: true, virtuals: true })
    .exec();

  if (!existingChannel) {
    return res.status(404).json({ error: "Channel no encontrado" });
  }

  const sanitizePoint = (value) => sanitizePosition(value) || null;
  const clonePoint = (value) => (value ? { x: value.x, y: value.y } : null);
  const samePoint = (a, b) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return Number(a.x) === Number(b.x) && Number(a.y) === Number(b.y);
  };

  const nodeMap = new Map();
  (Array.isArray(existingChannel.nodes) ? existingChannel.nodes : []).forEach((node) => {
    const id = node?.id ? String(node.id).trim() : "";
    if (!id) return;
    nodeMap.set(id, {
      labelPosition: sanitizePoint(node?.data?.labelPosition),
      multicastPosition: sanitizePoint(node?.data?.multicastPosition),
    });
  });

  const edgeMap = new Map();
  (Array.isArray(existingChannel.edges) ? existingChannel.edges : []).forEach((edge) => {
    const id = edge?.id ? String(edge.id).trim() : "";
    if (!id) return;
    const data = edge?.data && typeof edge.data === "object" ? edge.data : {};
    const endpointPositions = {};
    if (data.endpointLabelPositions && typeof data.endpointLabelPositions === "object") {
      if (data.endpointLabelPositions.source) {
        const sanitized = sanitizePoint(data.endpointLabelPositions.source);
        if (sanitized) endpointPositions.source = sanitized;
      }
      if (data.endpointLabelPositions.target) {
        const sanitized = sanitizePoint(data.endpointLabelPositions.target);
        if (sanitized) endpointPositions.target = sanitized;
      }
    }

    edgeMap.set(id, {
      labelPosition: sanitizePoint(data.labelPosition) || sanitizePoint(edge.labelPosition),
      multicastPosition: sanitizePoint(data.multicastPosition),
      endpointLabelPositions: endpointPositions,
    });
  });

  const setOperations = {};
  const unsetOperations = {};
  const arrayFilters = [];
  const nodeFilterNames = new Map();
  const edgeFilterNames = new Map();
  const touchedNodes = new Set();
  const touchedEdges = new Set();
  const diffNodes = {};
  const diffEdges = {};

  const ensureNodeFilter = (id) => {
    if (nodeFilterNames.has(id)) return nodeFilterNames.get(id);
    const name = `n${nodeFilterNames.size}`;
    nodeFilterNames.set(id, name);
    arrayFilters.push({ [`${name}.id`]: id });
    return name;
  };

  const ensureEdgeFilter = (id) => {
    if (edgeFilterNames.has(id)) return edgeFilterNames.get(id);
    const name = `e${edgeFilterNames.size}`;
    edgeFilterNames.set(id, name);
    arrayFilters.push({ [`${name}.id`]: id });
    return name;
  };

  Object.entries(nodesInput).forEach(([nodeKey, rawData]) => {
    const nodeId = String(nodeKey ?? "").trim();
    if (!nodeId) return;
    const baseline = nodeMap.get(nodeId);
    if (!baseline) return;
    const data = rawData && typeof rawData === "object" ? rawData : {};

    if (Object.prototype.hasOwnProperty.call(data, "labelPosition")) {
      const sanitized = sanitizePoint(data.labelPosition);
      const nextValue = sanitized || null;
      const previous = baseline.labelPosition || null;
      if (!samePoint(previous, nextValue)) {
        const filterName = ensureNodeFilter(nodeId);
        if (nextValue) {
          setOperations[`nodes.$[${filterName}].data.labelPosition`] = nextValue;
        } else {
          unsetOperations[`nodes.$[${filterName}].data.labelPosition`] = "";
        }
        diffNodes[nodeId] = diffNodes[nodeId] || {};
        diffNodes[nodeId].labelPosition = {
          from: clonePoint(previous),
          to: clonePoint(nextValue),
        };
        touchedNodes.add(nodeId);
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, "multicastPosition")) {
      const sanitized = sanitizePoint(data.multicastPosition);
      const nextValue = sanitized || null;
      const previous = baseline.multicastPosition || null;
      if (!samePoint(previous, nextValue)) {
        const filterName = ensureNodeFilter(nodeId);
        if (nextValue) {
          setOperations[`nodes.$[${filterName}].data.multicastPosition`] = nextValue;
        } else {
          unsetOperations[`nodes.$[${filterName}].data.multicastPosition`] = "";
        }
        diffNodes[nodeId] = diffNodes[nodeId] || {};
        diffNodes[nodeId].multicastPosition = {
          from: clonePoint(previous),
          to: clonePoint(nextValue),
        };
        touchedNodes.add(nodeId);
      }
    }
  });

  Object.entries(edgesInput).forEach(([edgeKey, rawData]) => {
    const edgeId = String(edgeKey ?? "").trim();
    if (!edgeId) return;
    const baseline = edgeMap.get(edgeId);
    if (!baseline) return;
    const data = rawData && typeof rawData === "object" ? rawData : {};

    if (Object.prototype.hasOwnProperty.call(data, "labelPosition")) {
      const sanitized = sanitizePoint(data.labelPosition);
      const nextValue = sanitized || null;
      const previous = baseline.labelPosition || null;
      if (!samePoint(previous, nextValue)) {
        const filterName = ensureEdgeFilter(edgeId);
        if (nextValue) {
          setOperations[`edges.$[${filterName}].data.labelPosition`] = nextValue;
          setOperations[`edges.$[${filterName}].labelPosition`] = nextValue;
        } else {
          unsetOperations[`edges.$[${filterName}].data.labelPosition`] = "";
          unsetOperations[`edges.$[${filterName}].labelPosition`] = "";
        }
        diffEdges[edgeId] = diffEdges[edgeId] || {};
        diffEdges[edgeId].labelPosition = {
          from: clonePoint(previous),
          to: clonePoint(nextValue),
        };
        touchedEdges.add(edgeId);
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, "multicastPosition")) {
      const sanitized = sanitizePoint(data.multicastPosition);
      const nextValue = sanitized || null;
      const previous = baseline.multicastPosition || null;
      if (!samePoint(previous, nextValue)) {
        const filterName = ensureEdgeFilter(edgeId);
        if (nextValue) {
          setOperations[`edges.$[${filterName}].data.multicastPosition`] = nextValue;
        } else {
          unsetOperations[`edges.$[${filterName}].data.multicastPosition`] = "";
        }
        diffEdges[edgeId] = diffEdges[edgeId] || {};
        diffEdges[edgeId].multicastPosition = {
          from: clonePoint(previous),
          to: clonePoint(nextValue),
        };
        touchedEdges.add(edgeId);
      }
    }
  });

  Object.entries(endpointInput).forEach(([edgeKey, rawData]) => {
    const edgeId = String(edgeKey ?? "").trim();
    if (!edgeId) return;
    const baseline = edgeMap.get(edgeId);
    if (!baseline) return;
    const data = rawData && typeof rawData === "object" ? rawData : {};

    ["source", "target"].forEach((endpoint) => {
      if (!Object.prototype.hasOwnProperty.call(data, endpoint)) return;
      const sanitized = sanitizePoint(data[endpoint]);
      const nextValue = sanitized || null;
      const previous =
        baseline.endpointLabelPositions && baseline.endpointLabelPositions[endpoint]
          ? baseline.endpointLabelPositions[endpoint]
          : null;
      if (!samePoint(previous, nextValue)) {
        const filterName = ensureEdgeFilter(edgeId);
        if (nextValue) {
          setOperations[`edges.$[${filterName}].data.endpointLabelPositions.${endpoint}`] = nextValue;
        } else {
          unsetOperations[`edges.$[${filterName}].data.endpointLabelPositions.${endpoint}`] = "";
        }
        diffEdges[edgeId] = diffEdges[edgeId] || {};
        diffEdges[edgeId].endpointLabelPositions =
          diffEdges[edgeId].endpointLabelPositions || {};
        diffEdges[edgeId].endpointLabelPositions[endpoint] = {
          from: clonePoint(previous),
          to: clonePoint(nextValue),
        };
        touchedEdges.add(edgeId);
      }
    });
  });

  const updatePayload = {};
  if (Object.keys(setOperations).length) {
    updatePayload.$set = setOperations;
  }
  if (Object.keys(unsetOperations).length) {
    updatePayload.$unset = unsetOperations;
  }

  if (!updatePayload.$set && !updatePayload.$unset) {
    return res
      .status(400)
      .json({ error: "No hay posiciones válidas para actualizar" });
  }

  try {
    const result = await Channel.updateOne(
      { _id: channelId },
      updatePayload,
      { arrayFilters, runValidators: true }
    ).exec();

    const matchedCount =
      typeof result.matchedCount === "number"
        ? result.matchedCount
        : result.n || 0;

    if (!matchedCount) {
      return res.status(404).json({ error: "Channel no encontrado" });
    }

    const summaryDiff = {};
    if (Object.keys(diffNodes).length) {
      summaryDiff.nodes = diffNodes;
    }
    if (Object.keys(diffEdges).length) {
      summaryDiff.edges = diffEdges;
    }

    const hasLabelChanges =
      Object.values(diffNodes).length > 0 ||
      Object.values(diffEdges).some((entry) =>
        Boolean(entry.labelPosition || entry.multicastPosition)
      );
    const hasEndpointChanges = Object.values(diffEdges).some(
      (entry) => entry.endpointLabelPositions && Object.keys(entry.endpointLabelPositions).length
    );

    let auditAction = null;
    if (hasLabelChanges && hasEndpointChanges) {
      auditAction = "PATCH_LABELS_AND_ENDPOINT_LABELS";
    } else if (hasEndpointChanges) {
      auditAction = "PATCH_ENDPOINT_LABELS";
    } else {
      auditAction = "PATCH_LABELS";
    }

    const originHeader = String(req.headers["x-diagram-origin"] || "").trim();
    const origin = originHeader === "ChannelForm" ? "ChannelForm" : "ChannelDiagram";

    res.locals.auditContext = {
      origin,
      channelId: String(channelId),
      action: auditAction,
      operation: "PATCH_LABEL_POSITIONS",
      summaryDiff: Object.keys(summaryDiff).length ? summaryDiff : undefined,
      meta: {
        updatedNodes: touchedNodes.size,
        updatedEdges: touchedEdges.size,
      },
    };

    return res.json({
      ok: true,
      updated: {
        nodes: touchedNodes.size,
        edges: touchedEdges.size,
      },
      summaryDiff,
    });
  } catch (error) {
    console.error("patchLabelPositions error", error);
    return res.status(500).json({ error: error.message });
  }
};


