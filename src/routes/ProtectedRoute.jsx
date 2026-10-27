// Guardián de rutas protegidas: restringe acceso por autenticación y rol de administrador
import React from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ShieldAlert, LogIn, ArrowLeft, UserCheck } from "lucide-react";

export const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { currentUser, isAuthenticated, isAdmin, switchDemoRole } = useAuth();
  const location = useLocation();

  // Si requiere autenticación general y el usuario no ha iniciado sesión
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si requiere rol de Webmaster/Admin y el usuario actual no lo tiene
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel rounded-2xl p-6 sm:p-8 text-center border border-red-500/30 shadow-2xl relative overflow-hidden">
          {/* Luz de acento sutil */}
          <div className="absolute -top-16 -left-16 w-36 h-36 bg-red-600/20 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Acceso Restringido al Webmaster</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Esta sección <code className="text-red-300 bg-red-950/60 px-1.5 py-0.5 rounded text-xs">/admin/*</code> está reservada exclusivamente para administradores con permisos de moderación y auditoría.
          </p>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 mb-6 text-left">
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Usuario actual:</div>
            <div className="flex items-center gap-3">
              <img
                src={currentUser?.avatar}
                alt={currentUser?.name}
                className="w-9 h-9 rounded-full object-cover border border-slate-700"
              />
              <div className="overflow-hidden">
                <div className="text-sm font-semibold text-slate-200 truncate">{currentUser?.name}</div>
                <div className="text-xs text-slate-400">Rol: <span className="text-amber-400 font-medium">Usuario Estándar</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Botón rápido para desarrollo: cambiar a rol Admin en 1 clic */}
            <button
              onClick={() => switchDemoRole("admin")}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30"
            >
              <UserCheck className="w-4 h-4" />
              Cambiar a rol Webmaster (Modo Demo)
            </button>

            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm transition-all border border-slate-700/60"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a la App Móvil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
