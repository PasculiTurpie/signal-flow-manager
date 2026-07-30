import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../utils/api";

const LOADING_MESSAGE = "Verificando sesión...";
const EXPIRED_MESSAGE = "Sesión expirada, redirigiendo...";

export default function ProtectedRoute() {
  const [ok, setOk] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const checkAuth = async () => {
      try {
        await api.profile({ signal: controller.signal });
        if (mounted) {
          setOk(true);
          setError(null);
        }
      } catch (err) {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
          return;
        }
        if (mounted) {
          setOk(false);
          const payloadError = err?.response?.data?.error;
          setError(payloadError || "No autorizado");
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  if (ok === null) {
    return <div style={{ padding: 16 }}>{LOADING_MESSAGE}</div>;
  }

  if (error && String(error).includes("token_expired")) {
    return <div style={{ padding: 16 }}>{EXPIRED_MESSAGE}</div>;
  }

  return ok ? <Outlet /> : <Navigate to="/auth/login" replace />;
}