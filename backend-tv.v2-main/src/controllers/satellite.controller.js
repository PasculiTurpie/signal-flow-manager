const Satellite = require("../models/satellite.model");

module.exports.getSatellites = async (req, res) => {
  try {
    const satellites = await Satellite.find()
      .sort({ satelliteName: 1 })
      .populate("satelliteType");
    res.json(satellites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener satélites" });
  }
};

module.exports.getSatelliteById = async (req, res) => {
  try {
    const satellite = await Satellite.findById(req.params.id).populate("satelliteType");
    if (!satellite)
      return res.status(404).json({ message: "Satélite no encontrado" });
    res.json(satellite);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener satélite" });
  }
};

module.exports.postSatellite = async (req, res) => {
  try {
    const satellite = new Satellite(req.body);
    await satellite.save();
    res.status(201).json(satellite);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.values(error.keyValue).join(", ");
      return res.status(400).json({
        message: `Ya existe un satélite con la misma combinación de ${field}`,
      });
    }
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

module.exports.updateSatellite = async (req, res) => {
  try {
    const satellite = await Satellite.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!satellite)
      return res.status(404).json({ message: "Satélite no encontrado" });
    res.json(satellite);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Error al actualizar satélite" });
  }
};

module.exports.deleteSatellite = async (req, res) => {
  
  try {
    const satellite = await Satellite.findByIdAndDelete(req.params.id);
    if (!satellite)
      return res.status(404).json({ message: "Satélite no encontrado" });
    res.json({ message: "Satélite eliminado de la base de datos" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar satélite" });
  }
};
