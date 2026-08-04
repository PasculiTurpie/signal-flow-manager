import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import api from "../../utils/api.js";

const BulkChannelFisicoUploader = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Previsualización (dry-run), 3: Resultado final

  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const data = await api.bulkCreateChannelsFisico(f, false); // dry-run
      setPreview(data);
      setStep(2);
    } catch (error) {
      console.error("Error al previsualizar archivo:", error);
      alert(
        `Error al leer el archivo: ${
          error?.response?.data?.message || error.message
        }`
      );
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
      const data = await api.bulkCreateChannelsFisico(file, true); // commit real
      setResults(data);
      setStep(3);
    } catch (error) {
      console.error("Error al generar diagramas:", error);
      alert(
        `Error al generar diagramas: ${
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

  const box = { padding: 16, borderRadius: 8, margin: "8px 0" };
  const okBox = { ...box, backgroundColor: "#e8f5e8", border: "1px solid #a5d6a7" };
  const errBox = { ...box, backgroundColor: "#ffebee", border: "1px solid #ef9a9a" };
  const warnBox = { ...box, backgroundColor: "#fff3cd", border: "1px solid #ffe082" };

  const renderSummary = (data, title) => (
    <div>
      <h3>{title}</h3>
      <p style={{ color: "#666" }}>{data?.data?.mode}</p>
      <div style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        <div style={{ ...okBox, flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: "bold", color: "#388e3c" }}>
            {data?.data?.summary?.ok || 0}
          </div>
          <div>OK</div>
        </div>
        <div style={{ ...errBox, flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: "bold", color: "#d32f2f" }}>
            {data?.data?.summary?.errors || 0}
          </div>
          <div>Errores</div>
        </div>
        <div style={{ ...box, flex: 1, textAlign: "center", backgroundColor: "#f5f5f5" }}>
          <div style={{ fontSize: 28, fontWeight: "bold" }}>
            {data?.data?.summary?.totalGrupos || 0}
          </div>
          <div>Señales (grupos)</div>
        </div>
      </div>

      {data?.data?.errors?.length > 0 && (
        <div style={{ margin: "16px 0" }}>
          <h4 style={{ color: "#d32f2f" }}>Errores por señal:</h4>
          <div style={{ maxHeight: 300, overflow: "auto", ...errBox }}>
            {data.data.errors.map((e, i) => (
              <div key={i} style={{ padding: 8, borderBottom: "1px solid #ffcdd2" }}>
                <strong>{e.nombre_señal}</strong>: {e.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.data?.duplicadosEnArchivo?.length > 0 && (
        <div style={{ margin: "16px 0" }}>
          <h4 style={{ color: "#b26a00" }}>
            ⚠️ Filas 100% idénticas dentro del mismo archivo ({data.data.duplicadosEnArchivo.length}):
          </h4>
          <p style={{ fontSize: 13, color: "#666" }}>
            Esto es distinto de una ruta primaria/respaldo (que tiene datos diferentes) — acá son
            filas exactamente iguales, probablemente copiadas por error en el Excel original.
          </p>
          <div
            style={{
              maxHeight: 200,
              overflow: "auto",
              padding: 16,
              borderRadius: 8,
              backgroundColor: "#fff3cd",
              border: "1px solid #ffe082",
            }}
          >
            {data.data.duplicadosEnArchivo.map((d, i) => (
              <div key={i} style={{ padding: 8, borderBottom: "1px solid #ffe082" }}>
                <strong>{d.grupo}</strong>: {d.filasIguales} filas idénticas
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.data?.successful?.length > 0 && (
        <div style={{ margin: "16px 0" }}>
          <h4 style={{ color: "#388e3c" }}>Diagramas OK:</h4>
          <div style={{ maxHeight: 300, overflow: "auto", ...okBox }}>
            {data.data.successful.slice(0, 30).map((s, i) => (
              <div key={i} style={{ padding: 8, borderBottom: "1px solid #c8e6c9" }}>
                <strong>{s.nombre_señal}</strong> — {s.nodos} nodos, {s.enlaces} conexiones
                {Array.isArray(s.ramas) ? (
                  <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                    Ramas: {s.ramas.join(", ")}
                  </div>
                ) : (
                  <span style={{ marginLeft: 6, color: "#555" }}>({s.ramas} rama{s.ramas === 1 ? "" : "s"})</span>
                )}
              </div>
            ))}
            {data.data.successful.length > 30 && (
              <div style={{ padding: 8, fontStyle: "italic" }}>
                ... y {data.data.successful.length - 30} más
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="outlet-main" style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h2>Carga Masiva de Diagramas de Canal</h2>
      <p style={{ color: "#666" }}>
        Sube el archivo <code>carga_masiva_diagramas.xlsx</code> (hoja <code>Diagramas</code> +{" "}
        <code>Ref_Sitio</code>). Primero se muestra una previsualización sin escribir nada en la
        base; recién al confirmar se crean/actualizan los diagramas.
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <p style={{ fontSize: "1.1em" }}>
            {isDragActive ? "Suelta el archivo aquí..." : "Arrastra el Excel o haz clic para elegirlo"}
          </p>
          <p style={{ fontSize: "0.9em", color: "#666" }}>Solo .xlsx</p>
        </div>
      )}

      {step === 2 && preview && (
        <div>
          {renderSummary(preview, "Previsualización (nada se ha guardado todavía)")}
          {preview.data?.summary?.errors > 0 && (
            <div style={warnBox}>
              Hay filas con error — se pueden confirmar igual (esas filas simplemente no se crean),
              o cancela, corrige el Excel y vuelve a subirlo.
            </div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={resetUploader} style={{ padding: "10px 20px" }}>
              Cancelar / subir otro archivo
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !preview?.data?.summary?.ok}
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
              {loading ? "Creando diagramas..." : `Confirmar y crear ${preview?.data?.summary?.ok || 0} diagrama(s)`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && results && (
        <div>
          {renderSummary(results, "Resultado final")}
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

      {loading && step === 1 && (
        <p style={{ textAlign: "center", marginTop: 20 }}>⏳ Leyendo archivo...</p>
      )}
    </div>
  );
};

export default BulkChannelFisicoUploader;
