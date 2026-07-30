import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./DetailCard.css";
import api from "../../utils/api";
import ModalContact from "./ModalContact";
import Swal from "sweetalert2";
import "animate.css";

const DetailCard = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [signalDetail, setSignalDetail] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [flowDetail, setFlowDetail] = useState(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Cargar detalle de señal
  useEffect(() => {
    let ignore = false;
    const fetchSignal = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await api.getIdSignal(id);
        if (!ignore) {
          setSignalDetail(res.data || null);
          setContacts(res.data?.contact || []);
        }
      } catch (err) {
        console.error("No se pudo cargar el detalle de la señal", err);
        if (!ignore) setError("No se pudo cargar el detalle de la señal.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };
    if (id) fetchSignal();
    return () => {
      ignore = true;
    };
  }, [id]);

  // ✅ Verifica si existe un diagrama (nodos o edges)
  const verifyFlow = async () => {
    try {
      const res = await api.getChannelDiagramBySignal(id);

      const diagram = Array.isArray(res)
        ? res[0]
        : res?.diagram || res || {};

      const nodes = diagram?.nodes || [];
      const edges = diagram?.edges || [];

      setFlowDetail({ nodes, edges });
      setNodeCount(Array.isArray(nodes) ? nodes.length : 0);
    } catch (err) {
      console.error("Error obteniendo el diagrama:", err);
      setFlowDetail(null);
      setNodeCount(0);
    }
  };

  // Llama a verifyFlow al cargar el detalle
  useEffect(() => {
    if (id) verifyFlow();
  }, [id]);

  // Ir al diagrama
  const handleClickDiagram = async () => {
    if (!id) {
      Swal.fire({
        title: "Señal no disponible",
        text: "No se pudo determinar el identificador de la señal.",
        icon: "error",
      });
      return;
    }

    try {
      const res = await api.getChannelDiagramBySignal(id);
      const payload = res;

      const asArray = Array.isArray(payload) ? payload : payload ? [payload] : [];

      const foundChannel = asArray.find((item) => {
        const signal = item?.signal;
        if (!signal) return false;

        if (typeof signal === "string") {
          return String(signal) === String(id);
        }
        const signalId = signal?._id || signal?.id;
        return signalId ? String(signalId) === String(id) : false;
      });

      if (foundChannel?._id) {
        navigate(`/channels/${foundChannel._id}`);
        return;
      }

      Swal.fire({
        title: "No existe flujo para este canal",
        text: "Aún no hay un diagrama asociado a esta señal.",
        icon: "info",
        showClass: {
          popup: `
            animate__animated
            animate__fadeInUp
            animate__faster
          `,
        },
        hideClass: {
          popup: `
            animate__animated
            animate__fadeOutDown
            animate__faster
          `,
        },
      });
    } catch (err) {
      console.error("Error obteniendo el diagrama:", err);
      Swal.fire({
        title: "Error",
        text: "No se pudo obtener el diagrama asociado.",
        icon: "error",
      });
    }
  };

  const handleBackSubmit = () => navigate(-1);

  if (isLoading) {
    return (
      <div className="container__card-detail">
        <div className="card-detail-container">Cargando…</div>
      </div>
    );
  }

  if (error || !signalDetail) {
    return (
      <div className="container__card-detail">
        <div className="card-detail-container">
          <button className="button-back btn-warning" onClick={handleBackSubmit}>
            ← Volver
          </button>
          <p className="error">{error || "No se encontró la señal."}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container__card-detail">
        <div className="card-detail-container">
          <button className="button-back btn-warning" onClick={handleBackSubmit}>
            ← Volver
          </button>

          <div className="card-detail-header">
            {signalDetail.logoChannel ? (
              <img
                className="card__detail-logo"
                src={signalDetail.logoChannel}
                alt={`Logo ${signalDetail.nameChannel || "Canal"}`}
              />
            ) : (
              <div className="card__detail-logo placeholder">Sin logo</div>
            )}
            <h3 className="card-detail-title">{signalDetail.nameChannel}</h3>
          </div>

          <div className="card__detail-numbers">
            <span>
              <strong>Norte:</strong>{" "}
              <span className="card__detail-info">{signalDetail.numberChannelCn}</span>
            </span>
            <span>
              <strong>Sur:</strong>{" "}
              <span className="card__detail-info">{signalDetail.numberChannelSur}</span>
            </span>
          </div>

          <div className="card__detail-numbers">
            <span>
              <strong>Tecnología:</strong>{" "}
              <span className="card__detail-info">{signalDetail.tipoTecnologia}</span>
            </span>
            <span>
              <strong>Severidad:</strong>{" "}
              <span className="card__detail-info">{signalDetail.severidadChannel}</span>
            </span>
          </div>

          {/* ✅ Botones */}
          <div className="card__detail-button">
            {Array.isArray(signalDetail.contact) && signalDetail.contact.length > 0 && (
              <button className="button btn-success" onClick={openModal}>
                Contacto
              </button>
            )}

            <button
              onClick={nodeCount > 0 ? handleClickDiagram : undefined}
              className={`button ${nodeCount > 0 ? "btn-primary" : "btn-disabled"}`}
              disabled={nodeCount === 0}
              title={
                nodeCount > 0
                  ? `Abrir diagrama (${nodeCount} nodos)`
                  : "Sin datos de diagrama disponibles"
              }
            >
              Diagrama
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Contacto */}
      <ModalContact isOpen={isModalOpen} onClose={closeModal}>
        <>
          <h1 className="modal-contact__title">Contacto proveedor</h1>
          <table className="modal-contact__table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact, idx) => (
                <tr key={contact?._id || idx} className="modal-contact__row">
                  <td>{contact?.nombreContact || "-"}</td>
                  <td>{contact?.telefono || "-"}</td>
                  <td>{contact?.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      </ModalContact>
    </>
  );
};

export default DetailCard;
