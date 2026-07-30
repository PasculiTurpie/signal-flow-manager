const TipoEquipo = require("../models/tipoEquipo");

const normalize = (s) => String(s ?? "").trim();
const normalizeLower = (s) => normalize(s).toLowerCase();

const sanitize = (doc) => {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(plain._id),
    tipoNombre: plain.tipoNombre,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

// ✅ NUEVO: GET /tipo-equipo/by-name/:name
module.exports.getTipoEquipoByName = async (req, res) => {
  try {
    const name = normalize(req.params?.name);
    if (!name) return res.status(400).json({ message: "name es obligatorio" });

    const lower = normalizeLower(name);

    // preferimos el campo normalizado (rápido y consistente)
    const tipo = await TipoEquipo.findOne({ tipoNombreLower: lower }).lean();

    if (!tipo) {
      return res.status(404).json({ message: "Tipo de equipo no encontrado" });
    }

    return res.json(sanitize(tipo));
  } catch (error) {
    console.error("Error al obtener tipo de equipo por nombre:", error);
    return res.status(500).json({ message: "Error al obtener tipo de equipo" });
  }
};

module.exports.getTipoEquipo = async (_req, res) => {
  try {
    const tipoEquipo = await TipoEquipo.find().sort({ tipoNombreLower: 1 }).lean();
    return res.json(tipoEquipo.map(sanitize));
  } catch (error) {
    console.error("Error al obtener tipos de equipo:", error);
    return res.status(500).json({ message: "Error al obtener tipos" });
  }
};

module.exports.getTipoEquipoById = async (req, res) => {
  try {
    const tipoEquipo = await TipoEquipo.findById(req.params.id).lean();
    if (!tipoEquipo) return res.status(404).json({ message: "Tipo de equipo no encontrado" });
    return res.json(sanitize(tipoEquipo));
  } catch (error) {
    console.error("Error al obtener tipo de equipo:", error);
    return res.status(500).json({ message: "Error al obtener tipo de equipo" });
  }
};

module.exports.createTipoEquipo = async (req, res) => {
  try {
    const tipoNombre = normalize(req.body?.tipoNombre);
    if (!tipoNombre) return res.status(400).json({ message: "tipoNombre es obligatorio" });

    const doc = await TipoEquipo.create({
      tipoNombre,
      tipoNombreLower: normalizeLower(tipoNombre),
    });

    return res.status(201).json(sanitize(doc));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: `Ya existe un tipo de equipo con ese nombre.`,
      });
    }
    console.error("Error inesperado al crear tipo de equipo:", error);
    return res.status(500).json({ message: "Error al crear tipo de equipo" });
  }
};

module.exports.updateTipoEquipo = async (req, res) => {
  try {
    const update = { ...req.body };

    if (update.tipoNombre !== undefined) {
      const tipoNombre = normalize(update.tipoNombre);
      if (!tipoNombre) return res.status(400).json({ message: "tipoNombre es obligatorio" });

      update.tipoNombre = tipoNombre;
      update.tipoNombreLower = normalizeLower(tipoNombre);
    }

    const updated = await TipoEquipo.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) return res.status(404).json({ message: "Tipo de equipo no encontrado" });

    return res.json(sanitize(updated));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: `Ya existe un tipo de equipo con ese nombre.`,
      });
    }
    console.error("Error al actualizar tipo de equipo:", error);
    return res.status(500).json({ message: "Error al actualizar tipo de equipo" });
  }
};

module.exports.deleteTipoEquipo = async (req, res) => {
  try {
    const deleted = await TipoEquipo.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ message: "Tipo de equipo no encontrado" });
    return res.json({ message: "Tipo de equipo eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar tipo de equipo:", error);
    return res.status(500).json({ message: "Error al eliminar tipo de equipo" });
  }
};
