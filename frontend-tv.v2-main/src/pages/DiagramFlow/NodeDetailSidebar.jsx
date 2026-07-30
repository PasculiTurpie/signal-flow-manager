import PropTypes from "prop-types";

const getStatusClassName = (message) => {
  if (!message || typeof message !== "object") return "diagram-sidebar__status";
  if (message.type === "error") {
    return "diagram-sidebar__status diagram-sidebar__status--error";
  }
  if (message.type === "warning") {
    return "diagram-sidebar__status diagram-sidebar__status--warning";
  }
  if (message.type === "loading") {
    return "diagram-sidebar__status diagram-sidebar__status--loading";
  }
  return "diagram-sidebar__status";
};

const ipRegex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const hasHttpProtocol = (value) => /^https?:\/\//i.test(value);

const shouldRenderAsLink = (label, value) => {
  if (typeof value !== "string") return false;

  const trimmedValue = value.trim();
  if (!trimmedValue) return false;

  const labelText = typeof label === "string" ? label : "";
  const labelMentionsIp = /\bip\b/i.test(labelText);
  const isIpAddress = ipRegex.test(trimmedValue);
  const isUrl = hasHttpProtocol(trimmedValue) && labelMentionsIp;

  return isIpAddress || isUrl;
};

const buildLink = (value) => {
  const trimmedValue = value.trim();
  const href = hasHttpProtocol(trimmedValue) ? trimmedValue : `http://${trimmedValue}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="diagram-sidebar__link"
    >
      {trimmedValue}
    </a>
  );
};

const renderDetailValue = (item) => {
  if (!item) return "—";

  const { label, value } = item;

  if (value == null || value === "") {
    return "—";
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return "—";
    }

    if (shouldRenderAsLink(label, trimmedValue)) {
      return buildLink(trimmedValue);
    }

    return trimmedValue;
  }

  return value;
};

const NodeDetailSidebar = ({ isOpen, detail, loading, message, onClose }) => {
  const safeMessage = message && typeof message === "object" ? message : null;
  const detailTitle = detail?.title ?? "Equipo";
  const detailItems = Array.isArray(detail?.details) ? detail.details : [];

  return (
    <aside
      className={`diagram-sidebar${isOpen ? " is-open" : ""}`}
      aria-label="Detalle del equipo seleccionado"
    >
      {isOpen ? (
        <div className="diagram-sidebar__content">
          <div className="diagram-sidebar__header">
            <h2 className="diagram-sidebar__title">{detailTitle}</h2>
            <button
              type="button"
              className="diagram-sidebar__close"
              onClick={onClose}
              aria-label="Cerrar panel de detalles"
            >
              ×
            </button>
          </div>

          {loading ? (
            <p className="diagram-sidebar__status diagram-sidebar__status--loading">
              Cargando información...
            </p>
          ) : null}

          {safeMessage?.text ? (
            <p className={getStatusClassName(safeMessage)}>{safeMessage.text}</p>
          ) : null}

          {detail?.image ? (
            <div className="diagram-sidebar__image">
              <img src={detail.image} alt={`Imagen del equipo ${detailTitle}`} />
            </div>
          ) : null}

          {detailItems.length ? (
            <dl className="diagram-sidebar__list">
              {detailItems.map((item, index) => (
                <div
                  key={`${item?.label ?? "detalle"}-${index}`}
                  className="diagram-sidebar__list-item"
                >
                  <dt>{item?.label}</dt>
                  <dd>{renderDetailValue(item)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="diagram-sidebar__empty-section">
              No hay parámetros adicionales para este equipo.
            </p>
          )}
        </div>
      ) : (
        <div className="diagram-sidebar__empty">
          <h2>Panel de parámetros</h2>
          <p>Selecciona un equipo del diagrama para ver sus detalles.</p>
        </div>
      )}
    </aside>
  );
};

NodeDetailSidebar.propTypes = {
  isOpen: PropTypes.bool,
  detail: PropTypes.shape({
    title: PropTypes.string,
    image: PropTypes.string,
    details: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string,
        value: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.number,
          PropTypes.bool,
          PropTypes.node,
        ]),
      })
    ),
  }),
  loading: PropTypes.bool,
  message: PropTypes.shape({
    type: PropTypes.string,
    text: PropTypes.string,
  }),
  onClose: PropTypes.func,
};

NodeDetailSidebar.defaultProps = {
  isOpen: false,
  detail: null,
  loading: false,
  message: null,
  onClose: () => {},
};

export default NodeDetailSidebar;
