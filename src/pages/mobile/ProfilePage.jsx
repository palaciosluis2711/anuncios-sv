// Perfil del usuario y centro de control de sus publicaciones
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  User,
  Package,
  Clock,
  LogOut,
  Sparkles,
  ExternalLink,
  Edit3,
  Trash2,
  CheckCircle2,
  LogIn,
  PlusCircle,
  AlertTriangle,
  ChevronRight,
  SlidersHorizontal,
  MessageCircle,
  Ban,
  Star
} from "lucide-react";
import {
  getStoredProducts,
  getUserProducts,
  isProductOwner,
  formatProductPrice,
  deleteProduct,
  DAILY_PUBLICATION_LIMIT,
  canUserPublishToday
} from "../../services/productsService";
import {
  getTotalUnreadCount,
  getBlockedUsers,
  unblockUser,
  CHAT_EVENT
} from "../../services/chatService";
import {
  getSellerRatingStats,
  subscribeToSellerRatings,
  RATING_UPDATED_EVENT
} from "../../services/reputationService";

// Calcula y formatea el tiempo restante de una promoción destacada
const getRemainingPromotionText = (prod) => {
  if (!prod?.featured) return null;
  const now = Date.now();
  let expiresAt = prod.featuredExpiresAt;
  if (!expiresAt) {
    const start = prod.featuredTimestamp || (prod.promotedAt ? new Date(prod.promotedAt).getTime() : now);
    const days = Number(prod.promotedDays || prod.featuredDays || 7);
    expiresAt = start + days * 24 * 60 * 60 * 1000;
  }

  const diffMs = expiresAt - now;
  if (diffMs <= 0) {
    return "Promoción por renovar";
  }

  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h restantes`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m restantes`;
  }
  return `${mins}m restantes`;
};

export const ProfilePage = () => {
  const {
    currentUser,
    isAdmin,
    logout,
    switchDemoRole
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Inicializar pestaña activa respetando parámetro URL (?tab=...) o estado de navegación
  const rawInitialTab = searchParams.get("tab") || location.state?.tab || "posts";
  const targetInitialTab = rawInitialTab === "saved" ? "featured" : rawInitialTab;
  const [activeTab, setActiveTab] = useState(targetInitialTab);

  // Sincronizar reactivamente si cambia el query param o state
  useEffect(() => {
    const tabParam = searchParams.get("tab") || location.state?.tab;
    if (tabParam && ["posts", "featured", "saved", "settings"].includes(tabParam)) {
      setActiveTab(tabParam === "saved" ? "featured" : tabParam);
    }
  }, [searchParams, location.state]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
  };

  const [allProducts, setAllProducts] = useState(() => getStoredProducts());
  const [unreadChatCount, setUnreadChatCount] = useState(() => getTotalUnreadCount(currentUser));
  const [blockedUsers, setBlockedUsers] = useState(() => getBlockedUsers(currentUser));
  const [unblockingId, setUnblockingId] = useState(null);

  // Sincronizar en tiempo real cuando se publica un producto, se actualizan datos o hay mensajes
  useEffect(() => {
    const handleUpdate = () => {
      setAllProducts(getStoredProducts());
    };

    window.addEventListener("anunciossv_products_updated", handleUpdate);
    return () => {
      window.removeEventListener("anunciossv_products_updated", handleUpdate);
    };
  }, [currentUser]);

  // Estadísticas reactivas de reputación del usuario actual en tiempo real
  const [userRatingStats, setUserRatingStats] = useState(() =>
    getSellerRatingStats(
      currentUser,
      currentUser?.rating || 5.0,
      currentUser?.reviewsCount || 0
    )
  );

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeToSellerRatings(currentUser, (newStats) => {
      if (newStats) {
        setUserRatingStats(newStats);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Sincronización en tiempo real de bloqueos y mensajes no leídos
  useEffect(() => {
    setBlockedUsers(getBlockedUsers(currentUser));
    setUnreadChatCount(getTotalUnreadCount(currentUser));

    const handleChatUpdate = () => {
      setBlockedUsers(getBlockedUsers(currentUser));
      setUnreadChatCount(getTotalUnreadCount(currentUser));
    };

    window.addEventListener(CHAT_EVENT, handleChatUpdate);
    return () => window.removeEventListener(CHAT_EVENT, handleChatUpdate);
  }, [currentUser]);

  // Desbloquear usuario desde el perfil
  const handleUnblockUser = (userId) => {
    setUnblockingId(userId);
    unblockUser(userId, currentUser);
    setBlockedUsers(getBlockedUsers(currentUser));
    setTimeout(() => setUnblockingId(null), 300);
  };

  // Eliminar un borrador guardado
  const handleDeleteDraft = async (draftId) => {
    if (window.confirm("¿Deseas descartar y eliminar este borrador de forma permanente?")) {
      await deleteProduct(draftId);
      setAllProducts(getStoredProducts());
    }
  };

  if (!currentUser) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-lg">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Modo Invitado</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Actualmente estás navegando sin iniciar sesión. Accede con tu cuenta para gestionar tus publicaciones, anuncios destacados y configuración.
        </p>
        <div className="pt-2">
          <button
            onClick={() => navigate("/login", { state: { from: { pathname: "/profile" } } })}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4" />
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  // Filtrar productos reales del usuario actual desde productsService
  const userProducts = getUserProducts(currentUser);

  // Filtrar anuncios destacados que pertenecen al usuario o fueron promocionados por él
  const featuredProducts = (allProducts || []).filter((p) => {
    if (!p?.featured) return false;
    const isOwner = currentUser && isProductOwner(p, currentUser);
    const isPromoter = currentUser?.email && (
      p.promotedBuyerEmail === currentUser.email ||
      p.featuredBuyerEmail === currentUser.email
    );
    return isOwner || isPromoter;
  });

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Tarjeta de cabecera de perfil */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative flex-shrink-0">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 shadow-lg">
                  <User className="w-8 h-8 text-slate-400" />
                </div>
              )}
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-extrabold text-white truncate">{currentUser.name}</h2>
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              </div>
              <div className="text-xs text-slate-400 truncate">{currentUser.email}</div>

              <div className="mt-1 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isAdmin
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  }`}>
                  {isAdmin ? "👑 Webmaster Admin" : "👤 Usuario Estándar"}
                </span>

                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-[10px] font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-0.5 underline"
                  >
                    Abrir panel →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Botón en el lado superior derecho para ir a la pantalla de Editar Perfil */}
          <Link
            to="/profile/edit"
            className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shadow-md transition-all active:scale-95 flex-shrink-0"
            title="Editar perfil y datos de la cuenta"
            aria-label="Editar perfil y datos de la cuenta"
          >
            <Edit3 className="w-4 h-4 text-indigo-400" />
          </Link>
        </div>

        {/* Resumen de actividad / KPIs del usuario */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
          <div>
            <div className="text-sm font-bold text-white">{userProducts.length}</div>
            <div className="text-[10px] text-slate-400">Publicaciones</div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/profile/reputation")}
            className="group p-1.5 -m-1.5 rounded-xl hover:bg-slate-800/60 active:scale-95 transition-all text-center focus:outline-none"
            title="Ver personas que te han calificado"
            aria-label="Ver detalles de reputación"
          >
            <div className="text-sm font-bold text-amber-400 group-hover:text-amber-300 transition-colors flex items-center justify-center gap-1">
              <span>{userRatingStats.average}</span>
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
            <div className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors">
              Reputación ({userRatingStats.count})
            </div>
          </button>
          <div>
            <div className="text-sm font-bold text-amber-400">{featuredProducts.length}</div>
            <div className="text-[10px] text-slate-400">Destacados</div>
          </div>
        </div>
      </div>

      {/* Acceso directo a la Bandeja de Mensajes internos */}
      <Link
        to="/messages"
        state={{ fromBottomNav: false }}
        onClick={() => {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("anunciossv_messages_from_footer");
          }
        }}
        className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 flex items-center justify-between gap-3 transition-all active:scale-[0.99] shadow-sm"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Bandeja de Mensajes</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black shadow-sm">
                  {unreadChatCount} {unreadChatCount === 1 ? "nuevo" : "nuevos"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {unreadChatCount > 0
                ? "Tienes consultas pendientes por revisar"
                : "Conversaciones con compradores y vendedores"}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </Link>

      {/* Pestañas de contenido (altura táctil optimizada min-h-[42px]) */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => handleTabChange("posts")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${activeTab === "posts"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
            }`}
        >
          Mis Anuncios ({userProducts.length})
        </button>
        <button
          onClick={() => handleTabChange("featured")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${activeTab === "featured" || activeTab === "saved"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
            }`}
        >
          Destacados ({featuredProducts.length})
        </button>
        <button
          onClick={() => handleTabChange("settings")}
          className={`flex-1 min-h-[40px] py-2 rounded-lg transition-all flex items-center justify-center font-bold ${activeTab === "settings"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
            }`}
        >
          Cuenta
        </button>
      </div>

      {/* Contenido de la pestaña Mis Anuncios */}
      {activeTab === "posts" && (
        <div className="space-y-2.5 animate-fade-in">
          {/* Indicador de límite diario de publicaciones */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">Publicaciones hoy:</span>
              <span className="font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px]">
                {canUserPublishToday(currentUser).count} de {DAILY_PUBLICATION_LIMIT}
              </span>
            </div>
            <Link
              to="/publish"
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95 transition-transform"
            >
              <span>+ Publicar anuncio</span>
            </Link>
          </div>

          {userProducts.length > 0 ? (
            userProducts.map((prod) => {
              const isDraft = prod.status === "borrador";
              const targetLink = isDraft ? `/publish?draftId=${prod.id}` : `/product/${prod.id}?from=profile&tab=posts`;
              const targetState = { from: "/profile", fromProfile: true, tab: "posts" };

              return (
                <div
                  key={prod.id}
                  className={`p-3 rounded-xl bg-slate-900 border flex items-center justify-between gap-3 shadow-sm transition-all ${
                    isDraft
                      ? "border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <Link
                    to={targetLink}
                    state={targetState}
                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0 block"
                  >
                    <img
                      src={prod.image || (prod.images && prod.images[0])}
                      alt={prod.title}
                      className="w-full h-full object-cover"
                    />
                    {prod.featured && (
                      <span className="absolute top-1 right-1 p-0.5 rounded bg-amber-500 text-slate-950">
                        <Sparkles className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={targetLink} state={{ from: "/profile", tab: "posts" }} className="block">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white truncate hover:text-indigo-300 transition-colors">
                          {prod.title || "Borrador sin título"}
                        </h4>
                        {prod.featured && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            DESTACADO
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="text-xs font-semibold text-indigo-400 mt-0.5">
                      {(() => {
                        const priceInfo = formatProductPrice(prod);
                        if (priceInfo.isContact) return "💬 A consultar";
                        if (priceInfo.isFree) return "GRATIS";
                        return `${priceInfo.text} ${priceInfo.currency || "USD"}${priceInfo.periodSuffix || ""}`;
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {isDraft ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                          <span>📝</span>
                          <span>Borrador</span>
                        </span>
                      ) : prod.status === "pausado" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                          ⏸ Pausado
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                          ✓ Activo
                        </span>
                      )}
                      {!isDraft && (
                        <span className="text-[10px] text-slate-500">{prod.viewsCount || 0} visitas</span>
                      )}
                      {prod.condition && (
                        <span className="text-[10px] text-slate-400">· {prod.condition}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {isDraft ? (
                      <>
                        <Link
                          to={`/publish?draftId=${prod.id}`}
                          className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white transition-colors flex items-center justify-center"
                          title="Continuar editando borrador"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(prod.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors flex items-center justify-center"
                          title="Eliminar borrador"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to={`/manage-product/${prod.id}?from=profile&tab=posts`}
                          state={{ from: "/profile", fromProfile: true, tab: "posts" }}
                          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition-colors flex items-center justify-center shadow-sm active:scale-95"
                          title="Gestionar anuncio"
                          aria-label="Gestionar anuncio"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/product/${prod.id}?from=profile&tab=posts`}
                          state={{ from: "/profile", fromProfile: true, tab: "posts" }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center shadow-sm active:scale-95"
                          title="Ver en detalle"
                          aria-label="Ver en detalle"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Aún no tienes publicaciones</h4>
                <p className="mt-1 text-slate-400">Publica tu primer producto o servicio gratis en AnunciosSV.</p>
              </div>
              <Link
                to="/publish"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Crear Publicación</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Contenido de la pestaña Destacados */}
      {(activeTab === "featured" || activeTab === "saved") && (
        <div className="space-y-2.5 animate-fade-in">
          {featuredProducts.length > 0 ? (
            featuredProducts.map((prod) => {
              const productLink = `/product/${prod.id}?from=profile&tab=featured`;
              const productState = { from: "/profile", fromProfile: true, tab: "featured" };
              const remainingText = getRemainingPromotionText(prod);

              return (
                <div
                  key={prod.id}
                  className="p-3 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-between gap-3 shadow-md shadow-amber-500/5 hover:border-amber-500/50 transition-all"
                >
                  <Link
                    to={productLink}
                    state={productState}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-amber-500/40 flex-shrink-0 block ring-2 ring-amber-500/20"
                  >
                    <img
                      src={prod.image || (prod.images && prod.images[0])}
                      alt={prod.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1 right-1 p-0.5 rounded bg-amber-500 text-slate-950 shadow-sm">
                      <Sparkles className="w-2.5 h-2.5 fill-current" />
                    </span>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link to={productLink} state={productState} className="block">
                      <h4 className="text-xs font-bold text-white truncate hover:text-amber-300 transition-colors">
                        {prod.title}
                      </h4>
                    </Link>

                    {/* Tiempo restante de la promoción */}
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md w-fit">
                      <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span>{remainingText}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="truncate max-w-[130px]">{prod.location}</span>
                      {prod.condition && <span>· {prod.condition}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Botón Centro de Control si es dueño */}
                    {isProductOwner(prod, currentUser) ? (
                      <Link
                        to={`/manage-product/${prod.id}`}
                        state={{ from: "/profile", fromProfile: true, tab: "featured" }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white transition-colors"
                        title="Gestionar anuncio"
                        aria-label="Gestionar anuncio"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </Link>
                    ) : (
                      <Link
                        to={productLink}
                        state={productState}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Ver en detalle"
                        aria-label="Ver en detalle"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-md shadow-amber-500/10">
                <Sparkles className="w-6 h-6 fill-amber-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">No tienes anuncios destacados</h4>
                <p className="mt-1 text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Destaca tus publicaciones para que se muestren con el halo dorado y aparezcan posicionadas sobre los demás anuncios en el feed principal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("posts")}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>Ver mis anuncios para destacar</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contenido de la pestaña Cuenta: Resumen, acceso a Editar Perfil, Bloqueados y Salir */}
      {activeTab === "settings" && (
        <div className="space-y-4 animate-fade-in pb-8">
          {/* Acceso directo a Editar Perfil y Datos de la Cuenta */}
          <Link
            to="/profile/edit"
            className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 flex items-center justify-between gap-3 transition-all active:scale-[0.99] shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Editar Perfil y Seguridad</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Cambiar foto, nombre, teléfono, correo o contraseña
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </Link>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-sm">
            <div className="pb-1 border-b border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Información de la Cuenta
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Nombre de pila</span>
                <span className="text-slate-200 font-semibold truncate max-w-[200px]">
                  {currentUser.displayName || currentUser.name || "No especificado"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Nombre de usuario</span>
                <span className="text-slate-200 font-semibold font-mono">
                  {currentUser.username ? `@${currentUser.username}` : "@usuario"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Correo Electrónico</span>
                <span className="text-slate-200 font-semibold truncate max-w-[200px]">
                  {currentUser.email || "No especificado"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Teléfono de contacto</span>
                <span className="text-slate-200 font-semibold">
                  {currentUser.phone || "No configurado"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Rol en la plataforma</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAdmin ? "text-purple-300 bg-purple-950/60 border border-purple-800" : "text-blue-300 bg-blue-950/60 border border-blue-800"
                  }`}>
                  {isAdmin ? "👑 Webmaster (Admin)" : "👤 Usuario Estándar"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Estado de cuenta</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Activa</span>
                </span>
              </div>
            </div>
          </div>

          {/* Acceso a Usuarios Bloqueados (diseño idéntico a Bandeja de Mensajes) */}
          <Link
            to="/blocked-users"
            className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-rose-950/30 border border-slate-800 hover:border-rose-500/40 flex items-center justify-between gap-3 transition-all active:scale-[0.99] shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Usuarios Bloqueados</span>
                  {blockedUsers.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black shadow-sm">
                      {blockedUsers.length}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {blockedUsers.length > 0
                    ? `${blockedUsers.length} contacto${blockedUsers.length === 1 ? "" : "s"} restringido${blockedUsers.length === 1 ? "" : "s"}`
                    : "Administra las cuentas restringidas para enviarte mensajes"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </Link>

          {/* Botón de Cerrar Sesión */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition-all active:scale-[0.99] shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
