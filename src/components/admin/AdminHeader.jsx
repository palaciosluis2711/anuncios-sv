// Barra superior para el panel de administración
import React from "react";
import { Link } from "react-router-dom";
import { Menu, Search, Bell, ExternalLink, Database } from "lucide-react";
import { isFirebaseConfigured } from "../../services/firebase";

export const AdminHeader = ({ setIsMobileOpen }) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between">
      {/* Lado izquierdo: Botón responsive + Título */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-bold text-white tracking-tight">Centro de Control</h1>
          <p className="text-[11px] text-slate-400">Supervisión en tiempo real de AnunciosSV</p>
        </div>
      </div>

      {/* Lado central: Buscador rápido en el panel */}
      <div className="hidden md:flex items-center relative w-72">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar usuarios, anuncios, reportes..."
          className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {/* Lado derecho: Estado de Firebase y enlaces */}
      <div className="flex items-center gap-3">
        {/* Indicador de estado de Firebase */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
          isFirebaseConfigured
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            : "bg-blue-500/10 text-blue-300 border-blue-500/30"
        }`}>
          <Database className="w-3 h-3" />
          <span>{isFirebaseConfigured ? "Firebase Activo" : "Modo Demo Activo"}</span>
        </div>

        {/* Campana de Notificaciones Administrativas */}
        <button
          aria-label="Notificaciones de reportes"
          className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
        </button>

        {/* Botón rápido para abrir la app móvil en pestaña nueva */}
        <Link
          to="/"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all"
        >
          <span>Abrir App Móvil</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </header>
  );
};

export default AdminHeader;
