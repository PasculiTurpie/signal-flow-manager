const mongoose = require("mongoose");

const SignalSchema = new mongoose.Schema(
  {
    nameChannel: {
      type: String,
      required: true,
      trim: true,
    },
    numberChannelSur: {
      type: String,
      required: true,
      trim: true,
    },
    numberChannelCn: {
      type: String,
      required: true,
      trim: true,
    },
    logoChannel: {
      type: String,
      required: true,
      trim: true,
    },
    severidadChannel: {
      type: String,
      required: true,
      trim: true,
    },
    tipoServicio: {
      type: String,
      required: true,
      trim: true,
    },
    tipoTecnologia: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
    },
    contact: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contact",
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

// Índice combinado único
SignalSchema.index({ nameChannel: 1, tipoTecnologia: 1 }, { unique: true });

const Signal = mongoose.model("Signal", SignalSchema);
module.exports = Signal;
