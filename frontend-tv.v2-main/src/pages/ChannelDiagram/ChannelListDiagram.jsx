import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../../utils/api";

import { clearLocalStorage } from "../../utils/localStorageUtils";

const PAGE_SIZE = 10;

const ChannelListDiagram = () => {
  const [channels, setChannels] = useState([]);
  const [filteredChannels, setFilteredChannels] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  const fetchChannels = async () => {
    try {
      const res = await api.listChannelDiagrams();
      const data = Array.isArray(res?.data) ? res.data : [];
      const combined = [...data];
      setChannels(combined);
      setFilteredChannels(combined);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error al cargar los canales", error);
      if (samples.length) {
        setChannels(samples);
        setFilteredChannels(samples);
        setCurrentPage(1);
        Swal.fire(
          "Modo demostración",
          "No se pudieron cargar los canales desde el servidor. Mostrando diagramas de ejemplo.",
          "info"
        );
      } else {
        Swal.fire("Error", "No se pudieron cargar los canales", "error");
      }
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreateNewChannel = useCallback(() => {
    const cleaned = clearLocalStorage();
    if (cleaned) {
      console.info("localStorage limpiado antes de crear un nuevo canal");
    }
    navigate("/channels/new");
  }, [navigate]);

  useEffect(() => {
    if (!filterText.trim()) {
      setFilteredChannels(channels);
      setCurrentPage(1);
      return;
    }
    const lower = filterText.toLowerCase();
    const filtered = channels.filter((ch) =>
      ch.signal?.nameChannel?.toLowerCase().includes(lower)
    );
    setFilteredChannels(filtered);
    setCurrentPage(1);
  }, [filterText, channels]);

  const handleDelete = (channel) => {
    if (!channel || channel.isSample) {
      Swal.fire(
        "Contenido de ejemplo",
        "Los diagramas de ejemplo no se pueden eliminar.",
        "info"
      );
      return;
    }

    const { _id: id } = channel || {};
    if (!id) {
      Swal.fire(
        "Canal no disponible",
        "No se pudo determinar el canal a eliminar.",
        "warning"
      );
      return;
    }

    Swal.fire({
      title: "¿Estás seguro?",
      text: "No podrás revertir esta acción",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        api
          .deleteChannelDiagram(id)
          .then(() => {
            Swal.fire("Eliminado!", "El canal fue eliminado.", "success");
            fetchChannels();
          })
          .catch((error) => {
            const message =
              error?.response?.data?.error ||
              error?.response?.data?.message ||
              error?.message ||
              "No se pudo eliminar el canal";
            Swal.fire("Error", message, "error");
          });
      }
    });
  };

  // Ir a visualizar el diagrama (visor)
  const handleView = (channel) => {
    // Si es un canal real con _id, vamos a /channels/:id/view
    if (channel?._id) {
      navigate(`/channels/${String(channel._id)}`);
      return;
    }
    // Si es demo (sin _id), enviamos el objeto por state al visor genérico
    navigate("/channels/view", { state: { channel } });
  };

  // Ir a editar el diagrama por ID del canal
  const handleEdit = (channel) => {
    if (channel?.isSample) {
      Swal.fire(
        "Diagrama de ejemplo",
        "Los diagramas de demostración no pueden editarse.",
        "info"
      );
      return;
    }

    const channelId = channel?._id;

    if (!channelId) {
      Swal.fire(
        "Canal no disponible",
        "No se encontró el identificador del canal para abrir el diagrama.",
        "warning"
      );
      return;
    }

    navigate(`/channels/${String(channelId)}/edit`);
  };

  const totalPages = Math.ceil(filteredChannels.length / PAGE_SIZE);
  const pagedChannels = filteredChannels.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="outlet-main" style={{ width: '100%', margin: "0 auto" }}>
      <h2>Lista de Channels</h2>
      <button
        className="button btn-primary"
        onClick={handleCreateNewChannel}
        style={{ marginBottom: "1rem" }}
      >
        + Crear nuevo Channel
      </button>

      <input
      className="form__group-input"
        type="text"
        placeholder="Filtrar por nombre de canal..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        style={{
          width: "100%",
          padding: "8px",
          marginBottom: "1rem",
          fontSize: "1rem",
          boxSizing: "border-box",
        }}
      />

      {channels.some((ch) => ch.isSample) && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "12px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e3a8a",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          Los canales marcados como <strong>Demo</strong> son diagramas de ejemplo
          listos para inspeccionar el flujo sin necesidad de backend.
        </div>
      )}

      <table
        className="table"
        style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #444" }}>
            <th>Nombre Canal</th>
            <th>Tecnología</th>
            <th>Nodos</th>
            <th>Enlaces</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pagedChannels.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "1rem" }}>
                No hay canales disponibles
              </td>
            </tr>
          ) : (
            pagedChannels.map((channel) => (
              <tr key={channel._id || channel.signal?.nameChannel} style={{ borderBottom: "1px solid #ccc" }}>
                <td>
                  {channel.signal?.nameChannel || "Sin nombre"}
                  {channel.isSample ? (
                    <span
                      style={{
                        marginLeft: "0.35rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#2563eb",
                        textTransform: "uppercase",
                      }}
                    >
                      Demo
                    </span>
                  ) : null}
                </td>
                <td>{channel.signal?.tipoTecnologia || "-"}</td>
                <td>{channel.nodes?.length || 0}</td>
                <td>{channel.edges?.length || 0}</td>
                <td>
                  {/* Nuevo botón verde: Ver diagrama */}
                  <button
                    className="button btn-success"
                    onClick={() => handleView(channel)}
                    style={{ marginRight: "0.5rem" }}
                    title="Visualizar diagrama"
                  >
                    Ver
                  </button>

                  <button
                    className="button btn-warning"
                    onClick={() => handleEdit(channel)}
                    style={{ marginRight: "0.5rem" }}
                  >
                    Editar
                  </button>
                  <button
                    className="button btn-danger"
                    onClick={() => handleDelete(channel)}
                    disabled={channel.isSample}
                    title={
                      channel.isSample
                        ? "Los diagramas de ejemplo no se pueden eliminar"
                        : undefined
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

      {totalPages > 1 && (
        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="button btn-primary"
          >
            &lt; Anterior
          </button>
          <span style={{ alignSelf: "center" }}>
            Página {currentPage} de {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="button btn-primary"
          >
            Siguiente &gt;
          </button>
        </div>
      )}
    </div>
  );
};

export default ChannelListDiagram;
