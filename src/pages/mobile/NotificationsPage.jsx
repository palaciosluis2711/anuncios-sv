// Vista principal de la sección de Notificaciones de AnunciosSV
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Bell,
  Sparkles,
  Star,
  MessageCircle,
  CheckCheck,
  Trash2,
  ChevronRight,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getUserNotifications,
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  formatNotificationTime,
  NOTIFICATION_EVENT
} from "../../services/notificationService";

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [notifications, setNotifications] = useState(() => getUserNotifications(currentUser));
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Referencias para detección del gesto táctil de retroceso (Swipe back desde margen izquierdo)
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

    // Gesto de swipe fluido hacia la derecha desde el margen izquierdo
    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && touchStartXRef.current < 120) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/", { replace: true });
      }
    }
  };

  // Desplazar al tope al montar
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (_) {}
  }, []);

  // Suscripción reactiva a cambios de notificaciones en tiempo real
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const unsubscribe = subscribeToUserNotifications(currentUser, (updated) => {
      setNotifications(updated || []);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Manejo de clic en una notificación
  const handleNotificationClick = (item) => {
    if (!item.read) {
      markNotificationAsRead(item.id, currentUser);
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  // Manejo para marcar todas como leídas
  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(currentUser);
  };

  // Manejo para vaciar todas las notificaciones
  const handleClearAll = () => {
    clearAllNotifications(currentUser);
    setShowClearConfirm(false);
  };

  // Icono y colores representativos según el tipo de notificación
  const renderNotificationIcon = (type) => {
    switch (type) {
      case "promotion":
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 fill-amber-400/20 text-amber-400" />
          </div>
        );
      case "rating":
        return (
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
          </div>
        );
      case "message":
        return (
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-sm">
            <MessageCircle className="w-5 h-5 text-indigo-400" />
          </div>
        );
      case "success":
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        );
      case "warning":
        return (
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>
        );
      case "system":
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Bell className="w-5 h-5 text-pink-400" />
          </div>
        );
    }
  };

  // En caso de no haber ninguna notificación (o usuario invitado sin notificaciones)
  // Solo se muestra el mensaje exacto solicitado: "Sin notificaciones por el momento"
  if (!currentUser || notifications.length === 0) {
    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="px-4 py-8 max-w-md mx-auto min-h-[calc(100dvh-8rem)] flex flex-col items-center justify-center text-center animate-page-enter"
      >
        <p className="text-sm font-medium text-slate-400">
          Sin notificaciones por el momento
        </p>
      </div>
    );
  }

  // 3. Estado con listado de notificaciones disponibles
  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-3.5 px-4 py-3 pb-16 max-w-md mx-auto animate-page-enter"
    >
      {/* Barra de estado y acciones rápidas */}
      <div className="flex items-center justify-between px-1 pt-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">
            {notifications.length} {notifications.length === 1 ? "notificación" : "notificaciones"}
          </span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black shadow-sm">
              {unreadCount} {unreadCount === 1 ? "nueva" : "nuevas"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
              title="Marcar todas como leídas"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar leídas</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            title="Limpiar todas las notificaciones"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Diálogo de confirmación para vaciar la bandeja */}
      {showClearConfirm && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2.5 animate-scale-up">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>¿Vaciar todas las notificaciones?</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Se eliminarán de tu bandeja. Esta acción no se puede deshacer.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white shadow-sm"
            >
              Sí, vaciar
            </button>
          </div>
        </div>
      )}

      {/* Listado de tarjetas de notificación */}
      <div className="space-y-2.5">
        {notifications.map((item) => {
          const isUnread = !item.read;

          return (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              role="button"
              tabIndex={0}
              className={`group relative p-3.5 rounded-2xl border transition-all text-left flex items-start gap-3 select-none ${
                isUnread
                  ? "bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/30 border-indigo-500/30 shadow-md ring-1 ring-indigo-500/20"
                  : "bg-slate-900/80 border-slate-800/90 hover:border-slate-700"
              } ${item.link ? "cursor-pointer active:scale-[0.99]" : "cursor-default"}`}
            >
              {/* Icono del tipo de notificación */}
              {renderNotificationIcon(item.type)}

              {/* Contenido textual */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3
                    className={`text-xs font-bold leading-tight ${
                      isUnread ? "text-white" : "text-slate-200"
                    }`}
                  >
                    {item.title}
                  </h3>
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 ring-2 ring-slate-950 inline-block shadow-sm" />
                  )}
                </div>

                {item.message && (
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    {item.message}
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-2 font-medium">
                  <Clock className="w-3 h-3" />
                  <span>{formatNotificationTime(item.createdAt)}</span>
                </div>
              </div>

              {/* Botón individual de borrado */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(item.id, currentUser);
                }}
                title="Eliminar notificación"
                className="absolute top-3 right-3 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Indicador de navegación si tiene enlace */}
              {item.link && (
                <div className="absolute bottom-3 right-3 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationsPage;

