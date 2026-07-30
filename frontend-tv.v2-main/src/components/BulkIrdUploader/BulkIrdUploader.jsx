import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import api from "../../utils/api.js";

const BulkIrdUploader = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Results

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      setLoading(true);

      try {
        const data = await api.validateExcelIrds(file);

        if (data.success) {
          setPreview(data);
          setStep(2);
        } else {
          alert(`Error: ${data.message}`);
          if (data.missingHeaders) {
            alert(`Columnas faltantes: ${data.missingHeaders.join(", ")}`);
          }
        }
      } catch (error) {
        console.error("Error al validar archivo:", error);
        alert(
          `Error al validar archivo: ${
            error?.response?.data?.message || error.message
          }`
        );
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleProcess = async () => {
    setLoading(true);

    try {
      const data = await api.bulkCreateIrds(file);
      setResults(data);
      setStep(3);
    } catch (error) {
      console.error("Error al procesar archivo:", error);
      alert(
        `Error al procesar archivo: ${
          error?.response?.data?.message || error.message
        }`
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

  const downloadTemplate = () => {
    const template = [
      {
        nombreIrd: "IRD-001",
        ipAdminIrd: "192.168.1.100",
        marcaIrd: "Motorola",
        modelIrd: "DSR-6000",
        versionIrd: "1.0",
        uaIrd: "UA001",
        tidReceptor: "TID001",
        typeReceptor: "DVB-S2",
        feqReceptor: "12.5",
        symbolRateIrd: "27500",
        fecReceptorIrd: "3/4",
        modulationReceptorIrd: "8PSK",
        rellOfReceptor: "0.35",
        nidReceptor: "1",
        cvirtualReceptor: "100",
        vctReceptor: "200",
        outputReceptor: "ASI",
        multicastReceptor: "239.1.1.1",
        ipVideoMulticast: "239.1.1.2",
        locationRow: "A",
        locationCol: "1",
        swAdmin: "SW-001",
        portSw: "1",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template IRDs");
    XLSX.writeFile(wb, "template_irds.xlsx");
  };

  // ✅ Estilos para tabla responsive
  const tableWrapStyle = {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    border: "1px solid #ddd",
    borderRadius: "10px",
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed", // ✅ clave para que ajuste al contenedor
  };

  const thStyle = {
    border: "1px solid #ddd",
    padding: "12px",
    textAlign: "left",
    backgroundColor: "#f5f5f5",
    fontSize: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const tdStyle = {
    border: "1px solid #ddd",
    padding: "12px",
    fontSize: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  return (
    <div
      className="outlet-main"
      style={{
        width: "100%",
        maxWidth: "100%", // ✅ se adapta a la ventana (ajusta si quieres)
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Carga Masiva de IRDs</h2>

        <button
          onClick={downloadTemplate}
          style={{
            padding: "8px 16px",
            backgroundColor: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Descargar Template
        </button>
      </div>

      {step === 1 && (
        <div>
          <div
            style={{
              marginBottom: "16px",
              padding: "14px 16px",
              backgroundColor: "#e3f2fd",
              borderRadius: "8px",
              border: "1px solid #bbdefb",
              color: "#0d47a1",
            }}
          >
            <strong>Nota:</strong> En carga masiva se permiten{" "}
            <strong>duplicados</strong> (nombre, IP y equipos asociados).
          </div>

          <div
            {...getRootProps()}
            style={{
              border: "2px dashed #ccc",
              borderRadius: "10px",
              padding: "40px",
              textAlign: "center",
              cursor: "pointer",
              backgroundColor: isDragActive ? "#f0f8ff" : "#fafafa",
              transition: "background-color 0.3s ease",
            }}
          >
            <input {...getInputProps()} />
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
            <p style={{ fontSize: "1.1em", margin: "0 0 8px 0" }}>
              {isDragActive
                ? "Suelta el archivo Excel aquí..."
                : "Arrastra un archivo Excel o haz clic para seleccionar"}
            </p>
            <p style={{ fontSize: "0.9em", color: "#666", margin: "0" }}>
              Formatos soportados: .xlsx, .xls (máx. 10MB)
            </p>
          </div>

          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              backgroundColor: "#fff3cd",
              borderRadius: "8px",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", color: "#856404" }}>
              Columnas requeridas:
            </h4>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#856404" }}>
              <li>
                <strong>nombreIrd:</strong> Nombre del IRD (puede repetirse)
              </li>
              <li>
                <strong>ipAdminIrd:</strong> IP de administración (puede
                repetirse)
              </li>
              <li>
                <strong>marcaIrd:</strong> Marca del equipo
              </li>
              <li>
                <strong>modelIrd:</strong> Modelo del equipo
              </li>
            </ul>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div>
          <h3>Vista Previa del Archivo</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
              margin: "20px 0",
            }}
          >
            <div
              style={{
                padding: "16px",
                backgroundColor: "#e3f2fd",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#1976d2",
                }}
              >
                {preview.totalRows}
              </div>
              <div style={{ color: "#1976d2" }}>Total de filas</div>
            </div>

            <div
              style={{
                padding: "16px",
                backgroundColor: "#e8f5e8",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#388e3c",
                }}
              >
                {preview.headers?.length || 0}
              </div>
              <div style={{ color: "#388e3c" }}>Columnas encontradas</div>
            </div>

            <div
              style={{
                padding: "16px",
                backgroundColor: "#fff3e0",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#f57c00",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file?.name || ""}
              </div>
              <div style={{ color: "#f57c00" }}>Archivo</div>
            </div>
          </div>

          <h4>Columnas encontradas:</h4>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              margin: "16px 0",
            }}
          >
            {preview.headers?.map((header, index) => (
              <span
                key={index}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#e3f2fd",
                  borderRadius: "16px",
                  fontSize: "0.9em",
                  border: "1px solid #bbdefb",
                }}
                title={header}
              >
                {header}
              </span>
            ))}
          </div>

          <h4>Muestra de datos (primeras 5 filas):</h4>

          {/* ✅ Tabla ajustada al ancho de la ventana */}
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: "50px" }}>#</th>
                  {preview.headers?.map((header, index) => (
                    <th key={index} style={thStyle} title={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview?.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    style={{
                      backgroundColor: rowIndex % 2 === 0 ? "#fff" : "#fafafa",
                    }}
                  >
                    <td style={{ ...tdStyle, fontWeight: "bold" }}>
                      {rowIndex + 1}
                    </td>
                    {preview.headers?.map((header, colIndex) => (
                      <td
                        key={colIndex}
                        style={tdStyle}
                        title={row?.[header] ? String(row[header]) : ""}
                      >
                        {row?.[header] ? String(row[header]) : "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button
              onClick={resetUploader}
              style={{
                padding: "12px 24px",
                backgroundColor: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleProcess}
              disabled={loading}
              style={{
                padding: "12px 24px",
                backgroundColor: loading ? "#ccc" : "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              {loading ? "Procesando..." : "Procesar IRDs"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && results && (
        <div>
          <h3>Resultados del Procesamiento</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              margin: "24px 0",
            }}
          >
            <div
              style={{
                padding: "20px",
                backgroundColor: "#e8f5e8",
                borderRadius: "12px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#388e3c",
                }}
              >
                {results.data?.summary?.totalProcessed || 0}
              </div>
              <div style={{ color: "#388e3c", fontWeight: "500" }}>
                Total Procesados
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                backgroundColor: "#e3f2fd",
                borderRadius: "12px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#1976d2",
                }}
              >
                {results.data?.summary?.irdsCreated || 0}
              </div>
              <div style={{ color: "#1976d2", fontWeight: "500" }}>
                IRDs Creados
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                backgroundColor: "#fff3e0",
                borderRadius: "12px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#f57c00",
                }}
              >
                {results.data?.summary?.equiposCreated || 0}
              </div>
              <div style={{ color: "#f57c00", fontWeight: "500" }}>
                Equipos Creados
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                backgroundColor: "#ffebee",
                borderRadius: "12px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#d32f2f",
                }}
              >
                {results.data?.summary?.errors || 0}
              </div>
              <div style={{ color: "#d32f2f", fontWeight: "500" }}>Errores</div>
            </div>
          </div>

          {results.data?.successful?.length > 0 && (
            <div style={{ margin: "24px 0" }}>
              <h4 style={{ color: "#388e3c" }}>IRDs creados exitosamente:</h4>
              <div
                style={{
                  maxHeight: "200px",
                  overflow: "auto",
                  border: "1px solid #4caf50",
                  borderRadius: "8px",
                  backgroundColor: "#f1f8e9",
                }}
              >
                {results.data.successful.slice(0, 10).map((success, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #c8e6c9",
                    }}
                  >
                    <strong>Fila {success.row}:</strong> {success.nombre} (
                    {success.ip})
                  </div>
                ))}
                {results.data.successful.length > 10 && (
                  <div style={{ padding: "12px", fontStyle: "italic", color: "#666" }}>
                    ... y {results.data.successful.length - 10} más
                  </div>
                )}
              </div>
            </div>
          )}

          {results.data?.errors?.length > 0 && (
            <div style={{ margin: "24px 0" }}>
              <h4 style={{ color: "#d32f2f" }}>Errores encontrados:</h4>
              <div
                style={{
                  maxHeight: "300px",
                  overflow: "auto",
                  border: "1px solid #f44336",
                  borderRadius: "8px",
                  backgroundColor: "#ffebee",
                }}
              >
                {results.data.errors.map((error, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #ffcdd2",
                    }}
                  >
                    <strong style={{ color: "#d32f2f" }}>
                      Fila {error.row}:
                    </strong>
                    <div style={{ marginTop: "4px", color: "#666" }}>
                      {error.error}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={resetUploader}
            style={{
              padding: "12px 24px",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            Subir Otro Archivo
          </button>
        </div>
      )}

      {loading && (
        <div
          style={{
            textAlign: "center",
            margin: "40px 0",
            padding: "20px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "12px" }}>⏳</div>
          <p style={{ margin: 0, fontSize: "16px" }}>
            {step === 2 ? "Validando archivo..." : "Procesando IRDs..."}
          </p>
        </div>
      )}
    </div>
  );
};

export default BulkIrdUploader;
