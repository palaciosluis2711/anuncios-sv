// Vista dedicada de gestión de usuarios bloqueados para AnunciosSV
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Ban, ShieldCheck, Check, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getBlockedUsers,
  unblockUser,
  CHAT_EVENT,
  normalizeUserId
} from "../../services/chatService";
import { resolveUserAvatar, getPublicProfile } from "../../services/userProfileService";

export const BlockedUsersPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState(() => getBlockedUsers(currentUser));
  const [unblockingId, setUnblockingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Sincronización en tiempo real ante bloqueos/desbloqueos
  useEffect(() => {
    setBlockedUsers(getBlockedUsers(currentUser));

    const handleChatUpdate = () => {
      setBlockedUsers(getBlockedUsers(currentUser));
    };

    window.addEventListener(CHAT_EVENT, handleChatUpdate);
    return () => window.removeEventListener(CHAT_EVENT, handleChatUpdate);
  }, [currentUser]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/profile", { replace: true });
    }
  };

  const handleUnblock = (targetUserId, targetName) => {
    setUnblockingId(targetUserId);
    try {
      unblockUser(targetUserId, currentUser);
      setBlockedUsers((prev) => prev.filter((u) => String(u.id) !== String(targetUserId)));
      setFeedbackMsg(`Has desbloqueado a ${targetName || "este usuario"}.`);
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      alert("Error al desbloquear: " + err.message);
    } finally {
      setUnblockingId(null);
    }
  };

  const filteredUsers = blockedUsers.filter((user) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = user.name?.toLowerCase().includes(q);
    const usernameMatch = user.username?.toLowerCase().includes(q);
    return nameMatch || usernameMatch;
  });

  return (
    <div
      className={`px-4 animate-fade-in max-w-lg mx-auto ${
        blockedUsers.length === 0 ? "min-h-[calc(100dvh-7.5rem)] flex flex-col" : "space-y-3.5 pb-8"
      }`}
    >
      {/* Cabecera superior fija de Usuarios Bloqueados */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md px-4 py-3 border-b border-slate-800/90 shadow-md -mx-4 -mt-2 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Regresar"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all shadow-sm flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">Usuarios Bloqueados</h1>
                {blockedUsers.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black shadow-sm">
                    {blockedUsers.length}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">Cuentas restringidas para enviarte mensajes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mensaje de retroalimentación temporal */}
      {feedbackMsg && (
        <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-sm">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Buscador cuando hay múltiples bloqueados */}
      {blockedUsers.length > 3 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en usuarios bloqueados..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 transition-all shadow-sm"
          />
        </div>
      )}

      {/* Lista o Estado Vacío */}
      {blockedUsers.length === 0 ? (
        // Estado vacío: Sin usuarios bloqueados (centrado en el medio de la pantalla)
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto animate-fade-in space-y-3.5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-sm">
            <Ban className="w-8 h-8 text-slate-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-300">No tienes usuarios bloqueados</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Los usuarios que bloquees desde el chat aparecerán aquí para que puedas gestionarlos o desbloquearlos cuando lo desees.
            </p>
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        // Estado vacío de búsqueda
        <div className="p-8 text-center space-y-2 text-slate-400 animate-fade-in">
          <p className="text-sm font-semibold text-slate-300">No se encontraron coincidencias</p>
          <p className="text-xs">No hay resultados para "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredUsers.map((user) => {
            const cachedProfile = getPublicProfile(user.id || user.username || user.name);
            const avatarUrl = cachedProfile?.avatar || resolveUserAvatar(user.id, user.avatar);
            const displayName = cachedProfile?.displayName || cachedProfile?.name || user.name || "Usuario";
            const username = cachedProfile?.username || user.username || "usuario";

            return (
              <div
                key={user.id}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-700 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">{displayName}</h3>
                    <p className="text-[11px] text-slate-400 truncate font-medium">
                      @{username.replace(/^@/, "")}
                    </p>
                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-0.5">
                      <Ban className="w-3 h-3 flex-shrink-0" />
                      <span>Mensajes restringidos</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUnblock(user.id, displayName)}
                  disabled={unblockingId === user.id}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all active:scale-95 flex-shrink-0 disabled:opacity-50 shadow-sm"
                >
                  {unblockingId === user.id ? "Desbloqueando..." : "Desbloquear"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BlockedUsersPage;

