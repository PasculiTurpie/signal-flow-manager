const Polarization = require("../models/polarization.model");

module.exports.getPolarization = async (req, res) => {
  try {
    const polarization = await Polarization.find();
    res.json(polarization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.createPolarization = async (req, res) => {
  try {
    const polarization = new Polarization(req.body);
    await polarization.save();
    res.json(polarization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
