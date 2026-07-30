import React, { useMemo, useState } from "react";
import Swal from "sweetalert2";

import api from "../../utils/api";
import stylesEquipment from "./Equipment.module.css";

const TipoEquipoList = ({ tipos = [], onRefresh }) => {
    const [editingTipoId, setEditingTipoId] = useState(null);
    const [editingTipoNombre, setEditingTipoNombre] = useState("");
    const [updatingId, setUpdatingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const sortedTipos = useMemo(
        () =>
            [...(tipos || [])].sort((a, b) =>
                (a?.tipoNombre || "").localeCompare(b?.tipoNombre || "", undefined, {
                    sensitivity: "base",
                })
            ),
        [tipos]
    );

    const handleStartEdit = (tipo) => {
        setEditingTipoId(tipo?._id || null);
        setEditingTipoNombre((tipo?.tipoNombre || "").trim());
    };

    const handleCancelEdit = () => {
        setEditingTipoId(null);
        setEditingTipoNombre("");
    };

    const handleSaveEdit = async () => {
        const normalized = editingTipoNombre.trim().toLowerCase();

        if (!editingTipoId || !normalized) {
            Swal.fire({
                title: "Validación",
                icon: "warning",
                text: "El tipo de equipo no puede estar vacío.",
            });
            return;
        }

        try {
            setUpdatingId(editingTipoId);
            await api.updateTipoEquipo(editingTipoId, { tipoNombre: normalized });
            Swal.fire({
                title: "Tipo de equipo actualizado",
                icon: "success",
                html: `<p><strong>Tipo:</strong> ${normalized}</p>`,
            });
            handleCancelEdit();
            onRefresh?.();
        } catch (error) {
            Swal.fire({
                title: "Error",
                icon: "error",
                text: "No se pudo actualizar el tipo de equipo",
                footer: `${error.response?.data?.message || "Error desconocido"}`,
            });
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = async (tipo) => {
        if (!tipo?._id) return;

        const displayName = (tipo.tipoNombre || "").trim().toUpperCase();
        const result = await Swal.fire({
            title: "¿Eliminar tipo de equipo?",
            icon: "warning",
            html: `<p>Se eliminará <strong>${displayName || "(sin nombre)"}</strong>.</p>`,
            showCancelButton: true,
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
            focusCancel: true,
        });

        if (!result.isConfirmed) return;

        try {
            setDeletingId(tipo._id);
            await api.deleteTipoEquipo(tipo._id);
            Swal.fire({
                title: "Tipo de equipo eliminado",
                icon: "success",
                html: `<p><strong>Tipo:</strong> ${displayName || "(sin nombre)"}</p>`,
            });
            if (editingTipoId === tipo._id) {
                handleCancelEdit();
            }
            onRefresh?.();
        } catch (error) {
            Swal.fire({
                title: "Error",
                icon: "error",
                text: "No se pudo eliminar el tipo de equipo",
                footer: `${error.response?.data?.message || "Error desconocido"}`,
            });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <section className={stylesEquipment.type__list}>
            <div className={stylesEquipment.type__listHeader}>
                <h2 className={stylesEquipment.type__listTitle}>Tipos de equipo registrados</h2>
                <span className={stylesEquipment.type__counter}>{sortedTipos.length}</span>
            </div>

            <div className={stylesEquipment.type__tableContainer}>
                <table className={stylesEquipment.type__table} role="grid">
                    <thead>
                        <tr>
                            <th scope="col">#</th>
                            <th scope="col">Nombre</th>
                            <th scope="col" className={stylesEquipment.type__actionsHeader}>
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTipos.length === 0 ? (
                            <tr>
                                <td colSpan={3} className={stylesEquipment.type__tableEmpty}>
                                    Aún no hay tipos de equipo registrados.
                                </td>
                            </tr>
                        ) : (
                            sortedTipos.map((tipo, index) => {
                                const isEditing = editingTipoId === tipo._id;
                                const displayName = (tipo?.tipoNombre || "").trim();
                                const isSaving = updatingId === tipo._id;
                                const isDeleting = deletingId === tipo._id;

                                return (
                                    <tr key={tipo._id}>
                                        <td data-label="#">{index + 1}</td>
                                        <td data-label="Nombre">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editingTipoNombre}
                                                    onChange={(event) => setEditingTipoNombre(event.target.value)}
                                                    className={`form__group-input ${stylesEquipment.type__input}`}
                                                    placeholder="Tipo equipo"
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                            event.preventDefault();
                                                            handleSaveEdit();
                                                        }
                                                        if (event.key === "Escape") {
                                                            event.preventDefault();
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className={stylesEquipment.type__name}>
                                                    {displayName.toUpperCase() || "(SIN NOMBRE)"}
                                                </span>
                                            )}
                                        </td>
                                        <td data-label="Acciones">
                                            <div className={stylesEquipment.type__actions}>
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="button btn-primary"
                                                            onClick={handleSaveEdit}
                                                            disabled={isSaving}
                                                        >
                                                            {isSaving ? "Guardando..." : "Guardar"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button btn-secondary"
                                                            onClick={handleCancelEdit}
                                                            disabled={isSaving}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="button btn-secondary"
                                                            onClick={() => handleStartEdit(tipo)}
                                                            disabled={Boolean(updatingId) || Boolean(deletingId)}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button btn-danger"
                                                            onClick={() => handleDelete(tipo)}
                                                            disabled={isDeleting || Boolean(updatingId)}
                                                        >
                                                            {isDeleting ? "Eliminando..." : "Eliminar"}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default TipoEquipoList;
