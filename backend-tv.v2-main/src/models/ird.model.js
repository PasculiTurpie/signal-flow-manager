// models/ird.model.js
const mongoose = require("mongoose");

const IrdSchema = new mongoose.Schema(
  {
    urlIrd: {
      type: String,
      default: "https://i.ibb.co/pvW06r6K/ird-motorola.png",
      trim: true,
    },

    nombreIrd: {
      type: String,
      required: true,
      trim: true,
    },

    ipAdminIrd: {
      type: String,
      required: true,
      trim: true,
    },

    marcaIrd: { type: String, trim: true, default: "" },
    modelIrd: { type: String, trim: true, default: "" },
    versionIrd: { type: String, trim: true, default: "" },
    uaIrd: { type: String, trim: true, default: "" },

    tidReceptor: { type: String, trim: true, default: "" },
    typeReceptor: { type: String, trim: true, default: "" },
    feqReceptor: { type: String, trim: true, default: "" },
    symbolRateIrd: { type: String, trim: true, default: "" },
    fecReceptorIrd: { type: String, trim: true, default: "" },
    modulationReceptorIrd: { type: String, trim: true, default: "" },
    rellOfReceptor: { type: String, trim: true, default: "" },
    nidReceptor: { type: String, trim: true, default: "" },
    cvirtualReceptor: { type: String, trim: true, default: "" },
    vctReceptor: { type: String, trim: true, default: "" },
    outputReceptor: { type: String, trim: true, default: "" },
    multicastReceptor: { type: String, trim: true, default: "" },
    ipVideoMulticast: { type: String, trim: true, default: "" },

    locationRow: { type: String, trim: true, default: "" },
    locationCol: { type: String, trim: true, default: "" },

    swAdmin: { type: String, trim: true, default: "" },
    portSw: { type: String, trim: true, default: "" },
  },
  { timestamps: true, versionKey: false }
);

/* ===========================
   ÍNDICE COMPUESTO ÚNICO
   nombreIrd + ipAdminIrd
   =========================== */
IrdSchema.index(
  { nombreIrd: 1, ipAdminIrd: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 }, // case-insensitive
  }
);

const Ird = mongoose.model("Ird", IrdSchema);
module.exports = Ird;
