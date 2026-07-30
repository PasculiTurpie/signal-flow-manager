import PropTypes from "prop-types";
import { Link } from "react-router-dom";

const Safe = (v) => (v == null || v === "" ? "—" : String(v));

export default function EquipoDetail({
  equipo,
  loading,
  error,
  title = "Detalle de Equipo",
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

  // mostrar nombre del tipo si viene populado
  const tipo =
    typeof equipo?.tipoNombre === "object"
      ? equipo?.tipoNombre?.tipoNombre
      : equipo?.tipoNombre;

  return (
    <div style={wrapStyle}>
      {title && (
        <h3 style={{ margin: 0, marginBottom: compact ? 6 : 8, fontSize: compact ? 15 : 16 }}>
          {title}
        </h3>
      )}

      {loading && <div>Cargando equipo…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>Error: {Safe(error)}</div>}
      {!loading && !error && !equipo && <div>Selecciona un nodo para ver el detalle del equipo.</div>}

      {!loading && !error && equipo && (
        <>
          <div style={gridStyle}>
            {/* <div><strong>ID:</strong> {Safe(equipo?._id)}</div> */}
            <div><strong>Nombre:</strong> {Safe(equipo?.nombre).toLocaleUpperCase()}</div>
            <div><strong>Marca:</strong> {Safe(equipo?.marca).toLocaleUpperCase()}</div>
            <div><strong>Modelo:</strong> {Safe(equipo?.modelo.toLocaleUpperCase())}</div>
            <div><strong>Tipo:</strong> {Safe(tipo).toLocaleUpperCase()}</div>
            <div>
              <strong>IP Gestión:</strong>{" "}
              {equipo?.ip_gestion ? (
                <Link
                  to={`http://${equipo.ip_gestion}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", textDecoration: "underline" }}
                >
                  {equipo.ip_gestion}
                </Link>
              ) : (
                "—"
              )}
            </div>
            <div><strong>Creado:</strong> {equipo?.createdAt ? new Date(equipo.createdAt).toLocaleString() : "—"}</div>
            <div><strong>Actualizado:</strong> {equipo?.updatedAt ? new Date(equipo.updatedAt).toLocaleString() : "—"}</div>
          </div>
        </>
      )}
    </div>
  );
}

EquipoDetail.propTypes = {
  equipo: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
  title: PropTypes.string,
  compact: PropTypes.bool,
};
