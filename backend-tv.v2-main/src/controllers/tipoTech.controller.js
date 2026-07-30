const TipoTech = require("../models/tipoTech.model");

const sanitize = (doc) => {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(plain._id),
    nombreTipo: plain.nombreTipo,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

module.exports.createTech = async (req, res) => {
  try {
    const tipoTech = new TipoTech(req.body);
    await tipoTech.save();
    return res.status(201).json(sanitize(tipoTech));
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res
        .status(409)
        .json({ message: `Ya existe una tecnología con "${value}"` });
    }
    console.error("Error al crear tecnología:", error);
    return res
      .status(500)
      .json({ message: "Error al crear tecnología" });
  }
};

module.exports.getTech = async (_req, res) => {
  try {
    const tipoTech = await TipoTech.find().sort({ nombreTipo: 1 }).lean();
    return res.status(200).json(tipoTech.map(sanitize));
  } catch (error) {
    console.error("Error al obtener tecnologías:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener las tecnologías" });
  }
};

module.exports.getTechById = async (req, res) => {
  try {
    const tipoTech = await TipoTech.findById(req.params.id).lean();
    if (!tipoTech) {
      return res.status(404).json({ message: "Tecnología no encontrada" });
    }
    return res.json(sanitize(tipoTech));
  } catch (error) {
    console.error("Error al obtener tecnología:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener la tecnología" });
  }
};

module.exports.updateTech = async (req, res) => {
  try {
    const updated = await TipoTech.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) {
      return res.status(404).json({ message: "Tecnología no encontrada" });
    }
    return res.json(sanitize(updated));
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res
        .status(409)
        .json({ message: `Ya existe una tecnología con "${value}"` });
    }
    console.error("Error al actualizar tecnología:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar la tecnología" });
  }
};

module.exports.deleteTech = async (req, res) => {
  try {
    const deleted = await TipoTech.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Tecnología no encontrada" });
    }
    return res.json({ message: "Tecnología eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar tecnología:", error);
    return res
      .status(500)
      .json({ message: "Error al eliminar la tecnología" });
  }
};
