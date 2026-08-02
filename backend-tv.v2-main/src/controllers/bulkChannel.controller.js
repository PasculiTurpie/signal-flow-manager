// controllers/bulkChannel.controller.js
//
// Carga masiva de Channels (diagramas de red) desde un Excel con 3 hojas:
//
//   Hoja "Channels": 1 fila por canal (metadata + referencia a su Signal)
//     nameChannel | signalNameChannel | signalTipoTecnologia | numberChannelSur |
//     numberChannelCn | logoChannel | severidadChannel | tipoTecnologia
//
//   Hoja "Nodes": 1 fila por nodo (equipo) del diagrama
//     nameChannel | nodeId | equipoNombre | label | x | y
//     (x/y son opcionales: si se omiten, se calculan automáticamente)
//
//   Hoja "Edges": 1 fila por conexión entre nodos
//     nameChannel | edgeId | source | target | label | direction
//     (direction: ida | vuelta | bi — default "ida")
//
// "nameChannel" es la columna que enlaza las 3 hojas entre sí.

const XLSX = require("xlsx");
const Channel = require("../models/channel.model");
const Signal = require("../models/signal.model");
const Equipo = require("../models/equipo.model");

const normalizeStr = (s) => String(s ?? "").trim();
const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const CHANNEL_REQUIRED = ["nameChannel", "signalNameChannel"];
const NODE_REQUIRED = ["nameChannel", "nodeId", "equipoNombre"];
const EDGE_REQUIRED = ["nameChannel", "edgeId", "source", "target"];

/* ------------------------- Lectura de las 3 hojas ------------------------ */

function readSheet(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws);
}

/* --------------------------- Auto-layout simple --------------------------
 * Layout por niveles (BFS) a partir de las aristas: los nodos sin conexiones
 * de entrada quedan en el nivel 0, y cada nodo se ubica un nivel después del
 * máximo nivel de sus predecesores. Los nodos aislados (sin edges) se ponen
 * en una fila aparte. Sirve como punto de partida razonable; el usuario
 * puede reacomodar los nodos luego arrastrándolos en el editor.
 * -------------------------------------------------------------------------*/
function autoLayout(nodeIds, edges) {
  const levelOf = new Map();
  const incoming = new Map(nodeIds.map((id) => [id, 0]));
  const adj = new Map(nodeIds.map((id) => [id, []]));

  for (const e of edges) {
    if (adj.has(e.source) && incoming.has(e.target)) {
      adj.get(e.source).push(e.target);
      incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
    }
  }

  const queue = nodeIds.filter((id) => (incoming.get(id) || 0) === 0);
  queue.forEach((id) => levelOf.set(id, 0));

  let guard = 0;
  while (queue.length && guard < nodeIds.length * 4) {
    guard++;
    const current = queue.shift();
    const lvl = levelOf.get(current) || 0;
    for (const next of adj.get(current) || []) {
      const candidate = lvl + 1;
      if (!levelOf.has(next) || candidate > levelOf.get(next)) {
        levelOf.set(next, candidate);
        queue.push(next);
      }
    }
  }

  // Nodos que quedaron sin nivel (aislados / ciclos no resueltos)
  nodeIds.forEach((id) => {
    if (!levelOf.has(id)) levelOf.set(id, 0);
  });

  const byLevel = new Map();
  nodeIds.forEach((id) => {
    const lvl = levelOf.get(id);
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(id);
  });

  const positions = new Map();
  const X_SPACING = 260;
  const Y_SPACING = 160;
  for (const [lvl, ids] of byLevel.entries()) {
    ids.forEach((id, idx) => {
      positions.set(id, { x: lvl * X_SPACING, y: idx * Y_SPACING });
    });
  }
  return positions;
}

/* ------------------------------ Agrupadores ------------------------------ */

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = normalizeStr(row[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

/* --------------------------------- Core ---------------------------------- */

async function processChannelWorkbook(workbook) {
  const results = {
    successful: [],
    errors: [],
    summary: { totalProcessed: 0, channelsCreated: 0, errors: 0 },
  };

  const channelRows = readSheet(workbook, "Channels");
  const nodeRows = readSheet(workbook, "Nodes");
  const edgeRows = readSheet(workbook, "Edges");

  if (!channelRows) throw new Error('Falta la hoja "Channels" en el Excel.');
  if (!nodeRows) throw new Error('Falta la hoja "Nodes" en el Excel.');
  if (!edgeRows) throw new Error('Falta la hoja "Edges" en el Excel (puede estar vacía, pero debe existir).');

  const nodesByChannel = groupBy(nodeRows, "nameChannel");
  const edgesByChannel = groupBy(edgeRows, "nameChannel");

  for (let i = 0; i < channelRows.length; i++) {
    const row = channelRows[i];
    const rowNumber = i + 2;

    try {
      results.summary.totalProcessed++;

      for (const field of CHANNEL_REQUIRED) {
        if (!row[field] || String(row[field]).trim() === "") {
          throw new Error(`Campo requerido faltante en hoja Channels: ${field}`);
        }
      }
      const nameChannel = normalizeStr(row.nameChannel);

      // 1) Resolver Signal
      const signalFilter = { nameChannel: normalizeStr(row.signalNameChannel) };
      if (row.signalTipoTecnologia) {
        signalFilter.tipoTecnologia = normalizeStr(row.signalTipoTecnologia);
      }
      const signal = await Signal.findOne(signalFilter).select("_id").lean();
      if (!signal) {
        throw new Error(
          `No se encontró Signal con nameChannel="${signalFilter.nameChannel}"${
            signalFilter.tipoTecnologia ? ` y tipoTecnologia="${signalFilter.tipoTecnologia}"` : ""
          }.`
        );
      }

      // 2) Resolver Nodes de este canal
      const rawNodes = nodesByChannel.get(nameChannel) || [];
      if (rawNodes.length === 0) {
        throw new Error(`No hay filas en la hoja Nodes para nameChannel="${nameChannel}".`);
      }

      const nodeIds = [];
      const nodesPending = [];
      for (const nr of rawNodes) {
        for (const field of NODE_REQUIRED) {
          if (!nr[field] || String(nr[field]).trim() === "") {
            throw new Error(`Campo requerido faltante en hoja Nodes: ${field} (canal "${nameChannel}")`);
          }
        }
        const nodeId = normalizeStr(nr.nodeId);
        if (nodeIds.includes(nodeId)) {
          throw new Error(`nodeId duplicado "${nodeId}" en canal "${nameChannel}".`);
        }
        nodeIds.push(nodeId);

        const equipoNombre = normalizeStr(nr.equipoNombre);
        const equipo = await Equipo.findOne({ nombre: equipoNombre }).select("_id").lean();
        if (!equipo) {
          throw new Error(`Equipo no encontrado: "${equipoNombre}" (nodeId "${nodeId}", canal "${nameChannel}").`);
        }

        nodesPending.push({
          nodeId,
          equipoId: equipo._id,
          label: normalizeStr(nr.label) || equipoNombre,
          x: toNumberOrNull(nr.x),
          y: toNumberOrNull(nr.y),
        });
      }

      // 3) Resolver Edges de este canal
      const rawEdges = edgesByChannel.get(nameChannel) || [];
      const edgeIds = [];
      const edgesPending = [];
      for (const er of rawEdges) {
        for (const field of EDGE_REQUIRED) {
          if (!er[field] || String(er[field]).trim() === "") {
            throw new Error(`Campo requerido faltante en hoja Edges: ${field} (canal "${nameChannel}")`);
          }
        }
        const edgeId = normalizeStr(er.edgeId);
        if (edgeIds.includes(edgeId)) {
          throw new Error(`edgeId duplicado "${edgeId}" en canal "${nameChannel}".`);
        }
        edgeIds.push(edgeId);

        const source = normalizeStr(er.source);
        const target = normalizeStr(er.target);
        if (!nodeIds.includes(source)) {
          throw new Error(`Edge "${edgeId}": source "${source}" no existe entre los nodos del canal "${nameChannel}".`);
        }
        if (!nodeIds.includes(target)) {
          throw new Error(`Edge "${edgeId}": target "${target}" no existe entre los nodos del canal "${nameChannel}".`);
        }

        const direction = ["ida", "vuelta", "bi"].includes(normalizeStr(er.direction))
          ? normalizeStr(er.direction)
          : "ida";

        edgesPending.push({
          edgeId,
          source,
          target,
          label: normalizeStr(er.label) || undefined,
          direction,
        });
      }

      // 4) Auto-layout para nodos sin x/y
      const needsLayout = nodesPending.some((n) => n.x === null || n.y === null);
      const layoutPositions = needsLayout
        ? autoLayout(nodeIds, edgesPending.map((e) => ({ source: e.source, target: e.target })))
        : new Map();

      const nodes = nodesPending.map((n) => {
        const pos =
          n.x !== null && n.y !== null
            ? { x: n.x, y: n.y }
            : layoutPositions.get(n.nodeId) || { x: 0, y: 0 };
        return {
          id: n.nodeId,
          type: "image",
          equipo: n.equipoId,
          position: pos,
          data: { label: n.label },
        };
      });

      const edges = edgesPending.map((e) => ({
        id: e.edgeId,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        data: { label: e.label, direction: e.direction },
      }));

      // 5) Crear (o actualizar si ya existe un canal con ese nombre)
      let doc = await Channel.findOne({ nameChannel });
      const payload = {
        signal: signal._id,
        nameChannel,
        numberChannelSur: normalizeStr(row.numberChannelSur) || undefined,
        numberChannelCn: normalizeStr(row.numberChannelCn) || undefined,
        logoChannel: normalizeStr(row.logoChannel) || undefined,
        severidadChannel: normalizeStr(row.severidadChannel) || undefined,
        tipoTecnologia: normalizeStr(row.tipoTecnologia) || undefined,
        nodes,
        edges,
      };

      if (!doc) {
        doc = new Channel(payload);
      } else {
        doc.set(payload);
      }
      await doc.save();

      results.summary.channelsCreated++;
      results.successful.push({
        row: rowNumber,
        channelId: doc._id,
        nameChannel,
        nodes: nodes.length,
        edges: edges.length,
      });
    } catch (error) {
      results.summary.errors++;
      results.errors.push({ row: rowNumber, data: row, error: error.message });
    }
  }

  return results;
}

/* ------------------------------- Endpoints -------------------------------- */

const bulkCreateChannels = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    }
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const results = await processChannelWorkbook(workbook);

    return res.json({
      success: true,
      message: "Procesamiento completado",
      data: results,
    });
  } catch (error) {
    console.error("Error en carga masiva de Channels:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error interno del servidor",
    });
  }
};

const validateExcelFormat = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    }
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const requiredSheets = ["Channels", "Nodes", "Edges"];
    const missingSheets = requiredSheets.filter((s) => !workbook.SheetNames.includes(s));

    if (missingSheets.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Faltan hojas requeridas en el Excel",
        missingSheets,
        foundSheets: workbook.SheetNames,
      });
    }

    const channelRows = readSheet(workbook, "Channels");
    const nodeRows = readSheet(workbook, "Nodes");
    const edgeRows = readSheet(workbook, "Edges");

    return res.json({
      success: true,
      message: "Formato válido",
      sheets: {
        Channels: { totalRows: channelRows.length, preview: channelRows.slice(0, 3) },
        Nodes: { totalRows: nodeRows.length, preview: nodeRows.slice(0, 3) },
        Edges: { totalRows: edgeRows.length, preview: edgeRows.slice(0, 3) },
      },
    });
  } catch (error) {
    console.error("Error en validateExcelFormat (Channel):", error);
    return res.status(500).json({ success: false, message: "Error al validar archivo", error: error.message });
  }
};

module.exports = { bulkCreateChannels, validateExcelFormat };
