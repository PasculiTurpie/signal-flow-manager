import React, { useCallback, useEffect, useMemo, useState } from "react";
import Loader from "../../components/Loader/Loader";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../../utils/api";
import ModalUser from "./ModalUser";

const ListarUsers = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [itemId, setItemId] = useState("");

    // Paginación (cliente)
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const refreshList = useCallback(() => {
        setIsLoading(true);
        api
            .getUserInfo()
            .then((data) => {
                // api.getUserInfo() ya devuelve res.data (array)
                const sorted = (data || []).sort((a, b) =>
                    (a?.username || "").localeCompare(b?.username || "", "es", { sensitivity: "base" })
                );
                setUsers(sorted);
            })
            .catch((error) => {
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: `${error?.response?.data?.message || error.message}`,
                    footer: '<a href="#">Contactar a administrador</a>',
                });
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        refreshList();
    }, [refreshList]);

    const deleteUser = async (id) => {
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
                await api.deleteUserId(id);
                await refreshList();

                // Ajustar página si la actual quedó vacía
                setTimeout(() => {
                    const newTotal = Math.max(users.length - 1, 0);
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

    const handleCancel = () => setModalOpen(false);

    // --- Paginación calculada ---
    const total = users.length;
    const totalPages = Math.max(Math.ceil(total / pageSize) || 1, 1);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return users.slice(start, start + pageSize);
    }, [users, page, pageSize]);

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
                            <Link to="/registrar-user">Registrar Usuario</Link>
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

                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
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
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Correo electrónico</th>
                                    <th className="action">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: "center", color: "#777" }}>
                                            Sin datos para mostrar.
                                        </td>
                                    </tr>
                                ) : (
                                    pageItems.map((user) => (
                                        <tr key={user.id} id={user.id}>
                                            <td>{user.username}</td>
                                            <td>{user.email}</td>
                                            <td className="button-action">
                                                <button
                                                    className="btn btn-warning"
                                                    onClick={() => showModal(user.id)}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => deleteUser(user.id)}
                                                >
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
                <ModalUser
                    modalOpen={modalOpen}
                    setModalOpen={setModalOpen}
                    handleCancel={handleCancel}
                    handleOk={handleOk}
                    showModal={showModal}
                    refreshList={refreshList}
                    itemId={itemId}
                    title="Actualizar Usuario"
                />
            )}
        </>
    );
};

export default ListarUsers;
