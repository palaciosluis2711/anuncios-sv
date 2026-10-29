// Detalle exhaustivo de una publicación de clasificado en AnunciosSV
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  Heart,
  MapPin,
  Clock,
  Eye,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Package,
  Briefcase,
  Tag,
  Boxes,
  Store,
  Truck,
  ChevronLeft,
  ChevronRight,
  Star,
  Maximize2,
  SlidersHorizontal,
  Mail
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PhotoCarouselModal } from "../../components/mobile/PhotoCarouselModal";
import { MOCK_PRODUCTS, DELIVERY_OPTIONS } from "../../services/mockData";
import {
  getProductById,
  isProductFavorite,
  toggleFavoriteProduct,
  isProductOwner,
  formatProductPrice,
  getCleanWhatsappNumber,
  FAVORITES_EVENT
} from "../../services/productsService";
import { getPublicProfile, PROFILE_UPDATED_EVENT } from "../../services/userProfileService";
import { getOrCreateConversation } from "../../services/chatService";
import { formatPublicationTime } from "../../components/mobile/ProductCard";

const DELIVERY_ICONS = {
  public_place: MapPin,
  pickup: Store,
  store_pickup: Store,
  shipping: Truck
};

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentUser, requireAuth } = useAuth();

  // Control de retorno e información de la procedencia
  const isFromChat = Boolean(
    location.state?.fromChat ||
    searchParams.get("fromChat") === "true" ||
    searchParams.get("from") === "chat"
  );
  const chatId = location.state?.chatId || searchParams.get("chatId");
  const chatPath = location.state?.chatPath || (chatId ? `/messages/${chatId}` : "/messages");

  // Manejo de retorno con el MISMO comportamiento que el gesto táctil del celular
  const handlePageBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Referencias para detección de gesto táctil de retroceso desde el borde izquierdo (Swipe back)
  const pageTouchStartXRef = useRef(0);
  const pageTouchStartYRef = useRef(0);
  const pageTouchStartTimeRef = useRef(0);

  const handlePageTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      pageTouchStartXRef.current = e.touches[0].clientX;
      pageTouchStartYRef.current = e.touches[0].clientY;
      pageTouchStartTimeRef.current = Date.now();
    }
  };

  const handlePageTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - pageTouchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - pageTouchStartYRef.current;
    const elapsed = Date.now() - pageTouchStartTimeRef.current;

    // Gesto de swipe fluido hacia la derecha desde el margen izquierdo (< 120px)
    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && pageTouchStartXRef.current < 120) {
      handlePageBack();
    }
  };

  // Obtener producto del servicio centralizado o fallback de mockData
  const product = getProductById(id) || MOCK_PRODUCTS.find((p) => String(p.id) === String(id)) || MOCK_PRODUCTS[0];

  // Identificar si el usuario actual es el dueño del anuncio
  const isOwner = currentUser && isProductOwner(product, currentUser);

  // Galería de imágenes (soporta array de fotos múltiples o foto única)
  const imagesList = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.image || "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80"];

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Estados y referencias para deslizamiento táctil horizontal fluido (swipe 1-a-1) y arrastre hacia abajo
  const [dragOffset, setDragOffset] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isPointerDownRef = useRef(false);
  const pointerIdRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const currentOffsetYRef = useRef(0);
  const directionLockedRef = useRef(null);

  // Estado para la animación de despliegue interactivo en tiempo real conforme se arrastra hacia abajo
  const [interactiveDeploy, setInteractiveDeploy] = useState({
    isDeploying: false,
    progress: 0,
    offsetY: 0
  });

  // Información formateada de precio (soporta fijo, rango, alquiler y solicitar por mensaje)
  const priceInfo = formatProductPrice(product);

  // Estado reactivo de favorito sincronizado globalmente
  const [isLiked, setIsLiked] = useState(() => isProductFavorite(product.id, currentUser));
  const [likesCount, setLikesCount] = useState(product.likesCount || 0);

  // Desactivar el pull-to-refresh nativo del navegador en esta pantalla para priorizar el gesto de la portada
  useEffect(() => {
    const originalBodyOverscroll = document.body.style.overscrollBehaviorY;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "contain";
    document.documentElement.style.overscrollBehaviorY = "contain";

    return () => {
      document.body.style.overscrollBehaviorY = originalBodyOverscroll;
      document.documentElement.style.overscrollBehaviorY = originalHtmlOverscroll;
    };
  }, []);

  // Asegurar que la pantalla siempre aparezca en el tope con la portada primero
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

  const [, setProfileUpdateTick] = useState(0);

  useEffect(() => {
    setIsLiked(isProductFavorite(product.id, currentUser));
    setLikesCount(product.likesCount || 0);

    const handleFavUpdate = (e) => {
      if (String(e.detail?.productId) === String(product.id)) {
        setIsLiked(Boolean(e.detail.isFavorite));
        if (typeof e.detail.likesCount === "number") {
          setLikesCount(e.detail.likesCount);
        }
      }
    };

    const handleProfileUpdate = () => {
      setProfileUpdateTick((prev) => prev + 1);
    };

    window.addEventListener(FAVORITES_EVENT, handleFavUpdate);
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, handleFavUpdate);
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate);
    };
  }, [product.id, product.likesCount, currentUser]);

  const sellerProfile = getPublicProfile(product.seller?.id || product.seller?.username || product.seller?.name);
  const sellerAvatar = sellerProfile?.avatar || product.seller?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80";
  const sellerName = sellerProfile?.displayName || sellerProfile?.name || product.seller?.name || "Vendedor";

  const handleToggleFavorite = () => {
    // Requerir inicio de sesión con diálogo de confirmación interactivo
    requireAuth(
      () => {
        const res = toggleFavoriteProduct(product.id, currentUser);
        setIsLiked(res.isFavorite);
        setLikesCount(res.likesCount);
      },
      {
        actionType: "like",
        title: "¿Guardar en tus favoritos?",
        message: "Inicia sesión para poder guardar este anuncio en tus favoritos y consultarlo cuando quieras."
      }
    );
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % imagesList.length);
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + imagesList.length) % imagesList.length);
  };

  // Gestos táctiles de deslizamiento horizontal suave (swipe 1-a-1) y arrastre hacia abajo para abrir visualizador
  const handleGalleryPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch (_) {}

    pointerIdRef.current = e.pointerId;
    isPointerDownRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    currentOffsetRef.current = 0;
    currentOffsetYRef.current = 0;
    directionLockedRef.current = null;
    setIsDragging(true);
    setDragOffset(0);
    setDragOffsetY(0);
    setInteractiveDeploy({
      isDeploying: false,
      progress: 0,
      offsetY: 0
    });
  };

  const handleGalleryPointerMove = (e) => {
    if (!isPointerDownRef.current) return;
    const diffX = e.clientX - startXRef.current;
    const diffY = e.clientY - startYRef.current;

    // Detectar si el usuario desliza horizontalmente (entre fotos) o hacia abajo (para abrir visualizador)
    if (directionLockedRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        if (Math.abs(diffX) >= Math.abs(diffY)) {
          // Deslizamiento horizontal entre fotos
          directionLockedRef.current = "horizontal";
        } else if (diffY > 6) {
          // Arrastre hacia abajo: activar apertura y despliegue interactivo de imagen completa
          directionLockedRef.current = "vertical-down";
        } else {
          // Deslizamiento hacia arriba: permitir scroll normal de la página
          isPointerDownRef.current = false;
          setIsDragging(false);
          setDragOffset(0);
          setDragOffsetY(0);
          currentOffsetRef.current = 0;
          currentOffsetYRef.current = 0;
          setInteractiveDeploy({
            isDeploying: false,
            progress: 0,
            offsetY: 0
          });
          if (pointerIdRef.current !== null) {
            try {
              e.currentTarget.releasePointerCapture?.(pointerIdRef.current);
            } catch (_) {}
            pointerIdRef.current = null;
          }
          return;
        }
      }
    }

    if (directionLockedRef.current === "horizontal") {
      let offset = diffX;
      if (imagesList.length <= 1) {
        offset = diffX * 0.15;
      } else if (
        (activeImageIndex === 0 && diffX > 0) ||
        (activeImageIndex === imagesList.length - 1 && diffX < 0)
      ) {
        offset = diffX * 0.28;
      }
      currentOffsetRef.current = offset;
      setDragOffset(offset);
    } else if (directionLockedRef.current === "vertical-down") {
      // Movimiento vertical hacia abajo con resistencia elástica suave
      const rawY = Math.max(0, diffY);
      const dampenedY = rawY < 50 ? rawY : 50 + (rawY - 50) * 0.6;
      currentOffsetYRef.current = dampenedY;
      setDragOffsetY(dampenedY);

      // Despliegue interactivo en tiempo real conforme se arrastra hacia abajo
      const progress = Math.min(1, rawY / 130);
      setInteractiveDeploy({
        isDeploying: true,
        progress,
        offsetY: dampenedY
      });
    }
  };

  const handleGalleryPointerUp = (e) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    if (pointerIdRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture?.(pointerIdRef.current);
      } catch (_) {}
      pointerIdRef.current = null;
    }

    const diffX = currentOffsetRef.current;
    const diffY = currentOffsetYRef.current;
    const elapsed = Date.now() - startTimeRef.current;
    const lockedDir = directionLockedRef.current;

    // 1. Si fue un tap o clic sin desplazamiento: abrir visualizador modal
    if (Math.abs(diffX) < 8 && Math.abs(diffY) < 8 && elapsed < 350) {
      currentOffsetRef.current = 0;
      currentOffsetYRef.current = 0;
      setDragOffset(0);
      setDragOffsetY(0);
      directionLockedRef.current = null;
      setInteractiveDeploy({
        isDeploying: false,
        progress: 0,
        offsetY: 0
      });
      setIsViewerOpen(true);
      return;
    }

    // 2. Si se arrastró hacia abajo: abrir o cancelar despliegue
    if (lockedDir === "vertical-down") {
      const isDownFlick = elapsed < 350 && diffY > 20;
      const isPastDownThreshold = diffY > 40;

      if (isDownFlick || isPastDownThreshold) {
        setInteractiveDeploy({
          isDeploying: false,
          progress: 1,
          offsetY: 0
        });
        setIsViewerOpen(true);
        currentOffsetRef.current = 0;
        currentOffsetYRef.current = 0;
        setDragOffset(0);
        setDragOffsetY(0);
        directionLockedRef.current = null;
        return;
      } else {
        // Cancelar despliegue y replegar suavemente
        setInteractiveDeploy({
          isDeploying: false,
          progress: 0,
          offsetY: 0
        });
      }
    }

    // 3. Si se arrastró horizontalmente: pasar a la siguiente o anterior foto
    if (lockedDir === "horizontal") {
      const isFlick = elapsed < 320 && Math.abs(diffX) > 25;
      const isPastThreshold = Math.abs(diffX) > 50;

      if (isFlick || isPastThreshold) {
        if (diffX < 0 && activeImageIndex < imagesList.length - 1) {
          setActiveImageIndex(activeImageIndex + 1);
        } else if (diffX > 0 && activeImageIndex > 0) {
          setActiveImageIndex(activeImageIndex - 1);
        }
      }
    }

    currentOffsetRef.current = 0;
    currentOffsetYRef.current = 0;
    setDragOffset(0);
    setDragOffsetY(0);
    directionLockedRef.current = null;
  };

  const handleGalleryPointerCancel = () => {
    isPointerDownRef.current = false;
    setIsDragging(false);
    if (pointerIdRef.current !== null) {
      try {
        pointerIdRef.current = null;
      } catch (_) {}
    }
    currentOffsetRef.current = 0;
    currentOffsetYRef.current = 0;
    setDragOffset(0);
    setDragOffsetY(0);
    directionLockedRef.current = null;
    setInteractiveDeploy({
      isDeploying: false,
      progress: 0,
      offsetY: 0
    });
  };

  // Detección de canales de contacto activos habilitados por el vendedor
  const rawPhone = product.contactWhatsapp || product.contactPhone || product.seller?.phone;
  const isWhatsappActive = Boolean(product.allowWhatsappContact && rawPhone && rawPhone.trim().length > 0);
  const sellerEmail = product.contactEmail || product.seller?.email;
  const isEmailActive = product.allowEmailContact !== false && Boolean(sellerEmail && sellerEmail.trim().length > 0);

  const handleWhatsappContact = () => {
    // Requerir inicio de sesión para contactar al vendedor
    requireAuth(
      () => {
        const cleanNumber = getCleanWhatsappNumber(rawPhone);
        if (!cleanNumber) {
          alert("El vendedor no tiene un número disponible para WhatsApp.");
          return;
        }
        const text = encodeURIComponent(
          `¡Hola ${product.seller?.name || ""}! Vi tu publicación "${product.title}" en AnunciosSV y me interesa más información: ${window.location.href}`
        );
        window.open(`https://wa.me/${cleanNumber}?text=${text}`, "_blank", "noopener,noreferrer");
      },
      {
        actionType: "message",
        title: "¿Contactar por WhatsApp?",
        message: `Inicia sesión para comunicarte directamente vía WhatsApp con ${product.seller?.name || "el vendedor"}.`
      }
    );
  };

  const handleEmailContact = () => {
    // Requerir inicio de sesión para contactar al vendedor
    requireAuth(
      () => {
        if (!sellerEmail) {
          alert("El vendedor no tiene disponible un correo de contacto.");
          return;
        }
        const subject = encodeURIComponent(`Consulta por tu anuncio en AnunciosSV: ${product.title}`);
        const body = encodeURIComponent(
          `Hola ${product.seller?.name || ""},\n\nTe contacto desde AnunciosSV por tu publicación "${product.title}". Quisiera consultar disponibilidad y detalles.\n\nEnlace del anuncio: ${window.location.href}`
        );
        window.location.href = `mailto:${sellerEmail}?subject=${subject}&body=${body}`;
      },
      {
        actionType: "message",
        title: "¿Contactar por Correo?",
        message: `Inicia sesión para escribirle un correo electrónico a ${product.seller?.name || "el vendedor"}.`
      }
    );
  };

  const handleSendMessage = () => {
    // Requerir inicio de sesión para contactar al vendedor
    requireAuth(
      () => {
        try {
          const conv = getOrCreateConversation({
            currentUser,
            recipient: product.seller,
            product
          });
          navigate(`/messages/${conv.id}`);
        } catch (err) {
          alert("Error al iniciar la conversación: " + err.message);
        }
      },
      {
        actionType: "message",
        title: "¿Contactar al vendedor?",
        message: `Inicia sesión para comunicarte directamente con ${product.seller?.name || "el vendedor"} y acordar tu compra.`
      }
    );
  };

  return (
    <div
      onTouchStart={handlePageTouchStart}
      onTouchEnd={handlePageTouchEnd}
      style={{ overscrollBehaviorY: "contain" }}
      className="space-y-4 pb-8 animate-fade-in select-none overscroll-y-contain"
    >
      {/* 1. Galería de Fotos Interactiva con Navegación Táctil Deslizable y Miniaturas */}
      <div className="relative bg-slate-950 select-none">
        <div
          onPointerDown={handleGalleryPointerDown}
          onPointerMove={handleGalleryPointerMove}
          onPointerUp={handleGalleryPointerUp}
          onPointerCancel={handleGalleryPointerCancel}
          style={{ touchAction: "none" }}
          className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900 cursor-grab active:cursor-grabbing touch-none select-none"
          title="Desliza para ver más fotos o hacia abajo para desplegar el visualizador"
        >
          {/* Pista deslizante continua de imágenes */}
          <div
            className="flex w-full h-full"
            style={{
              transform: `translate3d(calc(-${activeImageIndex * 100}% + ${dragOffset}px), ${dragOffsetY}px, 0) scale(${dragOffsetY > 0 ? Math.min(1.04, 1 + dragOffsetY * 0.0006) : 1})`,
              transition: isDragging ? "none" : "transform 360ms cubic-bezier(0.16, 1, 0.3, 1)",
              willChange: "transform",
            }}
          >
            {imagesList.map((photoUrl, idx) => (
              <div
                key={idx}
                className="w-full h-full flex-shrink-0 relative overflow-hidden bg-slate-950"
              >
                <img
                  src={photoUrl}
                  alt={`${product.title} - Foto ${idx + 1}`}
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none select-none"
                  loading={idx === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>

          {/* Indicador visual suave al arrastrar hacia abajo para ampliar */}
          {dragOffsetY > 12 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md text-[11px] font-bold text-white border border-indigo-500/40 shadow-xl flex items-center gap-1.5 z-20 pointer-events-none animate-fade-in">
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{dragOffsetY > 35 ? "Suelta para ampliar" : "Desliza hacia abajo para ampliar"}</span>
            </div>
          )}

          {/* Badge de Anuncio Destacado */}
          {product.featured && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-lg z-10 pointer-events-none">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Destacado</span>
            </div>
          )}

          {/* Botón flotante sobre la foto (Favorito) */}
          <div
            className="absolute top-3 right-3 z-10"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={isLiked ? "Quitar de favoritos" : "Guardar en favoritos"}
              className={`p-2.5 rounded-full backdrop-blur-md transition-all active:scale-90 shadow-md ${
                isLiked
                  ? "bg-rose-500 text-white shadow-rose-500/40 ring-2 ring-rose-400/40"
                  : "bg-slate-950/70 text-slate-200 hover:text-white hover:bg-slate-950/90"
              }`}
            >
              <Heart className={`w-4.5 h-4.5 transition-transform ${isLiked ? "fill-white scale-110" : ""}`} />
            </button>
          </div>

          {/* Flechas de navegación para múltiples fotos */}
          {imagesList.length > 1 && (
            <>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                aria-label="Foto anterior"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950/90 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 shadow-md z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                aria-label="Foto siguiente"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950/90 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 shadow-md z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Indicador táctil para ver en pantalla completa y conteo */}
          <div
            className="absolute bottom-3 right-3 flex items-center gap-2 z-10"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsViewerOpen(true);
            }}
          >
            {imagesList.length > 1 && (
              <div className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-bold text-slate-200 border border-slate-800 shadow pointer-events-none">
                {activeImageIndex + 1} / {imagesList.length}
              </div>
            )}
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-slate-200 hover:text-white text-[11px] font-semibold border border-slate-700/60 shadow transition-all active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ver completa</span>
            </button>
          </div>
        </div>

        {/* Carrusel de Miniaturas cuando hay más de una foto */}
        {imagesList.length > 1 && (
          <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {imagesList.map((photoUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                  activeImageIndex === idx
                    ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-105"
                    : "border-slate-800 opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={photoUrl}
                  alt={`Miniatura ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {idx === 0 && (
                  <span className="absolute bottom-0 inset-x-0 bg-indigo-600/90 text-[8px] font-bold text-white text-center py-0.5 leading-none">
                    Principal
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Contenido Principal */}
      <div className="px-4 space-y-4">
        {/* Jerarquía de Categoría y Subcategoría */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            {product.mainCategory === "servicio" ? (
              <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Package className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>{product.mainCategoryName || (product.mainCategory === "servicio" ? "Servicio" : "Producto")}</span>
            <span className="text-slate-500">›</span>
            <span>{product.subcategoryName || product.categoryName || "Clasificado"}</span>
          </span>

          {product.featured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-400/15 text-amber-300 border border-amber-400/30">
              <Sparkles className="w-3 h-3 fill-amber-300" />
              Destacado
            </span>
          )}
        </div>

        {/* Título de la Publicación */}
        <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
          {product.title}
        </h1>

        {/* Bloque de Precio, Modalidades y Condiciones */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3">
          {/* Fila 1: Encabezado con Etiqueta y Contador de Me Gusta */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {priceInfo.isContact ? "Modalidad de Precio" : priceInfo.isRange ? "Rango de Precios" : "Precio"}
            </span>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60 flex-shrink-0">
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
              <span>{likesCount} {likesCount === 1 ? "me gusta" : "me gusta"}</span>
            </div>
          </div>

          {/* Fila 2: Visualización del Monto / Precio Principal con espacio completo */}
          <div className="min-w-0">
            {priceInfo.isContact ? (
              <div className="space-y-0.5">
                <span className="text-2xl sm:text-3xl font-black text-indigo-400 tracking-tight block">
                  A consultar
                </span>
                <p className="text-xs text-slate-400 font-medium">
                  Precio a solicitar mediante mensaje privado con el vendedor
                </p>
              </div>
            ) : priceInfo.isFree ? (
              <div className="space-y-0.5">
                <span className="text-3xl font-black text-emerald-400 tracking-tight drop-shadow-sm block">
                  GRATIS
                </span>
                <p className="text-xs text-emerald-300/80 font-medium">
                  Artículo o servicio ofrecido sin costo
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">
                  {priceInfo.text}
                </span>
                <span className="text-xs font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30 whitespace-nowrap">
                  {priceInfo.currency || "USD"}{priceInfo.periodSuffix ? ` ${priceInfo.periodSuffix.trim()}` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Fila 3: Badges / Etiquetas de Modalidades y Condiciones organizadas con flex-wrap */}
          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800/80">
            {/* Modalidad de pago o facturación (ej. Renta mensual, Mensual recurrente, Un solo pago) */}
            {priceInfo.billingLabel && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/15 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span>{priceInfo.billingLabel}</span>
              </span>
            )}

            {/* Tipo de precio (Rango vs Negociable vs Precio Fijo) */}
            {priceInfo.isRange ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/15 text-purple-300 text-xs font-semibold border border-purple-500/30">
                <span>📊 Rango de Precios</span>
              </span>
            ) : product.isNegotiable ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                <span>🤝 Precio Negociable</span>
              </span>
            ) : !priceInfo.isFree && !priceInfo.isContact ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">
                <span>🏷️ Precio Fijo</span>
              </span>
            ) : null}

            {/* Estado especial: Por mensaje o Sin costo */}
            {priceInfo.isContact && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/15 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                <span>💬 Trato Directo</span>
              </span>
            )}

            {priceInfo.isFree && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                <span>🎁 ¡Sin Costo!</span>
              </span>
            )}
          </div>
        </div>

        {/* 3. Bloque de Especificaciones Clave (Condición, Cantidad de Unidades, Ubicación) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Condición / Estado Físico */}
          {product.condition && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Estado</div>
                <div className="text-xs font-bold text-white truncate">{product.condition}</div>
              </div>
            </div>
          )}

          {/* Cantidad disponible de unidades */}
          {(product.isSingleItem !== undefined || product.availableQuantity) && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
                <Boxes className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Disponibilidad</div>
                <div className="text-xs font-bold text-white truncate">
                  {product.isSingleItem
                    ? "Artículo único (1)"
                    : `${product.availableQuantity || 1} unidades`}
                </div>
              </div>
            </div>
          )}

          {/* Ubicación / Departamento */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Departamento</div>
              <div className="text-xs font-bold text-white truncate">
                {product.department || product.location || "San Salvador"}
              </div>
            </div>
          </div>

          {/* Fecha / Publicado */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Publicado</div>
              <div className="text-xs font-bold text-white truncate">{formatPublicationTime(product)}</div>
            </div>
          </div>
        </div>

        {/* 4. Preferencias y Métodos de Entrega (solo si aplica o se han seleccionado) */}
        {product.deliveryPreferences && product.deliveryPreferences.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-400" />
                <span>Preferencias de Entrega</span>
              </h3>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Disponibles
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {product.deliveryPreferences.map((prefId) => {
                const option = DELIVERY_OPTIONS.find((o) => o.id === prefId) || {
                  id: prefId,
                  label: prefId === "public_place" ? "Lugar Público" : prefId === "store_pickup" ? "Retiro en Local" : "Envío a Domicilio",
                  detail: "Coordinar directamente con el anunciante"
                };
                const IconComponent = DELIVERY_ICONS[prefId] || Package;

                return (
                  <div
                    key={prefId}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white leading-tight">
                        {option.label}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        {option.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Ubicación y Referencia Detallada */}
        {(product.exactLocation || product.location) && (
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-indigo-400" />
              <span>Ubicación y Referencia</span>
            </div>
            <p className="text-xs font-semibold text-slate-200">
              {product.exactLocation
                ? `${product.exactLocation}, ${product.department || "El Salvador"}`
                : product.location}
            </p>
            {product.exactLocation && product.department && (
              <p className="text-[11px] text-slate-400">
                Departamento: <span className="text-slate-300 font-semibold">{product.department}</span>
              </p>
            )}
          </div>
        )}

        {/* 6. Descripción Detallada */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Descripción del anuncio
          </h3>
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {product.description || "El vendedor no proporcionó una descripción adicional para este anuncio."}
            </p>
          </div>
        </div>

        {/* 7. Metadatos de la publicación */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 px-1 py-1">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>{product.viewsCount || 0} visualizaciones</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Publicado: {formatPublicationTime(product)}</span>
          </div>
        </div>

        {/* 8. Tarjeta del Vendedor (enlace directo a su perfil completo) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Publicado por
          </div>

          <Link
            to={`/seller/${encodeURIComponent(product.seller?.id || product.seller?.name || "vendedor")}${
              isFromChat
                ? `?from=chat${chatId ? `&chatId=${encodeURIComponent(chatId)}` : ""}`
                : `?from=product&productId=${encodeURIComponent(product.id)}`
            }`}
            state={{
              fromChat: isFromChat,
              chatPath: chatPath,
              chatId: chatId,
              fromProduct: !isFromChat,
              productPath: location.pathname + location.search,
              productId: product.id
            }}
            className="flex items-center justify-between gap-3 group active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={sellerAvatar}
                alt={sellerName}
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 group-hover:border-indigo-500 transition-colors flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                    {sellerName}
                  </span>
                  {isOwner && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      Tú
                    </span>
                  )}
                  {product.seller?.verified && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400 fill-blue-500/20 flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-slate-200">{product.seller?.rating || 5.0}</span>
                  <span>· {product.seller?.reviewsCount || 0} opiniones</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {product.seller?.verified && (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 whitespace-nowrap">
                  Verificado
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        </div>

        {/* 9. Botón de Acción Directa: Gestionar anuncio si es el dueño o Contactar al vendedor si es comprador */}
        <div className="pt-1 space-y-2">
          {isOwner ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const isFromProfile = Boolean(location.state?.fromProfile || location.state?.from === "/profile");
                  if (isFromProfile) {
                    navigate(`/manage-product/${product.id}?from=profile`, {
                      state: { from: "/profile", fromProfile: true, tab: "posts" }
                    });
                  } else {
                    // Si se gestiona desde el detalle de la publicación (Feed)
                    navigate(`/manage-product/${product.id}?from=product`, {
                      state: { from: `/product/${product.id}`, fromProduct: true, fromProfile: false }
                    });
                  }
                }}
                className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span>Gestionar anuncio</span>
              </button>
              <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 py-2 px-3 rounded-xl border border-indigo-500/20 text-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span>Esta es tu publicación · Puedes editarla, pausarla o eliminarla</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Botón de WhatsApp si está activado por el vendedor */}
              {isWhatsappActive && (
                <button
                  type="button"
                  onClick={handleWhatsappContact}
                  className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2.5"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                  <span>Contactar por WhatsApp</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                {/* Botón de Mensajería interna */}
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className={`flex-1 min-h-[48px] py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${
                    isWhatsappActive
                      ? "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800"
                      : "bg-gradient-to-r from-indigo-600 via-indigo-500 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-indigo-600/30"
                  }`}
                >
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span>{isWhatsappActive || isEmailActive ? "Mensaje interno" : "Enviar mensaje"}</span>
                </button>

                {/* Botón de Correo Electrónico si está activado por el vendedor */}
                {isEmailActive && (
                  <button
                    type="button"
                    onClick={handleEmailContact}
                    className="flex-1 min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-500/30 font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4.5 h-4.5" />
                    <span>Enviar correo</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Botón Destacar anuncio (visible en todos los anuncios, tanto de dueño como de terceros) */}
          <button
            type="button"
            onClick={() => navigate(`/promote-ad/${product.id}`, { state: { from: `/product/${product.id}` } })}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 hover:border-amber-400/70 text-amber-300 hover:text-amber-200 font-extrabold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4.5 h-4.5 text-amber-400 fill-amber-400" />
            <span>Destacar anuncio</span>
          </button>
        </div>

        {/* 10. Consejos de Seguridad para Compradores en El Salvador */}
        <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>Consejo de Seguridad AnunciosSV</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Acuerda siempre tus entregas en lugares públicos y transitados de El Salvador (centros comerciales, gasolineras o plazas). Nunca envíes dinero o transferencias por adelantado sin verificar el producto.
          </p>
        </div>
      </div>

      {/* Visualizador modal de imagen completa (Lightbox interactivo y suave) */}
      <PhotoCarouselModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setInteractiveDeploy({ isDeploying: false, progress: 0, offsetY: 0 });
        }}
        photos={imagesList}
        activeIndex={activeImageIndex}
        onSelectIndex={setActiveImageIndex}
        readOnly={true}
        title={product.title}
        sellerName={product.seller?.username || product.seller?.name || "usuario"}
        interactiveDeploy={interactiveDeploy}
      />
    </div>
  );
};

export default ProductDetailPage;
