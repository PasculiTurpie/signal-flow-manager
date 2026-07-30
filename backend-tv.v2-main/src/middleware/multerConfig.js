// Configuración de multer para manejar uploads de Excel en memoria
const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [".xlsx", ".xls"];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos Excel (.xlsx, .xls)"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = upload;
