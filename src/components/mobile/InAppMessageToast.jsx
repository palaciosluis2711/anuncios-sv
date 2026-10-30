// Banner / Notificación flotante superior in-app para mensajes entrantes
// Aparece en Feed, Mi Perfil y demás pantallas EXCEPTO Nueva Publicación y Mensajería
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  INCOMING_MESSAGE_EVENT,
  getUserCandidateKeys
} from "../../services/chatService";

export const InAppMessageToast = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [toastData, setToastData] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef(null);
  const removeTimeoutRef = useRef(null);

  // Pantallas estrictamente excluidas de la notificación:
  // "en este caso será dentro de Feed, Mi Perfil, y las demás excepto Nueva Publicacion y Mensajeria."
  const isExcluded =
    location.pathname === "/publish" ||
    location.pathname.startsWith("/messages");

  // Ocultar de inmediato si el usuario entra a una pantalla excluida
  useEffect(() => {
    if (isExcluded && isVisible) {
      setIsVisible(false);
      clearTimeout(hideTimeoutRef.current);
      clearTimeout(removeTimeoutRef.current);
      setToastData(null);
    }
  }, [location.pathname, isExcluded, isVisible]);

  // Suscripción al evento de mensaje entrante (alimentado por el stream global de MobileLayout)
  useEffect(() => {
    const handleIncomingMessage = (event) => {
      const detail = event.detail;
      if (!detail) return;

      // Si la pantalla actual está excluida, no mostrar
      const currentPath = window.location.pathname;
      if (currentPath === "/publish" || currentPath.startsWith("/messages")) {
        return;
      }

      // Si el mensaje fue enviado por el propio usuario actual, no auto-notificar
      const candidates = getUserCandidateKeys(currentUser).map((k) => k.toLowerCase());
      const senderKey = String(detail.senderId || "").trim().toLowerCase().replace(/^@/, "");
      if (candidates.includes(senderKey)) {
        return;
      }

      // Si el evento especifica un destinatario, verificar que coincida con el usuario actual
      if (detail.targetUserId) {
        const targetKey = String(detail.targetUserId).trim().toLowerCase().replace(/^@/, "");
        if (!candidates.includes(targetKey)) {
          return;
        }
      }

      // Limpiar temporizadores previos si ya había una notificación en curso
      clearTimeout(hideTimeoutRef.current);
      clearTimeout(removeTimeoutRef.current);

      setToastData({
        conversationId: detail.conversationId,
        senderName: detail.senderName || "Usuario",
        senderAvatar: detail.senderAvatar || "",
        text: detail.text || "Nuevo mensaje recibido"
      });

      // Animación suave de entrada
      setTimeout(() => {
        setIsVisible(true);
      }, 50);

      // Desaparición suave tras 4.5 segundos
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        removeTimeoutRef.current = setTimeout(() => {
          setToastData(null);
        }, 350);
      }, 4500);
    };

    window.addEventListener(INCOMING_MESSAGE_EVENT, handleIncomingMessage);
    return () => {
      window.removeEventListener(INCOMING_MESSAGE_EVENT, handleIncomingMessage);
      clearTimeout(hideTimeoutRef.current);
      clearTimeout(removeTimeoutRef.current);
    };
  }, [currentUser]);

  // Descartar manualmente con la X
  const handleDismiss = () => {
    clearTimeout(hideTimeoutRef.current);
    clearTimeout(removeTimeoutRef.current);
    setIsVisible(false);
    removeTimeoutRef.current = setTimeout(() => {
      setToastData(null);
    }, 350);
  };

  // Al pulsar sobre la notificación:
  // "si se pulsa la notificacion, se llevará al usuario a ese chat"
  const handleClick = () => {
    if (!toastData?.conversationId) return;

    // Guardar la pantalla exacta donde se encontraba el usuario antes de pulsar la notificación
    const currentOrigin = location.pathname + location.search;

    if (typeof window !== "undefined") {
      sessionStorage.setItem("anunciossv_toast_return_origin", currentOrigin);
      // Limpiar la marca de navegación por footer para que la flecha de retorno esté activa
      sessionStorage.removeItem("anunciossv_messages_from_footer");
    }

    // Ocultar el toast inmediatamente
    clearTimeout(hideTimeoutRef.current);
    clearTimeout(removeTimeoutRef.current);
    setIsVisible(false);
    setToastData(null);

    // Navegar al chat pasando el estado de origen
    navigate(`/messages/${toastData.conversationId}`, {
      state: {
        fromNotificationToast: true,
        originPath: currentOrigin
      }
    });
  };

  if (!toastData || isExcluded) return null;

  return (
    <div
      className={`fixed top-3 left-4 right-4 z-[999] max-w-md mx-auto transition-all duration-300 ease-out transform ${
        isVisible
          ? "translate-y-0 opacity-100 scale-100"
          : "-translate-y-10 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 hover:border-indigo-500/60 shadow-[0_16px_40px_rgba(0,0,0,0.6)] rounded-2xl p-3 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98] transition-transform text-left ring-1 ring-white/10"
      >
        {/* Avatar del usuario con indicador de chat */}
        <div className="relative flex-shrink-0">
          {toastData.senderAvatar ? (
            <img
              src={toastData.senderAvatar}
              alt={toastData.senderName}
              className="w-10 h-10 rounded-full object-cover border border-indigo-500/40 ring-2 ring-indigo-500/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-pink-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {toastData.senderName?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-pink-500 border-2 border-slate-900 rounded-full flex items-center justify-center shadow-sm">
            <MessageCircle className="w-2.5 h-2.5 text-white stroke-[2.4]" />
          </span>
        </div>

        {/* Contenido textual solicitado: 'X usuario te ha enviado un mensaje.' */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-white tracking-tight truncate">
              {toastData.senderName}
            </span>
            <span className="text-[11px] font-normal text-slate-300">
              te ha enviado un mensaje.
            </span>
          </div>
          {toastData.text && (
            <p className="text-[11px] text-indigo-300 truncate mt-0.5 font-medium">
              "{toastData.text}"
            </p>
          )}
        </div>

        {/* Botón de cierre para descartar suavemente */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            aria-label="Cerrar notificación"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InAppMessageToast;
