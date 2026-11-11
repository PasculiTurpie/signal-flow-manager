const Channel = require("../models/channel.model");
const Signal = require("../models/signal.model");
const { escapeRegex } = require("../../helpers/escapeRegex");
const { parseKeyword, collectMplsMulticastMatches } = require("./mplsMulticast");

const MAX_CHANNELS = 300;

/**
 * Señales cuyo canal tiene una salida (arista) hacia el MPLS con un multicast
 * que calza con `keyword` (IP completa o parcial, con puerto opcional).
 * Cada señal devuelta incluye `mplsMulticast: [{ channelId, edgeId, ip, port,
 * value, field, mplsNode }]`.
 */
const findSignalsByMplsMulticast = async (keyword) => {
  const parsed = parseKeyword(keyword);
  if (!parsed) return [];

  // Prefiltro en Mongo (subcadena, superconjunto); el criterio fino
  // (exacto/prefijo, rango multicast, nodo MPLS) se aplica en memoria.
  const rx = new RegExp(escapeRegex(parsed.ip));
  const channels = await Channel.find({
    edges: {
      $elemMatch: {
        $or: [
          { "data.multicast": rx },
          { "data.labelEnd": rx },
          { "data.labelStart": rx },
          { "data.tooltip": rx },
          { label: rx },
        ],
      },
    },
  })
    .select("signal nodes edges")
    .limit(MAX_CHANNELS)
    .populate({
      path: "nodes.equipo",
      select: "nombre tipoNombre",
      populate: { path: "tipoNombre", select: "tipoNombre tipoNombreLower" },
    })
    .lean();

  const matchesBySignal = new Map();
  channels.forEach((channel) => {
    if (!channel?.signal) return;
    const matches = collectMplsMulticastMatches(channel, keyword);
    if (!matches.length) return;
    const signalId = String(channel.signal);
    const list = matchesBySignal.get(signalId) || [];
    matches.forEach((match) => list.push({ ...match, channelId: String(channel._id) }));
    matchesBySignal.set(signalId, list);
  });

  if (!matchesBySignal.size) return [];

  const signals = await Signal.find({ _id: { $in: [...matchesBySignal.keys()] } })
    .populate("contact")
    .lean();

  return signals.map((signal) => ({
    ...signal,
    mplsMulticast: matchesBySignal.get(String(signal._id)) || [],
  }));
};

module.exports = { findSignalsByMplsMulticast };
