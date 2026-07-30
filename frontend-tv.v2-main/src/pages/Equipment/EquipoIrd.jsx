import PropTypes from "prop-types";

const Safe = (v) => (v == null || v === "" ? "—" : String(v));

export default function EquipoIrd({
  ird,
  loading,
  error,
  title = "Detalle IRD",
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

  // IP como link (http://<ip>)
  const renderIp = (ip) =>
    ip ? (
      <a
        href={`http://${ip}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "underline", color: "#2563eb" }}
      >
        {ip}
      </a>
    ) : (
      "—"
    );

  return (
    <div style={wrapStyle}>
      {title && (
        <h3 style={{ margin: 0, marginBottom: compact ? 6 : 8, fontSize: compact ? 15 : 16 }}>
          {title}
        </h3>
      )}

      {loading && <div>Cargando IRD…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>Error: {Safe(error)}</div>}
      {!loading && !error && !ird && <div>No hay información de IRD para este equipo.</div>}

      {!loading && !error && ird && (
        <>
          <div style={gridStyle}>
            <div><strong>ID:</strong> {Safe(ird?._id)}</div>
            <div><strong>Nombre IRD:</strong> {Safe(ird?.nombreIrd)}</div>
            <div><strong>Marca:</strong> {Safe(ird?.marcaIrd)}</div>
            <div><strong>Modelo:</strong> {Safe(ird?.modelIrd)}</div>
            <div><strong>IP Administración:</strong> {renderIp(ird?.ipAdminIrd)}</div>
            <div><strong>Versión:</strong> {Safe(ird?.versionIrd)}</div>
            <div><strong>UA:</strong> {Safe(ird?.uaIrd)}</div>
            <div><strong>TID:</strong> {Safe(ird?.tidReceptor)}</div>
            <div><strong>Tipo receptor:</strong> {Safe(ird?.typeReceptor)}</div>
            <div><strong>Frecuencia:</strong> {Safe(ird?.feqReceptor)}</div>
            <div><strong>Symbol Rate:</strong> {Safe(ird?.symbolRateIrd)}</div>
            <div><strong>FEC:</strong> {Safe(ird?.fecReceptorIrd)}</div>
            <div><strong>Modulación:</strong> {Safe(ird?.modulationReceptorIrd)}</div>
            <div><strong>Roll Off:</strong> {Safe(ird?.rellOfReceptor)}</div>
            <div><strong>NID:</strong> {Safe(ird?.nidReceptor)}</div>
            <div><strong>Canal Virtual:</strong> {Safe(ird?.cvirtualReceptor)}</div>
            <div><strong>VCT:</strong> {Safe(ird?.vctReceptor)}</div>
            <div><strong>Salida receptor:</strong> {Safe(ird?.outputReceptor)}</div>
            <div><strong>Multicast Receptor:</strong> {Safe(ird?.multicastReceptor)}</div>
            <div><strong>IP Video Multicast:</strong> {Safe(ird?.ipVideoMulticast)}</div>
            <div><strong>Fila:</strong> {Safe(ird?.locationRow)}</div>
            <div><strong>Bastidor:</strong> {Safe(ird?.locationCol)}</div>
            <div><strong>Creado:</strong> {ird?.createdAt ? new Date(ird.createdAt).toLocaleString() : "—"}</div>
            <div><strong>Actualizado:</strong> {ird?.updatedAt ? new Date(ird.updatedAt).toLocaleString() : "—"}</div>
          </div>
        </>
      )}
    </div>
  );
}

EquipoIrd.propTypes = {
  ird: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
  title: PropTypes.string,
  compact: PropTypes.bool,
};
