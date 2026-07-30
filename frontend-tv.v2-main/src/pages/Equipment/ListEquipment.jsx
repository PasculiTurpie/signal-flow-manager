import { Form, Formik } from "formik";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import Swal from "sweetalert2";
import api from "../../utils/api";
import Loader from "../../components/Loader/Loader";
import ModalEquipment from "./ModalEquipment";
import "../../components/styles/tables.css";
import "../../components/styles/forms.css";

const ListEquipment = () => {
    const [equipos, setEquipos] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [itemId, setItemId] = useState("");

    // --- Paginación (cliente) ---
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const processedEquipos = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = term
            ? equipos.filter((equipo) => {
                  const valuesToSearch = [
                      equipo.nombre,
                      equipo.marca,
                      equipo.modelo,
                      equipo.ip_gestion,
                      equipo?.tipoNombre?.tipoNombre || equipo?.tipoNombre,
                  ];

                  return valuesToSearch.some((value) =>
                      String(value || "").toLowerCase().includes(term)
                  );
              })
            : equipos;

        return [...filtered].sort((a, b) => {
            const typeA = String(
                a?.tipoNombre?.tipoNombre || a?.tipoNombre || ""
            ).toLowerCase();
            const typeB = String(
                b?.tipoNombre?.tipoNombre || b?.tipoNombre || ""
            ).toLowerCase();

            return typeA.localeCompare(typeB);
        });
    }, [equipos, searchTerm]);

    const total = processedEquipos.length;
    const totalPages = Math.max(Math.ceil(total / pageSize) || 1, 1);

    // Asegura que page siempre esté dentro de rango cuando cambian lista/tamaño
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    // Items actuales de la página
    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return processedEquipos.slice(start, start + pageSize);
    }, [processedEquipos, page, pageSize]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    // Rango mostrado (1-indexed)
    const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeEnd = Math.min(page * pageSize, total);

    const refreshList = useCallback(() => {
        setIsLoading(true);
        api
            .getEquipo()
            .then((res) => {
                setEquipos(res.data || []);
            })
            .catch((error) => {
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: `${error.message}`,
                    footer: '<a href="#">Contactar a administrador</a>',
                });
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        refreshList();
    }, [refreshList]);

    const deleteEquipment = async (id) => {
        const result = await Swal.fire({
            title: "¿Estás seguro de eliminar el registro?",
            text: "¡No podrás revertir esto!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, eliminar",
        });

        if (result.isConfirmed) {
            try {
                await api.deleteEquipo(id);
                // Refresca y corrige la página si queda vacía
                await refreshList();
                // Si al borrar quedaste en una página sin elementos, retrocede una
                setTimeout(() => {
                    const newTotalPages = Math.max(
                        Math.ceil((total - 1) / pageSize) || 1,
                        1
                    );
                    if (page > newTotalPages) setPage(newTotalPages);
                }, 0);

                await Swal.fire({
                    title: "¡Eliminado!",
                    text: "El registro ha sido eliminado",
                    icon: "success",
                });
            } catch (error) {
                console.error("Error al eliminar:", error);
                Swal.fire({
                    title: "Error",
                    text: "Hubo un problema al eliminar el registro",
                    icon: "error",
                });
            }
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

    const handleCancel = () => {
        setModalOpen(false);
    };

    const goTo = (p) => {
        if (p < 1 || p > totalPages) return;
        setPage(p);
    };

    // Render de botones de páginas (simple, hasta 7 botones max con ellipsis)
    const renderPager = () => {
        const maxButtons = 7;
        const pages = [];
        const add = (n) =>
            pages.push(
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
            const windowSize = 3; // botones alrededor de la actual
            const start = Math.max(2, page - windowSize);
            const end = Math.min(totalPages - 1, page + windowSize);

            add(1);
            if (start > 2) pages.push(<span key="l-ellipsis">…</span>);
            for (let i = start; i <= end; i++) add(i);
            if (end < totalPages - 1) pages.push(<span key="r-ellipsis">…</span>);
            add(totalPages);
        }

        return pages;
    };

    return (
        <>
            <div className="outlet-main">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <Link to="/equipment">Formulario</Link>
                        </li>
                        <li className="breadcrumb-item active" aria-current="page">
                            Listar
                        </li>
                    </ol>
                </nav>

                {/* Barra superior: total, rango, page size */}
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

                    <div
                        style={{
                            marginLeft: "auto",
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        <div className="form__group" style={{ minWidth: 220, margin: 0 }}>
                            <label htmlFor="equipment-search" className="form__group-label">
                                Buscar
                            </label>
                            <input
                                id="equipment-search"
                                type="text"
                                placeholder="Buscar..."
                                className="form__group-input"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                            />
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            Tamaño de página:
                            <select
                                className="form__input"
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1); // reset a primera página
                                }}
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
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Marca</th>
                                    <th>Modelo</th>
                                    <th>Tipo</th>
                                    <th>Ip Gestión</th>
                                    <th className="action">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: "center", color: "#777" }}>
                                            Sin datos para mostrar.
                                        </td>
                                    </tr>
                                ) : (
                                    pageItems.map((equipo) => (
                                        <tr key={equipo._id} id={equipo._id}>
                                            <td>{equipo.nombre?.toUpperCase?.() || equipo.nombre}</td>
                                            <td>{equipo.marca?.toUpperCase?.() || equipo.marca}</td>
                                            <td>{equipo.modelo?.toUpperCase?.() || equipo.modelo}</td>
                                            <td>
                                                {equipo.tipoNombre?.tipoNombre
                                                    ? equipo.tipoNombre.tipoNombre.toUpperCase()
                                                    : "Sin tipo"}
                                            </td>
                                            <td>{equipo.ip_gestion || "-"}</td>
                                            <td
                                                className="button-action"
                                                style={{
                                                    display: "flex",
                                                    flexWrap: "nowrap",
                                                    gap: 8,
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <button
                                                    className="btn btn-warning"
                                                    onClick={() => showModal(equipo._id)}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => deleteEquipment(equipo._id)}
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Controles de paginación */}
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
                            <button
                                className="button btn-secondary"
                                onClick={() => goTo(page - 1)}
                                disabled={page <= 1}
                            >
                                ◀ Anterior
                            </button>

                            {renderPager()}

                            <button
                                className="button btn-secondary"
                                onClick={() => goTo(page + 1)}
                                disabled={page >= totalPages}
                            >
                                Siguiente ▶
                            </button>
                        </div>
                    </>
                )}
            </div>

            {modalOpen && (
                <ModalEquipment
                    modalOpen={modalOpen}
                    setModalOpen={setModalOpen}
                    handleCancel={handleCancel}
                    handleOk={handleOk}
                    showModal={showModal}
                    refreshList={refreshList}
                    itemId={itemId}
                    title="Actualizar Equipo"
                />
            )}
        </>
    );
};

export default ListEquipment;