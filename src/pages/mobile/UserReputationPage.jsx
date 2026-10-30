// Vista de Reputación y Calificaciones recibidas por el usuario en AnunciosSV
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Star, ShieldCheck, UserCheck, ArrowLeft, Clock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getSellerRatingStats,
  getSellerRatingsList,
  RATING_UPDATED_EVENT
} from "../../services/reputationService";

/**
 * Formatea la fecha de emisión de una calificación en formato amigable
 */
const formatRatingDate = (isoString) => {
  if (!isoString) return "Reciente";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Reciente";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 2) return "Hace un momento";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};

export const UserReputationPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Estadísticas y listado de calificaciones recibidas
  const [ratingStats, setRatingStats] = useState(() =>
    getSellerRatingStats(currentUser, currentUser?.rating || 5.0, currentUser?.reviewsCount || 0)
  );
  const [ratingsList, setRatingsList] = useState(() => getSellerRatingsList(currentUser));

  // Referencias para detección de gesto táctil de retroceso (Swipe back desde margen izquierdo)
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
    }
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
    const elapsed = Date.now() - touchStartTimeRef.current;

    // Gesto de swipe fluido hacia la derecha desde el margen izquierdo (< 120px)
    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && touchStartXRef.current < 120) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/profile", { replace: true });
      }
    }
  };

  // Asegurar que siempre inicie en la parte superior
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (_) {}
  }, []);

  // Sincronizar reactivamente si se recibe una nueva calificación en tiempo real
  useEffect(() => {
    const handleUpdate = () => {
      setRatingStats(
        getSellerRatingStats(currentUser, currentUser?.rating || 5.0, currentUser?.reviewsCount || 0)
      );
      setRatingsList(getSellerRatingsList(currentUser));
    };

    window.addEventListener(RATING_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(RATING_UPDATED_EVENT, handleUpdate);
  }, [currentUser]);

  // Si no hay usuario autenticado, redirigir a perfil
  if (!currentUser) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <h2 className="text-base font-bold text-white">Sesión requerida</h2>
        <p className="text-xs text-slate-400">
          Inicia sesión para consultar la reputación y valoraciones de tu cuenta.
        </p>
        <button
          type="button"
          onClick={() => navigate("/profile", { replace: true })}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Volver a Mi Perfil
        </button>
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-4 px-4 py-3 pb-12 animate-fade-in"
    >
      {/* 1. Tarjeta Resumen de Reputación */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white">Tu Reputación</h1>
              <p className="text-[11px] text-slate-400">
                Puntuaciones otorgadas por otros usuarios
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-black text-amber-400 flex items-center justify-end gap-1">
              <span>{ratingStats.average}</span>
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {ratingsList.length} {ratingsList.length === 1 ? "valoración" : "valoraciones"}
            </div>
          </div>
        </div>

        {/* Mensaje descriptivo */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            Cada usuario registrado puede otorgar entre 1 y 5 estrellas a tu perfil.
          </span>
        </div>
      </div>

      {/* 2. Listado de Personas que han calificado */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span>Personas que te han calificado ({ratingsList.length})</span>
          </h2>
        </div>

        {ratingsList.length > 0 ? (
          <div className="space-y-2">
            {ratingsList.map((item, idx) => (
              <div
                key={item.raterId || idx}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-sm select-none"
              >
                {/* Avatar y Nombre del calificador (Solo lectura, sin enlace al perfil) */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.raterAvatar}
                    alt={item.raterName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-slate-700 flex-shrink-0 bg-slate-950"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {item.raterName}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatRatingDate(item.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Estrellas otorgadas */}
                <div className="flex items-center gap-1 flex-shrink-0 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((starNum) => (
                      <Star
                        key={starNum}
                        className={`w-3.5 h-3.5 ${
                          starNum <= item.score
                            ? "fill-amber-400 text-amber-400"
                            : "fill-transparent text-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-amber-400 ml-1">
                    {item.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Estado Vacío cuando no se han recibido calificaciones */
          <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3 my-2 animate-fade-in">
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
              <Star className="w-7 h-7 text-amber-400/80" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Sin calificaciones aún</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Aún no has recibido valoraciones. Cuando otros usuarios registrados de AnunciosSV puntúen tus publicaciones o atención, aparecerán listadas aquí.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Botón de retorno al perfil */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/profile", { replace: true });
            }
          }}
          className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Mi Perfil</span>
        </button>
      </div>
    </div>
  );
};

export default UserReputationPage;

