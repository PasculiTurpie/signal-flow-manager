import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../utils/api";
import { useEffect, useRef, useState } from "react";
import Loader from "../../components/Loader/Loader";
import "../../components/Card/Card.css";
import "./SearchFilter.css";

const SearchFilter = () => {
  const [querySearch] = useSearchParams();
  const keyword = (querySearch.get("keyword") ?? "").trim();

  const [dataSearch, setDataSearch] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // Estados por imagen: loading y error por _id
  const [imageLoading, setImageLoading] = useState({});
  const [imageError, setImageError] = useState({});

  const navigate = useNavigate();

  // 👇 Contenedor para controlar el scroll interno (si aplica)
  const containerRef = useRef(null);

  // 🔝 Forzar scroll al tope cuando cambia keyword o termina la carga
  useEffect(() => {
    // Si hay contenedor con overflow, scrollea ese
    if (containerRef.current) {
      try {
        containerRef.current.scrollTo({ top: 0, behavior: "instant" });
      } catch {
        // algunos navegadores no soportan "instant"
        containerRef.current.scrollTop = 0;
      }
    }
    // Y de todas formas forzamos el scroll de la ventana
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [keyword, isLoading, noResults, hasError]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setHasError(false);
      setNoResults(false);

      try {
        const res = await api.searchChannels(keyword);
        if (cancelled) return;

        // Soporta res.data = [] o res.data.data = []
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];

        setDataSearch(list);
        setNoResults(list.length === 0);

        // Inicializa estado de carga por imagen en true
        const initialLoading = {};
        list.forEach((item) => {
          if (item?._id && item?.logoChannel) {
            initialLoading[item._id] = true;
          }
        });
        setImageLoading(initialLoading);
        setImageError({});
      } catch (error) {
        if (cancelled) return;
        console.error("Error al obtener las señales:", error);
        setHasError(true);
        setDataSearch([]);
        setNoResults(false);
        setImageLoading({});
        setImageError({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (keyword) {
      fetchData();
    } else {
      // Si no hay keyword, no se consulta y se muestra “sin resultados”
      setDataSearch([]);
      setNoResults(true);
      setHasError(false);
      setIsLoading(false);
      setImageLoading({});
      setImageError({});
    }

    return () => {
      cancelled = true;
    };
  }, [keyword]);

  const handleCardClick = (id) => {
    if (id) navigate(`/signal/${id}`);
  };

  // Handlers por imagen
  const handleImageLoad = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: false }));
  };

  const handleImageError = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: false }));
    setImageError((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="container__result" ref={containerRef}>
      {isLoading ? (
        <div className="loader__charge">
          <Loader message="Cargando y conectando con el servidor..." />
        </div>
      ) : hasError ? (
        <p className="error__data">
          Error al conectar. Comuníquese con el administrador.
        </p>
      ) : noResults ? (
        <p className="error__data">
          No se encontraron resultados para: <strong>{keyword}</strong>
        </p>
      ) : (
        <div className="card__layout card__layout--search">
          <h3 className="card__heading card__heading--search">
            <span className="card__total">{dataSearch.length}</span>
            {dataSearch.length === 1
              ? "resultado encontrado"
              : "resultados encontrados"}
          </h3>
          <p className="search__subtitle">
            Búsqueda para: <strong>{keyword}</strong>
          </p>

          <div className="card__grid">
            {dataSearch.map((signalItem) => {
              const id = signalItem?._id;
              const isImgLoading = !!imageLoading[id];
              const hasImgError = !!imageError[id];
              const hasLogo = Boolean(signalItem?.logoChannel);

              return (
                <button
                  type="button"
                  className="card__container"
                  key={id}
                  data-id={id}
                  onClick={() => handleCardClick(id)}
                  aria-label={`Abrir detalle de ${signalItem.nameChannel}`}
                >
                  <div className="card__header">
                    <h4 className="card__title" title={signalItem.nameChannel}>
                      {signalItem.nameChannel}
                    </h4>
                    <div className="card__number">
                      <span className="badge">
                        Norte: {signalItem.numberChannelCn ?? "-"}
                      </span>
                      <span className="badge">
                        Sur: {signalItem.numberChannelSur ?? "-"}
                      </span>
                    </div>
                  </div>

                  <div className="card__image-wrapper">
                    {isImgLoading && hasLogo && (
                      <div className="card__spinner" aria-hidden="true" />
                    )}

                    {hasLogo && !hasImgError ? (
                      <img
                        className="card__logo"
                        src={signalItem.logoChannel}
                        alt={`Logo de ${signalItem.nameChannel}`}
                        onLoad={() => handleImageLoad(id)}
                        onError={() => handleImageError(id)}
                        style={{ visibility: isImgLoading ? "hidden" : "visible" }}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="card__logo--placeholder" aria-hidden="true">
                        {signalItem?.nameChannel?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  <div className="card__footer">
                    <div className="tech">{signalItem.tipoTecnologia}</div>
                    <div className="sev">
                      Severidad: <strong>{signalItem.severidadChannel}</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilter;
