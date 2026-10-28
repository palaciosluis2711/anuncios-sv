// Vista completa de perfil público y publicaciones de un vendedor en AnunciosSV
import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  User,
  CheckCircle2,
  Star,
  MapPin,
  MessageCircle,
  Package,
  Sparkles,
  Heart,
  ExternalLink,
  ShieldCheck,
  Share2
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getSellerInfo,
  getProductsBySellerId,
  isProductFavorite,
  toggleFavoriteProduct,
  formatProductPrice,
  FAVORITES_EVENT
} from "../../services/productsService";
import { PROFILE_UPDATED_EVENT } from "../../services/userProfileService";
import { getOrCreateConversation } from "../../services/chatService";

export const SellerProfilePage = () => {
  const { sellerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentUser, requireAuth } = useAuth();

  // Control de retorno y procedencia desde el chat
  const isFromChat = Boolean(
    location.state?.fromChat ||
    searchParams.get("from") === "chat" ||
    searchParams.get("fromChat") === "true"
  );
  const chatId = location.state?.chatId || searchParams.get("chatId") || "";
  const chatPath = location.state?.chatPath || (chatId ? `/messages/${chatId}` : "/messages");

  const [seller, setSeller] = useState(() => getSellerInfo(sellerId));
  const [sellerProducts, setSellerProducts] = useState(() => getProductsBySellerId(sellerId));

  // Referencias para detección de gesto táctil de retroceso (Swipe back)
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

    // Gesto de swipe hacia la derecha desde el margen izquierdo (retroceso táctil fluido)
    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && touchStartXRef.current < 120) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/", { replace: true });
      }
    }
  };

  // Asegurar que siempre se muestre la parte superior al ingresar al perfil
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [sellerId]);

  // Actualizar datos si cambian las publicaciones o favoritos
  useEffect(() => {
    setSeller(getSellerInfo(sellerId));
    setSellerProducts(getProductsBySellerId(sellerId));

    const handleUpdate = () => {
      setSeller(getSellerInfo(sellerId));
      setSellerProducts(getProductsBySellerId(sellerId));
    };

    window.addEventListener("anunciossv_products_updated", handleUpdate);
    window.addEventListener(FAVORITES_EVENT, handleUpdate);
    window.addEventListener(PROFILE_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener("anunciossv_products_updated", handleUpdate);
      window.removeEventListener(FAVORITES_EVENT, handleUpdate);
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleUpdate);
    };
  }, [sellerId]);

  const handleSendMessage = () => {
    // Requerir inicio de sesión para contactar al vendedor
    requireAuth(
      () => {
        try {
          const conv = getOrCreateConversation({
            currentUser,
            recipient: seller
          });
          navigate(`/messages/${conv.id}`);
        } catch (err) {
          alert("Error al iniciar la conversación: " + err.message);
        }
      },
      {
        actionType: "message",
        title: "¿Contactar al vendedor?",
        message: `Inicia sesión para comunicarte directamente con ${seller?.name || "el vendedor"} y gestionar tus mensajes.`
      }
    );
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Perfil de ${seller?.name} en AnunciosSV`,
        text: `Conoce las publicaciones de ${seller?.name} en AnunciosSV`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      alert("Enlace del perfil copiado al portapapeles");
    }
  };

  const totalLikes = sellerProducts.reduce((acc, p) => acc + (Number(p.likesCount) || 0), 0);

  if (!seller) {
    return (
      <div className="p-6 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Vendedor no encontrado</h2>
        <p className="text-xs text-slate-400">El perfil que buscas no existe o ya no tiene publicaciones activas.</p>
        <button
          onClick={() => navigate("/", { replace: true })}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-4 px-4 py-3 pb-8 animate-fade-in"
    >
      {/* 1. Tarjeta de Cabecera del Vendedor */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src={seller.avatar}
                alt={seller.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-lg"
              />
              {seller.verified && (
                <div className="absolute -bottom-1 -right-1 p-0.5 bg-slate-950 rounded-full">
                  <CheckCircle2 className="w-4.5 h-4.5 text-blue-400 fill-blue-500/20" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-white truncate">{seller.name}</h1>
              </div>
              <div className="text-xs text-slate-400 truncate font-medium">{seller.username}</div>

              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span className="font-bold text-slate-100">{seller.rating}</span>
                <span className="text-slate-400">({seller.reviewsCount} opiniones)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition-all active:scale-95"
            title="Compartir perfil"
            aria-label="Compartir perfil"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Insignia de verificación y ubicación */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="truncate">{seller.location}</span>
          </div>

          {seller.verified ? (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Vendedor Verificado</span>
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Vendedor Registrado
            </span>
          )}
        </div>

        {/* Resumen de actividad / Métricas del Vendedor */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-center">
          <div>
            <div className="text-sm font-bold text-white">{sellerProducts.length}</div>
            <div className="text-[10px] text-slate-400 font-medium">Anuncios</div>
          </div>
          <div>
            <div className="text-sm font-bold text-white">{seller.rating} ★</div>
            <div className="text-[10px] text-slate-400 font-medium">Reputación</div>
          </div>
          <div>
            <div className="text-sm font-bold text-white">{totalLikes}</div>
            <div className="text-[10px] text-slate-400 font-medium">Me Gusta</div>
          </div>
        </div>
      </div>

      {/* 2. Botón de Acción Principal: Enviar mensaje al vendedor (Oculto si se mira desde el chat) */}
      {!isFromChat && (
        <button
          type="button"
          onClick={handleSendMessage}
          className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          <span>Enviar mensaje a {seller.name}</span>
        </button>
      )}

      {/* 3. Lista de Publicaciones del Vendedor */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-indigo-400" />
            <span>Publicaciones Activas ({sellerProducts.length})</span>
          </h2>
        </div>

        {sellerProducts.length > 0 ? (
          <div className="space-y-2.5">
            {sellerProducts.map((prod) => {
              const isFav = isProductFavorite(prod.id, currentUser);
              const productDetailLink = `/product/${prod.id}?from=seller${isFromChat ? "&fromChat=true" : ""}${chatId ? `&chatId=${encodeURIComponent(chatId)}` : ""}&sellerId=${encodeURIComponent(sellerId)}`;
              const productDetailState = {
                fromSeller: true,
                sellerPath: location.pathname + location.search,
                sellerId: sellerId,
                fromChat: isFromChat,
                chatPath: chatPath,
                chatId: chatId
              };

              return (
                <div
                  key={prod.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-all"
                >
                  <Link
                    to={productDetailLink}
                    state={productDetailState}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0 block"
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
                    <Link to={productDetailLink} state={productDetailState} className="block">
                      <h3 className="text-xs font-bold text-white truncate hover:text-indigo-300 transition-colors">
                        {prod.title}
                      </h3>
                    </Link>

                    <div className="text-xs font-semibold text-indigo-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const priceInfo = formatProductPrice(prod);
                        if (priceInfo.isContact) {
                          return (
                            <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-500/30">
                              💬 A consultar
                            </span>
                          );
                        }
                        if (priceInfo.isFree) {
                          return <span className="text-emerald-400 font-bold">GRATIS</span>;
                        }
                        return (
                          <span>
                            {priceInfo.text} {priceInfo.currency}{priceInfo.periodSuffix}
                          </span>
                        );
                      })()}
                      {prod.isNegotiable && !prod.isFree && !prod.isContactPrice && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                          Negociable
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="truncate max-w-[130px]">{prod.location}</span>
                      {prod.condition && <span>· {prod.condition}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        requireAuth(
                          () => {
                            toggleFavoriteProduct(prod.id, currentUser);
                          },
                          {
                            actionType: "like",
                            title: "¿Guardar en tus favoritos?",
                            message: "Inicia sesión para poder guardar este anuncio en tus favoritos y consultarlo cuando quieras."
                          }
                        );
                      }}
                      className={`p-2 rounded-xl transition-all active:scale-95 ${
                        isFav
                          ? "bg-rose-500 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-rose-400"
                      }`}
                      title={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}
                      aria-label="Favorito"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
                    </button>

                    <Link
                      to={productDetailLink}
                      state={productDetailState}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Ver anuncio"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
            <Package className="w-8 h-8 mx-auto text-slate-500" />
            <h4 className="font-bold text-white text-sm">Sin publicaciones disponibles</h4>
            <p>Este vendedor no cuenta con anuncios activos en este momento.</p>
          </div>
        )}
      </div>

      {/* 4. Garantía y Confianza */}
      <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-300 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-indigo-400">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Comercio Seguro en AnunciosSV</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Toda la comunicación de compra y venta se mantendrá de forma interna y privada. Acuerda entregas en lugares públicos para mayor tranquilidad.
        </p>
      </div>
    </div>
  );
};

export default SellerProfilePage;

