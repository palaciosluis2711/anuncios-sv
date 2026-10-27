// Detalle exhaustivo de una publicación de clasificado
import React from "react";
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
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { MOCK_PRODUCTS } from "../../services/mockData";
import { getProductById } from "../../services/productsService";

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const product = getProductById(id) || MOCK_PRODUCTS.find((p) => p.id === id) || MOCK_PRODUCTS[0];

  return (
    <div className="space-y-4 pb-4 animate-fade-in">
      {/* Imagen destacada */}
      <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover"
        />
        {product.featured && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-bold shadow-lg">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            Anuncio Destacado
          </div>
        )}
      </div>

      {/* Información principal */}
      <div className="px-4 space-y-3">
        {/* Precio y categoría */}
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-black text-white">
            ${Number(product.price).toLocaleString()}{" "}
            <span className="text-xs font-medium text-slate-400">{product.currency}</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            {product.categoryName}
          </span>
        </div>

        {/* Título */}
        <h1 className="text-lg font-bold text-white leading-snug">
          {product.title}
        </h1>

        {/* Metadatos */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            <span>{product.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{product.createdAt}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>{product.viewsCount} visualizaciones</span>
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Descripción del vendedor
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
            {product.description}
          </p>
        </div>

        {/* Tarjeta del Vendedor */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Publicado por
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={product.seller.avatar}
                alt={product.seller.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-700"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-white">{product.seller.name}</span>
                  {product.seller.verified && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400 fill-blue-500/20" />
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {product.seller.rating} ★ · {product.seller.reviewsCount} opiniones
                </div>
              </div>
            </div>

            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
              Vendedor Verificado
            </span>
          </div>
        </div>

        {/* Botones de acción directa (altura táctil estándar min-h-[48px]) */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={() => alert(`Iniciando chat con ${product.seller.name}`)}
            className="flex items-center justify-center gap-2 min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.99]"
          >
            <MessageCircle className="w-4.5 h-4.5" />
            <span>Contactar WhatsApp</span>
          </button>

          <button
            onClick={() => alert(`Llamada o mensaje interno enviado a ${product.seller.name}`)}
            className="flex items-center justify-center gap-2 min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.99]"
          >
            <PhoneCall className="w-4.5 h-4.5" />
            <span>Llamar Vendedor</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
