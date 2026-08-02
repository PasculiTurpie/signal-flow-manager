// controllers/bulkChannelFisico.controller.js
//
// v4 — genera nodes/edges con la MISMA estructura que usa la app cuando el
// usuario arma un diagrama a mano (verificado contra db.channels.findOne()
// de un canal real):
//   - node.type = 'custom', node.data = {label, labelPosition, multicastPosition,
//     equipoId, equipoNombre, equipoTipo, type:'custom'}
//   - edge.type = 'customDirectional', animated:true, label ("X a Y"),
//     data = {labelStart, labelEnd, direction, tooltip, tooltipTitle, ...}
//     con sourceHandle/targetHandle calculados por geometría (no genéricos).
//
// Se agrupa por "nombre_señal": cada fila (variante región/categoría) es una
// RAMA de color distinto, compartiendo satélite/IRD/switch de entrada/ASR/MPLS.
//
// Modo por defecto: DRY-RUN. Para escribir de verdad: ?commit=true

const XLSX = require("xlsx");
const Channel = require("../models/channel.model");
const Signal = require("../models/signal.model");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");

const norm = (s) => String(s ?? "").trim();

const REQUIRED_FIELDS = [
  "nombre_señal", "region", "categoria", "sitio",
  "satelite", "polarizacion", "switch_entrada", "mcast_out_ird",
  "dcm", "switch_dcm_in", "switch_dcm_out", "mcast_out_dcm",
  "encoder_tlhost", "switch_encoder_in", "switch_encoder_out", "mcast_out_clear",
  "dcm_vmx", "switch_dcm_vmx_in", "switch_dcm_vmx_out", "mcast_out_dcm_vmx",
  "rtes", "switch_rtes_in", "switch_rtes_out", "mcast_rtes_out",
  "router_asr", "nodo_mpls", "mcast_prod",
];

const COLOR_NEGRO = "#111827";
const COLOR_AZUL_ENTRADA = "#3b82f6";
const COLOR_GRIS_BACKBONE = "#64748b";
const COLOR_ROJO_SALIDA = "#ef4444";
const BRANCH_COLOR_CYCLE = ["#3b82f6", "#22c55e", "#06b6d4", "#a855f7", "#ef4444"];

let tipoCache = null;
async function getTipoId(tipoNombre) {
  if (!tipoCache) {
    const all = await TipoEquipo.find({}).lean();
    tipoCache = new Map(all.map((t) => [String(t.tipoNombre).toLowerCase(), t._id]));
  }
  const id = tipoCache.get(tipoNombre.toLowerCase());
  if (!id) throw new Error(`No existe TipoEquipo "${tipoNombre}" en el catálogo.`);
  return id;
}

async function resolveEquipo(nombre, tipoNombre, { strict }) {
  const clean = norm(nombre);
  if (!clean) throw new Error(`Nombre de equipo vacío (tipo ${tipoNombre}).`);
  let eq = await Equipo.findOne({ nombre: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (eq) return eq;
  if (strict) {
    throw new Error(`Equipo "${clean}" (tipo ${tipoNombre}) no existe en el catálogo (no se crea automáticamente).`);
  }
  const tipoId = await getTipoId(tipoNombre);
  return Equipo.create({ nombre: clean, marca: "Por definir", modelo: "Por definir", tipoNombre: tipoId });
}

/* ------------------------------- Auto-layout ------------------------------ */
function layoutHierarchical(centerId, switchGroups, entryId, satId, irdId, mplsId) {
  const positions = new Map();
  const X_STEP = 300, Y_ROW = 220;
  positions.set(centerId, { x: 0, y: 0 });
  positions.set(mplsId, { x: 0, y: -Y_ROW * 1.8 });
  positions.set(entryId, { x: -X_STEP, y: 0 });
  positions.set(irdId, { x: -X_STEP, y: Y_ROW });
  positions.set(satId, { x: -X_STEP * 1.8, y: Y_ROW * 0.5 });
  switchGroups.forEach(({ switchId, deviceIds }, i) => {
    const x = X_STEP * (i + 1);
    positions.set(switchId, { x, y: 0 });
    deviceIds.forEach((deviceId, j) => positions.set(deviceId, { x, y: Y_ROW * (1 + j * 0.8) }));
  });
  return positions;
}

/* ------------------------- Handles por geometría --------------------------
 * Calcula de qué lado del nodo sale/entra la flecha según la posición
 * relativa (igual criterio visual que usa el editor manual), con un
 * contador de "slot" por (nodo, lado) para no apilar todas las conexiones
 * en el mismo punto cuando un nodo tiene muchas (ej. el ASR).
 * -------------------------------------------------------------------------*/
function makeHandleAllocator() {
  const counters = new Map(); // "nodeId:side:kind" -> siguiente índice
  return function alloc(nodeId, side, kind) {
    const key = `${nodeId}:${side}:${kind}`;
    const idx = (counters.get(key) || 0) + 1;
    counters.set(key, idx);
    return `${kind}-${side}-${idx}`;
  };
}

function sidesFor(posA, posB) {
  const dx = (posB?.x ?? 0) - (posA?.x ?? 0);
  const dy = (posB?.y ?? 0) - (posA?.y ?? 0);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { sideA: "right", sideB: "left" } : { sideA: "left", sideB: "right" };
  }
  return dy >= 0 ? { sideA: "bottom", sideB: "top" } : { sideA: "top", sideB: "bottom" };
}

function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function groupBySeñal(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = norm(row["nombre_señal"]);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function makeNode(id, equipo, label, position) {
  return {
    id,
    type: "custom",
    equipo: equipo._id,
    position,
    data: {
      label,
      labelPosition: { x: 0, y: 0 },
      multicastPosition: null,
      equipoId: String(equipo._id),
      equipoNombre: equipo.nombre,
      equipoTipo: equipo.tipoNombreLower || equipo.tipoNombre,
      type: "custom",
    },
    handles: [],
  };
}

async function buildChannelForGroup(nombreSenal, rows) {
  for (const row of rows) {
    for (const f of REQUIRED_FIELDS) {
      if (!row[f] || String(row[f]).trim() === "") {
        throw new Error(`Fila de "${row.region || "?"}": campo requerido faltante "${f}"`);
      }
    }
  }

  const first = rows[0];
  const satelite = norm(first.satelite);
  const polarizacion = norm(first.polarizacion);
  const switchEntrada = norm(first.switch_entrada);
  const routerAsr = norm(first.router_asr);
  const nodoMpls = norm(first.nodo_mpls);

  const satEquipoDoc = await resolveEquipo(`${satelite} ${polarizacion}`.trim(), "satelite", { strict: false });
  const irdEquipoDoc = await resolveEquipo(`IRD ${nombreSenal}`, "ird", { strict: false });
  const swEntradaDoc = await resolveEquipo(switchEntrada, "switch", { strict: false });
  const asrEquipoDoc = await resolveEquipo(routerAsr, "router", { strict: false });
  const mplsEquipoDoc = await resolveEquipo(nodoMpls, "mpls", { strict: false });

  // Necesitamos el tipoNombreLower de cada equipo para data.equipoTipo — lo resolvemos junto al doc
  async function tipoLowerOf(equipoDoc) {
    const tipo = await TipoEquipo.findById(equipoDoc.tipoNombre).lean();
    return tipo?.tipoNombreLower || tipo?.tipoNombre || "";
  }
  const withTipo = async (doc) => ({ ...doc.toObject(), tipoNombreLower: await tipoLowerOf(doc) });

  const satEquipo = await withTipo(satEquipoDoc);
  const irdEquipo = await withTipo(irdEquipoDoc);
  const swEntrada = await withTipo(swEntradaDoc);
  const asrEquipo = await withTipo(asrEquipoDoc);
  const mplsEquipo = await withTipo(mplsEquipoDoc);

  const nodeDefs = [
    { id: "sat", equipo: satEquipo, label: `${satelite} ${polarizacion}`.trim() },
    { id: "ird", equipo: irdEquipo, label: `IRD ${nombreSenal}` },
    { id: "sw_in", equipo: swEntrada, label: switchEntrada },
    { id: "asr", equipo: asrEquipo, label: routerAsr },
    { id: "mpls", equipo: mplsEquipo, label: nodoMpls },
  ];

  const edgeDefs = []; // { id, source, target, direction, color, labelStart, labelEnd }
  edgeDefs.push({ id: "e_sat_ird", source: "sat", target: "ird", direction: "ida", color: COLOR_NEGRO, labelStart: "", labelEnd: "" });
  edgeDefs.push({
    id: "e_ird_swin", source: "ird", target: "sw_in", direction: "ida", color: COLOR_AZUL_ENTRADA,
    labelStart: `PORT DATA IP MULT: ${norm(first.mcast_out_ird)}`,
    labelEnd: `${switchEntrada} PORT ${norm(first.puerto_entrada || "")}`.trim(),
  });
  edgeDefs.push({ id: "e_swin_asr", source: "sw_in", target: "asr", direction: "bi", color: COLOR_GRIS_BACKBONE, labelStart: "", labelEnd: "" });
  edgeDefs.push({
    id: "e_asr_mpls", source: "asr", target: "mpls", direction: "ida", color: COLOR_ROJO_SALIDA,
    labelStart: "", labelEnd: `IP MULT VMX ${norm(first.mcast_prod)}${first.puerto_prod ? ":" + first.puerto_prod : ""} / IP FUENTE ${norm(first.unicast_mcast || "")}`,
  });

  const switchEquipoByName = new Map(); // nombre -> equipo (con tipoLower)
  const switchNodeByEquipoId = new Map();
  const switchGroupsMap = new Map();
  let switchCounter = 0;

  async function getOrCreateSwitchNode(nombre) {
    let equipo = switchEquipoByName.get(nombre);
    if (!equipo) {
      const doc = await resolveEquipo(nombre, "switch", { strict: false });
      equipo = await withTipo(doc);
      switchEquipoByName.set(nombre, equipo);
    }
    const key = String(equipo._id);
    if (switchNodeByEquipoId.has(key)) return switchNodeByEquipoId.get(key);
    const nodeId = `sw_${switchCounter++}`;
    switchNodeByEquipoId.set(key, nodeId);
    nodeDefs.push({ id: nodeId, equipo, label: nombre });
    edgeDefs.push({ id: `e_asr_${nodeId}`, source: "asr", target: nodeId, direction: "bi", color: COLOR_GRIS_BACKBONE, labelStart: "", labelEnd: "" });
    switchGroupsMap.set(nodeId, []);
    return nodeId;
  }

  async function wireDevice(b, stage, deviceId, tipoNombre, nombreEquipo, swInName, swOutName, portIn, portOut, portIdIn, portIdOut, mcastIn, mcastOut, branchColor) {
    const doc = await resolveEquipo(nombreEquipo, tipoNombre, { strict: true });
    const equipo = await withTipo(doc);
    nodeDefs.push({ id: deviceId, equipo, label: nombreEquipo });

    const swInId = await getOrCreateSwitchNode(swInName);
    switchGroupsMap.get(swInId).push(deviceId);
    edgeDefs.push({
      id: `e_${b}_${stage}_in`, source: swInId, target: deviceId, direction: "ida", color: branchColor,
      labelStart: `PORT ${portIn || ""}`.trim(),
      labelEnd: `${portIdIn || ""} IP MULT: ${mcastIn || ""}`.trim(),
    });

    const sameSwitch = norm(swOutName).toLowerCase() === norm(swInName).toLowerCase();
    const swOutId = sameSwitch ? swInId : await getOrCreateSwitchNode(swOutName);
    if (!sameSwitch && !switchGroupsMap.get(swOutId).includes(deviceId)) switchGroupsMap.get(swOutId).push(deviceId);

    edgeDefs.push({
      id: `e_${b}_${stage}_out`, source: deviceId, target: swOutId, direction: "ida", color: branchColor,
      labelStart: `${portIdOut || ""} IP MULT: ${mcastOut || ""}`.trim(),
      labelEnd: `PORT ${portOut || ""}`.trim(),
    });
  }

  const branchesSummary = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const region = norm(row.region);
    const branchColor = BRANCH_COLOR_CYCLE[i % BRANCH_COLOR_CYCLE.length];
    const b = `b${i}`;

    const signal = await Signal.findOne({ nameChannel: nombreSenal, tipoTecnologia: region }).select("_id").lean();
    if (!signal) throw new Error(`No se encontró Signal con nameChannel="${nombreSenal}" + tipoTecnologia="${region}".`);

    await wireDevice(b, "dcm", `${b}_dcm`, "dcm", norm(row.dcm), row.switch_dcm_in, row.switch_dcm_out,
      row.puerto_dcm_in, row.puerto_dcm_out, row.portid_dcm_in, row.portid_dcm_out,
      row.mcast_out_ird, row.mcast_out_dcm, branchColor);

    await wireDevice(b, "enc", `${b}_enc`, "titan", norm(row.encoder_tlhost), row.switch_encoder_in, row.switch_encoder_out,
      row.puerto_encoder_in, row.puerto_encoder_out, row.portid_encoder_in, row.portid_encoder_out,
      row.mcast_out_dcm, row.mcast_out_clear, branchColor);

    await wireDevice(b, "dcmvmx", `${b}_dcmvmx`, "dcm", norm(row.dcm_vmx), row.switch_dcm_vmx_in, row.switch_dcm_vmx_out,
      row.puerto_dcm_vmx_in, row.puerto_dcm_vmx_out, row.portid_dcm_vmx_in, row.portid_dcm_vmx_out,
      row.mcast_out_clear, row.mcast_out_dcm_vmx, branchColor);

    await wireDevice(b, "rtes", `${b}_rtes`, "rtes", norm(row.rtes), row.switch_rtes_in, row.switch_rtes_out,
      row.puerto_rtes_in, row.puerto_rtes_out, row.portid_rtes_in, row.portid_rtes_out,
      row.mcast_out_dcm_vmx, row.mcast_rtes_out, branchColor);

    branchesSummary.push({ region, categoria: norm(row.categoria), color: branchColor, signalId: signal._id });
  }

  const switchGroups = Array.from(switchGroupsMap.entries()).map(([switchId, deviceIds]) => ({ switchId, deviceIds }));
  const positions = layoutHierarchical("asr", switchGroups, "sw_in", "sat", "ird", "mpls");

  const nodes = nodeDefs.map((n) => makeNode(n.id, n.equipo, n.label, positions.get(n.id) || { x: 0, y: 0 }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const labelById = new Map(nodeDefs.map((n) => [n.id, n.label]));

  const allocHandle = makeHandleAllocator();
  const edges = edgeDefs.map((e) => {
    const posA = positions.get(e.source) || { x: 0, y: 0 };
    const posB = positions.get(e.target) || { x: 0, y: 0 };
    const { sideA, sideB } = sidesFor(posA, posB);
    const sourceHandle = allocHandle(e.source, sideA, "out");
    const targetHandle = allocHandle(e.target, sideB, "in");

    const srcLabel = labelById.get(e.source) || e.source;
    const tgtLabel = labelById.get(e.target) || e.target;
    const title = `${srcLabel} a ${tgtLabel}`;
    const tooltipParts = [];
    if (e.labelStart) tooltipParts.push(`Origen: ${e.labelStart}`);
    if (e.labelEnd) tooltipParts.push(`Destino: ${e.labelEnd}`);

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "customDirectional",
      animated: true,
      style: { stroke: e.color, strokeWidth: 2 },
      sourceHandle,
      targetHandle,
      label: title,
      labelPosition: {},
      data: {
        labelStart: e.labelStart || "",
        labelEnd: e.labelEnd || "",
        direction: e.direction,
        labelPosition: {},
        multicastPosition: {},
        endpointLabels: {},
        endpointLabelPositions: {},
        tooltip: tooltipParts.join(" | "),
        tooltipTitle: title,
      },
    };
  });

  return {
    signal: branchesSummary[0].signalId,
    nameChannel: nombreSenal,
    nodes,
    edges,
    branchesSummary,
  };
}

async function processWorkbook(workbook, { commit }) {
  const rows = readSheet(workbook, "Diagramas");
  if (!rows) throw new Error('Falta la hoja "Diagramas" en el Excel.');

  const results = {
    mode: commit ? "COMMIT (se escribió en la base)" : "DRY-RUN (no se escribió nada)",
    successful: [], errors: [],
    summary: { totalGrupos: 0, ok: 0, errors: 0 },
  };

  tipoCache = null;
  const groups = groupBySeñal(rows);

  for (const [nombreSenal, groupRows] of groups) {
    results.summary.totalGrupos++;
    try {
      const payload = await buildChannelForGroup(nombreSenal, groupRows);

      if (commit) {
        let doc = await Channel.findOne({ nameChannel: payload.nameChannel });
        if (!doc) doc = new Channel(payload);
        else doc.set(payload);
        await doc.save();
        results.successful.push({
          nombre_señal: nombreSenal, channelId: doc._id,
          ramas: payload.branchesSummary.length, nodos: payload.nodes.length, enlaces: payload.edges.length,
        });
      } else {
        results.successful.push({
          nombre_señal: nombreSenal,
          ramas: payload.branchesSummary.map((b) => `${b.region} (${b.color})`),
          nodos: payload.nodes.length, enlaces: payload.edges.length, preview: true,
        });
      }
      results.summary.ok++;
    } catch (error) {
      results.summary.errors++;
      results.errors.push({ nombre_señal: nombreSenal, error: error.message });
    }
  }
  return results;
}

const bulkCreateChannelsFisico = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    const commit = String(req.query.commit || "").toLowerCase() === "true";
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const results = await processWorkbook(workbook, { commit });
    return res.json({ success: true, message: "Procesamiento completado", data: results });
  } catch (error) {
    console.error("Error en carga masiva física de Channels:", error);
    return res.status(500).json({ success: false, message: error.message || "Error interno del servidor" });
  }
};

module.exports = { bulkCreateChannelsFisico };
