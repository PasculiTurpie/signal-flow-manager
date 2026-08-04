// controllers/bulkTipoEquipo.controller.js
const XLSX = require("xlsx");
const TipoEquipo = require("../models/tipoEquipo");

const REQUIRED_FIELDS = ["tipoNombre"];

async function processTipoEquipoData(excelData) {
  const results = {
    successful: [],
    errors: [],
    duplicadosEnArchivo: [],
    summary: { totalProcessed: 0, created: 0, updated: 0, errors: 0, duplicadosEnArchivo: 0 },
  };

  const vistosEnArchivo = new Map(); // key -> [rowNumber, ...]

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const rowNumber = i + 2;
    try {
      results.summary.totalProcessed++;

      for (const field of REQUIRED_FIELDS) {
        if (!row[field] || String(row[field]).trim() === "") {
          throw new Error(`Campo requerido faltante: ${field}`);
        }
      }

      const tipoNombre = String(row.tipoNombre).trim();
      const tipoNombreLower = tipoNombre.toLowerCase();

      if (vistosEnArchivo.has(tipoNombreLower)) {
        vistosEnArchivo.get(tipoNombreLower).push(rowNumber);
      } else {
        vistosEnArchivo.set(tipoNombreLower, [rowNumber]);
      }

      const existing = await TipoEquipo.findOne({ tipoNombreLower });
      if (existing) {
        results.summary.updated++;
        results.successful.push({ row: rowNumber, tipoEquipoId: existing._id, tipoNombre, accion: "ya existía (sin cambios)" });
        continue;
      }

      const created = await TipoEquipo.create({ tipoNombre });
      results.summary.created++;
      results.successful.push({ row: rowNumber, tipoEquipoId: created._id, tipoNombre, accion: "creado" });
    } catch (error) {
      results.summary.errors++;
      results.errors.push({ row: rowNumber, data: row, error: error.message });
    }
  }

  for (const [key, rows] of vistosEnArchivo) {
    if (rows.length > 1) {
      results.duplicadosEnArchivo.push({ tipoNombre: key, filas: rows });
      results.summary.duplicadosEnArchivo++;
    }
  }

  return results;
}

const bulkCreateTipoEquipos = async (req, res) => {
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

    const results = await processTipoEquipoData(excelData);
    return res.json({ success: true, message: "Procesamiento completado", data: results });
  } catch (error) {
    console.error("Error en carga masiva de TipoEquipo:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
  }
};

const validateExcelFormat = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    }
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: "El archivo Excel está vacío" });
    }

    const headers = data[0] || [];
    const missingHeaders = REQUIRED_FIELDS.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({ success: false, message: "Formato de archivo incorrecto", missingHeaders, foundHeaders: headers });
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return res.json({ success: true, message: "Formato válido", headers, preview: jsonData.slice(0, 5), totalRows: jsonData.length });
  } catch (error) {
    console.error("Error en validateExcelFormat (TipoEquipo):", error);
    return res.status(500).json({ success: false, message: "Error al validar archivo", error: error.message });
  }
};

module.exports = { bulkCreateTipoEquipos, validateExcelFormat };
