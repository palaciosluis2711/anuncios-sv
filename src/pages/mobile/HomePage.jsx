// Página principal: Feed social de clasificados y productos/servicios
import React, { useState, useEffect, useMemo } from "react";
import ProductCard from "../../components/mobile/ProductCard";
import { CustomSelect } from "../../components/common/CustomSelect";
import { useAuth } from "../../context/AuthContext";
import {
  getStoredFeedPreferences,
  saveFeedPreferences,
  fetchUserFeedPreferencesFromFirestore
} from "../../services/feedPreferencesService";
import {
  EL_SALVADOR_DEPARTMENTS,
  PUBLICATION_HIERARCHY
} from "../../services/mockData";
import {
  getStoredProducts
} from "../../services/productsService";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  MapPin,
  Layers,
  Tag,
  RotateCcw
} from "lucide-react";

/**
 * Extrae el timestamp numérico representativo de la publicación para ordenamiento cronológico
 */
export const getProductTimestamp = (product) => {
  if (!product) return 0;

  // 1. Timestamp numérico directo
  if (product.publishedTimestamp && !isNaN(Number(product.publishedTimestamp))) {
    return Number(product.publishedTimestamp);
  }
  if (product.createdAtISO && !isNaN(new Date(product.createdAtISO).getTime())) {
    return new Date(product.createdAtISO).getTime();
  }
  if (product.publishedAt) {
    if (typeof product.publishedAt.toDate === "function") return product.publishedAt.toDate().getTime();
    const t = new Date(product.publishedAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (product.createdAt && typeof product.createdAt === "object" && typeof product.createdAt.toDate === "function") {
    return product.createdAt.toDate().getTime();
  }

  // 2. Timestamps basados en el ID (ej. "prod-1729000000000")
  if (typeof product.id === "string") {
    const cleanId = product.id.replace(/^(?:prod-|draft-)/, "");
    const numId = Number(cleanId);
    if (!isNaN(numId) && numId > 1600000000000 && numId < 2500000000000) {
      return numId;
    }
  }

  // 3. Parser de texto de createdAt ("Hace 2 horas", "Hace 1 día", etc.)
  if (typeof product.createdAt === "string") {
    const str = product.createdAt.trim();
    const now = Date.now();
    if (str.includes("Hace 2 horas")) return now - 2 * 60 * 60 * 1000;
    if (str.includes("Hace 5 horas")) return now - 5 * 60 * 60 * 1000;
    if (str.includes("Hace 1 día")) return now - 24 * 60 * 60 * 1000;
    if (str.includes("Hace 2 días")) return now - 48 * 60 * 60 * 1000;
    if (str.includes("Hace 3 días")) return now - 72 * 60 * 60 * 1000;
    if (str.includes("Hace 4 días")) return now - 96 * 60 * 60 * 1000;
    if (str.includes("Hace un momento") || str === "Reciente") return now;

    const parsed = new Date(str).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  return 0;
};

/**
 * Obtiene el timestamp en el que fue promocionada o destacada la publicación
 */
export const getFeaturedTimestamp = (product) => {
  if (!product) return 0;
  if (product.featuredTimestamp && !isNaN(Number(product.featuredTimestamp))) {
    return Number(product.featuredTimestamp);
  }
  if (product.promotedAt && !isNaN(Number(product.promotedAt))) {
    return Number(product.promotedAt);
  }
  return getProductTimestamp(product);
};

/**
 * Organiza las publicaciones del feed según las reglas estrictas de la plataforma:
 * 1. Filtra únicamente publicaciones aprobadas y activas (excluye borradores y pausadas).
 * 2. Bloque Superior (Destacadas): Las publicaciones destacadas se ubican siempre al inicio del feed,
 *    ordenadas cronológicamente de la que fue promocionada primero (superior) a la que fue promocionada después (debajo).
 * 3. Bloque Inferior (Normales): Las publicaciones regulares se ubican a continuación de las destacadas,
 *    ordenadas por la más reciente primero y las más antiguas al final.
 */
export const organizeFeedProducts = (productsList) => {
  if (!Array.isArray(productsList)) return [];

  // Filtrar exclusivamente anuncios aprobados (excluye borradores y pausados del feed público)
  const approvedOnly = productsList.filter(
    (p) => p && (p.status === "aprobado" || !p.status) && p.status !== "borrador" && p.status !== "pausado"
  );

  // Separar publicaciones destacadas y normales
  const featuredItems = approvedOnly.filter((p) => Boolean(p.featured));
  const normalItems = approvedOnly.filter((p) => !p.featured);

  // Ordenar destacadas: la promocionada primero arriba, la que fue promocionada después debajo
  // (orden cronológico ascendente por fecha de promoción)
  featuredItems.sort((a, b) => getFeaturedTimestamp(a) - getFeaturedTimestamp(b));

  // Ordenar normales: la más reciente primero y las más antiguas al final
  // (orden cronológico descendente por fecha de publicación)
  normalItems.sort((a, b) => getProductTimestamp(b) - getProductTimestamp(a));

  // Retornar lista unificada: primero destacadas y luego normales
  return [...featuredItems, ...normalItems];
};

const PAGE_SIZE = 6; // Cantidad de anuncios que se cargan progresivamente por tanda

export const HomePage = () => {
  const { currentUser } = useAuth() || {};
  const [products, setProducts] = useState(() => organizeFeedProducts(getStoredProducts()));

  // Inicializar estado de filtros a partir de las preferencias persistentes del usuario (aisladas por usuario)
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    return getStoredFeedPreferences(currentUser).department;
  });
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return getStoredFeedPreferences(currentUser).category;
  });
  const [selectedSubcategory, setSelectedSubcategory] = useState(() => {
    return getStoredFeedPreferences(currentUser).subcategory;
  });

  // Retener al usuario en el Feed principal ante el gesto táctil de retorno del dispositivo
  useEffect(() => {
    const handlePopState = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Efecto para recargar filtros cuando cambie de usuario (inicio de sesión, cambio de cuenta o logout)
  // y sincronizar en segundo plano con Firestore si el usuario está autenticado
  useEffect(() => {
    const localPrefs = getStoredFeedPreferences(currentUser);
    setSelectedDepartment(localPrefs.department);
    setSelectedCategory(localPrefs.category);
    setSelectedSubcategory(localPrefs.subcategory);

    let isMounted = true;
    if (currentUser) {
      fetchUserFeedPreferencesFromFirestore(currentUser).then((cloudPrefs) => {
        if (isMounted && cloudPrefs) {
          setSelectedDepartment(cloudPrefs.department);
          setSelectedCategory(cloudPrefs.category);
          setSelectedSubcategory(cloudPrefs.subcategory);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Opciones para el selector CustomSelect de departamentos
  const departmentOptions = useMemo(() => [
    { id: "all", name: "📍 Todos los departamentos" },
    ...EL_SALVADOR_DEPARTMENTS.map((dept) => ({ id: dept, name: dept }))
  ], []);

  // Opciones para el selector CustomSelect de categorías
  const categoryOptions = useMemo(() => [
    { id: "all", name: "Todas las categorías" },
    ...PUBLICATION_HIERARCHY.map((cat) => ({ id: cat.id, name: cat.name }))
  ], []);

  // Opciones reactivas para el selector CustomSelect de subcategorías
  const subcategoryOptions = useMemo(() => {
    let subs = [];
    if (selectedCategory === "all") {
      subs = PUBLICATION_HIERARCHY.flatMap((cat) => cat.subcategories);
    } else {
      const currentGroup = PUBLICATION_HIERARCHY.find((cat) => cat.id === selectedCategory);
      subs = currentGroup?.subcategories || [];
    }
    return [
      { id: "all", name: "Todas las subcategorías" },
      ...subs.map((s) => ({ id: s.id, name: s.name }))
    ];
  }, [selectedCategory]);

  const handleDepartmentChange = (deptId) => {
    setSelectedDepartment(deptId);
    saveFeedPreferences(currentUser, {
      department: deptId,
      category: selectedCategory,
      subcategory: selectedSubcategory
    });
  };

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    setSelectedSubcategory("all");
    saveFeedPreferences(currentUser, {
      department: selectedDepartment,
      category: catId,
      subcategory: "all"
    });
  };

  const handleSubcategoryChange = (subId) => {
    setSelectedSubcategory(subId);
    saveFeedPreferences(currentUser, {
      department: selectedDepartment,
      category: selectedCategory,
      subcategory: subId
    });
  };

  const handleResetFilters = () => {
    setSelectedDepartment("all");
    setSelectedCategory("all");
    setSelectedSubcategory("all");
    saveFeedPreferences(currentUser, {
      department: "all",
      category: "all",
      subcategory: "all"
    });
  };

  const hasActiveFilters =
    selectedDepartment !== "all" ||
    selectedCategory !== "all" ||
    selectedSubcategory !== "all";

  // Control de paginación e infinite scroll
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Sincronizar en tiempo real cuando se publica o modifica un anuncio
  useEffect(() => {
    const handleUpdate = () => {
      const refreshed = getStoredProducts();
      setProducts(organizeFeedProducts(refreshed));
    };
    window.addEventListener("anunciossv_products_updated", handleUpdate);
    return () => window.removeEventListener("anunciossv_products_updated", handleUpdate);
  }, []);

  // Reiniciar cantidad visible al cambiar de departamento, categoría o subcategoría
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedDepartment, selectedCategory, selectedSubcategory]);

  // Filtrado reactivo de publicaciones según departamento, categoría y subcategoría
  const filteredProducts = products.filter((product) => {
    // Solo mostrar productos aprobados en el feed público
    if (product.status && product.status !== "aprobado") return false;

    // 1. Filtro por Departamento
    const matchesDepartment =
      selectedDepartment === "all" ||
      (product.department && product.department.toLowerCase() === selectedDepartment.toLowerCase()) ||
      (product.location && product.location.toLowerCase().includes(selectedDepartment.toLowerCase()));

    // 2. Filtro por Categoría Principal
    const matchesCategory =
      selectedCategory === "all" ||
      product.mainCategory === selectedCategory ||
      (selectedCategory === "producto" && (!product.mainCategory || product.mainCategory === "producto")) ||
      (selectedCategory === "servicio" && product.mainCategory === "servicio") ||
      (selectedCategory === "alquiler" && product.mainCategory === "alquiler") ||
      product.category === selectedCategory;

    // 3. Filtro por Subcategoría
    const matchesSubcategory =
      selectedSubcategory === "all" ||
      product.subcategory === selectedSubcategory ||
      product.category === selectedSubcategory;

    return (
      matchesDepartment &&
      matchesCategory &&
      matchesSubcategory
    );
  });

  // Publicaciones actualmente visibles en pantalla
  const displayedProducts = filteredProducts.slice(0, visibleCount);
  const hasMoreToLoad = visibleCount < filteredProducts.length;

  // Carga progresiva al deslizar hacia arriba al llegar al final
  const handleLoadMore = () => {
    if (isLoadingMore || !hasMoreToLoad) return;
    setIsLoadingMore(true);

    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredProducts.length));
      setIsLoadingMore(false);
    }, 600);
  };

  // Detección de scroll para cargar más publicaciones al llegar al final
  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingMore || !hasMoreToLoad) return;
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (scrollY + windowHeight >= docHeight - 160) {
        handleLoadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLoadingMore, hasMoreToLoad, filteredProducts.length]);

  return (
    <div className="space-y-4 px-4 py-3 min-h-screen relative">
      {/* Filtros avanzados en cascada: 1. Departamento -> 2. Categoría -> 3. Subcategoría con CustomSelect idéntico al formulario */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 space-y-3 shadow-sm">
        {/* 1. Departamento (Combobox con opción "Todos") */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Departamento</span>
            </label>
            {selectedDepartment !== "all" && (
              <button
                type="button"
                onClick={() => handleDepartmentChange("all")}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Limpiar
              </button>
            )}
          </div>
          <CustomSelect
            value={selectedDepartment}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder="Seleccionar departamento"
          />
        </div>

        {/* 2. Categoría y 3. Subcategoría */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2.5">
          {/* Categoría */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Categoría</span>
              </label>
              {selectedCategory !== "all" && (
                <button
                  type="button"
                  onClick={() => handleCategoryChange("all")}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Limpiar
                </button>
              )}
            </div>
            <CustomSelect
              value={selectedCategory}
              onChange={handleCategoryChange}
              options={categoryOptions}
              placeholder="Seleccionar categoría"
            />
          </div>

          {/* Subcategoría */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>Subcategoría</span>
              </label>
              {selectedSubcategory !== "all" && (
                <button
                  type="button"
                  onClick={() => handleSubcategoryChange("all")}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Limpiar
                </button>
              )}
            </div>
            <CustomSelect
              value={selectedSubcategory}
              onChange={handleSubcategoryChange}
              options={subcategoryOptions}
              placeholder="Seleccionar subcategoría"
            />
          </div>
        </div>

        {/* Resumen de filtros aplicados y botón para restablecer */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 text-[11px] truncate max-w-[220px]">
              Filtro activo:{" "}
              <strong className="text-indigo-300">
                {selectedDepartment !== "all" ? selectedDepartment : "Todo el país"}
                {selectedCategory !== "all" ? ` · ${PUBLICATION_HIERARCHY.find((c) => c.id === selectedCategory)?.name}` : ""}
                {selectedSubcategory !== "all" ? ` · ${subcategoryOptions.find((s) => s.id === selectedSubcategory)?.name}` : ""}
              </strong>
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] flex items-center gap-1 flex-shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Restablecer
            </button>
          </div>
        )}
      </div>

      {/* Encabezado del catálogo de publicaciones */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Publicaciones ({filteredProducts.length})
        </div>
      </div>

      {/* Lista de tarjetas del feed con carga progresiva */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-900/50 rounded-2xl border border-slate-800">
          <div className="text-3xl mb-2">🔍</div>
          <h3 className="text-sm font-bold text-white">No se encontraron publicaciones</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Prueba ajustando el término de búsqueda o seleccionando otra categoría.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-4 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            Restablecer todos los filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}

          {/* Indicador de carga cuando el usuario se desplaza hacia arriba al final del feed */}
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 py-5 text-xs text-indigo-300 font-semibold animate-fade-in">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Cargando más publicaciones...</span>
            </div>
          )}

          {/* Mensaje al llegar al final del catálogo: cuando no hay más publicaciones disponibles */}
          {!hasMoreToLoad && filteredProducts.length > 0 && (
            <div className="text-center py-6 px-4 animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                <span>No hay nuevas publicaciones disponibles</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomePage;

