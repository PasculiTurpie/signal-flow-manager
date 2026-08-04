import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import api from "../../utils/api.js";

const BulkTipoEquipoUploader = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Previsualización, 3: Resultado final

  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const data = await api.validateExcelTipoEquipos(f);
      setPreview(data);
      setStep(2);
    } catch (error) {
      console.error("Error al validar archivo:", error);
      alert(
        `Error al leer el archivo: ${
          error?.response?.data?.message || error.message
        }${
          error?.response?.data?.missingHeaders
            ? "\nFaltan columnas: " + error.response.data.missingHeaders.join(", ")
            : ""
        }`
      );
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const data = await api.bulkCreateTipoEquipos(file);
      setResults(data);
      setStep(3);
    } catch (error) {
      console.error("Error al crear tipos de equipo:", error);
      alert(
        `Error al procesar: ${error?.response?.data?.message || error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const resetUploader = () => {
    setFile(null);
    setPreview(null);
    setResults(null);
    setStep(1);
  };

  const box = { padding: 16, borderRadius: 8, margin: "8px 0" };
  const okBox = { ...box, backgroundColor: "#e8f5e8", border: "1px solid #a5d6a7" };
  const errBox = { ...box, backgroundColor: "#ffebee", border: "1px solid #ef9a9a" };

  return (
    <div className="outlet-main" style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h2>Carga Masiva de Tipos de Equipo</h2>
      <p style={{ color: "#666" }}>
        Sube un Excel con una columna <code>tipoNombre</code>. Es idempotente: si el tipo ya
        existe, no se duplica.
      </p>

      {step === 1 && (
        <div
          {...getRootProps()}
          style={{
            border: "2px dashed #ccc",
            borderRadius: 10,
            padding: 40,
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragActive ? "#f0f8ff" : "#fafafa",
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: "1.1em" }}>
            {isDragActive ? "Suelta el archivo aquí..." : "Arrastra el Excel o haz clic para elegirlo"}
          </p>
          <p style={{ fontSize: "0.9em", color: "#666" }}>Solo .xlsx</p>
          {loading && <p>⏳ Validando archivo...</p>}
        </div>
      )}

      {step === 2 && preview && (
        <div>
          <h3>Previsualización</h3>
          <p>
            <strong>{preview.totalRows}</strong> filas detectadas. Columnas encontradas:{" "}
            {preview.headers?.join(", ")}
          </p>
          <div style={{ maxHeight: 250, overflow: "auto", ...box, backgroundColor: "#f5f5f5" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {preview.headers?.map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #ccc" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview?.map((row, i) => (
                  <tr key={i}>
                    {preview.headers?.map((h) => (
                      <td key={h} style={{ padding: 6, borderBottom: "1px solid #eee" }}>
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={resetUploader} style={{ padding: "10px 20px" }}>
              Cancelar / subir otro archivo
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              style={{
                padding: "10px 20px",
                backgroundColor: "#4caf50",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Procesando..." : `Confirmar y cargar ${preview.totalRows} tipo(s)`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && results && (
        <div>
          <h3>Resultado</h3>
          <div style={{ display: "flex", gap: 16, margin: "16px 0" }}>
            <div style={{ ...okBox, flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: "bold", color: "#388e3c" }}>
                {results.data?.summary?.created || 0}
              </div>
              <div>Creados</div>
            </div>
            <div style={{ ...box, flex: 1, textAlign: "center", backgroundColor: "#f5f5f5" }}>
              <div style={{ fontSize: 28, fontWeight: "bold" }}>
                {results.data?.summary?.updated || 0}
              </div>
              <div>Ya existían</div>
            </div>
            <div style={{ ...errBox, flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: "bold", color: "#d32f2f" }}>
                {results.data?.summary?.errors || 0}
              </div>
              <div>Errores</div>
            </div>
          </div>

          {results.data?.errors?.length > 0 && (
            <div style={{ maxHeight: 250, overflow: "auto", ...errBox }}>
              {results.data.errors.map((e, i) => (
                <div key={i} style={{ padding: 8, borderBottom: "1px solid #ffcdd2" }}>
                  Fila {e.row}: {e.error}
                </div>
              ))}
            </div>
          )}

          {results.data?.duplicadosEnArchivo?.length > 0 && (
            <div style={{ margin: "16px 0" }}>
              <h4 style={{ color: "#b26a00" }}>
                ⚠️ Duplicados dentro del mismo archivo ({results.data.duplicadosEnArchivo.length}):
              </h4>
              <div
                style={{
                  maxHeight: 200,
                  overflow: "auto",
                  ...box,
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffe082",
                }}
              >
                {results.data.duplicadosEnArchivo.map((d, i) => (
                  <div key={i} style={{ padding: 8, borderBottom: "1px solid #ffe082" }}>
                    <strong>{d.tipoNombre}</strong> aparece en las filas: {d.filas.join(", ")}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={resetUploader}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: 6,
              marginTop: 16,
            }}
          >
            Subir otro archivo
          </button>
        </div>
      )}
    </div>
  );
};

export default BulkTipoEquipoUploader;
