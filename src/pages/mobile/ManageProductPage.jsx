// Pantalla de gestión exclusiva para el propietario de un anuncio en AnunciosSV
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Edit3,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Star,
  X,
  Clock
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getProductById,
  isProductOwner,
  togglePauseProduct,
  deleteProduct,
  updateProduct,
  formatProductPrice
} from "../../services/productsService";

export const ManageProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();

  // Detectar con precisión si la navegación proviene de Perfil > Mis Anuncios
  const cameFromProfile = Boolean(
    location.state?.fromProfile === true ||
    location.state?.from === "/profile" ||
    searchParams.get("from") === "profile"
  );

  // Detectar si proviene del detalle de la publicación (abierta desde el Feed)
  const cameFromProduct = Boolean(
    location.state?.fromProduct === true ||
    (typeof location.state?.from === "string" && location.state.from.startsWith("/product/")) ||
    searchParams.get("from") === "product"
  );

  const [product, setProduct] = useState(() => getProductById(id));
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelPromotionModal, setShowCancelPromotionModal] = useState(false);

  // Retorno seguro y directo a Perfil > Mis Anuncios
  const handleReturnToProfile = useCallback(() => {
    navigate("/profile?tab=posts", { replace: true, state: { from: "/profile", fromProfile: true, tab: "posts" } });
  }, [navigate]);

  // Retorno seguro y directo a los detalles de la publicación (Feed)
  const handleReturnToProduct = useCallback(() => {
    navigate(`/product/${id}`, { replace: true });
  }, [navigate, id]);

  // Manejo de retroceso para header y gestos: respeta si se abrió desde Perfil o desde el Feed
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (cameFromProduct) {
      handleReturnToProduct();
    } else {
      // Si se abrió desde Perfil > Mis Anuncios (o por defecto), retornar siempre a Perfil
      handleReturnToProfile();
    }
  }, [cameFromProduct, handleReturnToProduct, handleReturnToProfile, navigate]);

  // Manejo de gestos táctiles de deslizamiento hacia la derecha (swipe back)
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

    // Gesto táctil de deslizamiento horizontal hacia la derecha desde el lado izquierdo (< 120px)
    if (
      diffX > 65 &&
      Math.abs(diffY) < 55 &&
      elapsed < 600 &&
      touchStartXRef.current < 120
    ) {
      handleBack();
    }
  };

  // Interceptar evento popstate del navegador (gesto táctil de retroceso en iOS/Android o botón atrás del sistema)
  useEffect(() => {
    const handlePopState = () => {
      if (cameFromProduct) {
        handleReturnToProduct();
      } else {
        handleReturnToProfile();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [cameFromProduct, handleReturnToProduct, handleReturnToProfile]);

  // Asegurar scroll al tope al ingresar a la pantalla
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

  // Sincronizar producto si cambia globalmente
  useEffect(() => {
    setProduct(getProductById(id));
    const handleUpdate = () => {
      setProduct(getProductById(id));
    };
    window.addEventListener("anunciossv_products_updated", handleUpdate);
    return () => window.removeEventListener("anunciossv_products_updated", handleUpdate);
  }, [id]);

  if (!product) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Anuncio no encontrado</h2>
        <p className="text-xs text-slate-400">El anuncio que intentas gestionar ya no existe o fue removido.</p>
        <button
          onClick={handleReturnToProfile}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Ir a mis publicaciones
        </button>
      </div>
    );
  }

  const isOwner = currentUser && isProductOwner(product, currentUser);

  // Validación de seguridad: si no es el dueño, denegar acceso
  if (!isOwner) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Acceso no autorizado</h2>
        <p className="text-xs text-slate-400">
          Solo el usuario que publicó este anuncio tiene permisos para gestionarlo o modificarlo.
        </p>
        <button
          onClick={handleReturnToProfile}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Volver a mis anuncios
        </button>
      </div>
    );
  }

  const isPaused = product.status === "pausado";
  const priceInfo = formatProductPrice(product);

  // 1. Pausar o Reactivar anuncio
  const handleTogglePause = async () => {
    setLoading(true);
    try {
      const updated = await togglePauseProduct(product.id);
      setProduct(updated);
      setStatusMessage(
        updated.status === "pausado"
          ? "Tu anuncio ha sido pausado. Ya no se mostrará en el Feed público ni en búsquedas."
          : "¡Tu anuncio ha sido reactivado! Ya es visible nuevamente para todos los compradores."
      );
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      alert("Error al cambiar el estado del anuncio: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Cancelar la promoción (destaque) del anuncio definitivamente
  const handleConfirmCancelPromotion = async () => {
    setLoading(true);
    try {
      const updated = await updateProduct(product.id, {
        featured: false,
        featuredTimestamp: null,
        featuredExpiresAt: null,
        featuredDays: null,
        promotedAt: null,
        promotedDays: null,
        promotedPrice: null,
        promotedBuyerEmail: null,
        promotedErn: null,
        promotedReference: null
      });
      setProduct(updated);
      setShowCancelPromotionModal(false);
      setStatusMessage("Se ha eliminado el destacado del anuncio. Tu publicación sigue activa con normalidad.");
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      alert("Error al cancelar la promoción: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Eliminar anuncio definitivamente
  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      await deleteProduct(product.id);
      setShowDeleteModal(false);
      if (cameFromProfile) {
        handleReturnToProfile();
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      alert("Error al eliminar el anuncio: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-4 px-4 pb-12 animate-fade-in max-w-lg mx-auto"
    >
      {/* Cabecera superior fija: Centro de Control (Sustituye al header global de AnunciosSV) */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md px-4 py-2.5 border-b border-slate-800/90 shadow-md -mx-4 mb-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            aria-label={cameFromProfile ? "Volver a mis anuncios" : "Volver al detalle del anuncio"}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-white tracking-tight">Centro de Control</h1>
          <div className="w-10" aria-hidden="true" />
        </div>
      </header>

      {/* Notificación de retroalimentación de estado */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300 flex items-start gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{statusMessage}</span>
        </div>
      )}

      {/* Tarjeta resumen del anuncio */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-start gap-3">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800">
            <img
              src={product.image || (product.images && product.images[0])}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            {product.featured && (
              <span className="absolute top-1 left-1 p-0.5 rounded bg-amber-500 text-slate-950">
                <Sparkles className="w-3 h-3 fill-current" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isPaused ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ⏸ Pausado (Oculto)
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ✓ Activo en Feed
                </span>
              )}

              {product.featured && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" /> Destacado
                </span>
              )}
            </div>

            <h2 className="text-sm font-bold text-white line-clamp-1">{product.title}</h2>

            <div className="text-xs font-extrabold text-indigo-400">
              {priceInfo.isContact ? (
                <span>💬 A consultar</span>
              ) : priceInfo.isFree ? (
                <span className="text-emerald-400">GRATIS</span>
              ) : (
                <span>
                  {priceInfo.text} {priceInfo.currency}{priceInfo.periodSuffix}
                </span>
              )}
            </div>

            <div className="text-[10px] text-slate-400 flex items-center gap-2">
              <span>{product.viewsCount || 0} vistas</span>
              <span>· {product.likesCount || 0} me gusta</span>
            </div>

            {/* Badges de canales de contacto activos */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {product.allowWhatsappContact ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  WhatsApp activo
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  WhatsApp inactivo
                </span>
              )}
              {product.allowEmailContact !== false ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  Correo activo
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Correo inactivo
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Opciones de Gestión del Anuncio */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Acciones de configuración
        </h3>

        {/* 1. Opción: Pausar / Reactivar Anuncio */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isPaused
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
            }`}>
              {isPaused ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white">
                {isPaused ? "Reactivar anuncio" : "Pausar publicación"}
              </h4>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleTogglePause}
            className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-md ${
              isPaused
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30"
            }`}
          >
            {isPaused ? (
              <>
                <Eye className="w-4 h-4" />
                <span>Mostrar en el Feed</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Pausar (Ocultar)</span>
              </>
            )}
          </button>
        </div>

        {/* 2. Opción: Editar detalles del anuncio */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white">Editar información</h4>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate(`/publish?edit=${product.id}&from=${cameFromProfile ? "profile" : "product"}`, {
                state: {
                  from: cameFromProfile ? "/profile" : `/product/${product.id}`,
                  fromProfile: cameFromProfile,
                  fromProduct: cameFromProduct,
                  tab: cameFromProfile ? "posts" : undefined
                }
              })
            }
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            <span>Editar anuncio</span>
          </button>
        </div>

        {/* 3. Opción: Destacar anuncio / Cancelar destaque */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-amber-500/30 space-y-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 fill-amber-400/20" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white">Destacar anuncio</h4>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                {product.featured
                  ? "Esta publicación cuenta con halo dorado y posicionamiento preferente"
                  : "Aumenta el alcance de tu anuncio colocándolo en la cima del feed"}
              </p>
            </div>
          </div>

          {product.featured ? (
            /* Si el anuncio ya está destacado: solo botón para cancelar la promoción */
            <div className="space-y-2 pt-1">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  Actualmente destacado
                </span>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Activo
                </span>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => setShowCancelPromotionModal(true)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Cancelar destaque</span>
              </button>
            </div>
          ) : (
            /* En anuncios no destacados: solo botón para destacar */
            <div className="pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => navigate(`/promote-ad/${product.id}`, { state: { from: `/manage-product/${product.id}` } })}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Destacar anuncio</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. Opción: Eliminar Anuncio (Zona de Peligro) */}
        <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-rose-300">Eliminar publicación</h4>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/40 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar anuncio</span>
          </button>
        </div>
      </div>

      {/* Modal de Confirmación para Cancelar Destaque */}
      {showCancelPromotionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-enter">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl animate-scale-up text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">¿Cancelar el destacado de este anuncio?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Se va a <strong className="text-white">eliminar el destacado</strong> (halo dorado y posicionamiento preferente), <strong className="text-emerald-400">mas no se eliminará tu anuncio</strong>.
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-amber-400 font-medium">
                ⚠️ Ten en cuenta que esta acción no se puede revertir.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowCancelPromotionModal(false)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-[0.99]"
              >
                No, mantener
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmCancelPromotion}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                {loading ? "Cancelando..." : "Sí, eliminar destacado"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Anuncio */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-enter">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl animate-scale-up text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">¿Eliminar este anuncio?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Esta acción <span className="text-rose-400 font-bold">no se puede deshacer</span>. Tu anuncio "{product.title}" será borrado para siempre.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowDeleteModal(false)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-[0.99]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDelete}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                {loading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageProductPage;

