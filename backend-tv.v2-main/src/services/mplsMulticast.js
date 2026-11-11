// Utilidades puras para buscar el multicast de salida hacia el MPLS.
//
// Dónde vive el dato (según cómo se creó el canal):
//   - Carga masiva (bulkChannelFisico): arista asr -> mpls con
//     data.labelEnd = "IP MULT VMX 239.x.x.x:puerto / IP FUENTE a.b.c.d"
//   - Editor de diagrama: data.multicast, data.labelStart/labelEnd, data.tooltip,
//     label o endpointLabels.
// Por eso se extraen las IPs desde todos esos textos y solo se consideran
// multicast las del rango 224.0.0.0 - 239.255.255.255 (para no confundir la
// "IP FUENTE", que es unicast), salvo que vengan en data.multicast, que es el
// campo explícito de multicast.

const IP_QUERY_REGEX = /^\d{1,3}(?:\.\d{0,3}){1,3}(?::\d{0,5})?$/;
const FULL_IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV4_WITH_PORT_REGEX = /(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?/g;

const isValidIpv4 = (ip) =>
  FULL_IPV4_REGEX.test(ip) && ip.split(".").every((octet) => Number(octet) <= 255);

const isMulticastRange = (ip) => {
  const first = Number(String(ip).split(".")[0]);
  return first >= 224 && first <= 239;
};

/** "239.1.1", "239.1.1.1", "239.1.1.1:5000" => true. "101" o "tnt" => false. */
const isIpLikeKeyword = (keyword) => IP_QUERY_REGEX.test(String(keyword ?? "").trim());

/**
 * Interpreta lo que escribió el usuario.
 * - IP completa (4 octetos): coincidencia exacta de IP (y de puerto si lo escribió).
 * - IP parcial: coincidencia por prefijo ("239.10" no encuentra "239.110...").
 */
const parseKeyword = (keyword) => {
  const raw = String(keyword ?? "").trim();
  if (!IP_QUERY_REGEX.test(raw)) return null;
  const [ip, port] = raw.split(":");
  const hasPort = port !== undefined && port !== "";
  return {
    ip,
    port: hasPort ? port : null,
    prefix: raw,
    exact: FULL_IPV4_REGEX.test(ip) && (port === undefined || hasPort),
  };
};

const matchesKeyword = (entry, parsed) => {
  if (!parsed) return false;
  if (parsed.exact) {
    return entry.ip === parsed.ip && (parsed.port === null || entry.port === parsed.port);
  }
  return entry.value.startsWith(parsed.prefix);
};

const asText = (value) => (typeof value === "string" ? value : "");

/** Nodo MPLS: por id, tipo de equipo, nombre del equipo o etiqueta. */
const isMplsNode = (node) => {
  if (!node) return false;
  const equipo = node.equipo && typeof node.equipo === "object" ? node.equipo : null;
  const tipo = equipo?.tipoNombre;
  const candidates = [
    node.id,
    node.data?.equipoTipo,
    node.data?.equipoNombre,
    node.data?.label,
    equipo?.nombre,
    typeof tipo === "string" ? tipo : tipo?.tipoNombre,
    tipo?.tipoNombreLower,
  ];
  return candidates.some((candidate) => /mpls/i.test(asText(candidate)));
};

const collectEdgeTexts = (edge) => {
  const data = edge?.data || {};
  const texts = [
    { field: "labelEnd", text: asText(data.labelEnd) },
    { field: "labelStart", text: asText(data.labelStart) },
    { field: "tooltip", text: asText(data.tooltip) },
    { field: "label", text: asText(edge?.label) || asText(data.label) },
  ];
  const endpointLabels = data.endpointLabels;
  if (endpointLabels && typeof endpointLabels === "object") {
    Object.values(endpointLabels).forEach((value) =>
      texts.push({ field: "endpointLabels", text: asText(value) })
    );
  }
  return texts;
};

/** Todas las IPs multicast (con puerto opcional) de una arista, sin repetidos. */
const extractMulticastEntries = (edge) => {
  const entries = new Map();

  const push = (field, ip, port) => {
    if (!isValidIpv4(ip)) return;
    const value = port ? `${ip}:${port}` : ip;
    if (!entries.has(value)) entries.set(value, { ip, port: port || null, value, field });
  };

  const explicit = asText(edge?.data?.multicast);
  for (const match of explicit.matchAll(IPV4_WITH_PORT_REGEX)) {
    push("multicast", match[1], match[2]);
  }

  collectEdgeTexts(edge).forEach(({ field, text }) => {
    for (const match of text.matchAll(IPV4_WITH_PORT_REGEX)) {
      if (isMulticastRange(match[1])) push(field, match[1], match[2]);
    }
  });

  return [...entries.values()];
};

/**
 * Coincidencias de un canal: aristas hacia el MPLS cuyo multicast calza con
 * lo buscado. Devuelve [{ edgeId, ip, port, value, field, mplsNode }].
 */
const collectMplsMulticastMatches = (channel, keyword) => {
  const parsed = parseKeyword(keyword);
  if (!parsed) return [];

  const nodes = Array.isArray(channel?.nodes) ? channel.nodes : [];
  const edges = Array.isArray(channel?.edges) ? channel.edges : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const matches = [];
  edges.forEach((edge) => {
    // Salida hacia MPLS: target MPLS (ida/bi) o, si la arista está invertida
    // ("vuelta"), source MPLS.
    const direction = edge?.data?.direction || "ida";
    const mplsId = direction === "vuelta" ? edge.source : edge.target;
    const mplsNode = nodeById.get(mplsId);
    if (!isMplsNode(mplsNode)) return;

    extractMulticastEntries(edge)
      .filter((entry) => matchesKeyword(entry, parsed))
      .forEach((entry) =>
        matches.push({
          edgeId: edge.id,
          ip: entry.ip,
          port: entry.port,
          value: entry.value,
          field: entry.field,
          mplsNode: mplsNode?.data?.label || mplsNode?.equipo?.nombre || mplsNode?.id || null,
        })
      );
  });

  return matches;
};

/** Señales con coincidencia de multicast primero; luego el resto sin repetir. */
const mergeSignalResults = (baseSignals, multicastSignals) => {
  const seen = new Set(multicastSignals.map((signal) => String(signal._id)));
  const rest = baseSignals.filter((signal) => !seen.has(String(signal._id)));
  return [...multicastSignals, ...rest];
};

module.exports = {
  isIpLikeKeyword,
  parseKeyword,
  isMplsNode,
  extractMulticastEntries,
  collectMplsMulticastMatches,
  mergeSignalResults,
};
