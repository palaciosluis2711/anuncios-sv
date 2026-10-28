// Página de Exploración y Categorías
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Laptop,
  Car,
  Home,
  Briefcase,
  Armchair,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { MOCK_CATEGORIES } from "../../services/mockData";
import { getStoredProducts } from "../../services/productsService";
import ProductCard from "../../components/mobile/ProductCard";

export const ExplorePage = () => {
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState(null);
  const allProducts = getStoredProducts();

  // Interceptar el gesto táctil del sistema hacia atrás para retornar siempre al Feed principal
  useEffect(() => {
    const handlePopState = () => {
      navigate("/", { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  const iconMap = {
    Laptop: Laptop,
    Car: Car,
    Home: Home,
    Briefcase: Briefcase,
    Armchair: Armchair,
    Sparkles: Sparkles
  };

  const trendingTags = [
    "iPhone 15",
    "Alquiler Madrid",
    "Honda Civic",
    "Desarrollador React",
    "Cámara Sony",
    "MacBook M2"
  ];

  // Listado filtrado si se seleccionó una categoría
  const activeProducts = selectedCat
    ? allProducts.filter(
        (p) =>
          (p.category === selectedCat.id || p.mainCategory === selectedCat.id) &&
          (p.status === "aprobado" || !p.status)
      )
    : [];

  return (
    <div className="space-y-5 px-4 py-3">
      {/* Encabezado de la vista */}
      <div>
        <h2 className="text-lg font-extrabold text-white tracking-tight">Explorar AnunciosSV</h2>
        <p className="text-xs text-slate-400">Descubre clasificados organizados por rubro y tendencias</p>
      </div>

      {/* Tendencias populares */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-pink-400" />
          Búsquedas en Tendencia
        </div>
        <div className="flex flex-wrap gap-1.5">
          {trendingTags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Grid de Categorías Principales */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Categorías Destacadas
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {MOCK_CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
            const Icon = iconMap[cat.icon] || Sparkles;
            const isSelected = selectedCat?.id === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(isSelected ? null : cat)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                  isSelected
                    ? "bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/20"
                    : "bg-slate-900/90 border-slate-800/90 hover:border-slate-700"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform text-indigo-400">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors">
                  {cat.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {cat.count} anuncios activos
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vista de resultados si se selecciona categoría */}
      {selectedCat && (
        <div className="pt-2 border-t border-slate-800 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Anuncios en {selectedCat.name}</span>
              <span className="text-xs font-normal text-slate-400">({activeProducts.length})</span>
            </h3>
            <button
              onClick={() => setSelectedCat(null)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Cerrar filtro
            </button>
          </div>

          <div className="space-y-3">
            {activeProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/60 rounded-xl">
                No hay más anuncios en esta categoría por ahora.
              </div>
            ) : (
              activeProducts.map((p) => <ProductCard key={p.id} product={p} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplorePage;
