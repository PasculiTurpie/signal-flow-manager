// controllers/bulkSignal.controller.js
const XLSX = require("xlsx");
const Signal = require("../models/signal.model");
const Contact = require("../models/contact.model");

const normalizeStr = (s) => String(s ?? "").trim();

const REQUIRED_FIELDS = [
  "nameChannel",
  "numberChannelSur",
  "numberChannelCn",
  "logoChannel",
  "severidadChannel",
  "tipoServicio",
  "tipoTecnologia",
];

const OPTIONAL_FIELDS = ["source"];

/**
 * Limpia y valida una fila de la hoja "Signals".
 * Columna opcional "contactos": nombres de contacto separados por coma,
 * ej: "Juan Pérez, María González" -> se resuelven por Contact.nombreContact.
 */
function cleanAndValidateRow(row) {
  const cleaned = {};

  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === "") {
      throw new Error(`Campo requerido faltante: ${field}`);
    }
    cleaned[field] = normalizeStr(row[field]);
  }

  for (const field of OPTIONAL_FIELDS) {
    if (row[field] && String(row[field]).trim() !== "") {
      cleaned[field] = normalizeStr(row[field]);
    }
  }

  const contactosRaw = row.contactos || row.contactosNombres || "";
  const contactNames = String(contactosRaw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return { cleaned, contactNames };
}

async function resolveContactIds(contactNames, warnings) {
  if (!contactNames.length) return [];
  const ids = [];
  for (const name of contactNames) {
    const contact = await Contact.findOne({ nombreContact: name }).select("_id").lean();
    if (contact?._id) {
      ids.push(contact._id);
    } else {
      warnings.push(`Contacto no encontrado (se omite): "${name}"`);
    }
  }
  return ids;
}

async function processSignalData(excelData) {
  const results = {
    successful: [],
    errors: [],
    duplicadosEnArchivo: [],
    summary: { totalProcessed: 0, signalsCreated: 0, signalsUpdated: 0, errors: 0, duplicadosEnArchivo: 0 },
  };

  const vistosEnArchivo = new Map();

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const rowNumber = i + 2; // +2 por header

    try {
      results.summary.totalProcessed++;

      const { cleaned, contactNames } = cleanAndValidateRow(row);
      const warnings = [];
      const contactIds = await resolveContactIds(contactNames, warnings);

      const key = `${cleaned.nameChannel.toLowerCase()}|||${cleaned.tipoTecnologia.toLowerCase()}`;
      if (vistosEnArchivo.has(key)) {
        vistosEnArchivo.get(key).push(rowNumber);
      } else {
        vistosEnArchivo.set(key, [rowNumber]);
      }

      // Idempotente: la clave natural del modelo es nameChannel + tipoTecnologia
      let signal = await Signal.findOne({
        nameChannel: cleaned.nameChannel,
        tipoTecnologia: cleaned.tipoTecnologia,
      });

      let accion;
      if (signal) {
        signal.set({ ...cleaned, contact: contactIds });
        await signal.save();
        results.summary.signalsUpdated++;
        accion = "actualizada";
      } else {
        signal = await Signal.create({ ...cleaned, contact: contactIds });
        results.summary.signalsCreated++;
        accion = "creada";
      }

      results.successful.push({
        row: rowNumber,
        signalId: signal._id,
        nameChannel: cleaned.nameChannel,
        accion,
        warnings: warnings.length ? warnings : undefined,
      });
    } catch (error) {
      results.summary.errors++;
      let message = error.message;
      if (error?.code === 11000) {
        message = `Duplicado: ya existe una señal con nameChannel+tipoTecnologia = "${row.nameChannel}" + "${row.tipoTecnologia}".`;
      }
      results.errors.push({ row: rowNumber, data: row, error: message });
    }
  }

  for (const [key, rows] of vistosEnArchivo) {
    if (rows.length > 1) {
      const [nameChannel, tipoTecnologia] = key.split("|||");
      results.duplicadosEnArchivo.push({ nameChannel, tipoTecnologia, filas: rows });
      results.summary.duplicadosEnArchivo++;
    }
  }

  return results;
}

const bulkCreateSignals = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    if (excelData.length === 0) {
      return res.status(400).json({ success: false, message: "El archivo Excel está vacío" });
    }

    const results = await processSignalData(excelData);

    return res.json({
      success: true,
      message: "Procesamiento completado",
      data: results,
    });
  } catch (error) {
    console.error("Error en carga masiva de Signals:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

const validateExcelFormat = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, message: "El archivo Excel no tiene hojas válidas" });
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: "El archivo Excel está vacío" });
    }

    const headers = data[0] || [];
    const missingHeaders = REQUIRED_FIELDS.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Formato de archivo incorrecto",
        missingHeaders,
        foundHeaders: headers,
      });
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return res.json({
      success: true,
      message: "Formato válido",
      headers,
      preview: jsonData.slice(0, 5),
      totalRows: jsonData.length,
    });
  } catch (error) {
    console.error("Error en validateExcelFormat (Signal):", error);
    return res.status(500).json({ success: false, message: "Error al validar archivo", error: error.message });
  }
};

module.exports = { bulkCreateSignals, validateExcelFormat };
