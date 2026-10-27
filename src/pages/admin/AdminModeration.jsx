// Módulo de Moderación de Anuncios y Control de Calidad
import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Filter,
  Check,
  UserX,
  Clock
} from "lucide-react";
import { MOCK_PRODUCTS } from "../../services/mockData";

export const AdminModeration = () => {
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [filterStatus, setFilterStatus] = useState("pendiente"); // "todos" | "pendiente" | "aprobado" | "rechazado"

  // Acciones de moderación interactivas
  const handleUpdateStatus = (id, newStatus) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  const filtered = products.filter((p) => {
    if (filterStatus === "todos") return true;
    return p.status === filterStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            Moderación de Anuncios
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Revisa, aprueba o descarta publicaciones para mantener la calidad y seguridad en la comunidad.
          </p>
        </div>

        {/* Filtros por pestaña de estado */}
        <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
          {[
            { id: "pendiente", label: "Pendientes", color: "text-amber-400" },
            { id: "aprobado", label: "Aprobados", color: "text-emerald-400" },
            { id: "rechazado", label: "Rechazados", color: "text-red-400" },
            { id: "todos", label: "Todos", color: "text-slate-300" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === tab.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de tarjetas de moderación */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">¡No hay anuncios con este filtro!</h3>
          <p className="text-xs text-slate-400 mt-1">La cola de revisión se encuentra al día.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between"
            >
              <div>
                {/* Cabecera del ítem */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={item.seller.avatar}
                      alt={item.seller.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">{item.seller.name}</div>
                      <div className="text-[10px] text-slate-400">{item.createdAt}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      item.status === "aprobado"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : item.status === "pendiente"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Previsualización del anuncio */}
                <div className="flex gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-3">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                    <div className="text-xs font-semibold text-indigo-400 mt-0.5">
                      ${item.price} {item.currency} · <span className="text-slate-400">{item.categoryName}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de acción del Webmaster */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ID: {item.id}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus(item.id, "rechazado")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(item.id, "aprobado")}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminModeration;
