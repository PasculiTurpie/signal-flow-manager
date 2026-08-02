// controllers/bulkEquipo.controller.js
const XLSX = require("xlsx");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");
const Satellite = require("../models/satellite.model");
const Ird = require("../models/ird.model");

const REQUIRED_FIELDS = ["nombre", "marca", "modelo", "tipoNombre"];
const norm = (s) => String(s ?? "").trim();

async function resolveTipoEquipo(nombre) {
  const clean = norm(nombre);
  const tipo = await TipoEquipo.findOne({ tipoNombreLower: clean.toLowerCase() });
  if (!tipo) {
    throw new Error(`tipoNombre "${clean}" no existe. Créalo primero con la carga masiva de TipoEquipo.`);
  }
  return tipo;
}

async function resolveSatelliteOptional(nombre) {
  const clean = norm(nombre);
  if (!clean) return null;
  const sat = await Satellite.findOne({ satelliteName: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (!sat) throw new Error(`satelliteNombre "${clean}" no existe en el catálogo de Satellite.`);
  return sat;
}

async function resolveIrdOptional(nombre) {
  const clean = norm(nombre);
  if (!clean) return null;
  const ird = await Ird.findOne({ nombreIrd: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (!ird) throw new Error(`irdNombre "${clean}" no existe en el catálogo de Ird.`);
  return ird;
}

async function processEquipoData(excelData) {
  const results = {
    successful: [],
    errors: [],
    summary: { totalProcessed: 0, created: 0, updated: 0, errors: 0 },
  };

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

      const nombre = norm(row.nombre);
      const marca = norm(row.marca);
      const modelo = norm(row.modelo);
      const tipo = await resolveTipoEquipo(row.tipoNombre);
      const satellite = await resolveSatelliteOptional(row.satelliteNombre);
      const ird = await resolveIrdOptional(row.irdNombre);
      const ipGestion = norm(row.ip_gestion) || null;

      const payload = {
        nombre,
        marca,
        modelo,
        tipoNombre: tipo._id,
        ip_gestion: ipGestion,
        satelliteRef: satellite ? satellite._id : null,
        irdRef: ird ? ird._id : null,
      };

      // Evita duplicar: mismo nombre + modelo = mismo equipo físico
      const existing = await Equipo.findOne({ nombre, modelo });
      if (existing) {
        existing.set(payload);
        await existing.save();
        results.summary.updated++;
        results.successful.push({ row: rowNumber, equipoId: existing._id, nombre, accion: "actualizado" });
        continue;
      }

      const created = await Equipo.create(payload);
      results.summary.created++;
      results.successful.push({ row: rowNumber, equipoId: created._id, nombre, accion: "creado" });
    } catch (error) {
      results.summary.errors++;
      let message = error.message;
      if (error?.code === 11000) message = `Duplicado: ya existe un equipo con esos datos únicos.`;
      results.errors.push({ row: rowNumber, data: row, error: message });
    }
  }

  return results;
}

const bulkCreateEquipos = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    if (excelData.length === 0) return res.status(400).json({ success: false, message: "El archivo Excel está vacío" });

    const results = await processEquipoData(excelData);
    return res.json({ success: true, message: "Procesamiento completado", data: results });
  } catch (error) {
    console.error("Error en carga masiva de Equipo:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
  }
};

const validateExcelFormat = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No se encontró archivo Excel" });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length === 0) return res.status(400).json({ success: false, message: "El archivo Excel está vacío" });

    const headers = data[0] || [];
    const missingHeaders = REQUIRED_FIELDS.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({ success: false, message: "Formato de archivo incorrecto", missingHeaders, foundHeaders: headers });
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return res.json({ success: true, message: "Formato válido", headers, preview: jsonData.slice(0, 5), totalRows: jsonData.length });
  } catch (error) {
    console.error("Error en validateExcelFormat (Equipo):", error);
    return res.status(500).json({ success: false, message: "Error al validar archivo", error: error.message });
  }
};

module.exports = { bulkCreateEquipos, validateExcelFormat };
