const XLSX = require("xlsx");
const Ird = require("../models/ird.model");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");

// Normalizadores
const normalizeLower = (s) => String(s ?? "").trim().toLowerCase();
const normalizeStr = (s) => String(s ?? "").trim();

// Función para limpiar y validar datos
const cleanAndValidateData = (data) => {
  const cleaned = {};

  // Campos requeridos
  const requiredFields = ["nombreIrd", "ipAdminIrd"];

  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === "") {
      throw new Error(`Campo requerido faltante: ${field}`);
    }
    cleaned[field] = normalizeStr(data[field]);
  }

  // Campos opcionales con limpieza
  const optionalFields = [
    "urlIrd",
    "marcaIrd",
    "modelIrd",
    "versionIrd",
    "uaIrd",
    "tidReceptor",
    "typeReceptor",
    "feqReceptor",
    "symbolRateIrd",
    "fecReceptorIrd",
    "modulationReceptorIrd",
    "rellOfReceptor",
    "nidReceptor",
    "cvirtualReceptor",
    "vctReceptor",
    "outputReceptor",
    "multicastReceptor",
    "ipVideoMulticast",
    "locationRow",
    "locationCol",
    "swAdmin",
    "portSw",
  ];

  for (const field of optionalFields) {
    if (data[field] && String(data[field]).trim() !== "") {
      cleaned[field] = normalizeStr(data[field]);
    }
  }

  // Validación de IP (simple)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(cleaned.ipAdminIrd)) {
    throw new Error(`IP inválida: ${cleaned.ipAdminIrd}`);
  }

  return cleaned;
};

// Función para obtener o crear TipoEquipo para IRD (robusta)
const getOrCreateIrdTipoEquipo = async () => {
  // Si tu TipoEquipo tiene tipoNombreLower, úsalo (más estable)
  let tipoIrd = await TipoEquipo.findOne({ tipoNombreLower: "ird" }).lean();

  if (!tipoIrd) {
    // fallback por tipoNombre por si no existe lower
    tipoIrd = await TipoEquipo.findOne({
      tipoNombre: { $regex: /^ird$/i },
    }).lean();
  }

  if (!tipoIrd) {
    const payload = {
      tipoNombre: "IRD",
      tipoNombreLower: "ird",
    };

    const created = await TipoEquipo.create(payload);
    return created;
  }

  return tipoIrd;
};

// Procesamiento principal (idempotente: no duplica registros existentes)
const processIrdData = async (excelData) => {
  const results = {
    successful: [],
    errors: [],
    duplicadosEnArchivo: [],
    summary: {
      totalProcessed: 0,
      irdsCreated: 0,
      irdsUpdated: 0,
      equiposCreated: 0,
      equiposUpdated: 0,
      errors: 0,
      duplicadosEnArchivo: 0,
    },
  };

  const tipoIrd = await getOrCreateIrdTipoEquipo();
  const vistosEnArchivo = new Map();

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const rowNumber = i + 2; // +2 por headers

    try {
      results.summary.totalProcessed++;

      // Limpiar/validar
      const cleanData = cleanAndValidateData(row);

      const key = `${String(cleanData.nombreIrd).toLowerCase()}|||${String(cleanData.ipAdminIrd).toLowerCase()}`;
      if (vistosEnArchivo.has(key)) {
        vistosEnArchivo.get(key).push(rowNumber);
      } else {
        vistosEnArchivo.set(key, [rowNumber]);
      }

      // Idempotente: busca por nombreIrd + ipAdminIrd (misma clave única del modelo,
      // sin distinguir mayúsculas/minúsculas) antes de crear.
      const nombreEsc = String(cleanData.nombreIrd).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const ipEsc = String(cleanData.ipAdminIrd).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let ird = await Ird.findOne({
        nombreIrd: new RegExp(`^${nombreEsc}$`, "i"),
        ipAdminIrd: new RegExp(`^${ipEsc}$`, "i"),
      });

      let accionIrd;
      if (ird) {
        ird.set(cleanData);
        await ird.save();
        results.summary.irdsUpdated++;
        accionIrd = "actualizado";
      } else {
        ird = await Ird.create(cleanData);
        results.summary.irdsCreated++;
        accionIrd = "creado";
      }

      // Equipo asociado: idempotente también, buscando por nombre
      const equipoData = {
        nombre: cleanData.nombreIrd,
        marca: cleanData.marcaIrd || "N/A",
        modelo: cleanData.modelIrd || "N/A",
        tipoNombre: tipoIrd._id,
        ip_gestion: cleanData.ipAdminIrd || null,
        irdRef: ird._id,
      };

      let equipo = await Equipo.findOne({ nombre: new RegExp(`^${nombreEsc}$`, "i") });
      let accionEquipo;
      if (equipo) {
        equipo.set(equipoData);
        await equipo.save();
        results.summary.equiposUpdated++;
        accionEquipo = "actualizado";
      } else {
        equipo = await Equipo.create(equipoData);
        results.summary.equiposCreated++;
        accionEquipo = "creado";
      }

      results.successful.push({
        row: rowNumber,
        irdId: ird._id,
        equipoId: equipo._id,
        nombre: cleanData.nombreIrd,
        ip: cleanData.ipAdminIrd,
        accionIrd,
        accionEquipo,
      });
    } catch (error) {
      results.summary.errors++;
      results.errors.push({
        row: rowNumber,
        data: row,
        error: error.message,
      });
    }
  }

  for (const [key, rows] of vistosEnArchivo) {
    if (rows.length > 1) {
      const [nombreIrd, ipAdminIrd] = key.split("|||");
      results.duplicadosEnArchivo.push({ nombreIrd, ipAdminIrd, filas: rows });
      results.summary.duplicadosEnArchivo++;
    }
  }

  return results;
};

// Controlador principal
const bulkCreateIrds = async (req, res) => {
  // ✅ Log infalible para confirmar que ESTE controller está corriendo
  console.log("[BULK IRD] controller NUEVO cargado ✅", new Date().toISOString());
  console.log("[BULK IRD] HIT URL:", req.originalUrl);

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se encontró archivo Excel",
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const excelData = XLSX.utils.sheet_to_json(worksheet);

    if (excelData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El archivo Excel está vacío",
      });
    }

    const results = await processIrdData(excelData);

    return res.json({
      success: true,
      message: "Procesamiento completado (duplicados permitidos)",
      data: results,
    });
  } catch (error) {
    console.error("Error en carga masiva de IRDs:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

// Validación de formato
const validateExcelFormat = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se encontró archivo Excel",
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: "El archivo Excel no tiene hojas válidas",
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El archivo Excel está vacío",
      });
    }

    const headers = data[0] || [];
    const expectedHeaders = ["nombreIrd", "ipAdminIrd", "marcaIrd", "modelIrd"];
    const missingHeaders = expectedHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Formato de archivo incorrecto",
        missingHeaders,
        foundHeaders: headers,
      });
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    const preview = jsonData.slice(0, 5);

    return res.json({
      success: true,
      message: "Formato válido",
      headers,
      preview,
      totalRows: jsonData.length,
    });
  } catch (error) {
    console.error("Error en validateExcelFormat:", error);
    return res.status(500).json({
      success: false,
      message: "Error al validar archivo",
      error: error.message,
    });
  }
};

module.exports = {
  bulkCreateIrds,
  validateExcelFormat,
};
