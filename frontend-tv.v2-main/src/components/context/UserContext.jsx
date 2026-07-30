/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await api.profile();
      // Guardar TODOS los datos del usuario, incluyendo imagen
      const userData = res?.user || res || null;
      
      setUser(userData);
      setIsAuth(!!userData);
    } catch (error) {
      
      setUser(null);
      setIsAuth(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshAuth();
      if (mounted) setLoading(false);
    })();

    const onVisibility = async () => {
      if (document.visibilityState === "visible") {
        await refreshAuth();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshAuth]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        isAuth,
        setIsAuth,
        loading,
        refreshAuth,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};