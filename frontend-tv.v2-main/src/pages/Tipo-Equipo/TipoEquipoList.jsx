// src/pages/TipoEquipo/TipoEquipoList.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";

import Loader from "../../components/Loader/Loader";
import api from "../../utils/api";
import stylesEquipment from "../Equipment/Equipment.module.css";
import ModalTipoEquipo from "./ModalTipoEquipo";

const TipoEquipoList = () => {
  const [tipos, setTipos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemId, setItemId] = useState("");

  const refreshList = useCallback(() => {
    setIsLoading(true);

    api
      .getTipoEquipo()
      .then((data) => {
        // ✅ Si backend devuelve array directo => data
        // ✅ Si backend devuelve { data: [...] } => data.data
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];

        setTipos(list);
      })
      .catch((error) => {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text:
            error?.response?.data?.message ||
            "No se pudo obtener la lista de tipos de equipo",
          footer: '<a href="#">Contactar a administrador</a>',
        });
        setTipos([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const sortedTipos = useMemo(() => {
    return [...(tipos || [])].sort((a, b) => {
      const nameA = (a?.tipoNombre || "").toLowerCase();
      const nameB = (b?.tipoNombre || "").toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  }, [tipos]);

  const showModal = (id) => {
    setItemId(id || "");
    setIsModalOpen(true);
  };

  const handleOk = () => {
    setIsModalOpen(false);
    setItemId("");

    Swal.fire({
      position: "center",
      icon: "success",
      title: "Registro actualizado",
      showConfirmButton: false,
      timer: 1500,
    });

    // ✅ opcional: refrescar lista al cerrar con OK
    refreshList();
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setItemId("");
  };

  const deleteTipoEquipo = async (id) => {
    if (!id) return;

    const result = await Swal.fire({
      title: "¿Estás seguro de eliminar el registro?",
      text: "¡No podrás revertir esto!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await api.deleteTipoEquipo(id);

      await Swal.fire({
        title: "¡Eliminado!",
        text: "El registro ha sido eliminado",
        icon: "success",
      });

      refreshList();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error?.response?.data?.message ||
          "Hubo un problema al eliminar el registro. Inténtalo nuevamente más tarde.",
      });
    }
  };

  return (
    <div className="outlet-main">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/register-type-equitment">Registrar</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Lista
          </li>
        </ol>
      </nav>

      <section className={stylesEquipment.tipo__section}>
        <div className={stylesEquipment.type__listHeader}>
          <h2 className={stylesEquipment.type__listTitle}>
            Tipos de equipo registrados
          </h2>
          <span className={stylesEquipment.type__counter}>
            {sortedTipos.length}
          </span>
        </div>

        {isLoading ? (
          <div className="loader__spinner">
            <Loader />
          </div>
        ) : (
          <div className={stylesEquipment.type__tableContainer}>
            <table className={stylesEquipment.type__table} role="grid">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th
                    scope="col"
                    className={stylesEquipment.type__actionsHeader}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedTipos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className={stylesEquipment.type__tableEmpty}
                    >
                      Aún no hay tipos de equipo registrados.
                    </td>
                  </tr>
                ) : (
                  sortedTipos.map((tipo, index) => {
                    const tipoId = tipo?._id || tipo?.id;
                    const nombre = (tipo?.tipoNombre || "").toUpperCase();

                    return (
                      <tr key={tipoId || index}>
                        <td data-label="Nombre">
                          <span className={stylesEquipment.type__name}>
                            {nombre || "(SIN NOMBRE)"}
                          </span>
                        </td>

                        <td data-label="Acciones">
                          <div className={stylesEquipment.type__actions}>
                            <button
                              type="button"
                              className="btn btn-warning"
                              onClick={() => showModal(tipoId)}
                              disabled={!tipoId}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => deleteTipoEquipo(tipoId)}
                              disabled={!tipoId}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isModalOpen && (
        <ModalTipoEquipo
          isModalOpen={isModalOpen}
          handleOk={handleOk}
          handleCancel={handleCancel}
          itemId={itemId}
          refreshList={refreshList}
        />
      )}
    </div>
  );
};

export default TipoEquipoList;
