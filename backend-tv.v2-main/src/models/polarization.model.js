const mongoose = require('mongoose');

const PolarizationSchema = new mongoose.Schema(
  {
    typePolarization: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const Polarization = mongoose.model('Polarization', PolarizationSchema);
module.exports = Polarization;