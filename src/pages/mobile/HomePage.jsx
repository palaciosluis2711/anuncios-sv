// Página principal: Feed social de clasificados y productos/servicios
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../../components/mobile/ProductCard";
import { MOCK_CATEGORIES, MOCK_ADS } from "../../services/mockData";
import { getStoredProducts } from "../../services/productsService";
import { Search, Sparkles, Filter, Megaphone, ArrowRight } from "lucide-react";

export const HomePage = () => {
  const [products, setProducts] = useState(() => getStoredProducts());
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFeaturedOnly, setFilterFeaturedOnly] = useState(false);

  // Sincronizar en tiempo real cuando se publica un nuevo anuncio
  useEffect(() => {
    const handleUpdate = () => {
      setProducts(getStoredProducts());
    };
    window.addEventListener("anunciossv_products_updated", handleUpdate);
    return () => window.removeEventListener("anunciossv_products_updated", handleUpdate);
  }, []);

  // Filtrado reactivo de publicaciones (mostrando las más recientes al principio)
  const filteredProducts = products.filter((product) => {
    // Solo mostrar productos aprobados en el feed público
    if (product.status && product.status !== "aprobado") return false;

    const matchesCategory =
      selectedCategory === "all" ||
      product.category === selectedCategory ||
      product.mainCategory === selectedCategory;

    const matchesSearch =
      (product.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.location || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFeatured = !filterFeaturedOnly || Boolean(product.featured);

    return matchesCategory && matchesSearch && matchesFeatured;
  });

  const featuredAd = MOCK_ADS[0];

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Barra de búsqueda interactiva (altura estándar móvil min-h-[48px]) */}
      <div className="relative">
        <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar autos, casas, iPhones, servicios..."
          className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-slate-400 hover:text-white"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Categorías con scroll horizontal (Historias/Chips) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Categorías
          </span>
          <Link to="/explore" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
            Ver todas
          </Link>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
          {MOCK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 min-h-[36px] rounded-full text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros rápidos: Todos vs Destacados */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Publicaciones Recientes ({filteredProducts.length})
        </div>

        <button
          onClick={() => setFilterFeaturedOnly(!filterFeaturedOnly)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 min-h-[34px] rounded-lg transition-all ${
            filterFeaturedOnly
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          {filterFeaturedOnly ? "Solo Destacados" : "Todos"}
        </button>
      </div>

      {/* Banner publicitario integrado en el feed */}
      {featuredAd && (
        <aside aria-label="Publicidad patrocinada" className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 p-3.5 shadow-lg">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
            <Megaphone className="w-3 h-3" />
            Patrocinado · {featuredAd.advertiser}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white line-clamp-1">{featuredAd.title}</h4>
              <p className="text-[11px] text-slate-300 mt-0.5">Aprovecha descuentos de temporada para usuarios de la comunidad.</p>
            </div>
            <a
              href={featuredAd.link}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-md transition-colors"
            >
              <span>Ver más</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </aside>
      )}

      {/* Lista de tarjetas del feed */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-900/50 rounded-2xl border border-slate-800">
          <div className="text-3xl mb-2">🔍</div>
          <h3 className="text-sm font-bold text-white">No se encontraron publicaciones</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Prueba ajustando el término de búsqueda o seleccionando otra categoría.
          </p>
          <button
            onClick={() => {
              setSelectedCategory("all");
              setSearchQuery("");
              setFilterFeaturedOnly(false);
            }}
            className="mt-4 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;
