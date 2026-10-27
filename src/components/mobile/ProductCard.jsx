// Tarjeta de publicación de producto/servicio optimizada para el feed móvil
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, CheckCircle2, Eye, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isProductFavorite, toggleFavoriteProduct, FAVORITES_EVENT } from "../../services/productsService";

export const ProductCard = ({ product }) => {
  const { currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(() => isProductFavorite(product.id, currentUser));
  const [likesCount, setLikesCount] = useState(product.likesCount || 0);

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

  const toggleLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleFavoriteProduct(product.id, currentUser);
    setIsLiked(result.isFavorite);
    setLikesCount(result.likesCount);
  };

  return (
    <article className="group bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg hover:border-slate-700/80 transition-all duration-300">
      {/* Cabecera del vendedor estilo Red Social */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src={product.seller?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
            alt={product.seller?.name || "Vendedor"}
            className="w-8 h-8 rounded-full object-cover border border-slate-700"
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-200">{product.seller?.name || "Usuario"}</span>
              {product.seller?.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-500/20" />
              )}
            </div>
            <span className="text-[10px] text-slate-400">{product.createdAt || "Reciente"}</span>
          </div>
        </div>

        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          {product.categoryName || product.subcategoryName || "Clasificado"}
        </span>
      </div>

      {/* Imagen del producto */}
      <Link to={`/product/${product.id}`} className="block relative aspect-[4/3] overflow-hidden bg-slate-950">
        <img
          src={product.image || (product.images && product.images[0]) || "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80"}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Badge de destacado */}
        {product.featured && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black shadow-md">
            <Sparkles className="w-3 h-3 fill-current" />
            Destacado
          </div>
        )}

        {/* Botón flotante de Me Gusta */}
        <button
          type="button"
          onClick={toggleLike}
          aria-label={isLiked ? "Quitar de favoritos" : "Guardar en favoritos"}
          className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all active:scale-90 z-10 ${
            isLiked
              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-400/30"
              : "bg-slate-950/60 text-slate-200 hover:text-white hover:bg-slate-950/80"
          }`}
        >
          <Heart className={`w-4 h-4 transition-transform ${isLiked ? "fill-white scale-105" : ""}`} />
        </button>

        {/* Barra inferior de la foto con precio */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-3 pt-6 flex items-end justify-between">
          <div>
            <div className="text-xl font-extrabold text-white tracking-tight drop-shadow-md flex items-center gap-1.5">
              {product.isFree ? (
                <span className="text-emerald-400 font-black">GRATIS</span>
              ) : (
                <>
                  <span>${Number(product.price || 0).toLocaleString()}</span>
                  <span className="text-xs font-normal text-slate-300">{product.currency || "USD"}</span>
                </>
              )}
              {product.isNegotiable && !product.isFree && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/40 text-indigo-200 font-bold border border-indigo-400/30">
                  Negociable
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300 bg-slate-950/60 backdrop-blur-sm px-2 py-0.5 rounded-md">
            <MapPin className="w-3 h-3 text-indigo-400" />
            <span className="truncate max-w-[130px]">{product.location}</span>
          </div>
        </div>
      </Link>

      {/* Contenido / Título y descripción */}
      <div className="p-3">
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1 mb-1">
            {product.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
            {product.description}
          </p>
        </Link>

        {/* Pie de tarjeta con interacción */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "text-rose-500 fill-rose-500" : "text-slate-400"}`} />
              <span className="text-[11px] font-medium">{likesCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-medium">{product.viewsCount}</span>
            </span>
          </div>

          <Link
            to={`/product/${product.id}`}
            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
          >
            Ver detalle →
          </Link>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
