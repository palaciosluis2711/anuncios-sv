// Vista principal de Bandeja de Mensajes y Conversaciones en AnunciosSV
// Selección múltiple por pulsación prolongada con barra superior de acciones (fijar en zona superior, marcar leído, eliminar)
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageCircle,
  Search,
  ChevronLeft,
  ShoppingBag,
  Check,
  CheckCheck,
  Trash2,
  X,
  ShieldAlert,
  Pin,
  PinOff,
  User
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getUserConversations,
  subscribeToUserConversations,
  formatConversationTime,
  deleteMultipleConversations,
  markConversationsAsRead,
  togglePinConversation,
  getPinnedConversationIds,
  normalizeUserId,
  getConversationUnreadCount,
  resolveConversationPeer,
  subscribeToUserOnlineStatus,
  getUserCandidateKeys
} from "../../services/chatService";
import { formatProductPrice, getProductById } from "../../services/productsService";

export const MessagesPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Rastrear si la navegación actual proviene de un flujo iniciado por una notificación in-app (Toast)
  const toastReturnOrigin =
    location.state?.fromToastOrigin ||
    (typeof window !== "undefined" && sessionStorage.getItem("anunciossv_toast_return_origin"));

  // Determinar si la navegación a Chats proviene de la barra inferior (footer)
  const isFromBottomNav = Boolean(
    !toastReturnOrigin &&
    (location.state?.fromBottomNav ||
    (typeof window !== "undefined" && sessionStorage.getItem("anunciossv_messages_from_footer") === "true"))
  );

  const [conversations, setConversations] = useState(() => getUserConversations(currentUser));
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState(() => getPinnedConversationIds(currentUser));

  // Estado para Selección Múltiple
  const [selectedConvIds, setSelectedConvIds] = useState(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mapa reactivo de presencia en tiempo real por ID de interlocutor
  const [onlineMap, setOnlineMap] = useState({});

  // Referencias para detección de pulsación prolongada (Long Press)
  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggeredRef = useRef(false);

  const currentUserId = normalizeUserId(currentUser);
  const myCandidatesLower = new Set(
    getUserCandidateKeys(currentUser).flatMap((k) => {
      const lower = String(k).trim().toLowerCase();
      return [lower, lower.replace(/^@/, "")];
    })
  );

  // Sincronización en tiempo real ante nuevos mensajes, lecturas o eliminaciones y cambios de avatar
  useEffect(() => {
    const unsubscribe = subscribeToUserConversations(currentUser, (updatedList) => {
      setConversations(updatedList);
      setPinnedIds(getPinnedConversationIds(currentUser));
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Suscripción en tiempo real al estado conectado / desconectado de cada interlocutor visible
  const peerIdsKey = Array.from(
    new Set(
      conversations
        .map((c) => resolveConversationPeer(c, currentUser)?.id)
        .filter(Boolean)
    )
  )
    .sort()
    .join("|");

  useEffect(() => {
    if (!peerIdsKey) return;
    const ids = peerIdsKey.split("|").filter(Boolean);
    const unsubs = ids.map((peerId) =>
      subscribeToUserOnlineStatus(peerId, (isOnline) => {
        setOnlineMap((prev) => {
          const val = Boolean(isOnline);
          if (prev[peerId] === val) return prev;
          return { ...prev, [peerId]: val };
        });
      })
    );

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch (_) {}
      });
    };
  }, [peerIdsKey]);

  // Manejo de pulsación prolongada (Long Press: 450ms)
  const handlePointerDown = (conv, e) => {
    isLongPressTriggeredRef.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate(40);
      }

      // Al mantener presionado: solo se selecciona el chat (sin desplegar menú inferior)
      setSelectedConvIds((prev) => {
        const next = new Set(prev);
        const strId = String(conv.id);
        if (next.has(strId)) {
          next.delete(strId);
        } else {
          next.add(strId);
        }
        return next;
      });
    }, 450);
  };

  const handlePointerMove = (e) => {
    const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
    // Si el usuario desliza más de 8 píxeles (scroll), cancelar long-press
    if (dx > 8 || dy > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Manejo de clic en la tarjeta de conversación
  const handleCardClick = (conv, e) => {
    // Si se activó el gesto de long-press, no realizar navegación
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Si estamos en modo de selección múltiple: alternar selección del chat
    if (selectedConvIds.size > 0) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedConvIds((prev) => {
        const next = new Set(prev);
        const strId = String(conv.id);
        if (next.has(strId)) {
          next.delete(strId);
        } else {
          next.add(strId);
        }
        return next;
      });
      return;
    }

    // Modo normal: navegar directamente a la sala de chat
    navigate(`/messages/${conv.id}`);
  };

  // Cancelar selección múltiple
  const handleClearSelection = () => {
    setSelectedConvIds(new Set());
  };

  // Acción: Fijar / Destacar en la zona superior las conversaciones seleccionadas
  const handleTogglePinSelected = () => {
    const targetIds = Array.from(selectedConvIds);
    if (targetIds.length === 0) return;

    targetIds.forEach((id) => {
      togglePinConversation(id, currentUser);
    });

    setPinnedIds(getPinnedConversationIds(currentUser));
    handleClearSelection();
  };

  // Acción: Marcar como leídas las conversaciones seleccionadas
  const handleMarkAsReadSelected = async () => {
    const targetIds = Array.from(selectedConvIds);
    if (targetIds.length === 0) return;

    await markConversationsAsRead(targetIds, currentUser);
    handleClearSelection();
  };

  // Acción: Abrir modal de confirmación para eliminar
  const handlePromptDelete = () => {
    if (selectedConvIds.size === 0) return;
    setIsDeleteModalOpen(true);
  };

  // Confirmar eliminación definitiva de las conversaciones seleccionadas
  const handleConfirmDelete = async () => {
    const targetIds = Array.from(selectedConvIds);
    if (targetIds.length === 0) return;

    setIsDeleting(true);
    try {
      await deleteMultipleConversations(targetIds, currentUser);

      // Actualizar estado local inmediatamente sin perder las conversaciones restantes
      const idSet = new Set(targetIds.map(String));
      setConversations((prev) => prev.filter((c) => !idSet.has(String(c.id))));
      setSelectedConvIds(new Set());
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error("Error al eliminar conversaciones:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrado reactivo de conversaciones según búsqueda
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();

    const peer = resolveConversationPeer(conv, currentUser);
    const matchesName = peer.name?.toLowerCase().includes(query);
    const matchesUsername = peer.username?.toLowerCase().includes(query);
    const matchesProduct = conv.product?.title?.toLowerCase().includes(query);
    const matchesMessage = conv.lastMessage?.toLowerCase().includes(query);

    return matchesName || matchesUsername || matchesProduct || matchesMessage;
  });

  const totalUnreads = conversations.reduce((acc, conv) => {
    return acc + getConversationUnreadCount(conv, currentUser);
  }, 0);

  // Referencias para detección de gesto táctil de retroceso
  const messagesSwipeStartXRef = useRef(0);
  const messagesSwipeStartYRef = useRef(0);
  const messagesSwipeStartTimeRef = useRef(0);

  const handleMessagesSwipeStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      messagesSwipeStartXRef.current = e.touches[0].clientX;
      messagesSwipeStartYRef.current = e.touches[0].clientY;
      messagesSwipeStartTimeRef.current = Date.now();
    }
  };

  const handleMessagesSwipeEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - messagesSwipeStartXRef.current;
    const diffY = e.changedTouches[0].clientY - messagesSwipeStartYRef.current;
    const elapsed = Date.now() - messagesSwipeStartTimeRef.current;

    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && messagesSwipeStartXRef.current < 90) {
      if (selectedConvIds.size > 0) {
        handleClearSelection();
        return;
      }
      if (!isFromBottomNav || toastReturnOrigin) {
        handleBack();
      }
    }
  };

  const handleBack = () => {
    if (selectedConvIds.size > 0) {
      handleClearSelection();
      return;
    }

    if (toastReturnOrigin) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("anunciossv_toast_return_origin");
      }
      navigate(toastReturnOrigin, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  const isSelectionMode = selectedConvIds.size > 0;
  const selectedCount = selectedConvIds.size;

  // Evaluar si todos los seleccionados están fijados actualmente
  const areAllSelectedPinned = selectedCount > 0 && Array.from(selectedConvIds).every((id) => pinnedIds.includes(String(id)));

  return (
    <div
      onTouchStart={handleMessagesSwipeStart}
      onTouchEnd={handleMessagesSwipeEnd}
      className={`px-4 animate-fade-in max-w-lg mx-auto ${
        conversations.length === 0 ? "min-h-[calc(100dvh-7.5rem)] flex flex-col" : "space-y-3.5 pb-8"
      }`}
    >
      {/* Cabecera superior fija: En modo normal muestra título Chats; en modo selección muestra el contador y las acciones disponibles */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md px-4 py-3 border-b border-slate-800/90 shadow-md -mx-4 -mt-2 mb-3">
        {isSelectionMode ? (
          <div className="flex items-center justify-between animate-fade-in">
            {/* Lado izquierdo: Botón Deseleccionar / Cancelar + Contador de seleccionados */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleClearSelection}
                aria-label="Cancelar selección"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all shadow-sm flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span className="text-indigo-400 font-black">{selectedCount}</span>
                  <span className="text-slate-300 font-bold">
                    {selectedCount === 1 ? "seleccionado" : "seleccionados"}
                  </span>
                </h1>
              </div>
            </div>

            {/* Lado derecho: Acciones disponibles en la parte superior */}
            <div className="flex items-center gap-2">
              {/* Acción 1: Fijar arriba / Destacar en la zona superior */}
              <button
                type="button"
                onClick={handleTogglePinSelected}
                className={`p-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95 ${
                  areAllSelectedPinned
                    ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                    : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-indigo-400 hover:text-indigo-300"
                }`}
                title={areAllSelectedPinned ? "Desfijar de la zona superior" : "Fijar arriba (Destacar)"}
              >
                {areAllSelectedPinned ? (
                  <PinOff className="w-4 h-4" />
                ) : (
                  <Pin className="w-4 h-4 fill-indigo-400/20" />
                )}
                <span className="hidden sm:inline">
                  {areAllSelectedPinned ? "Desfijar" : "Fijar"}
                </span>
              </button>

              {/* Acción 2: Marcar como leído */}
              <button
                type="button"
                onClick={handleMarkAsReadSelected}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-emerald-300 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="Marcar como leído"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Leído</span>
              </button>

              {/* Acción 3: Eliminar seleccionados */}
              <button
                type="button"
                onClick={handlePromptDelete}
                className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="Eliminar seleccionados"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {!isFromBottomNav && (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Regresar"
                  className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all shadow-sm flex-shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-white tracking-tight">Chats</h1>
                  {totalUnreads > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black shadow-sm">
                      {totalUnreads} {totalUnreads === 1 ? "nuevo" : "nuevos"}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Mantén presionado un chat para seleccionarlo</p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Buscador de conversaciones */}
      {conversations.length > 0 && !isSelectionMode && (
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
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto animate-fade-in space-y-3.5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-sm">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h2 className="text-sm font-semibold text-slate-300">Tu buzón está vacío</h2>
          <p className="text-xs text-slate-500 max-w-xs">
            Cuando contactes a otros usuarios o recibas mensajes de interesados, aparecerán aquí.
          </p>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="p-8 text-center space-y-2 text-slate-400 animate-fade-in">
          <p className="text-sm font-semibold text-slate-300">No se encontraron conversaciones</p>
          <p className="text-xs">No hay resultados para "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => {
            const other = resolveConversationPeer(conv, currentUser);
            const isPeerOnline = Boolean(other.id && onlineMap[other.id]);

            const unreads = getConversationUnreadCount(conv, currentUser);
            const hasUnread = unreads > 0;
            const senderLower = String(conv.lastSenderId || "").trim().toLowerCase();
            const isLastSenderMe = Boolean(
              senderLower &&
                (myCandidatesLower.has(senderLower) ||
                  myCandidatesLower.has(senderLower.replace(/^@/, "")))
            );
            const isPinned = pinnedIds.includes(String(conv.id));
            const isSelected = selectedConvIds.has(String(conv.id));
            const resolvedProduct = conv.product
              ? {
                  ...conv.product,
                  ...(getProductById(conv.product.id) || {})
                }
              : null;

            return (
              <div
                key={conv.id}
                onPointerDown={(e) => handlePointerDown(conv, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => handleCardClick(conv, e)}
                className={`block p-3.5 rounded-2xl border transition-all active:scale-[0.99] relative overflow-hidden select-none cursor-pointer ${
                  isSelected
                    ? "bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500"
                    : isPinned
                    ? "bg-slate-900 border-indigo-500/40 shadow-sm"
                    : hasUnread
                    ? "bg-slate-900 border-indigo-500/30 shadow-sm"
                    : "bg-slate-900/80 hover:bg-slate-900 border-slate-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox circular de selección múltiple (visible cuando hay al menos 1 seleccionado) */}
                  {isSelectionMode && (
                    <div className="flex items-center self-center pr-1 animate-scale-up">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                            : "bg-slate-900/80 border-slate-600 text-transparent"
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  )}

                  {/* Avatar del interlocutor con indicador de presencia en tiempo real */}
                  <div className="relative flex-shrink-0">
                    {other.avatar ? (
                      <img
                        src={other.avatar}
                        alt={other.name}
                        className="w-12 h-12 rounded-full object-cover border border-slate-700 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-sm">
                        <User className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-pink-500 rounded-full ring-2 ring-slate-900" />
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-slate-900 ${
                        isPeerOnline ? "bg-emerald-500" : "bg-slate-500"
                      }`}
                      title={isPeerOnline ? "Conectado" : "Desconectado"}
                    />
                  </div>

                  {/* Datos de la conversación */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span className="truncate">{other.name}</span>
                          {other.username && (
                            <span className="text-[10px] text-slate-400 font-normal truncate">
                              @{other.username.replace(/^@/, "")}
                            </span>
                          )}
                        </h3>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            isPeerOnline
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700/80"
                          }`}
                        >
                          {isPeerOnline ? "Conectado" : "Desconectado"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Distintivo de fijado/destacado en la zona superior */}
                        {isPinned && (
                          <Pin
                            className="w-3.5 h-3.5 text-indigo-400 rotate-45 flex-shrink-0 fill-indigo-400/20"
                            title="Chat fijado en la zona superior"
                          />
                        )}
                        <span className="text-[10px] text-slate-400">
                          {formatConversationTime(conv.lastMessageAt)}
                        </span>
                      </div>
                    </div>

                    {/* Pastilla contextual del producto asociado */}
                    {resolvedProduct && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 my-1 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-300 max-w-full truncate">
                        <ShoppingBag className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="font-semibold text-white truncate">{resolvedProduct.title}</span>
                        <span className="text-indigo-400 font-bold flex-shrink-0">
                          {formatProductPrice(resolvedProduct)}
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

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR (Renderizado con Portal en document.body con z-[110]) */}
      {isDeleteModalOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-backdrop-enter"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-up"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-white">
                {selectedCount > 1
                  ? `¿Eliminar ${selectedCount} conversaciones?`
                  : "¿Eliminar conversación?"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {selectedCount > 1
                  ? `Se eliminarán permanentemente las ${selectedCount} conversaciones seleccionadas y todos sus mensajes de tu buzón.`
                  : "Se eliminará permanentemente esta conversación y todos sus mensajes de tu buzón."}
                {" "}Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MessagesPage;
