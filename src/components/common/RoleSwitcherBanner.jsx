// Barra flotante de desarrollo para alternar roles (Webmaster / Invitado)
// Permite verificar el acceso del Webmaster o probar la experiencia en modo invitado sin credenciales.
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Shield, Eye, Sparkles, ChevronDown, ChevronUp, LayoutDashboard, Smartphone } from "lucide-react";

export const RoleSwitcherBanner = () => {
  const { currentUser, isAdmin, switchDemoRole } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isInAdmin = location.pathname.startsWith("/admin");
  const isChatDetail = location.pathname.startsWith("/messages/");

  // Ocultar el selector flotante en la vista de chat para no obstruir el teclado ni el input fijo
  if (isChatDetail) return null;

  return (
    <aside aria-label="Selector de rol demo" className="fixed bottom-20 sm:bottom-4 right-4 z-50">
      {/* Botón flotante colapsable */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full glass-panel border border-indigo-500/40 text-xs font-semibold text-slate-200 hover:text-white shadow-xl hover:border-indigo-400 transition-all bg-slate-900/90"
        >
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="hidden sm:inline">Rol actual:</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            isAdmin 
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" 
              : currentUser 
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" 
                : "bg-slate-700/50 text-slate-300 border border-slate-600"
          }`}>
            {isAdmin ? "👑 Webmaster" : currentUser ? `👤 ${currentUser.displayName || currentUser.name || "Usuario Real"}` : "👁️ Invitado"}
          </span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
        </button>
      </div>

      {/* Menú desplegable */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-72 glass-panel rounded-2xl p-3 border border-slate-700 shadow-2xl bg-slate-900/95 animate-slide-up">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Simulador de Roles
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            {/* Botón Admin */}
            <button
              onClick={() => {
                switchDemoRole("admin");
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all ${
                isAdmin 
                  ? "bg-purple-600/30 text-purple-200 border border-purple-500/50" 
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-purple-400" />
                <div className="text-left">
                  <div className="font-semibold">Webmaster (Admin)</div>
                  <div className="text-[10px] text-slate-400">Acceso a panel /admin y moderación</div>
                </div>
              </div>
              {isAdmin && <span className="text-[10px] bg-purple-500/40 px-1.5 py-0.5 rounded text-purple-200">Activo</span>}
            </button>

            {/* Botón Invitado */}
            <button
              onClick={() => {
                switchDemoRole("guest");
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all ${
                !currentUser 
                  ? "bg-slate-700/50 text-slate-200 border border-slate-600" 
                  : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-slate-400" />
                <div className="text-left">
                  <div className="font-semibold">Modo Invitado</div>
                  <div className="text-[10px] text-slate-500">Solo lectura sin credenciales</div>
                </div>
              </div>
              {!currentUser && <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">Activo</span>}
            </button>
          </div>

          {/* Enlaces de cambio directo de vista */}
          <div className="pt-2 border-t border-slate-800 flex gap-2">
            {isInAdmin ? (
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Ir a App Móvil
              </Link>
            ) : (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-xs font-medium transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Ir al Panel Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default RoleSwitcherBanner;
