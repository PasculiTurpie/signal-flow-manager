import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import Swal from "sweetalert2";
import Loader from "../../components/Loader/Loader";
import ModalContacto from "./ModalContacto";
import "../../components/styles/tables.css";

const ContactoList = () => {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [itemId, setItemId] = useState("");

    // 🔍 BUSCADOR
    const [searchTerm, setSearchTerm] = useState("");

    // Paginación (cliente)
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const refreshList = useCallback(() => {
        setIsLoading(true);
        api.getContact()
            .then((res) => {
                const list = res.data || [];
                const sorted = list.sort((a, b) =>
                    (a?.nombreContact || "").localeCompare(
                        b?.nombreContact || "",
                        "es",
                        { sensitivity: "base" }
                    )
                );
                setContacts(sorted);
            })
            .catch((error) => {
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: `${error.response?.data?.message || error.message}`,
                    footer: '<a href="#">Contactar a administrador</a>',
                });
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        refreshList();
    }, [refreshList]);

    const deleteContact = async (id) => {
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
                await api.deleteContact(id);
                await refreshList();

                // Ajuste de página si quedó vacía
                setTimeout(() => {
                    const newTotal = Math.max(contacts.length - 1, 0);
                    const newTotalPages = Math.max(
                        Math.ceil(newTotal / pageSize) || 1,
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

    const handleCancel = () => setModalOpen(false);

    // 🔍 BUSCADOR: contactos filtrados por nombre, email o teléfono
    const filteredContacts = useMemo(() => {
        if (!searchTerm.trim()) return contacts;

        const term = searchTerm.toLowerCase();
        return contacts.filter((c) => {
            const nombre = (c.nombreContact || "").toLowerCase();
            const email = (c.email || "").toLowerCase();
            const telefono = (c.telefono || "").toLowerCase();
            return (
                nombre.includes(term) ||
                email.includes(term) ||
                telefono.includes(term)
            );
        });
    }, [contacts, searchTerm]);

    // --- Paginación calculada (sobre la lista filtrada) ---
    const total = filteredContacts.length;
    const totalPages = Math.max(Math.ceil(total / pageSize) || 1, 1);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredContacts.slice(start, start + pageSize);
    }, [filteredContacts, page, pageSize]);

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
                    className={`button btn-secondary ${
                        n === page ? "active" : ""
                    }`}
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
            if (end < totalPages - 1)
                nodes.push(<span key="r-ellipsis">…</span>);
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
                            <Link to="/contact">Formulario</Link>
                        </li>
                        <li
                            className="breadcrumb-item active"
                            aria-current="page"
                        >
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

                    {/* 🔍 BUSCADOR */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <input
                            type="text"
                            className="form__input"
                            placeholder="Buscar por nombre, email o teléfono..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                            style={{
                                border: "2px solid #cbd5e1", // gris suave
                                borderRadius: "6px",
                                padding: "6px 10px",
                                outline: "none",
                                transition: "0.2s",
                            }}
                            onFocus={(e) =>
                                (e.target.style.borderColor = "#3b82f6")
                            } // azul suave
                            onBlur={(e) =>
                                (e.target.style.borderColor = "#cbd5e1")
                            }
                        />
                    </div>

                    <div
                        style={{ marginLeft: "auto", display: "flex", gap: 8 }}
                    >
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
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
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Teléfono</th>
                                    <th className="action">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            style={{
                                                textAlign: "center",
                                                color: "#777",
                                            }}
                                        >
                                            Sin datos para mostrar.
                                        </td>
                                    </tr>
                                ) : (
                                    pageItems.map((contact) => (
                                        <tr key={contact._id} id={contact._id}>
                                            <td className="text__align">
                                                {contact.nombreContact?.toUpperCase()}
                                            </td>
                                            <td className="text__align">
                                                {contact.email}
                                            </td>
                                            <td>{contact.telefono}</td>
                                            <td className="button-action">
                                                <button
                                                    className="btn btn-warning"
                                                    onClick={() =>
                                                        showModal(contact._id)
                                                    }
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() =>
                                                        deleteContact(
                                                            contact._id
                                                        )
                                                    }
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
                <ModalContacto
                    modalOpen={modalOpen}
                    setModalOpen={setModalOpen}
                    handleCancel={handleCancel}
                    handleOk={handleOk}
                    showModal={showModal}
                    refreshList={refreshList}
                    itemId={itemId}
                    title="Actualizar"
                />
            )}
        </>
    );
};

export default ContactoList;
