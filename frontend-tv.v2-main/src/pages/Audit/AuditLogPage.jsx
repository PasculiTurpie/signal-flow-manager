import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import Swal from "sweetalert2";

const initialFilters = {
  q: "",
  userId: "",
  email: "",
  action: "",          // create|update|delete|login|logout|read
  method: "",          // GET|POST|PUT|DELETE|PATCH
  ip: "",
  resource: "",
  status: "",
  statusMin: "",
  statusMax: "",
  dateFrom: "",
  dateTo: "",
  sort: "-createdAt",
  page: 1,
  limit: 50,
};

export default function AuditLogPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, limit: 50, total: 0 });

  const canPrev = meta.page > 1;
  const canNext = meta.page < meta.pages;

  const load = async (params) => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs(params);
      setRows(res?.data || []);
      setMeta(res?.meta || { page: 1, pages: 1, limit: 50, total: 0 });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Error cargando auditoría" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApplyFilters = () => {
    const next = { ...filters, page: 1 };
    setFilters(next);
    load(next);
  };

  const onExportCSV = async () => {
    try {
      const { data, headers } = await api.exportAuditLogsCSV(filters);
      const blob = new Blob([data], { type: "text/csv;charset=utf-8" });

      let filename = "audit.csv";
      const cd = headers?.["content-disposition"];
      if (cd) {
        const match = /filename="?(.*?)"?$/.exec(cd);
        if (match?.[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "No se pudo exportar CSV" });
    }
  };

  const onChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const goto = (page) => {
    const next = { ...filters, page };
    setFilters(next);
    load(next);
  };

  return (
    <div className="outlet-main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Auditoría</h2>
        <button className="button btn-secondary" onClick={onExportCSV} disabled={loading}>
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={{ margin: "12px 0", border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        <div
          className="form__group-inputs"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}
        >
          <input
            className="form__input"
            placeholder="Búsqueda libre (q)"
            value={filters.q}
            onChange={(e) => onChange("q", e.target.value)}
          />
          <input
            className="form__input"
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => onChange("userId", e.target.value)}
          />
          <input
            className="form__input"
            placeholder="Email"
            value={filters.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
          <input
            className="form__input"
            placeholder="IP"
            value={filters.ip}
            onChange={(e) => onChange("ip", e.target.value)}
          />

          <select
            className="form__input"
            value={filters.action}
            onChange={(e) => onChange("action", e.target.value)}
          >
            <option value="">Acción (cualquiera)</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="read">read</option>
            <option value="login">login</option>
            <option value="logout">logout</option>
          </select>

          <select
            className="form__input"
            value={filters.method}
            onChange={(e) => onChange("method", e.target.value)}
          >
            <option value="">Método (cualquiera)</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          <input
            className="form__input"
            placeholder="Recurso (/ruta base)"
            value={filters.resource}
            onChange={(e) => onChange("resource", e.target.value)}
          />
          <input
            className="form__input"
            placeholder="Status exacto (e.g. 200)"
            value={filters.status}
            onChange={(e) => onChange("status", e.target.value)}
          />

          <input
            className="form__input"
            placeholder="Status ≥"
            value={filters.statusMin}
            onChange={(e) => onChange("statusMin", e.target.value)}
          />
          <input
            className="form__input"
            placeholder="Status ≤"
            value={filters.statusMax}
            onChange={(e) => onChange("statusMax", e.target.value)}
          />

          <div>
            <label style={{ fontSize: 12, color: "#666" }}>Desde</label>
            <input
              className="form__input"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange("dateFrom", e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666" }}>Hasta</label>
            <input
              className="form__input"
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange("dateTo", e.target.value)}
            />
          </div>

          <select
            className="form__input"
            value={filters.sort}
            onChange={(e) => onChange("sort", e.target.value)}
          >
            <option value="-createdAt">Orden: Fecha ↓</option>
            <option value="createdAt">Orden: Fecha ↑</option>
            <option value="statusCode">Orden: Status ↑</option>
            <option value="-statusCode">Orden: Status ↓</option>
          </select>

          <select
            className="form__input"
            value={filters.limit}
            onChange={(e) => onChange("limit", Number(e.target.value))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div style={{ marginTop: 8 }}>
          <button className="button btn-primary" onClick={onApplyFilters} disabled={loading}>
            {loading ? "Buscando..." : "Aplicar filtros"}
          </button>
        </div>
      </div>

      {/* Meta / Paginación */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div>
          <strong>Total:</strong> {meta.total} &nbsp;|&nbsp; <strong>Página:</strong> {meta.page} / {meta.pages}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="button btn-secondary"
            disabled={!canPrev || loading}
            onClick={() => goto(meta.page - 1)}
          >
            ◀ Anterior
          </button>
          <button
            className="button btn-secondary"
            disabled={!canNext || loading}
            onClick={() => goto(meta.page + 1)}
          >
            Siguiente ▶
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, background: "#fafafa" }}>
            <tr>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Fecha</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Usuario</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Acción</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Método</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Recurso</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Endpoint</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Status</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#777" }}>
                  Sin resultados.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const shortEndpoint = r.endpoint || "-";
              const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
              return (
                <tr key={r._id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" }}>
                    {when}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>
                    <div style={{ fontWeight: 700 }}>
                      {r.userEmail ? r.userEmail : "usuario no autenticado"}
                    </div>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.action || "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid " + (r.method ? "#f2f2f2" : "#f2f2f2") }}>
                    {r.method || "-"}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.resource || "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", maxWidth: 420 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shortEndpoint}
                    </div>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid " + (r.statusCode >= 400 ? "#ffd5d5" : "#f2f2f2") }}>
                    {r.statusCode ?? "-"}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.ip || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
