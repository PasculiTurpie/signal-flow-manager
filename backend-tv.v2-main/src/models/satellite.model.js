const mongoose = require("mongoose");

const SatelliteSchema = new mongoose.Schema(
  {
    satelliteName: {
      type: String,
      required: true,
      trim: true,
    },
    satelliteType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Polarization",
      required: true,
      trim: true,
    },
    urlImagen: {
      type: String,
      default: "https://i.ibb.co/m5dxbBRh/parabolic.png",
      trim: true,
    },
    satelliteUrl: {
      type: String,
      default: "https://www.lyngsat.com/",
      trim: true,
    },
  },
  { timestamps: true, versionKey: false }
);

SatelliteSchema.index({ satelliteName: 1, satelliteType: 1 }, { unique: true });
const Satellite = mongoose.model("Satellite", SatelliteSchema);
module.exports = Satellite;
