const Channel = require("../models/channel.model");

const HANDLE_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9][0-9]*)$/;

function sanitizeNode(node) {
  if (!node || typeof node !== "object") {
    return null;
  }
  const position = node.position || {};
  const data = node.data && typeof node.data === "object" ? node.data : {};
  return {
    id: String(node.id),
    type: node.type ? String(node.type) : "default",
    position: {
      x: Number.isFinite(Number(position.x)) ? Number(position.x) : 0,
      y: Number.isFinite(Number(position.y)) ? Number(position.y) : 0,
    },
    ...(node.equipo ? { equipo: node.equipo } : {}),
    data,
  };
}

function sanitizeEdge(edge) {
  if (!edge || typeof edge !== "object") {
    return null;
  }
  const rawDirection = edge?.data?.direction;
  const direction = ["ida", "vuelta", "bi"].includes(rawDirection)
    ? rawDirection
    : "ida";

  const style = edge?.style && typeof edge.style === "object" ? edge.style : {};

  const sourceHandle = HANDLE_REGEX.test(edge?.sourceHandle || "")
    ? String(edge.sourceHandle)
    : null;
  const targetHandle = HANDLE_REGEX.test(edge?.targetHandle || "")
    ? String(edge.targetHandle)
    : null;

  if (!sourceHandle || !targetHandle) {
    throw new Error("Invalid edge handle format");
  }

  return {
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle,
    targetHandle,
    type: "customDirectional",
    label: edge.label ? String(edge.label) : "",
    data: {
      labelStart: edge?.data?.labelStart ? String(edge.data.labelStart) : "",
      labelEnd: edge?.data?.labelEnd ? String(edge.data.labelEnd) : "",
      direction,
    },
    style,
    animated: edge.animated !== undefined ? Boolean(edge.animated) : true,
  };
}

function sanitizeViewport(viewport) {
  if (!viewport || typeof viewport !== "object") {
    return null;
  }
  const x = Number(viewport.x);
  const y = Number(viewport.y);
  const zoom = Number(viewport.zoom);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1,
  };
}

exports.getChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await Channel.findById(id).lean({ getters: true, virtuals: true });
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }
    const diagram = channel.diagram || {};
    return res.json({
      nodes: Array.isArray(diagram.nodes) ? diagram.nodes : channel.nodes || [],
      edges: Array.isArray(diagram.edges) ? diagram.edges : channel.edges || [],
      viewport:
        diagram && typeof diagram.viewport === "object"
          ? diagram.viewport
          : null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateDiagram = async (req, res) => {
  try {
    const { id } = req.params;
    const nodesInput = Array.isArray(req.body?.nodes) ? req.body.nodes : [];
    const edgesInput = Array.isArray(req.body?.edges) ? req.body.edges : [];
    const viewportInput = req.body?.viewport;

    const sanitizedNodes = nodesInput.map((node) => sanitizeNode(node)).filter(Boolean);
    const sanitizedEdges = edgesInput.map((edge) => sanitizeEdge(edge)).filter(Boolean);
    const sanitizedViewport = sanitizeViewport(viewportInput);

    const update = {
      diagram: {
        nodes: sanitizedNodes,
        edges: sanitizedEdges,
        viewport: sanitizedViewport,
      },
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
    };

    const updated = await Channel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      upsert: false,
    }).lean({ getters: true, virtuals: true });

    if (!updated) {
      return res.status(404).json({ message: "Channel not found" });
    }

    return res.json(updated);
  } catch (error) {
    if (error.message === "Invalid edge handle format") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
  }
};
