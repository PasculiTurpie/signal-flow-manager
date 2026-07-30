// src/pages/Signal/Card.jsx
import React, {
    useEffect,
    useMemo,
    useState,
    useCallback,
} from "react";
import "./Card.css";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import Loader from "../../components/Loader/Loader";

const CARDS_PER_PAGE = 12;

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const Card = () => {
    const navigate = useNavigate();

    const [signalTv, setSignalTv] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Obtener señales desde la API
    const fetchSignals = useCallback(async (abortSignal) => {
        setIsLoading(true);
        setHasError(false);
        try {
            const res = await api.getSignal({ signal: abortSignal });
            const raw = Array.isArray(res?.data) ? res.data : [];

            if (raw.length === 0) {
                setSignalTv([]);
                setHasError(true);
                return;
            }

            const normalized = raw.map((s) => ({
                ...s,
                numberChannelSur: toNum(s?.numberChannelSur),
                numberChannelCn: toNum(s?.numberChannelCn),
            }));

            const sorted = [...normalized].sort((a, b) => {
                const an = a.numberChannelSur ?? Number.POSITIVE_INFINITY;
                const bn = b.numberChannelSur ?? Number.POSITIVE_INFINITY;
                return an - bn;
            });

            setSignalTv(sorted);
        } catch (err) {
            if (err?.name !== "AbortError") {
                console.error("Error al obtener las señales:", err);
                setHasError(true);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchSignals(controller.signal);
        return () => controller.abort();
    }, [fetchSignals]);

    const totalCards = signalTv.length;
    const totalPages = Math.max(1, Math.ceil(totalCards / CARDS_PER_PAGE));

    const currentCards = useMemo(() => {
        const last = currentPage * CARDS_PER_PAGE;
        const first = last - CARDS_PER_PAGE;
        return signalTv.slice(first, last);
    }, [signalTv, currentPage]);

    const paginate = (n) =>
        setCurrentPage(Math.min(Math.max(n, 1), totalPages));
    const nextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
    const prevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));

    const { tipoTv, tipoRadio } = useMemo(() => {
        let tv = 0,
            radio = 0;
        for (const s of signalTv) {
            if (s.tipoServicio === "TV") tv++;
            else if (s.tipoServicio === "Radio") radio++;
        }
        return { tipoTv: tv, tipoRadio: radio };
    }, [signalTv]);

    const handleCardClick = (id) => navigate(`/signal/${id}`);

    return (
        <>
            {isLoading ? (
                <div className="loader__charge">
                    <Loader message="Cargando y conectando con el servidor..." />
                </div>
            ) : hasError ? (
                <p className="error__data">
                    No se encuentran datos. Comuníquese con el administrador.
                </p>
            ) : (
                <div className="card__layout">
                    <h3 className="card__heading">
                        <span className="card__total">{totalCards}</span>{" "}
                        señales en total
                        <span className="pill pill--tv">TV: {tipoTv}</span>
                        <span className="pill pill--radio">
                            Radios: {tipoRadio}
                        </span>
                    </h3>

                    <div className="card__grid">
                        {currentCards.map((item) => {
                            const id = item._id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    className="card__container"
                                    data-id={id}
                                    onClick={() => handleCardClick(id)}
                                    aria-label={`Abrir detalle de ${item.nameChannel}`}
                                >
                                    <div className="card__header">
                                        <h4
                                            className="card__title"
                                            title={item.nameChannel}
                                        >
                                            {item.nameChannel}
                                        </h4>
                                        <div className="card__number">
                                            <span className="badge">
                                                Norte:{" "}
                                                {item.numberChannelCn ?? "-"}
                                            </span>
                                            <span className="badge">
                                                Sur:{" "}
                                                {item.numberChannelSur ?? "-"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="card__image-wrapper">
                                        {item.logoChannel ? (
                                            <img
                                                className="card__logo"
                                                src={item.logoChannel}
                                                alt={`Logo de ${item.nameChannel}`}
                                                loading="lazy"
                                                decoding="async"
                                                onError={(e) =>
                                                    (e.currentTarget.style.display =
                                                        "none")
                                                }
                                            />
                                        ) : (
                                            <div
                                                className="card__logo--placeholder"
                                                aria-hidden="true"
                                            >
                                                {item?.nameChannel?.[0]?.toUpperCase() ||
                                                    "?"}
                                            </div>
                                        )}
                                    </div>

                                    <div className="card__footer">
                                        <div className="tech">
                                            {item.tipoTecnologia}
                                        </div>
                                        <div className="sev">
                                            Severidad:{" "}
                                            <strong>
                                                {item.severidadChannel}
                                            </strong>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div
                        className="pagination"
                        role="navigation"
                        aria-label="Paginación"
                    >
                        <button onClick={prevPage} disabled={currentPage === 1}>
                            « Anterior
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .slice(
                                Math.max(0, currentPage - 3),
                                currentPage + 2
                            )
                            .map((page) => (
                                <button
                                    key={page}
                                    className={
                                        page === currentPage ? "active" : ""
                                    }
                                    onClick={() => paginate(page)}
                                    aria-current={
                                        page === currentPage
                                            ? "page"
                                            : undefined
                                    }
                                >
                                    {page}
                                </button>
                            ))}
                        <button
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente »
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Card;
