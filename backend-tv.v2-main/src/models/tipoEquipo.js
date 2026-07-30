const mongoose = require("mongoose");

const TipoEquipoSchema = new mongoose.Schema(
  {
    tipoNombre: { type: String, required: true, trim: true },
    tipoNombreLower: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true }
);

// Asegura que tipoNombreLower siempre exista aunque alguien cree directo por Mongo
TipoEquipoSchema.pre("validate", function (next) {
  if (this.tipoNombre) {
    this.tipoNombre = String(this.tipoNombre).trim();
    this.tipoNombreLower = String(this.tipoNombre).trim().toLowerCase();
  }
  next();
});

module.exports = mongoose.model("TipoEquipo", TipoEquipoSchema);
