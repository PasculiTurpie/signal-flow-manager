const mongoose = require('mongoose')

const NodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    type: { type: String, default: "default" },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    data: {
      label: { type: String, required: true },
      labelPosition: {
        x: { type: Number },
        y: { type: Number },
      },
      otherData: { type: mongoose.Schema.Types.Mixed }, // otros datos opcionales
    },
  },
  { timestamps: true, versionKey: false }
);

const Nodo = mongoose.model('Nodo', NodeSchema)
module.exports = Nodo;
