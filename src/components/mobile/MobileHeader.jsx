// Encabezado superior adaptativo para la experiencia móvil
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, Bell, Shield, ArrowLeft, Share2, MessageCircle, Sparkles, Star, Edit3 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getTotalUnreadCount, CHAT_EVENT } from "../../services/chatService";
import { getUnreadNotificationsCount, NOTIFICATION_EVENT } from "../../services/notificationService";
import { shareContent } from "../../services/shareService";

export const MobileHeader = () => {
  const { isAdmin, currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [unreadMessagesCount, setUnreadMessagesCount] = useState(() => getTotalUnreadCount(currentUser));
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(() => getUnreadNotificationsCount(currentUser));

  // Control de visibilidad del header al desplazarse en el feed principal
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  const pathname = location.pathname;
  const isHome = pathname === "/";
  const isLoginPage = pathname === "/login";
  const isPublishPage = pathname === "/publish";
  const isProductDetailPage = pathname.startsWith("/product/");
  const isSellerProfilePage = pathname.startsWith("/seller/");
  const isManageProductPage = pathname.startsWith("/manage-product/");
  const isMessagesPage = pathname === "/messages";
  const isChatDetailPage = pathname.startsWith("/messages/");
  const isBlockedUsersPage = pathname === "/blocked-users";
  const isPromoteAdPage = pathname.startsWith("/promote-ad/");
  const isPagaditoSandboxPage = pathname.startsWith("/pagadito-sandbox/");
  const isPaymentReturnPage = pathname.startsWith("/payment-return");
  const isReputationPage = pathname === "/profile/reputation";
  const isNotificationsPage = pathname === "/notifications";
  const isEditProfilePage = pathname === "/profile/edit";

  // Suscripción al contador global de mensajes y notificaciones no leídos
  useEffect(() => {
    setUnreadMessagesCount(getTotalUnreadCount(currentUser));
    setUnreadNotificationsCount(getUnreadNotificationsCount(currentUser));

    const handleChatUpdate = () => {
      setUnreadMessagesCount(getTotalUnreadCount(currentUser));
    };

    const handleNotifUpdate = () => {
      setUnreadNotificationsCount(getUnreadNotificationsCount(currentUser));
    };

    window.addEventListener(CHAT_EVENT, handleChatUpdate);
    window.addEventListener(NOTIFICATION_EVENT, handleNotifUpdate);

    return () => {
      window.removeEventListener(CHAT_EVENT, handleChatUpdate);
      window.removeEventListener(NOTIFICATION_EVENT, handleNotifUpdate);
    };
  }, [currentUser]);

  // Función segura para retornar atrás con el MISMO comportamiento que el gesto táctil nativo del celular
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  // Función para compartir publicación
  const handleShare = () => {
    const title = document.title || "AnunciosSV";
    shareContent({
      title: title,
      text: `Mira este anuncio en AnunciosSV: ${title}`,
      url: window.location.href
    });
  };

  // Ocultar cabecera al desplazarse hacia abajo en el feed principal
  useEffect(() => {
    if (!isHome) {
      setShowHeader(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;

      // Al estar en el tope (primeros 25px), siempre visible
      if (currentScrollY <= 25) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        // Desplazamiento hacia abajo: ocultar suavemente
        setShowHeader(false);
      } else if (currentScrollY < lastScrollY.current) {
        // Desplazamiento hacia arriba: reaparecer suavemente
        setShowHeader(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // 1. En registro, login, Centro de Control, Bandeja, Chat individual, Usuarios Bloqueados, Pagadito Sandbox o Retorno de Pago: NO se muestra el header global
  if (isLoginPage || isManageProductPage || isMessagesPage || isChatDetailPage || isBlockedUsersPage || isPagaditoSandboxPage || isPaymentReturnPage) {
    return null;
  }

  // 2. En Publicar Anuncio: Header adaptativo para el Paso 1 (Publicar Anuncio) y Paso 2 (Promocionar publicación)
  if (isPublishPage) {
    const searchParams = new URLSearchParams(location.search);
    const isPromoteStep = searchParams.get("step") === "promote";

    const handlePublishBack = () => {
      // Notificar a PublishPage para que controle el retorno unificado tanto en Paso 2 como en Paso 1
      window.dispatchEvent(new CustomEvent("anunciossv_publish_back_requested"));
    };

    return (
      <header className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800/90 px-4 py-2.5 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          {/* Izquierda: Botón de retorno */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePublishBack}
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm flex-shrink-0"
              aria-label="Regresar"
              title="Regresar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Centro: Título dinámico (Promocionar publicación vs Publicar Anuncio) */}
          <h1 className="text-sm font-extrabold text-white tracking-tight truncate text-center">
            {isPromoteStep ? "Promocionar publicación" : "Publicar Anuncio"}
          </h1>

          {/* Derecha: Espaciador para centrar el título */}
          <div className="w-10 flex-shrink-0" />
        </div>
      </header>
    );
  }

  // 3. En detalle de publicación o perfil del vendedor: flecha de regresar fija con z-50
  if (isProductDetailPage || isSellerProfilePage) {
    const pageTitle = isSellerProfilePage ? "Perfil del Vendedor" : "Detalle del Anuncio";

    return (
      <header className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800/90 px-4 py-2.5 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm"
            aria-label="Regresar"
            title="Regresar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold text-white tracking-tight">{pageTitle}</span>

          {isSellerProfilePage ? (
            <div className="w-10 flex-shrink-0" />
          ) : (
            <button
              type="button"
              onClick={handleShare}
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm"
              aria-label="Compartir"
              title="Compartir"
            >
              <Share2 className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </header>
    );
  }

  // 4. En Destacar Anuncio, Reputación del Usuario, Notificaciones o Editar Perfil: cabecera fija con botón de retorno y título
  if (isPromoteAdPage || isReputationPage || isNotificationsPage || isEditProfilePage) {
    return (
      <header
        className={`sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/90 px-4 py-2.5 shadow-md ${
          isNotificationsPage ? "animate-header-enter" : ""
        }`}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm"
            aria-label="Regresar"
            title="Regresar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            {isNotificationsPage ? (
              <>
                <Bell className="w-4 h-4 text-pink-400" />
                <span>Notificaciones</span>
              </>
            ) : isReputationPage ? (
              <>
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Reputación</span>
              </>
            ) : isEditProfilePage ? (
              <>
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Editar Perfil</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Destacar anuncio</span>
              </>
            )}
          </span>

          <div className="w-10 flex-shrink-0" />
        </div>
      </header>
    );
  }

  // 5. Header general (Feed de inicio con auto-ocultamiento al desplazarse, Explorar y Perfil con z-50)
  return (
    <header
      className={`sticky top-0 z-50 bg-slate-950 border-b border-slate-800/90 px-4 py-3 shadow-md transition-all duration-300 ease-out ${
        isHome && !showHeader ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logotipo y Marca AnunciosSV */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5 text-white stroke-[2.2]" />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight text-white flex items-center gap-1">
              Anuncios<span className="text-gradient">SV</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Clasificados El Salvador</div>
          </div>
        </Link>

        {/* Acciones del encabezado */}
        <div className="flex items-center gap-2">
          {/* Badge de acceso rápido si el usuario es Webmaster */}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-[11px] font-bold text-purple-300 hover:bg-purple-500/25 transition-all"
              title="Ir al panel de control Webmaster"
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>Admin</span>
            </Link>
          )}

          {/* Botón de Mensajes directos con contador reactivo */}
          <Link
            to="/messages"
            state={{ fromBottomNav: false }}
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("anunciossv_messages_from_footer");
              }
            }}
            aria-label="Mensajes"
            title="Bandeja de mensajes"
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-slate-950 animate-fade-in shadow-sm">
                {unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}
              </span>
            )}
          </Link>

          {/* Notificaciones */}
          <Link
            to="/notifications"
            aria-label="Notificaciones"
            title="Bandeja de notificaciones"
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-slate-950 animate-fade-in shadow-sm">
                {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
