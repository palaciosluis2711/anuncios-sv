// Barra lateral de navegación Desktop-First para el panel de administración
import React from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Megaphone,
  Settings,
  Smartphone,
  LogOut,
  ShieldAlert,
  Sliders,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { MOCK_ADMIN_STATS } from "../../services/mockData";

export const AdminSidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    {
      to: "/admin",
      label: "Dashboard General",
      icon: LayoutDashboard,
      exact: true
    },
    {
      to: "/admin/moderation",
      label: "Moderación de Anuncios",
      icon: ShieldCheck,
      badge: MOCK_ADMIN_STATS.pendingModeration,
      badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/40"
    },
    {
      to: "/admin/users",
      label: "Gestión de Usuarios",
      icon: Users
    },
    {
      to: "/admin/ads",
      label: "Publicidad & Banners",
      icon: Megaphone
    },
    {
      to: "/admin/settings",
      label: "Configuración",
      icon: Settings
    }
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <>
      {/* Fondo oscuro al abrir el sidebar en pantallas móviles */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Cabecera del Sidebar */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <ShieldAlert className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1">
                Panel <span className="text-purple-400">Webmaster</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/60">
                Admin v1.0
              </span>
            </div>
          </Link>
        </div>

        {/* Lista de enlaces de navegación */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Módulos Principales
          </div>

          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exact}
                onClick={() => setIsMobileOpen?.(false)}
                className={({ isActive }) => `
                  flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group
                  ${
                    isActive
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition-transform ${isActive ? "text-purple-400 scale-110" : "text-slate-400 group-hover:text-slate-300"}`} />
                      <span>{link.label}</span>
                    </div>

                    {link.badge !== undefined && Number(link.badge) > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${link.badgeColor}`}>
                        {link.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Sección inferior con acceso a la app móvil y perfil */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Botón directo para volver a la app de usuarios */}
          <Link
            to="/"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>Ver App Móvil</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </Link>

          {/* Tarjeta de usuario administrador */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <img
                src={currentUser?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80"}
                alt="Admin"
                className="w-8 h-8 rounded-lg object-cover border border-purple-500/50"
              />
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-200 truncate">{currentUser?.name || "Webmaster"}</div>
                <div className="text-[10px] text-purple-400 font-medium">Super Admin</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
