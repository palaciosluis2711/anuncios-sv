// Tarjeta de publicación en formato lista horizontal para el feed móvil
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Clock } from "lucide-react";
import { formatProductPrice } from "../../services/productsService";
import { PROFILE_UPDATED_EVENT } from "../../services/userProfileService";

const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_MAP = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
};

/**
 * Formatea una hora en formato limpio de 12 horas (ej. "04:30 PM")
 */
export const formatTime12h = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  let hours = dateObj.getHours();
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
};

/**
 * Formatea una fecha en formato corto (ej. "27 oct.")
 */
export const formatDateShort = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const day = dateObj.getDate();
  const month = MONTH_NAMES[dateObj.getMonth()];
  return `${day} ${month}.`;
};

/**
 * Formatea la fecha y hora de la publicación para mostrar siempre la fecha y la hora en formato 12 h (ej. "27 oct. · 04:30 PM")
 */
export const formatPublicationTime = (product) => {
  if (!product) return "Reciente";

  // 1. Si product.createdAt ya incluye fecha y hora en formato 12h (ej. "27 oct. · 04:30 PM")
  if (
    typeof product.createdAt === "string" &&
    /\d{1,2}:\d{2}\s*(?:AM|PM|a\.?\s*m\.?|p\.?\s*m\.?)/i.test(product.createdAt)
  ) {
    return product.createdAt.replace(/p\.?\s*m\.?/i, "PM").replace(/a\.?\s*m\.?/i, "AM");
  }

  const now = new Date();
  let dateObj = null;

  // 2. Extraer objeto Date desde timestamps o propiedades numéricas/ISO
  if (product.publishedTimestamp && !isNaN(Number(product.publishedTimestamp))) {
    dateObj = new Date(Number(product.publishedTimestamp));
  } else if (product.createdAtISO && !isNaN(new Date(product.createdAtISO).getTime())) {
    dateObj = new Date(product.createdAtISO);
  } else if (product.publishedAt) {
    if (typeof product.publishedAt.toDate === "function") {
      dateObj = product.publishedAt.toDate();
    } else if (!isNaN(new Date(product.publishedAt).getTime())) {
      dateObj = new Date(product.publishedAt);
    }
  } else if (product.createdAt && typeof product.createdAt === "object" && typeof product.createdAt.toDate === "function") {
    dateObj = product.createdAt.toDate();
  } else if (
    typeof product.id === "string" &&
    product.id.startsWith("prod-") &&
    !isNaN(Number(product.id.replace("prod-", "")))
  ) {
    const ts = Number(product.id.replace("prod-", ""));
    if (ts > 1600000000000 && ts < 2500000000000) {
      dateObj = new Date(ts);
    }
  } else if (
    typeof product.id === "string" &&
    product.id.startsWith("draft-") &&
    !isNaN(Number(product.id.replace("draft-", "")))
  ) {
    const ts = Number(product.id.replace("draft-", ""));
    if (ts > 1600000000000 && ts < 2500000000000) {
      dateObj = new Date(ts);
    }
  }

  // 3. Si aún no tenemos dateObj y product.createdAt es texto
  if (!dateObj && typeof product.createdAt === "string") {
    const str = product.createdAt.trim();

    // Mocks relativos: "Hace 2 horas", "Hace 5 horas", "Hace 1 día", etc.
    if (str.includes("Hace 2 horas")) {
      dateObj = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    } else if (str.includes("Hace 5 horas")) {
      dateObj = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    } else if (str.includes("Hace 1 día")) {
      dateObj = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (str.includes("Hace 2 días")) {
      dateObj = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    } else if (str.includes("Hace 3 días")) {
      dateObj = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    } else if (str.includes("Hace 4 días")) {
      dateObj = new Date(now.getTime() - 96 * 60 * 60 * 1000);
    } else if (str.includes("Hace un momento") || str === "Reciente") {
      dateObj = now;
    } else {
      // Intentar parsear formato fecha en texto tipo "27 oct.", "27 oct", "27 de octubre"
      const dateMatch = str.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)\.?(?:\s*(?:de\s+)?(\d{4}))?/i);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const monthKey = dateMatch[2].toLowerCase().slice(0, 3);
        const month = MONTH_MAP[monthKey] !== undefined ? MONTH_MAP[monthKey] : now.getMonth();
        const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
        dateObj = new Date(year, month, day, now.getHours(), now.getMinutes());
      } else {
        const parsedStandard = new Date(str);
        if (!isNaN(parsedStandard.getTime())) {
          dateObj = parsedStandard;
        }
      }
    }
  }

  // Si no se pudo determinar, usar la fecha y hora actual
  if (!dateObj || isNaN(dateObj.getTime())) {
    dateObj = now;
  }

  const datePart = formatDateShort(dateObj);
  const timePart = formatTime12h(dateObj);

  return `${datePart} · ${timePart}`;
};

export const ProductCard = ({ product }) => {
  const navigate = useNavigate();
  const [, setProfileRefreshTick] = useState(0);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setProfileRefreshTick((prev) => prev + 1);
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate);
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate);
    };
  }, []);

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  const priceInfo = formatProductPrice(product);

  return (
    <article
      onClick={handleCardClick}
      className={`group cursor-pointer relative bg-slate-900/90 hover:bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 ${
        product.featured
          ? "border-amber-500/40 bg-gradient-to-r from-amber-500/[0.05] via-slate-900/95 to-slate-900/90 shadow-md shadow-amber-500/5 hover:border-amber-500/60"
          : "border-slate-800/80 hover:border-slate-700/80 shadow-sm"
      }`}
    >
      <div className="flex p-3 gap-3 items-stretch">
        {/* Columna izquierda: Miniatura compacta del producto */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden bg-slate-950">
          <div className="block w-full h-full">
            <img
              src={product.image || (product.images && product.images[0]) || "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80"}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>

          {/* Badge de destacado en miniatura */}
          {product.featured && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[9px] font-black shadow-md pointer-events-none">
              <Sparkles className="w-2.5 h-2.5 fill-current" />
              <span>Destacado</span>
            </div>
          )}
        </div>

        {/* Columna derecha: Título, precio, descripción resumida y datos */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Fila superior: Categoría y Hora/Fecha de publicación */}
          <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-[10px] truncate max-w-[130px]">
              {product.categoryName || product.subcategoryName || "Clasificado"}
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-2.5 h-2.5 text-slate-500" />
              <span>{formatPublicationTime(product)}</span>
            </span>
          </div>

          {/* Título de la publicación */}
          <div className="block mt-1">
            <h3 className="font-bold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1 leading-snug">
              {product.title}
            </h3>
          </div>

          {/* Precio con formato estricto de dos decimales */}
          <div className="block my-0.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {priceInfo.isContact ? (
                <span className="text-xs font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30">
                  💬 A consultar
                </span>
              ) : priceInfo.isFree ? (
                <span className="text-emerald-400 font-extrabold text-sm sm:text-base">GRATIS</span>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-sm sm:text-base font-extrabold text-indigo-400 tracking-tight">
                    {priceInfo.text}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {priceInfo.currency}{priceInfo.periodSuffix}
                  </span>
                </div>
              )}
              {product.isNegotiable && !product.isFree && !product.isContactPrice && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  Negociable
                </span>
              )}
            </div>
          </div>

          {/* Descripción corta: para ver la descripción completa el usuario ingresa al detalle */}
          <div className="block mt-0.5">
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {product.description || "Toca para ver los detalles del anuncio..."}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
