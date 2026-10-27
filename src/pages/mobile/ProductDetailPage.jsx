// Detalle exhaustivo de una publicación de clasificado en AnunciosSV
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Share2,
  Heart,
  MapPin,
  Clock,
  Eye,
  CheckCircle2,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Package,
  Briefcase,
  Tag,
  Boxes,
  Store,
  Truck,
  ChevronLeft,
  ChevronRight,
  Star
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { MOCK_PRODUCTS, DELIVERY_OPTIONS } from "../../services/mockData";
import {
  getProductById,
  isProductFavorite,
  toggleFavoriteProduct,
  FAVORITES_EVENT
} from "../../services/productsService";

const DELIVERY_ICONS = {
  public_place: MapPin,
  pickup: Store,
  store_pickup: Store,
  shipping: Truck
};

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Obtener producto del servicio centralizado o fallback de mockData
  const product = getProductById(id) || MOCK_PRODUCTS.find((p) => String(p.id) === String(id)) || MOCK_PRODUCTS[0];

  // Galería de imágenes (soporta array de fotos múltiples o foto única)
  const imagesList = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.image || "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80"];

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Estado reactivo de favorito sincronizado globalmente
  const [isLiked, setIsLiked] = useState(() => isProductFavorite(product.id, currentUser));
  const [likesCount, setLikesCount] = useState(product.likesCount || 0);

  // Asegurar que la pantalla siempre aparezca en el tope con la portada primero
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

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

    window.addEventListener(FAVORITES_EVENT, handleFavUpdate);
    return () => window.removeEventListener(FAVORITES_EVENT, handleFavUpdate);
  }, [product.id, product.likesCount, currentUser]);

  const handleToggleFavorite = () => {
    const res = toggleFavoriteProduct(product.id, currentUser);
    setIsLiked(res.isFavorite);
    setLikesCount(res.likesCount);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Mira este anuncio en AnunciosSV: ${product.title}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      alert("Enlace copiado al portapapeles");
    }
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % imagesList.length);
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + imagesList.length) % imagesList.length);
  };

  const handleSendMessage = () => {
    alert(`La mensajería interna con ${product.seller?.name || "el vendedor"} estará disponible próximamente en AnunciosSV.`);
  };

  return (
    <div className="space-y-4 pb-8 animate-fade-in">
      {/* 1. Galería de Fotos Interactiva con Navegación y Miniaturas */}
      <div className="relative bg-slate-950">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
          <img
            src={imagesList[activeImageIndex]}
            alt={`${product.title} - Foto ${activeImageIndex + 1}`}
            className="w-full h-full object-cover transition-all duration-300"
          />

          {/* Badge de Anuncio Destacado */}
          {product.featured && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-lg z-10">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Destacado</span>
            </div>
          )}

          {/* Botones de acción flotantes sobre la foto (Favorito y Compartir) */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
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

            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartir publicación"
              className="p-2.5 rounded-full bg-slate-950/70 text-slate-200 hover:text-white hover:bg-slate-950/90 backdrop-blur-md transition-all active:scale-90 shadow-md"
            >
              <Share2 className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Flechas de navegación para múltiples fotos */}
          {imagesList.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label="Foto anterior"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950/90 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 shadow-md"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Foto siguiente"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950/90 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 shadow-md"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Indicador de fotos (ej: 1 / 4) */}
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-bold text-slate-200 border border-slate-800 shadow">
                {activeImageIndex + 1} / {imagesList.length} fotos
              </div>
            </>
          )}
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

        {/* Bloque de Precio y Condiciones */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Precio
            </div>
            <div className="flex items-baseline gap-2">
              {product.isFree ? (
                <span className="text-2xl font-black text-emerald-400 drop-shadow-sm">
                  GRATIS
                </span>
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    ${Number(product.price || 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {product.currency || "USD"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {product.isFree ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                ¡Sin costo!
              </span>
            ) : product.isNegotiable ? (
              <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                Precio Negociable
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">
                Precio Fijo
              </span>
            )}

            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
              <span>{likesCount} {likesCount === 1 ? "me gusta" : "me gusta"}</span>
            </div>
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
              <div className="text-xs font-bold text-white truncate">{product.createdAt || "Reciente"}</div>
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
            <span>Publicado: {product.createdAt || "Reciente"}</span>
          </div>
        </div>

        {/* 8. Tarjeta del Vendedor (enlace directo a su perfil completo) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Publicado por
            </span>
            <Link
              to={`/seller/${encodeURIComponent(product.seller?.id || product.seller?.name || "vendedor")}`}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>Ver perfil</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Link
            to={`/seller/${encodeURIComponent(product.seller?.id || product.seller?.name || "vendedor")}`}
            className="flex items-center justify-between gap-3 group active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={product.seller?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                alt={product.seller?.name || "Vendedor"}
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 group-hover:border-indigo-500 transition-colors flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                    {product.seller?.name || "Vendedor"}
                  </span>
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

        {/* 9. Botón de Acción Directa: Enviar mensaje interno */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleSendMessage}
            className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Enviar mensaje</span>
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
    </div>
  );
};

export default ProductDetailPage;
