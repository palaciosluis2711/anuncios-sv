// Componente de restauración de scroll automático al cambiar de ruta
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Forzar inmediatamente la posición en la parte superior sin desplazamiento residual
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant"
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};

export default ScrollToTop;
