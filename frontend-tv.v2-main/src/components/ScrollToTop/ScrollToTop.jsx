import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 150,
      behavior: "smooth" // ✅ Scroll animado
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
