const Signal = require("../models/signal.model");
const { escapeRegex } = require("../../helpers/escapeRegex");

module.exports.createSignal = async (req, res) => {
  try {
    const signal = new Signal(req.body);
    await signal.save();
    res.status(200).json(signal);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: `Error al crear la señal`,
    });
  }
};

/* module.exports.getSignal = async (req, res) => {
  try {
    const signals = await Signal.find().populate("contact");
    res.status(200).json(signals);
  } catch (error) {
    console.error("Error al obtener señales:", error);
    res.status(500).json({ message: "Error al obtener señales" });
  }
}; */

module.exports.getSignal = async (req, res) => {
  try {
    const signals = await Signal.find().sort({ numberChannelSur: 1 }).populate("contact"); // 1 = ascendente
    res.status(200).json(signals);
  } catch (error) {
     console.error("Error al obtener señales:", error);
    res.status(500).json({ message: "Error al obtener señales" });
  }
};


module.exports.getIdSignal = async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id).populate("contact");
    res.status(200).json(signal);
  } catch (error) {
    console.error("Error al obtener señales:", error);
    res.status(500).json({ message: `Error al obtener señal` });
  }
};

module.exports.updateSignal = async (req, res) => {
  try {
    const { id } = req.params;
    const { contact, ...otherFields } = req.body;

    const signal = await Signal.findById(id);
    if (!signal)
      return res.status(404).json({ message: "No se encontró la señal" });

    // Preparar el objeto de actualización
    const updateData = { ...otherFields };

    // Si viene 'contact' válido, verificar y agregarlo
    if (contact && Array.isArray(contact) && contact.length > 0) {
      const alreadyAssigned = signal.contact.some((c) =>
        contact.includes(c.toString())
      );
      if (alreadyAssigned) {
        return res
          .status(409)
          .json({ message: "Contacto ya asignado previamente" });
      }

      updateData.$addToSet = { contact: { $each: contact } };
    }

    // Actualizar la señal
    const updatedSignal = await Signal.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.status(200).json({
      message: "Señal actualizada correctamente",
      data: updatedSignal,
    });
  } catch (error) {
    console.error("Error al actualizar señal:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};




module.exports.deleteSignal = async (req, res) => {
  try {
    const { id } = req.params;
    const signalTv = await Signal.findByIdAndDelete(id);
    if (!signalTv) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }
    res.status(200).json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar elemento:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};


module.exports.searchSignals = async (req, res) => {
  const raw = (req.query.keyword ?? "").toString();
  const keyword = raw.trim();

  if (!keyword) {
    return res.status(400).json({ message: "Parámetro 'keyword' requerido" });
  }

  try {
    const isNumeric = /^\d+$/.test(keyword); // sólo dígitos
    const regex = new RegExp(escapeRegex(keyword), "i");

    const query = {
      $or: [
        { nameChannel: regex },
        { numberChannelSur: regex }, // en DB son strings => regex funciona
        { numberChannelCn: regex },
        { tipoTecnologia: regex },
        { tipoServicio: regex },
      ],
    };

    // 👉 find + populate (sin expresiones en sort)
    const docs = await Signal.find(query).populate("contact").lean();

    // 🔢 Si el keyword es numérico, ordenamos en memoria de menor a mayor
    // priorizando Sur y luego Cn (ajusta si prefieres lo contrario)
    const toNum = (v) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };

    let results = docs;

    if (isNumeric) {
      results = [...docs].sort((a, b) => {
        const aSur = toNum(a.numberChannelSur);
        const bSur = toNum(b.numberChannelSur);
        if (aSur !== bSur) return aSur - bSur;

        const aCn = toNum(a.numberChannelCn);
        const bCn = toNum(b.numberChannelCn);
        return aCn - bCn;
      });
    }

    return res.json(results);
  } catch (error) {
    console.error("Error en búsqueda:", error);
    return res.status(500).json({ message: "Error al buscar señales" });
  }
};