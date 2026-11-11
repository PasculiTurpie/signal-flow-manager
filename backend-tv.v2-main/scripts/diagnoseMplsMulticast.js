/**
 * scripts/diagnoseMplsMulticast.js
 *
 * Diagnóstico de SOLO LECTURA: dada una IP (por ejemplo un mcast_prod que sabes
 * que existe), muestra dónde está guardada en los canales y por qué el buscador
 * "multicast hacia MPLS" la encuentra o no.
 *
 * Uso (desde backend-tv.v2-main, con el .env del backend):
 *   node scripts/diagnoseMplsMulticast.js 239.10.5.20
 */
const {
  collectMplsMulticastMatches,
  extractMulticastEntries,
  isMplsNode,
} = require("../src/services/mplsMulticast");

const MAX_HITS = 10;

const describeNode = (node) =>
  node
    ? {
        id: node.id,
        label: node.data?.label ?? null,
        equipoTipo: node.data?.equipoTipo ?? null,
        equipoNombre: node.equipo?.nombre ?? node.data?.equipoNombre ?? null,
        tipoEquipo: node.equipo?.tipoNombre?.tipoNombre ?? null,
      }
    : null;

/** Campos de texto de la arista donde aparece la IP. */
const fieldsContaining = (edge, ip) => {
  const found = [];
  const walk = (value, trail) => {
    if (typeof value === "string") {
      if (value.includes(ip)) found.push({ campo: trail, texto: value });
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => walk(v, trail ? `${trail}.${k}` : k));
    }
  };
  walk(edge, "");
  return found;
};

/**
 * Analiza canales ya cargados (puro, testeable). Devuelve { hits, soloEnNodos }.
 * Cada hit trae un `veredicto` que explica el resultado.
 */
const diagnose = (channels, ip, signalNameById = new Map()) => {
  const hits = [];
  const soloEnNodos = [];

  channels.forEach((channel) => {
    const nodes = Array.isArray(channel.nodes) ? channel.nodes : [];
    const edges = Array.isArray(channel.edges) ? channel.edges : [];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const signal = signalNameById.get(String(channel.signal)) || String(channel.signal || "");

    let enAristas = false;
    edges.forEach((edge) => {
      const campos = fieldsContaining(edge, ip);
      if (!campos.length) return;
      enAristas = true;

      const direction = edge?.data?.direction || "ida";
      const mplsId = direction === "vuelta" ? edge.source : edge.target;
      const mplsNode = nodeById.get(mplsId);
      const esMpls = isMplsNode(mplsNode);
      const reconocidos = extractMulticastEntries(edge).map((e) => e.value);
      const coincide = collectMplsMulticastMatches(channel, ip).some((m) => m.edgeId === edge.id);

      let veredicto;
      if (coincide) veredicto = "OK: el buscador la encontraría.";
      else if (!esMpls)
        veredicto = `NO: la arista no llega a un nodo reconocido como MPLS (destino: ${JSON.stringify(
          describeNode(mplsNode)
        )}). Ajustar isMplsNode o el tipo/etiqueta del nodo.`;
      else if (!reconocidos.some((v) => v.startsWith(ip)))
        veredicto = `NO: la IP está en el texto pero no se reconoce como multicast (reconocidas: ${JSON.stringify(
          reconocidos
        )}). Ver el formato del texto.`;
      else veredicto = "NO: motivo no determinado, revisar los datos.";

      hits.push({
        canalId: String(channel._id),
        señal: signal,
        arista: edge.id,
        ruta: `${edge.source} -> ${edge.target} (${direction})`,
        camposConLaIP: campos,
        multicastReconocidos: reconocidos,
        nodoDestinoMpls: describeNode(mplsNode),
        veredicto,
      });
    });

    if (!enAristas && JSON.stringify(nodes).includes(ip)) {
      soloEnNodos.push({ canalId: String(channel._id), señal: signal });
    }
  });

  return { hits, soloEnNodos };
};

const main = async () => {
  const ip = String(process.argv[2] || "").trim();
  if (!ip) {
    console.error("Uso: node scripts/diagnoseMplsMulticast.js <IP>   (ej. 239.10.5.20)");
    process.exit(1);
  }

  require("dotenv").config();
  const { connectMongoose, mongoose } = require("../src/config/config.mongoose");
  const Channel = require("../src/models/channel.model");
  const Signal = require("../src/models/signal.model");
  require("../src/models/equipo.model");
  require("../src/models/tipoEquipo");

  await connectMongoose();
  try {
    const channels = await Channel.find({})
      .select("signal nodes edges")
      .limit(5000)
      .populate({
        path: "nodes.equipo",
        select: "nombre tipoNombre",
        populate: { path: "tipoNombre", select: "tipoNombre" },
      })
      .lean();

    const signals = await Signal.find({}).select("nameChannel tipoTecnologia").lean();
    const names = new Map(signals.map((s) => [String(s._id), `${s.nameChannel} (${s.tipoTecnologia})`]));

    const { hits, soloEnNodos } = diagnose(channels, ip, names);

    console.log(`\nCanales revisados: ${channels.length}`);
    console.log(`Aristas con "${ip}": ${hits.length}`);
    hits.slice(0, MAX_HITS).forEach((h, i) => {
      console.log(`\n#${i + 1} ${h.señal}  canal ${h.canalId}`);
      console.log(`   arista ${h.arista}: ${h.ruta}`);
      h.camposConLaIP.forEach((c) => console.log(`   en ${c.campo}: ${JSON.stringify(c.texto)}`));
      console.log(`   multicast reconocidos: ${JSON.stringify(h.multicastReconocidos)}`);
      console.log(`   ${h.veredicto}`);
    });
    if (hits.length > MAX_HITS) console.log(`\n... y ${hits.length - MAX_HITS} más`);

    if (!hits.length && soloEnNodos.length) {
      console.log(`\nLa IP aparece solo en NODOS (no en aristas) de ${soloEnNodos.length} canal(es):`);
      soloEnNodos.slice(0, MAX_HITS).forEach((c) => console.log(`   ${c.señal}  canal ${c.canalId}`));
      console.log("El buscador solo mira aristas; habría que extenderlo a esos nodos.");
    }
    if (!hits.length && !soloEnNodos.length) {
      console.log(
        "\nLa IP no aparece en ningún canal (ni aristas ni nodos). Revisa que esté escrita igual " +
          "en la base o que la carga masiva se haya confirmado (no solo previsualizado)."
      );
    }
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error("Error en el diagnóstico:", error.message);
    process.exit(1);
  });
}

module.exports = { diagnose };
