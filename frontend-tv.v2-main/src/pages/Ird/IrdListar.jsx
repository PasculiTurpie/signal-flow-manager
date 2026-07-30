// pages/Ird/IrdListar.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../../components/Loader/Loader";
import api from "../../utils/api";
import Swal from "sweetalert2";
import ModalIrd from "./ModalIrd";
import "../../components/styles/tables.css";

const IrdListar = () => {
  const [ird, setIrd] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [itemId, setItemId] = useState("");

  // Paginación (cliente)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 🔎 Buscador
  const [query, setQuery] = useState("");

  const refreshList = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getIrd(); // tu api.getIrd devuelve AxiosResponse
      const list = res?.data || [];   // aquí lo manejamos seguro

      const sorted = [...list].sort((a, b) =>
        (a?.nombreIrd || "").localeCompare(b?.nombreIrd || "", "es", {
          sensitivity: "base",
        })
      );

      setIrd(sorted);
    } catch (error) {
      console.error("getIrd error:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: error?.response?.data?.message || error.message || "Error al cargar IRDs",
        footer: '<a href="#">Contactar a administrador</a>',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const deleteEncoderIrd = async (id) => {
    const result = await Swal.fire({
      title: "¿Estás seguro de eliminar el registro?",
      text: "¡No podrás revertir esto!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
    });

    if (!result.isConfirmed) return;

    try {
      const resp = await api.deleteIrd(id); // devuelve AxiosResponse (según tu api.js)
      // si backend envía {message}, resp.data.message existirá
      await refreshList();

      // Ajustar página correctamente (sin usar ird.length stale)
      setPage((prev) => {
        // recalcula basado en el nuevo listado (ya actualizado por refreshList)
        // como setIrd es async, hacemos una aproximación segura:
        // si estás en página >1, baja 1 si la página queda vacía.
        return Math.max(prev, 1);
      });

      await Swal.fire({
        title: "¡Eliminado!",
        text: resp?.data?.message || "El registro ha sido eliminado",
        icon: "success",
      });
    } catch (error) {
      console.error("deleteIrd error:", error);
      Swal.fire({
        title: "Error",
        icon: "error",
        text: error?.response?.data?.message || "Hubo un problema al eliminar el registro",
        footer: `Status: ${error?.response?.status ?? "?"}`,
      });
    }
  };

  const showModal = (id) => {
    setItemId(id);
    setModalOpen(true);
  };

  const handleOk = () => {
    setModalOpen(false);
    Swal.fire({
      position: "center",
      icon: "success",
      title: "Registro actualizado",
      showConfirmButton: false,
      timer: 1500,
    });
    refreshList();
  };

  const handleCancel = () => setModalOpen(false);

  // Utilidad para normalizar (case/acentos-insensitive)
  const normalize = (v = "") =>
    String(v).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  // Filtro por query (antes de paginar)
  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return ird;

    return ird.filter((x) => {
      const nombre = normalize(x?.nombreIrd);
      const marca = normalize(x?.marcaIrd);
      const multicast = normalize(x?.multicastReceptor);
      const ip = normalize(x?.ipAdminIrd);
      return (
        nombre.includes(q) ||
        marca.includes(q) ||
        multicast.includes(q) ||
        ip.includes(q)
      );
    });
  }, [ird, query]);

  const total = filtered.length;
  const totalPages = Math.max(Math.ceil(total / pageSize) || 1, 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const goTo = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const renderPager = () => {
    const maxButtons = 7;
    const nodes = [];
    const add = (n) =>
      nodes.push(
        <button
          key={n}
          className={`button btn-secondary ${n === page ? "active" : ""}`}
          onClick={() => goTo(n)}
          disabled={n === page}
          style={{ minWidth: 40 }}
        >
          {n}
        </button>
      );

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) add(i);
    } else {
      const windowSize = 3;
      const start = Math.max(2, page - windowSize);
      const end = Math.min(totalPages - 1, page + windowSize);

      add(1);
      if (start > 2) nodes.push(<span key="l-ellipsis">…</span>);
      for (let i = start; i <= end; i++) add(i);
      if (end < totalPages - 1) nodes.push(<span key="r-ellipsis">…</span>);
      add(totalPages);
    }

    return nodes;
  };

  return (
    <>
      <div className="outlet-main">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/ird">Formulario</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Listar
            </li>
          </ol>
        </nav>

        {/* Barra superior */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <p style={{ margin: 0 }}>
            <span className="total-list">Total items: </span>
            {total}
            {total > 0 && (
              <span style={{ marginLeft: 8, color: "#666" }}>
                (Mostrando {rangeStart}–{rangeEnd})
              </span>
            )}
          </p>

          {/* 🔎 Buscador */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="form__group-input"
              type="text"
              placeholder="Buscar por nombre, marca, multicast o IP…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minWidth: 260 }}
            />
            {query && (
              <button
                className="button btn-secondary"
                onClick={() => setQuery("")}
                title="Limpiar búsqueda"
              >
                Limpiar
              </button>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Tamaño de página:
              <select
                className="form__input"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <div className="loader__spinner">
            <Loader />
          </div>
        ) : (
          <>
            <table className="table list__table">
              <thead>
                <tr style={{ textAlign: "center" }}>
                  <th>Nombre Ird</th>
                  <th>Marca Ird</th>
                  <th>Multicast salida</th>
                  <th>Ip de gestión</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#777" }}>
                      {query ? "Sin coincidencias para la búsqueda." : "Sin datos para mostrar."}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((x) => (
                    <tr key={x._id} id={x._id}>
                      <td>{x.nombreIrd}</td>
                      <td>{x.marcaIrd}</td>
                      <td>{x.multicastReceptor}</td>
                      <td>
                        {/* ✅ NO uses Link para URL externa */}
                        <a href={`http://${x.ipAdminIrd}`} target="_blank" rel="noreferrer">
                          {x.ipAdminIrd}
                        </a>
                      </td>
                      <td className="action">
                        <button className="btn btn-warning" onClick={() => showModal(x._id)}>
                          Editar
                        </button>
                        <button className="btn btn-danger" onClick={() => deleteEncoderIrd(x._id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Paginador */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button className="button btn-secondary" onClick={() => goTo(page - 1)} disabled={page <= 1}>
                ◀ Anterior
              </button>
              {renderPager()}
              <button className="button btn-secondary" onClick={() => goTo(page + 1)} disabled={page >= totalPages}>
                Siguiente ▶
              </button>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <ModalIrd
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          handleCancel={handleCancel}
          handleOk={handleOk}
          showModal={showModal}
          refreshList={refreshList}
          itemId={itemId}
          title="Actualizar Ird"
        />
      )}
    </>
  );
};

export default IrdListar;
