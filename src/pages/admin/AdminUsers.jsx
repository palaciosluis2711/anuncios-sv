// Módulo de Gestión de Usuarios y Control de Suspensiones para el Webmaster
import React, { useState } from "react";
import {
  Users,
  Search,
  Shield,
  UserCheck,
  UserX,
  AlertTriangle,
  MoreVertical,
  CheckCircle,
  Ban
} from "lucide-react";
import { MOCK_USERS } from "../../services/mockData";

export const AdminUsers = () => {
  const [users, setUsers] = useState(MOCK_USERS);
  const [search, setSearch] = useState("");

  const handleToggleSuspend = (id) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextStatus = u.status === "activo" ? "suspendido" : "activo";
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Gestión de Usuarios
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Administra roles, supervisa perfiles y suspende cuentas infractoras.
          </p>
        </div>

        {/* Buscador de usuarios */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Tabla de usuarios Desktop / Tarjetas en móviles */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Usuario</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Publicaciones</th>
                <th className="p-4">Reportes</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Avatar y datos */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <div className="font-bold text-white text-sm">{user.name}</div>
                        <div className="text-slate-400 text-xs">{user.email}</div>
                        <div className="text-[10px] text-slate-500">Miembro desde {user.joinedDate}</div>
                      </div>
                    </div>
                  </td>

                  {/* Rol */}
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      user.role === "admin"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                    }`}>
                      {user.role === "admin" ? "👑 Webmaster" : "👤 Estándar"}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase ${
                      user.status === "activo"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border-red-500/30 animate-pulse"
                    }`}>
                      {user.status}
                    </span>
                  </td>

                  {/* Cantidad de publicaciones */}
                  <td className="p-4 font-semibold text-slate-300">
                    {user.postsCount} anuncios
                  </td>

                  {/* Reportes */}
                  <td className="p-4">
                    {user.reportedCount > 0 ? (
                      <span className="flex items-center gap-1 text-red-400 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {user.reportedCount} denuncias
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="p-4 text-right">
                    {user.role !== "admin" ? (
                      <button
                        onClick={() => handleToggleSuspend(user.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          user.status === "activo"
                            ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {user.status === "activo" ? "Suspender Cuenta" : "Reactivar Cuenta"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">Inmutable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
