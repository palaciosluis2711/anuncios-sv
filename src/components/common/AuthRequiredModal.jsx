// Diálogo modal que informa al usuario invitado que debe iniciar sesión o registrarse para realizar una acción
import React from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Heart, MessageCircle, Sparkles, Star, X } from "lucide-react";

export const AuthRequiredModal = ({
  isOpen,
  onClose,
  title,
  message,
  actionType = "action"
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToAuth = (mode = "login") => {
    onClose?.();
    navigate("/login", {
      state: {
        mode,
        from: { pathname: window.location.pathname + window.location.search }
      }
    });
  };

  // Ícono contextual según el tipo de acción
  const renderIcon = () => {
    if (actionType === "rate") {
      return (
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Star className="w-7 h-7 fill-amber-400" />
        </div>
      );
    }
    if (actionType === "promote") {
      return (
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Sparkles className="w-7 h-7 fill-amber-400/30" />
        </div>
      );
    }
    if (actionType === "like") {
      return (
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
          <Heart className="w-7 h-7 fill-rose-500/30" />
        </div>
      );
    }
    if (actionType === "message") {
      return (
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
          <MessageCircle className="w-7 h-7" />
        </div>
      );
    }
    return (
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
        <LogIn className="w-7 h-7" />
      </div>
    );
  };

  const defaultTitle =
    actionType === "rate"
      ? "¿Calificar a este vendedor?"
      : actionType === "promote"
      ? "¿Deseas destacar este anuncio?"
      : actionType === "like"
      ? "¿Guardar en tus favoritos?"
      : actionType === "message"
      ? "¿Contactar al vendedor?"
      : "Inicia sesión para continuar";

  const defaultMessage =
    actionType === "rate"
      ? "Inicia sesión o regístrate en AnunciosSV para valorar la reputación de este vendedor con estrellas."
      : actionType === "promote"
      ? "Inicia sesión o regístrate en AnunciosSV para destacar este anuncio y aumentar su visibilidad."
      : actionType === "like"
      ? "Inicia sesión para poder guardar esta publicación y consultarla cuando quieras."
      : actionType === "message"
      ? "Inicia sesión para comunicarte directamente con el vendedor y consultar tus conversaciones."
      : "Debes iniciar sesión con tu cuenta para poder realizar esta acción.";

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-enter"
    >
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl animate-scale-up text-center relative overflow-hidden">
        {/* Botón de cierre superior */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Cerrar diálogo"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ícono de la acción */}
        <div className="pt-2">{renderIcon()}</div>

        {/* Textos descriptivos */}
        <div className="space-y-1.5 px-2">
          <h3 className="text-base font-bold text-white">
            {title || defaultTitle}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {message || defaultMessage}
          </p>
        </div>

        {/* Botones de decisión: Iniciar Sesión y Registrarse */}
        <div className="space-y-2.5 pt-2">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleGoToAuth("login")}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar Sesión</span>
            </button>
            <button
              type="button"
              onClick={() => handleGoToAuth("register")}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-bold text-xs border border-indigo-500/30 transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Registrarse</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[34px] py-1 px-4 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthRequiredModal;
