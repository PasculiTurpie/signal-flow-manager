// src/pages/Equipment/EquipoSatellite.jsx
import PropTypes from "prop-types";

const Safe = (v) => (v == null || v === "" ? "—" : String(v));

export default function EquipoSatellite({
  satellite,
  loading,
  error,
  title = "Detalle Satélite",
  compact = false,
}) {
  const wrapStyle = {
    marginBottom: 16,
    padding: compact ? 10 : 12,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#fafafa",
    fontSize: compact ? 13 : 14,
    lineHeight: 1.35,
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: compact ? 6 : 8,
    marginTop: compact ? 8 : 10,
  };

  // satelliteType viene populado (objeto) o como id (string)
  const tipo =
    typeof satellite?.satelliteType === "object"
      ? satellite?.satelliteType?.typePolarization || satellite?.satelliteType?.tipoNombre
      : satellite?.satelliteType;

  return (
    <div style={wrapStyle}>
      {title && (
        <h3 style={{ margin: 0, marginBottom: compact ? 6 : 8, fontSize: compact ? 15 : 16 }}>
          {title}
        </h3>
      )}

      {loading && <div>Cargando satélite…</div>}

      {!loading && error && <div style={{ color: "#b91c1c" }}>Error: {Safe(error)}</div>}

      {!loading && !error && !satellite && <div>No hay datos de satélite para mostrar.</div>}

      {!loading && !error && satellite && (
        <>
          <div style={gridStyle}>
            <div><strong>ID:</strong> {Safe(satellite?._id)}</div>
            <div><strong>Nombre:</strong> {Safe(satellite?.satelliteName)}</div>
            <div>
              <strong>URL:</strong>{" "}
              {satellite?.satelliteUrl ? (
                <a href={satellite.satelliteUrl} target="_blank" rel="noopener noreferrer">
                  {satellite.satelliteUrl}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div><strong>Polarización / Tipo:</strong> {Safe(tipo)}</div>
            <div><strong>Creado:</strong> {satellite?.createdAt ? new Date(satellite.createdAt).toLocaleString() : "—"}</div>
            <div><strong>Actualizado:</strong> {satellite?.updatedAt ? new Date(satellite.updatedAt).toLocaleString() : "—"}</div>
          </div>
        </>
      )}
    </div>
  );
}

EquipoSatellite.propTypes = {
  satellite: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
  title: PropTypes.string,
  compact: PropTypes.bool,
};