const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema(
  {
    nombreContact: {
      type: String,
      unique: true,
      required: true,
      set: (v) => (v === "" ? undefined : v),
      trim: true, // <- corregido (antes tirm)
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      set: (v) => (v === "" ? undefined : v),
      trim: true, // <- corregido (antes tirm)
    },
    telefono: {
      type: String,
      unique: true,
      sparse: true,
      set: (v) => (v === "" ? undefined : v),
      trim: true, // <- corregido (antes tirm)
    },
  },
  { timestamps: true, versionKey: false }
);

const Contact = mongoose.model("Contact", ContactSchema);
module.exports = Contact;