import { useEffect, useState } from 'react';
import './ConnectionBanner.css';

/**
 * Banner que muestra el estado de conexión
 * @param {{ isOnline: boolean, wasOffline: boolean, queueSize: number }} props
 */
export function ConnectionBanner({ isOnline, wasOffline, queueSize = 0 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
    } else if (wasOffline) {
      setShow(true);
      // Ocultar después de 3 segundos si volvió la conexión
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [isOnline, wasOffline]);

  if (!show) return null;

  return (
    <div className={`connection-banner ${isOnline ? 'online' : 'offline'}`}>
      <div className="connection-banner-content">
        {!isOnline ? (
          <>
            <svg
              className="connection-banner-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
              />
            </svg>
            <span className="connection-banner-text">
              Sin conexión - Los cambios se guardarán cuando vuelva la conexión
              {queueSize > 0 && ` (${queueSize} operaciones pendientes)`}
            </span>
          </>
        ) : (
          <>
            <svg
              className="connection-banner-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="connection-banner-text">
              Conexión restaurada
              {queueSize > 0 && ` - Guardando ${queueSize} cambios pendientes...`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
