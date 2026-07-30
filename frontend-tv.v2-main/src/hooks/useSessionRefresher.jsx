// src/hooks/useSessionRefresher.jsx
import { useEffect, useRef } from "react";
import Swal from "sweetalert2";
import api from "../utils/api";
import { getCookie } from "../utils/cookies";

const WARN_SECONDS = 60;         // mostrar modal cuando falten <= 60s
const AUTO_REFRESH_SECONDS = 30; // auto-refresh cuando falten <= 30s

export default function useSessionRefresher() {
  const warnTimer = useRef(null);
  const refreshTimer = useRef(null);
  const countdownInterval = useRef(null);

  const clearAll = () => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  const scheduleFromCookie = () => {
    clearAll();
    const atExpStr = getCookie("at_exp");
    if (!atExpStr) return;

    const expMs = parseInt(atExpStr, 10) * 1000;
    if (!Number.isFinite(expMs)) return;

    const msToExp = expMs - Date.now();
    if (msToExp <= 0) return;

    // Modal 60s antes (o ahora si ya quedan <=60)
    const warnAt = msToExp - WARN_SECONDS * 1000;
    if (warnAt > 0) warnTimer.current = setTimeout(showWarningModal, warnAt);
    else showWarningModal();

    // Auto-refresh 30s antes (o ahora si ya quedan <=30)
    const autoAt = msToExp - AUTO_REFRESH_SECONDS * 1000;
    if (autoAt > 0) refreshTimer.current = setTimeout(autoRefresh, autoAt);
    else autoRefresh();
  };

  const showWarningModal = () => {
    const atExpStr = getCookie("at_exp");
    if (!atExpStr) return;
    const expMs = parseInt(atExpStr, 10) * 1000;

    Swal.fire({
      title: "Tu sesión está por expirar",
      html: '<b id="countdown">60</b> segundos restantes',
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Renovar ahora",
      cancelButtonText: "Cerrar sesión",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const el = Swal.getHtmlContainer().querySelector("#countdown");
        const tick = () => {
          const remain = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
          if (el) el.textContent = String(remain);
          if (remain <= 0) {
            clearInterval(countdownInterval.current);
            Swal.close();
          }
        };
        tick();
        countdownInterval.current = setInterval(tick, 1000);
      },
    }).then(async (result) => {
      clearInterval(countdownInterval.current);
      if (result.isConfirmed) {
        await manualRefresh();
      } else if (result.isDismissed) {
        await api.logout();
        Swal.fire({ icon: "success", title: "Usuario deslogueado", timer: 1200, showConfirmButton: false });
        window.location.href = "/auth/login";
      }
    });
  };

  const manualRefresh = async () => {
    try {
      await api._axios.post("/auth/refresh");
      Swal.fire({ icon: "success", title: "Sesión renovada", timer: 1200, showConfirmButton: false });
      scheduleFromCookie();
    } catch {
      Swal.fire({ icon: "error", title: "No se pudo renovar", text: "Vuelve a iniciar sesión" });
      await api.logout();
      window.location.href = "/auth/login";
    }
  };

  const autoRefresh = async () => {
    try {
      await api._axios.post("/auth/refresh");
      scheduleFromCookie();
    } catch {
      Swal.fire({ icon: "error", title: "Sesión expirada", text: "Por favor inicia sesión nuevamente" });
      await api.logout();
      window.location.href = "/auth/login";
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") scheduleFromCookie();
  };

  // ▶️ Nuevo: reprogramar después de login/refresh
  const onAuthLogin = () => scheduleFromCookie();
  const onAuthRefreshed = () => scheduleFromCookie();

  useEffect(() => {
    scheduleFromCookie();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("auth:login", onAuthLogin);
    window.addEventListener("auth:refreshed", onAuthRefreshed);
    return () => {
      clearAll();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("auth:login", onAuthLogin);
      window.removeEventListener("auth:refreshed", onAuthRefreshed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
