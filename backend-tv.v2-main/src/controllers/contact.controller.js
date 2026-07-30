const Contact = require("../models/contact.model");

module.exports.createContact = async (req, res) => {
  try {
    const contact = new Contact(req.body);
    const saved = await contact.save();
    return res.status(201).json(saved);
  } catch (error) {
    console.error("Error al crear contacto:", error);

    // 🔴 Duplicidad de datos (índice unique)
    if (error?.code === 11000) {
      const field =
        (error.keyValue && Object.keys(error.keyValue)[0]) ||
        (error.keyPattern && Object.keys(error.keyPattern)[0]) ||
        "campo";
      const value =
        (error.keyValue && error.keyValue[field]) || "valor repetido";
      return res.status(409).json({
        message: `Ya existe un contacto con ${field}: "${value}"`,
      });
    }

    // ❗ Error de validación (por ejemplo falta nombreContact)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        message: messages.join(". "),
      });
    }

    return res.status(500).json({ message: "Error al crear contacto" });
  }
};

module.exports.getContact = async (_req, res) => {
  try {
    const contact = await Contact.find().lean();
    return res.json(contact);
  } catch (error) {
    console.error("Error al obtener contactos:", error);
    return res.status(500).json({ message: "Error al obtener contacto" });
  }
};

module.exports.getIdContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).lean();
    if (!contact) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }
    return res.json(contact);
  } catch (error) {
    console.error("Error al obtener contacto:", error);
    return res.status(500).json({ message: "Error al obtener contacto" });
  }
};

module.exports.updateContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!contact) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }
    return res.json(contact);
  } catch (error) {
    console.error("Error al actualizar contacto:", error);

    if (error?.code === 11000) {
      const field =
        (error.keyValue && Object.keys(error.keyValue)[0]) ||
        (error.keyPattern && Object.keys(error.keyPattern)[0]) ||
        "campo";
      const value =
        (error.keyValue && error.keyValue[field]) || "valor repetido";
      return res.status(409).json({
        message: `Ya existe un contacto con ${field}: "${value}"`,
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        message: messages.join(". "),
      });
    }

    return res.status(500).json({ message: "Error al actualizar contacto" });
  }
};

module.exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id).lean();
    if (!contact) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }
    return res.json({ message: "Contacto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar contacto:", error);
    return res.status(500).json({ message: "Error al eliminar contacto" });
  }
};
