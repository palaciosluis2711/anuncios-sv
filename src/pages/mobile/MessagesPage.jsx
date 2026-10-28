// Vista principal de Bandeja de Mensajes y Conversaciones en AnunciosSV
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Search,
  ChevronLeft,
  ShoppingBag,
  Clock,
  ShieldCheck,
  CheckCheck,
  Trash2,
  MoreVertical,
  X,
  ShieldAlert
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getUserConversations,
  formatConversationTime,
  deleteConversation,
  CHAT_EVENT,
  normalizeUserId
} from "../../services/chatService";
import { getPublicProfile, PROFILE_UPDATED_EVENT } from "../../services/userProfileService";
import { formatMoney } from "../../services/productsService";

export const MessagesPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(() => getUserConversations(currentUser));
  const [searchQuery, setSearchQuery] = useState("");

  // Estado para el menú contextual de conversación (pulsación prolongada)
  const [contextMenuConv, setContextMenuConv] = useState(null);
  const [isClosingContextMenu, setIsClosingContextMenu] = useState(false);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(null);

  // Referencias para detección de pulsación prolongada (Long Press)
  const longPressTimeoutRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressActiveRef = useRef(false);

  const currentUserId = normalizeUserId(currentUser);

  // Sincronización en tiempo real ante nuevos mensajes, lecturas o eliminaciones y cambios de avatar
  useEffect(() => {
    setConversations(getUserConversations(currentUser));

    const handleChatUpdate = () => {
      setConversations(getUserConversations(currentUser));
    };

    window.addEventListener(CHAT_EVENT, handleChatUpdate);
    window.addEventListener(PROFILE_UPDATED_EVENT, handleChatUpdate);
    return () => {
      window.removeEventListener(CHAT_EVENT, handleChatUpdate);
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleChatUpdate);
    };
  }, [currentUser]);

  // Gestores de pulsación prolongada
  const handleTouchStart = (conv, e) => {
    isLongPressActiveRef.current = false;
    const t = e.touches ? e.touches[0] : e;
    touchStartPosRef.current = { x: t.clientX, y: t.clientY };

    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
      setContextMenuConv(conv);
    }, 500);
  };

  const handleTouchMove = (e) => {
    const t = e.touches ? e.touches[0] : e;
    const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleCardClick = (conv, e) => {
    if (isLongPressActiveRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    navigate(`/messages/${conv.id}`);
  };

  const handleCloseContextMenu = () => {
    setIsClosingContextMenu(true);
    setTimeout(() => {
      setContextMenuConv(null);
      setIsClosingContextMenu(false);
    }, 280);
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteConv) return;
    deleteConversation(confirmDeleteConv.id);
    setConversations((prev) => prev.filter((c) => String(c.id) !== String(confirmDeleteConv.id)));
    setConfirmDeleteConv(null);
    handleCloseContextMenu();
  };

  // Filtrado reactivo de conversaciones según búsqueda
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();

    // Buscar por nombre o usuario del otro participante
    const otherId = conv.participants?.find((p) => p !== currentUserId);
    const otherData = conv.participantsData?.[otherId] || {};
    const matchesName = otherData.name?.toLowerCase().includes(query);
    const matchesUsername = otherData.username?.toLowerCase().includes(query);

    // Buscar por título del producto asociado
    const matchesProduct = conv.product?.title?.toLowerCase().includes(query);

    // Buscar por contenido del último mensaje
    const matchesMessage = conv.lastMessage?.toLowerCase().includes(query);

    return matchesName || matchesUsername || matchesProduct || matchesMessage;
  });

  const totalUnreads = conversations.reduce((acc, conv) => {
    return acc + (Number(conv.unreadCounts?.[currentUserId]) || 0);
  }, 0);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div
      className={`px-4 animate-fade-in max-w-lg mx-auto ${
        conversations.length === 0 ? "min-h-[calc(100dvh-7.5rem)] flex flex-col" : "space-y-3.5 pb-8"
      }`}
    >
      {/* Cabecera superior fija de la Bandeja de Entrada */}
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
                <h1 className="text-base font-extrabold text-white tracking-tight">Mensajes</h1>
                {totalUnreads > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black shadow-sm">
                    {totalUnreads} {totalUnreads === 1 ? "nuevo" : "nuevos"}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">Conversaciones sobre compras y ventas</p>
            </div>
          </div>
        </div>
      </header>

      {/* Buscador de conversaciones */}
      {conversations.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por usuario o anuncio..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>
      )}

      {/* Lista de Conversaciones */}
      {conversations.length === 0 ? (
        // Estado vacío: Sin conversaciones iniciadas (centrado en el medio de la pantalla)
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto animate-fade-in space-y-3.5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-sm">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h2 className="text-sm font-semibold text-slate-300">Tu buzón está vacío</h2>
        </div>
      ) : filteredConversations.length === 0 ? (
        // Estado vacío para búsqueda sin resultados
        <div className="p-8 text-center space-y-2 text-slate-400 animate-fade-in">
          <p className="text-sm font-semibold text-slate-300">No se encontraron conversaciones</p>
          <p className="text-xs">No hay resultados para "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => {
            const otherId = conv.participants?.find((p) => p !== currentUserId);
            const otherRaw = conv.participantsData?.[otherId] || {};
            const cachedProfile = getPublicProfile(otherId || otherRaw);
            const other = {
              name: cachedProfile?.displayName || cachedProfile?.name || otherRaw.name || "Usuario",
              username: cachedProfile?.username || otherRaw.username || "usuario",
              avatar: cachedProfile?.avatar || otherRaw.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
            };

            const unreads = Number(conv.unreadCounts?.[currentUserId]) || 0;
            const hasUnread = unreads > 0;
            const isLastSenderMe = conv.lastSenderId === currentUserId;

            return (
              <div
                key={conv.id}
                onTouchStart={(e) => handleTouchStart(conv, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={(e) => handleTouchStart(conv, e)}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onClick={(e) => handleCardClick(conv, e)}
                className={`block p-3.5 rounded-2xl border transition-all active:scale-[0.99] relative overflow-hidden select-none cursor-pointer ${
                  hasUnread
                    ? "bg-slate-900 border-indigo-500/50 shadow-md shadow-indigo-950/30"
                    : "bg-slate-900/80 hover:bg-slate-900 border-slate-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar del interlocutor */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={other.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                      alt={other.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-700 shadow-sm"
                    />
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-pink-500 rounded-full ring-2 ring-slate-900" />
                    )}
                  </div>

                  {/* Datos de la conversación */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        <span>{other.name}</span>
                        {other.username && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            @{other.username.replace(/^@/, "")}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-slate-400">
                          {formatConversationTime(conv.lastMessageAt)}
                        </span>
                        {/* Botón rápido de menú contextual */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenuConv(conv);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                          title="Opciones de conversación"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Pastilla contextual del producto asociado */}
                    {conv.product && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 my-1 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-300 max-w-full truncate">
                        <ShoppingBag className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="font-semibold text-white truncate">{conv.product.title}</span>
                        <span className="text-indigo-400 font-bold flex-shrink-0">
                          {conv.product.isFree
                            ? "GRATIS"
                            : conv.product.priceMode === "contact"
                            ? "A consultar"
                            : conv.product.priceMode === "range" || conv.product.isPriceRange
                            ? `$${formatMoney(conv.product.minPrice)} - $${formatMoney(conv.product.maxPrice)} USD`
                            : `$${formatMoney(conv.product.price)} USD`}
                        </span>
                      </div>
                    )}

                    {/* Previsualización del último mensaje */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs line-clamp-1 leading-relaxed ${
                          hasUnread
                            ? "font-bold text-white"
                            : "text-slate-400 font-normal"
                        }`}
                      >
                        {isLastSenderMe && <span className="text-indigo-400 font-medium">Tú: </span>}
                        {conv.lastMessage || "Conversación iniciada..."}
                      </p>

                      {hasUnread && (
                        <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-pink-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                          {unreads}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Menú Contextual para Eliminar Conversación (Pulsación prolongada o menú de 3 puntos) */}
      {contextMenuConv && (
        <div
          onClick={handleCloseContextMenu}
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            isClosingContextMenu ? "opacity-0" : "opacity-100 animate-fade-in"
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md bg-slate-950 border-t border-slate-800 rounded-t-3xl shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto ${
              isClosingContextMenu ? "animate-slide-down-sheet" : "animate-slide-up-sheet"
            }`}
          >
            {/* Tirador visual estilo iOS */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />

            {/* Cabecera del Menú Contextual */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                {(() => {
                  const oId = contextMenuConv.participants?.find((p) => p !== currentUserId);
                  const oData = contextMenuConv.participantsData?.[oId] || {};
                  return (
                    <>
                      <img
                        src={oData.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                        alt={oData.name || "Usuario"}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">
                          {oData.name || "Usuario"}
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate">
                          {contextMenuConv.product?.title || "Opciones de la conversación"}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={handleCloseContextMenu}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                aria-label="Cerrar opciones"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opciones disponibles */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteConv(contextMenuConv)}
                className="w-full p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center gap-3 transition-colors active:scale-95 text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <span className="block">Eliminar conversación</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Se borrará el chat y todos sus mensajes de tu buzón
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Personalizado para Eliminar Conversación (Sobre el menú contextual z-[70]) */}
      {confirmDeleteConv && (
        <div
          onClick={() => setConfirmDeleteConv(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl animate-fade-in"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-white">¿Eliminar conversación?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Se eliminará esta conversación y todos sus mensajes de tu buzón. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteConv(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30 transition-all active:scale-95"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;

