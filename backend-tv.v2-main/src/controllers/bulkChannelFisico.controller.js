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
const Ird = require("../models/ird.model");
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

// Resuelve (y AUTOREPARA) el Equipo del IRD real, vinculándolo a la colección Ird.
//  1) Busca el Ird real por nombreIrd.
//  2) Si existe: busca/crea el Equipo y le asegura el irdRef correcto (lo corrige
//     si existía pero estaba mal vinculado — soluciona el error del panel "sin irdRef").
//  3) Si no existe ningún Ird con ese nombre (ej. la base de pruebas aún no tiene
//     los IRD reales cargados): cae al equipo sintético "IRD {señal}" sin irdRef.
async function resolveIrdEquipo(irdRealName, nombreSenal) {
  const clean = norm(irdRealName);
  if (clean) {
    const ird = await Ird.findOne({ nombreIrd: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (ird) {
      const tipoId = await getTipoId("ird");
      let eq = await Equipo.findOne({ nombre: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
      if (!eq) {
        eq = await Equipo.create({
          nombre: ird.nombreIrd,
          marca: ird.marcaIrd || "Por definir",
          modelo: ird.modelIrd || "Por definir",
          ip_gestion: ird.ipAdminIrd || null,
          tipoNombre: tipoId,
          irdRef: ird._id,
        });
      } else if (String(eq.irdRef || "") !== String(ird._id)) {
        eq.irdRef = ird._id; // autorepara el vínculo si faltaba o estaba mal
        await eq.save();
      }
      return { equipo: eq, sintetico: false };
    }
  }
  const equipo = await resolveEquipo(`IRD ${nombreSenal}`, "ird", { strict: false });
  return { equipo, sintetico: true };
}

/* ------------------------------- Auto-layout ------------------------------
 * Piramidal, de arriba hacia abajo:
 *   Fila -2:              MPLS (centrado)
 *   Fila -1:              ASR (centrado)
 *   Fila  0:  [SW entrada] [SW dist. 1] [SW dist. 2] ... (todos los switches, en línea)
 *   Fila  1:  [satélite] [IRD]  bajo el SW de entrada (misma horizontal, separados)
 *             [equipo(s)] bajo cada SW de distribución que les corresponda
 * -------------------------------------------------------------------------*/
function layoutHierarchical(centerId, switchGroups, entryId, satId, irdId, mplsId) {
  const positions = new Map();
  const X_STEP = 300, Y_ROW = 220, DEVICE_SPACING = 190, SAT_IRD_SPACING = 140;

  positions.set(mplsId, { x: 0, y: -Y_ROW * 2 });
  positions.set(centerId, { x: 0, y: -Y_ROW }); // ASR

  // Fila de switches: entrada primero, luego los de distribución, todos alineados y centrados
  const allSwitchIds = [entryId, ...switchGroups.map((g) => g.switchId)];
  const offsetX = ((allSwitchIds.length - 1) * X_STEP) / 2;
  allSwitchIds.forEach((swId, i) => {
    positions.set(swId, { x: i * X_STEP - offsetX, y: 0 });
  });

  // Satélite + IRD: misma horizontal, separados, centrados bajo el switch de entrada
  const entryX = positions.get(entryId).x;
  positions.set(satId, { x: entryX - SAT_IRD_SPACING, y: Y_ROW });
  positions.set(irdId, { x: entryX + SAT_IRD_SPACING, y: Y_ROW });

  // Equipos: bajo su switch de distribución correspondiente, en la misma fila inferior
  switchGroups.forEach(({ switchId, deviceIds }) => {
    const swX = positions.get(switchId).x;
    const n = deviceIds.length;
    deviceIds.forEach((deviceId, j) => {
      const dx = (j - (n - 1) / 2) * DEVICE_SPACING;
      positions.set(deviceId, { x: swX + dx, y: Y_ROW });
    });
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
  // 1 grupo = 1 variante región/categoría = 1 diagrama independiente
  // (antes se agrupaba solo por nombre_señal, combinando variantes en 1 diagrama;
  // se cambió a pedido explícito: 3 diagramas separados para HD/COBRE/FCA/etc.)
  const groups = new Map();
  for (const row of rows) {
    const señal = norm(row["nombre_señal"]);
    const region = norm(row.region);
    if (!señal || !region) continue;
    const key = `${señal}|||${region}`;
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
  const region0 = norm(first.region);
  const nameChannel = `${nombreSenal} ${region0}`.trim();
  const satelite = norm(first.satelite);
  const polarizacion = norm(first.polarizacion);
  const switchEntrada = norm(first.switch_entrada);
  const routerAsr = norm(first.router_asr);
  const nodoMpls = norm(first.nodo_mpls);

  const satEquipoDoc = await resolveEquipo(`${satelite} ${polarizacion}`.trim(), "satelite", { strict: false });

  const irdRealName = norm(first.ird_real);
  const { equipo: irdEquipoDoc, sintetico: irdEsSintetico } = await resolveIrdEquipo(irdRealName, nombreSenal);

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
    nameChannel,
    nodes,
    edges,
    branchesSummary,
    irdEsSintetico,
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

  for (const [, groupRows] of groups) {
    results.summary.totalGrupos++;
    const nombreSenal = norm(groupRows[0]["nombre_señal"]);
    const etiqueta = `${nombreSenal} (${norm(groupRows[0].region)})`;
    try {
      const payload = await buildChannelForGroup(nombreSenal, groupRows);

      if (commit) {
        let doc = await Channel.findOne({ nameChannel: payload.nameChannel });
        if (!doc) doc = new Channel(payload);
        else doc.set(payload);
        await doc.save();
        results.successful.push({
          nombre_señal: etiqueta, channelId: doc._id,
          ramas: payload.branchesSummary.length, nodos: payload.nodes.length, enlaces: payload.edges.length,
          irdSintetico: payload.irdEsSintetico,
        });
      } else {
        results.successful.push({
          nombre_señal: etiqueta,
          ramas: payload.branchesSummary.map((b) => `${b.region} (${b.color})`),
          nodos: payload.nodes.length, enlaces: payload.edges.length, preview: true,
          irdSintetico: payload.irdEsSintetico,
        });
      }
      results.summary.ok++;
    } catch (error) {
      results.summary.errors++;
      results.errors.push({ nombre_señal: etiqueta, error: error.message });
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
