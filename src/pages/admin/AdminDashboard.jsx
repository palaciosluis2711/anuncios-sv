// Dashboard principal de métricas y resumen de operaciones para el Webmaster
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MetricCard from "../../components/admin/MetricCard";
import {
  Users,
  ShoppingBag,
  ShieldAlert,
  DollarSign,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Eye,
  Inbox
} from "lucide-react";
import { MOCK_ADMIN_STATS, MOCK_USERS } from "../../services/mockData";
import { getStoredProducts } from "../../services/productsService";

export const AdminDashboard = () => {
  const [products, setProducts] = useState(() => getStoredProducts());

  useEffect(() => {
    setProducts(getStoredProducts());
  }, []);

  const pendingProducts = products.filter((p) => p.status === "pendiente");
  const approvedProducts = products.filter((p) => p.status === "aprobado");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado con bienvenida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Dashboard Webmaster
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Resumen global de actividad, moderación y rendimiento de la plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/moderation"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Cola de Moderación ({pendingProducts.length})</span>
          </Link>
        </div>
      </div>

      {/* Grid de KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Usuarios Registrados"
          value={MOCK_USERS.length.toLocaleString()}
          change="1 Webmaster activo"
          isPositive={true}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Anuncios Publicados"
          value={approvedProducts.length.toLocaleString()}
          change={approvedProducts.length === 0 ? "Sin publicaciones" : `${approvedProducts.length} activas`}
          isPositive={true}
          icon={ShoppingBag}
          color="emerald"
        />
        <MetricCard
          title="Pendientes de Revisión"
          value={pendingProducts.length}
          change={pendingProducts.length > 0 ? "Requiere acción inmediata" : "Al día"}
          isPositive={pendingProducts.length === 0}
          icon={ShieldAlert}
          color="amber"
        />
        <MetricCard
          title="Ingresos por Publicidad"
          value="$0.00 USD"
          change="0 transacciones"
          isPositive={true}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* Sección en 2 columnas: Moderación Urgente y Usuarios Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2 spans): Publicaciones pendientes */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Cola de Moderación Prioritaria
              </h3>
              <p className="text-xs text-slate-400">Anuncios enviados por la comunidad pendientes de revisión</p>
            </div>
            <Link
              to="/admin/moderation"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {pendingProducts.length === 0 ? (
              <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                <ShieldAlert className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-slate-300">No hay publicaciones pendientes de revisión</p>
                <p className="text-[11px] text-slate-500 mt-0.5">La cola de moderación está completamente al día.</p>
              </div>
            ) : (
              pendingProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={prod.image || (Array.isArray(prod.images) ? prod.images[0] : "") || "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80"}
                      alt={prod.title}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{prod.title}</h4>
                      <div className="text-xs font-medium text-indigo-400 mt-0.5">
                        ${Number(prod.price || 0).toFixed(2)} {prod.currency || "USD"} · <span className="text-slate-400">{prod.categoryName || prod.subcategoryName}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Por: {prod.seller?.name || "Vendedor"} · {prod.createdAt}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link
                      to="/admin/moderation"
                      className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold"
                    >
                      Revisar
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna Derecha (1 span): Usuarios Recientes y Estado */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Usuarios Registrados
            </h3>
            <Link
              to="/admin/users"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300"
            >
              Gestionar
            </Link>
          </div>

          <div className="space-y-3">
            {MOCK_USERS.map((user) => (
              <div
                key={user.id}
                className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700 flex-shrink-0"
                  />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white truncate">{user.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  user.status === "activo"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                }`}>
                  {user.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
