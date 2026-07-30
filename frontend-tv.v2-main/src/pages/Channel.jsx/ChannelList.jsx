import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import ModalChannel from "./ModalChannel";
import Loader from "../../components/Loader/Loader";
import Swal from "sweetalert2";
import "../../components/styles/tables.css";

const ChannelList = () => {
    const [channels, setChannels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [itemId, setItemId] = useState("");

    // Buscador
    const [searchTerm, setSearchTerm] = useState("");

    // Paginación (cliente)
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const refreshList = useCallback(() => {
        setIsLoading(true);
        api
            .getSignal()
            .then((res) => {
                const sorted = (res.data || []).sort((a, b) =>
                    (a.nameChannel || "").localeCompare(b.nameChannel || "", "es", {
                        sensitivity: "base",
                    })
                );
                setChannels(sorted);
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

    // Volver a la primera página al buscar
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    // Filtrar por nombre o número
    const filteredChannels = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        if (!term) return channels;

        return channels.filter((channel) => {
            const name = (channel.nameChannel || "").toLowerCase();
            const numberNorth = String(channel.numberChannelCn || "").toLowerCase();
            const numberSouth = String(channel.numberChannelSur || "").toLowerCase();

            return (
                name.includes(term) ||
                numberNorth.includes(term) ||
                numberSouth.includes(term)
            );
        });
    }, [channels, searchTerm]);

    // Datos paginados
    const total = filteredChannels.length;
    const totalPages = Math.max(Math.ceil(total / pageSize) || 1, 1);

    // Mantener page en rango si cambia lista o tamaño
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredChannels.slice(start, start + pageSize);
    }, [filteredChannels, page, pageSize]);

    const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeEnd = Math.min(page * pageSize, total);

    const deleteChannel = async (id) => {
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
                await api.deleteSignal(id);
                await refreshList();

                setTimeout(() => {
                    const newTotal = Math.max(total - 1, 0);
                    const newTotalPages = Math.max(Math.ceil(newTotal / pageSize) || 1, 1);
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

    // Paginador con elipsis
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
            const windowSize = 3;
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
                            <Link to="/channel">Formulario</Link>
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

                    <div
                        style={{
                            marginLeft: "auto",
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="text"
                            className="form__input"
                            placeholder="Buscar por nombre o número..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ minWidth: 260 }}
                        />

                        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            Tamaño de página:
                            <select
                                className="form__input"
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
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
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Nombre canal</th>
                                        <th>Número canal Norte</th>
                                        <th>Número canal Sur</th>
                                        <th>Tipo de tecnología</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: "center", color: "#777" }}>
                                                Sin datos para mostrar.
                                            </td>
                                        </tr>
                                    ) : (
                                        pageItems.map((channel) => (
                                            <tr key={channel._id} id={channel._id}>
                                                <td className="text__align">{channel.nameChannel}</td>
                                                <td>{channel.numberChannelCn}</td>
                                                <td>{channel.numberChannelSur}</td>
                                                <td>{channel.tipoTecnologia?.toUpperCase()}</td>
                                                <td>
                                                    <div className="button-action">
                                                        <button
                                                            className="btn btn-warning"
                                                            onClick={() => showModal(channel._id)}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            className="btn btn-danger"
                                                            onClick={() => deleteChannel(channel._id)}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

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
                <ModalChannel
                    modalOpen={modalOpen}
                    setModalOpen={setModalOpen}
                    handleCancel={handleCancel}
                    handleOk={handleOk}
                    showModal={showModal}
                    refreshList={refreshList}
                    itemId={itemId}
                    title="Actualizar Señal"
                />
            )}
        </>
    );
};

export default ChannelList;