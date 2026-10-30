// Vista de conversación y mensajería en tiempo real para AnunciosSV
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  Send,
  ExternalLink,
  ShieldCheck,
  Check,
  CheckCheck,
  Clock,
  SlidersHorizontal,
  X,
  Trash2,
  AlertCircle,
  Ban,
  BellOff,
  ShieldAlert,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Users,
  User
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getConversationById,
  getStoredMessages,
  subscribeToConversationMessages,
  subscribeToConversation,
  sendMessage,
  sendImageMessage,
  markConversationAsRead,
  setTemporaryChatConfig,
  setChatMute,
  getChatMuteStatus,
  toggleBlockUser,
  clearConversationMessages,
  deleteMessagesForMe,
  deleteMessagesForAll,
  canDeleteMessagesForAll,
  DELETE_FOR_ALL_LIMIT_MS,
  formatMessageTime,
  formatLastSeen,
  resolveConversationPeer,
  CHAT_EVENT,
  normalizeUserId,
  setUserActiveInChat,
  subscribeToUserOnlineStatus,
  getUserCandidateKeys
} from "../../services/chatService";
import { PROFILE_UPDATED_EVENT } from "../../services/userProfileService";
import { formatMoney, formatProductPrice, getProductById } from "../../services/productsService";
import { compressImage } from "../../utils/imageCompressor";

// Sugerencias rápidas para agilizar la negociación entre comprador y vendedor
const QUICK_SUGGESTIONS = [
  "¿Sigue disponible?",
  "¿Cuál es el último precio?",
  "¿Dónde podemos acordar la entrega?",
  "¡Me interesa comprarlo!"
];

export const ChatDetailPage = () => {
  const { conversationId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversation, setConversation] = useState(() => getConversationById(conversationId));
  const [isLoadingConv, setIsLoadingConv] = useState(() => !getConversationById(conversationId));
  const [messages, setMessages] = useState(() => getStoredMessages(conversationId));
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsClosing, setIsSettingsClosing] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'clear' | 'block', title, description, confirmLabel, isDestructive }

  // Selección de mensajes para eliminación (individual o múltiple)
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const longPressTimerRef = useRef(null);
  const isLongPressTriggeredRef = useRef(false);

  // Control de envío de imágenes y visor a pantalla completa
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { dataUrl, caption }
  const [activeFullscreenImage, setActiveFullscreenImage] = useState(null); // { src, caption } o null

  // Controles táctiles directos de deslizamiento en el visor de fotos
  const touchCoordsRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [touchTranslate, setTouchTranslate] = useState({ x: 0, y: 0 });
  const [isDraggingTouch, setIsDraggingTouch] = useState(false);

  const fileInputGalleryRef = useRef(null);
  const fileInputCameraRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Referencias para detección de gesto táctil de retroceso en el chat (Swipe back)
  const chatSwipeStartXRef = useRef(0);
  const chatSwipeStartYRef = useRef(0);
  const chatSwipeStartTimeRef = useRef(0);

  const handleCloseSettings = () => {
    setIsSettingsClosing(true);
    setTimeout(() => {
      setIsSettingsOpen(false);
      setIsSettingsClosing(false);
    }, 280);
  };

  const currentUserId = normalizeUserId(currentUser);

  // Control dinámico de altura del viewport visual (para cuando se despliega el teclado en móviles)
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window !== "undefined" && window.visualViewport) {
      return window.visualViewport.height;
    }
    return typeof window !== "undefined" ? window.innerHeight : 600;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        // Forzar a que la ventana principal nunca se desplace hacia arriba al abrir el teclado
        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0);
        }
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport);
      window.visualViewport.addEventListener("scroll", updateViewport);
    }
    window.addEventListener("resize", updateViewport);
    window.addEventListener("scroll", updateViewport);

    // Bloquear el scroll de documentElement y body para que el header nunca se desplace fuera de pantalla
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlHeight = document.documentElement.style.height;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100%";

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewport);
        window.visualViewport.removeEventListener("scroll", updateViewport);
      }
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("scroll", updateViewport);

      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.height = prevHtmlHeight;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.height = prevBodyHeight;
    };
  }, []);

  const handleInputFocus = () => {
    // Asegurar que la ventana global no se desplace hacia arriba al abrir el teclado
    setTimeout(() => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  // Cargar datos y sincronizar mensajes en tiempo real desde Firestore y local
  useEffect(() => {
    // Suscripción reactiva en tiempo real a los mensajes de la conversación
    const unsubscribeMessages = subscribeToConversationMessages(conversationId, (updatedMessages) => {
      setMessages(updatedMessages);
      if (currentUser && Array.isArray(updatedMessages)) {
        const myCandidates = getUserCandidateKeys(currentUser).map((k) => k.toLowerCase());
        const hasUnread = updatedMessages.some(
          (m) => !m.read && m.senderId && !myCandidates.includes(String(m.senderId).trim().toLowerCase())
        );
        if (hasUnread) {
          markConversationAsRead(conversationId, currentUser);
        }
      }
    });

    // Suscripción a cambios en la conversación (bloqueo, mensajes temporales, silenciado, presencia en sala)
    const unsubscribeConversation = subscribeToConversation(conversationId, (updatedConv) => {
      if (updatedConv) {
        setConversation(updatedConv);
        setIsLoadingConv(false);
      }
    });

    // Tiempo máximo de espera si la conversación aún se está sincronizando desde Firestore
    const loadTimeout = setTimeout(() => {
      setIsLoadingConv(false);
    }, 1800);

    // Marcar como leído inicialmente al acceder a la conversación
    if (currentUser) {
      markConversationAsRead(conversationId, currentUser);
    }

    const handleProfileUpdate = () => {
      const latest = getConversationById(conversationId);
      if (latest) setConversation(latest);
      setMessages(getStoredMessages(conversationId));
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate);

    return () => {
      clearTimeout(loadTimeout);
      unsubscribeMessages();
      unsubscribeConversation();
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate);
    };
  }, [conversationId, currentUser]);

  // Identificar los candidatos del usuario actual
  const myCandidates = getUserCandidateKeys(currentUser).map((k) => String(k).trim().toLowerCase());

  // Resolución inmediata e infalible del interlocutor
  const otherParticipant = resolveConversationPeer(conversation, currentUser);
  const otherParticipantId =
    otherParticipant?.id ||
    conversation?.participants?.find((p) => !myCandidates.includes(String(p).trim().toLowerCase())) ||
    conversation?.participants?.find((p) => p !== currentUserId) ||
    "";

  // Estado de conexión en línea y última actividad del otro usuario
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [otherLastActive, setOtherLastActive] = useState(null);

  // Notificar en Firestore que el usuario actual está activo dentro de este chat
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    setUserActiveInChat(conversationId, currentUser, true);
    return () => {
      setUserActiveInChat(conversationId, currentUser, false);
    };
  }, [conversationId, currentUser]);

  // Suscribirse al estado en línea (presence) del interlocutor en tiempo real
  useEffect(() => {
    const target = otherParticipant?.id ? otherParticipant : otherParticipantId;
    if (!target) return;
    const unsub = subscribeToUserOnlineStatus(target, (online, lastIso) => {
      setIsOtherOnline(Boolean(online));
      setOtherLastActive(lastIso || null);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [otherParticipantId, otherParticipant?.id, otherParticipant?.uid]);

  // Desplazamiento automático al final ante nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Selección de archivo de imagen (Galería o Cámara)
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const compressedDataUrl = await compressImage(file, 1024, 1024, 0.78);
      setPendingImage({
        dataUrl: compressedDataUrl,
        caption: ""
      });
      setIsAttachmentMenuOpen(false);
    } catch (err) {
      alert("Error al procesar la imagen: " + (err.message || "Formato no válido"));
    }
  };

  // Enviar imagen normal (almacenada localmente en el dispositivo)
  const handleSendPendingImage = async () => {
    if (!pendingImage || sending) return;
    setSending(true);

    const { dataUrl, caption } = pendingImage;
    setPendingImage(null);

    try {
      await sendImageMessage({
        conversationId,
        sender: currentUser,
        imageData: dataUrl,
        caption
      });
    } catch (err) {
      alert("Error al enviar la imagen: " + err.message);
    } finally {
      setSending(false);
    }
  };

  // Abrir imagen a pantalla completa con entrada de historial para captura de controles táctiles hacia atrás
  const handleOpenFullscreenImage = (imageSrc, caption = "") => {
    setActiveFullscreenImage({ src: imageSrc, caption });
    // Insertar entrada en el historial para que el gesto de retroceso del móvil cierre la foto en vez de salir del chat
    window.history.pushState({ modal: "fullscreen-image" }, "");
  };

  // Cerrar imagen a pantalla completa y sincronizar historial
  const handleCloseFullscreenImage = () => {
    if (activeFullscreenImage) {
      setActiveFullscreenImage(null);
      if (window.history.state?.modal === "fullscreen-image") {
        window.history.back();
      }
    }
  };

  // Interceptar el gesto táctil del sistema hacia atrás (o botón atrás) para cerrar el visor y quedarse en el chat
  useEffect(() => {
    const handlePopState = () => {
      if (activeFullscreenImage) {
        setActiveFullscreenImage(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeFullscreenImage]);

  // Controles táctiles directos de arrastre / deslizamiento sobre la imagen (Swipe to dismiss)
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    touchCoordsRef.current.startX = e.touches[0].clientX;
    touchCoordsRef.current.startY = e.touches[0].clientY;
    touchCoordsRef.current.currentX = e.touches[0].clientX;
    touchCoordsRef.current.currentY = e.touches[0].clientY;
    setIsDraggingTouch(true);
  };

  const handleTouchMove = (e) => {
    if (!isDraggingTouch || e.touches.length !== 1) return;
    touchCoordsRef.current.currentX = e.touches[0].clientX;
    touchCoordsRef.current.currentY = e.touches[0].clientY;
    const dx = touchCoordsRef.current.currentX - touchCoordsRef.current.startX;
    const dy = touchCoordsRef.current.currentY - touchCoordsRef.current.startY;

    // Permitir arrastre hacia la derecha (retroceder) o hacia abajo (descartar)
    if (dx > 0 || Math.abs(dy) > 0) {
      setTouchTranslate({
        x: Math.max(0, dx),
        y: dy
      });
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingTouch) return;
    setIsDraggingTouch(false);
    const dx = touchCoordsRef.current.currentX - touchCoordsRef.current.startX;
    const dy = touchCoordsRef.current.currentY - touchCoordsRef.current.startY;

    // Si se deslizó más de 75px hacia la derecha (gesto atrás) o más de 95px hacia abajo
    if (dx > 75 || Math.abs(dy) > 95) {
      handleCloseFullscreenImage();
    }
    setTouchTranslate({ x: 0, y: 0 });
  };

  // Alternar selección de mensaje
  const toggleSelectMessage = (msgId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  // Manejador de inicio de pulsación prolongada (Long Press) para seleccionar
  const handleMessagePointerDown = (msg) => {
    if (msg.isSystem) return;
    isLongPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (_) { }
      }
      setSelectedMessageIds((prev) => (prev.includes(msg.id) ? prev : [...prev, msg.id]));
    }, 450);
  };

  // Cancelar temporizador si se suelta el dedo antes de los 450ms
  const handleMessagePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Clic en mensaje: si está activo el modo selección, selecciona/deselecciona
  const handleMessageClick = (msg) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    if (selectedMessageIds.length > 0) {
      if (msg.isSystem) return;
      toggleSelectMessage(msg.id);
    }
  };

  // Cancelar modo selección
  const handleCancelSelection = () => {
    setSelectedMessageIds([]);
    setIsDeleteModalOpen(false);
  };

  // Tick de tiempo en tiempo real (cada 1s) para actualizar el contador en reversa de "Eliminar para todos"
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [deleteFromGallery, setDeleteFromGallery] = useState(true);

  useEffect(() => {
    if (!isDeleteModalOpen && selectedMessageIds.length === 0) return;
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isDeleteModalOpen, selectedMessageIds.length]);

  // Mensajes seleccionados y verificación de la regla de los 15 minutos
  const selectedMessages = messages.filter((m) => selectedMessageIds.includes(m.id));
  const canDeleteForAll = canDeleteMessagesForAll(selectedMessages, currentUser);
  const hasImageSelected = selectedMessages.some((m) => m.type === "image" && Boolean(m.image));

  // Calcula el texto del contador en reversa exacto para la opción "Eliminar para todos"
  const getDeleteForAllRemainingText = () => {
    if (!canDeleteForAll || selectedMessages.length === 0) return "";
    const oldestMsgTime = Math.min(
      ...selectedMessages.map((m) => new Date(m.createdAt).getTime())
    );
    const remainingMs = Math.max(0, DELETE_FOR_ALL_LIMIT_MS - (nowTick - oldestMsgTime));
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    const formattedTime = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    return `Disponible (${formattedTime})`;
  };

  // Ejecutar "Eliminar para mí"
  const handleDeleteForMe = () => {
    if (selectedMessageIds.length === 0) return;
    deleteMessagesForMe(conversationId, selectedMessageIds, { deleteFromGallery });
    setSelectedMessageIds([]);
    setIsDeleteModalOpen(false);
    setMessages(getStoredMessages(conversationId));
  };

  // Ejecutar "Eliminar para todos"
  const handleDeleteForAll = () => {
    if (selectedMessageIds.length === 0) return;
    try {
      deleteMessagesForAll(conversationId, selectedMessageIds, currentUser);
      setSelectedMessageIds([]);
      setIsDeleteModalOpen(false);
      setMessages(getStoredMessages(conversationId));
    } catch (err) {
      alert(err.message || "No fue posible eliminar para todos.");
    }
  };

  // Mientras se sincroniza una conversación recién abierta desde Firestore
  if (!conversation && isLoadingConv) {
    return (
      <div className="p-8 text-center space-y-3 max-w-sm mx-auto my-16 animate-fade-in">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
          <Clock className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-300">Sincronizando conversación...</p>
      </div>
    );
  }

  // Si la conversación no existe
  if (!conversation) {
    return (
      <div className="p-8 text-center space-y-4 max-w-sm mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Conversación no encontrada</h2>
        <p className="text-xs text-slate-400">Este chat no existe o fue eliminado.</p>
        <button
          onClick={() => navigate("/messages", { replace: true })}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Volver a mis mensajes
        </button>
      </div>
    );
  }

  // Candidatos de identificación del interlocutor y verificación de actividad en chat
  const otherCandidates = getUserCandidateKeys(otherParticipant || otherParticipantId);
  const isOtherActiveInChat = Boolean(
    conversation?.activeInChat &&
    typeof conversation.activeInChat === "object" &&
    otherCandidates.some((c) => c && conversation.activeInChat?.[c] === true)
  );

  // Estados derivados de bloqueo y silencio
  const isBlocked = Boolean(conversation.blockedBy);
  const isBlockedByMe = conversation.blockedBy === currentUserId;
  const isBlockedByOther = isBlocked && !isBlockedByMe;
  const muteStatus = getChatMuteStatus(conversation, currentUser);

  const handleChatSwipeStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      chatSwipeStartXRef.current = e.touches[0].clientX;
      chatSwipeStartYRef.current = e.touches[0].clientY;
      chatSwipeStartTimeRef.current = Date.now();
    }
  };

  const handleChatSwipeEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - chatSwipeStartXRef.current;
    const diffY = e.changedTouches[0].clientY - chatSwipeStartYRef.current;
    const elapsed = Date.now() - chatSwipeStartTimeRef.current;

    // Deslizar con el dedo de izquierda a derecha desde el borde (< 90px)
    if (diffX > 65 && Math.abs(diffY) < 55 && elapsed < 600 && chatSwipeStartXRef.current < 90) {
      handleBack();
    }
  };

  const handleBack = () => {
    // Si provino de la notificación flotante in-app (Toast):
    // "si se retrocede de ese chat (con el gesto tacti o con la flecha de retorno llevará al usuario a la panbtalla de chats, si se retrocede de ella, llevará al usuario a la pantalla donde estuviera antes de pulsar en la notifiacion del mensahe"
    const toastOrigin =
      location.state?.originPath ||
      (typeof window !== "undefined" && sessionStorage.getItem("anunciossv_toast_return_origin"));

    if (toastOrigin) {
      navigate("/messages", {
        replace: true,
        state: { fromToastOrigin: toastOrigin }
      });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/messages", { replace: true });
    }
  };

  const handleSendMessage = async (textToSend) => {
    if (isBlocked) return;
    const text = typeof textToSend === "string" ? textToSend : inputText;
    if (!text.trim() || sending) return;

    const trimmedText = text.trim();
    setSending(true);
    setInputText("");
    inputRef.current?.focus();

    try {
      // sendMessage inserta el mensaje localmente en 0 ms con estado "enviando" y lo confirma con Firestore
      await sendMessage({
        conversationId,
        sender: currentUser,
        text: trimmedText
      });
    } catch (err) {
      alert("Error al enviar el mensaje: " + err.message);
    } finally {
      setSending(false);
    }
  };

  // Activa o desactiva los mensajes temporales
  const handleToggleTemporaryMode = () => {
    const newStatus = !Boolean(conversation?.isTemporary);
    const hours = conversation?.temporaryHours || 24;
    setTemporaryChatConfig(conversationId, { isTemporary: newStatus, hours }, currentUser);
  };

  // Cambia la vigencia de los mensajes temporales (12h, 24h, 72h)
  const handleSelectTemporaryHours = (hours) => {
    setTemporaryChatConfig(conversationId, { isTemporary: true, hours }, currentUser);
  };

  // Alterna el estado de silencio
  const handleToggleMute = () => {
    if (muteStatus.isMuted) {
      setChatMute(conversationId, { isMuted: false }, currentUser);
    } else {
      // Silenciar por defecto 24 horas
      setChatMute(conversationId, { isMuted: true, duration: "24h" }, currentUser);
    }
  };

  // Cambia la duración del silencio (6h, 12h, 24h, always)
  const handleSelectMuteDuration = (duration) => {
    setChatMute(conversationId, { isMuted: true, duration }, currentUser);
  };

  // Solicitar confirmación para vaciar la copia de la conversación
  const promptClearConversation = () => {
    setConfirmModal({
      type: "clear",
      title: "¿Vaciar tu copia del chat?",
      description: "Se eliminarán todos los mensajes de tu dispositivo. Esta acción solo afectará tu copia de la conversación y no se puede deshacer.",
      confirmLabel: "Sí, vaciar mi copia",
      isDestructive: true
    });
  };

  // Solicitar confirmación para bloquear usuario
  const promptBlockUser = () => {
    if (isBlockedByMe) {
      // Desbloquear directamente
      toggleBlockUser(conversationId, currentUser);
    } else {
      setConfirmModal({
        type: "block",
        title: `¿Bloquear a ${otherParticipant.name}?`,
        description: "Ya no podrán enviarse mensajes mutuamente y la conversación se pausará. Podrás desbloquearlo en cualquier momento desde estos ajustes.",
        confirmLabel: "Bloquear usuario",
        isDestructive: true
      });
    }
  };

  // Ejecución de la acción confirmada en el modal personalizado
  const handleConfirmAction = () => {
    if (!confirmModal) return;

    if (confirmModal.type === "clear") {
      clearConversationMessages(conversationId);
      setMessages([]);
      setConfirmModal(null);
      handleCloseSettings();
    } else if (confirmModal.type === "block") {
      toggleBlockUser(conversationId, currentUser);
      setConfirmModal(null);
    }
  };

  // Identifica si un mensaje fue enviado por el usuario actual contrastando múltiples identificadores
  const isMessageFromMe = (msg) => {
    if (!msg || !currentUser) return false;
    const myIdentifiers = [
      currentUser.id,
      currentUser.uid,
      currentUser.email,
      currentUser.username,
      currentUserId
    ].filter(Boolean).map((v) => String(v).trim().toLowerCase().replace(/^@/, ""));

    const senderIdentifiers = [
      msg.senderId,
      msg.senderUsername,
      msg.senderEmail
    ].filter(Boolean).map((v) => String(v).trim().toLowerCase().replace(/^@/, ""));

    return myIdentifiers.some((id) => senderIdentifiers.includes(id));
  };

  // Renderiza el estado visual del mensaje ("Enviando", "Enviado", "Recibido", "Leído")
  const renderMessageStatus = (msg) => {
    // 1. Mensaje en proceso de envío
    if (msg.status === "enviando" || String(msg.id).startsWith("temp_")) {
      return (
        <span className="flex items-center gap-1 text-[9px] text-indigo-300 font-medium">
          <Clock className="w-2.5 h-2.5 animate-pulse" />
          <span>Enviando</span>
        </span>
      );
    }

    // 2. Mensaje con fallo de sincronización
    if (msg.status === "error") {
      return (
        <span className="flex items-center gap-1 text-[9px] text-amber-300 font-semibold">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>Sin conexión</span>
        </span>
      );
    }

    const msgTimeMs = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;

    // Obtener marcas de tiempo de lectura y entrega del interlocutor en la conversación
    const getPeerMapTimestamp = (mapObj) => {
      if (!mapObj || typeof mapObj !== "object") return 0;
      let latest = 0;
      otherCandidates.forEach((cand) => {
        if (!cand) return;
        const val = mapObj[cand];
        if (!val) return;
        const ms = typeof val === "string" ? new Date(val).getTime() : (val?.seconds ? val.seconds * 1000 : 0);
        if (!isNaN(ms) && ms > latest) latest = ms;
      });
      return latest;
    };

    const otherLastSeenMs = getPeerMapTimestamp(conversation?.lastSeenInChat);
    const otherLastDeliveredMs = getPeerMapTimestamp(conversation?.lastDeliveredAt);

    // 3. Leído: confirmado en el mensaje, interlocutor dentro del chat o vio el chat después de crearse el mensaje
    const isReadByOther =
      msg.read === true ||
      msg.status === "leido" ||
      isOtherActiveInChat ||
      (otherLastSeenMs > 0 && msgTimeMs > 0 && otherLastSeenMs >= msgTimeMs);

    if (isReadByOther) {
      return (
        <span className="flex items-center gap-1 text-[9px] text-cyan-300 font-bold">
          <CheckCheck className="w-3 h-3 text-cyan-300" />
          <span>Leído</span>
        </span>
      );
    }

    // 4. Recibido: el interlocutor está conectado o su app ya confirmó entrega del mensaje
    const isReceived =
      msg.status === "recibido" ||
      isOtherOnline ||
      (otherLastDeliveredMs > 0 && msgTimeMs > 0 && otherLastDeliveredMs >= msgTimeMs);

    if (isReceived) {
      return (
        <span className="flex items-center gap-1 text-[9px] text-slate-300 font-medium">
          <CheckCheck className="w-3 h-3 text-slate-300" />
          <span>Recibido</span>
        </span>
      );
    }

    // 5. Enviado: almacenado en el servidor, pendiente de que el receptor se conecte
    return (
      <span className="flex items-center gap-1 text-[9px] text-indigo-200 font-medium">
        <Check className="w-2.5 h-2.5" />
        <span>Enviado</span>
      </span>
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentTemporaryHours = conversation.temporaryHours || 24;

  return (
    <div
      style={{ height: `${viewportHeight}px` }}
      onTouchStart={handleChatSwipeStart}
      onTouchEnd={handleChatSwipeEnd}
      className="flex flex-col w-full max-w-md mx-auto bg-slate-950 overflow-hidden relative select-none"
    >
      {/* 1. Bloque Superior FIJO: Cabecera y Publicación Negociada */}
      <div className="flex-shrink-0 z-40 bg-slate-950 border-b border-slate-800 shadow-md">
        {/* Cabecera normal estilo WhatsApp / iOS */}
        <header className="px-3 py-2.5 flex items-center justify-between gap-2 bg-slate-950">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Regresar a mensajes"
              className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all shadow-sm flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Al tocar el perfil desde el chat se envía state: { fromChat: true, chatPath, chatId } y ?from=chat&chatId=... para retorno y ocultar 'Enviar mensaje' */}
            <Link
              to={`/seller/${encodeURIComponent(otherParticipant.id || otherParticipant.name)}?from=chat&chatId=${encodeURIComponent(conversation?.id || conversationId || "")}`}
              state={{
                fromChat: true,
                chatPath: location.pathname + location.search,
                chatId: conversation?.id || conversationId,
                sellerData: {
                  id: otherParticipant.id,
                  name: otherParticipant.name,
                  avatar: otherParticipant.avatar,
                  username: otherParticipant.username,
                  rating: otherParticipant.rating || 5.0,
                  reviewsCount: otherParticipant.reviewsCount || 0,
                  verified: Boolean(otherParticipant.verified)
                }
              }}
              className="flex items-center gap-2.5 min-w-0 group"
            >
              <div className="relative flex-shrink-0">
                {otherParticipant.avatar ? (
                  <img
                    src={otherParticipant.avatar}
                    alt={otherParticipant.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700 group-hover:border-indigo-500 transition-colors"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 group-hover:border-indigo-500 transition-colors flex items-center justify-center text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <span
                  title={isOtherActiveInChat ? "En el chat" : isOtherOnline ? "Conectado" : "Desconectado"}
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 transition-colors ${isOtherActiveInChat
                    ? "bg-emerald-400 animate-pulse"
                    : isOtherOnline
                    ? "bg-emerald-500"
                    : "bg-slate-500"
                    }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h2 className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                    {otherParticipant.name}
                  </h2>
                  {muteStatus.isMuted && (
                    <BellOff className="w-3 h-3 text-slate-400 flex-shrink-0" title="Chat silenciado" />
                  )}
                </div>

                {isBlocked ? (
                  <p className="text-[10px] text-rose-400 font-semibold truncate flex items-center gap-1">
                    <Ban className="w-2.5 h-2.5" />
                    <span>Contacto bloqueado</span>
                  </p>
                ) : conversation.isTemporary ? (
                  <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                    <span>Temporales ({currentTemporaryHours}h) · {isOtherOnline || isOtherActiveInChat ? "Conectado" : "Desconectado"}</span>
                  </p>
                ) : isOtherActiveInChat ? (
                  <p className="text-[10px] text-emerald-400 font-semibold truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>Conectado · En el chat</span>
                  </p>
                ) : isOtherOnline ? (
                  <p className="text-[10px] text-emerald-400 font-medium truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Conectado</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 truncate">
                    Desconectado{otherLastActive ? ` · ${formatLastSeen(otherLastActive)}` : ""}
                  </p>
                )}
              </div>
            </Link>
          </div>

          {/* Botón de Ajustes y Configuración del Chat */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Ajustes de la conversación"
            className={`p-2 rounded-xl border text-xs flex items-center justify-center flex-shrink-0 transition-all active:scale-95 shadow-sm ${conversation.isTemporary
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
              : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            title="Ajustes del chat"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </header>

        {/* Publicación Negociada FIJA (siempre visible arriba si existe producto) */}
        {conversation.product && (() => {
          const liveProduct = conversation.product.id ? getProductById(conversation.product.id) : null;
          const currentProduct = liveProduct ? { ...conversation.product, ...liveProduct } : conversation.product;
          const priceInfo = formatProductPrice(currentProduct);

          const productChatLink = `/product/${currentProduct.id || conversation.product.id}?from=chat&chatId=${encodeURIComponent(conversation.id || conversationId || "")}`;
          const productChatState = {
            fromChat: true,
            chatPath: location.pathname + location.search,
            chatId: conversation.id || conversationId
          };

          return (
            <div className="px-3 pt-1 pb-2 bg-slate-950 border-t border-slate-900">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-sm">
                <Link
                  to={productChatLink}
                  state={productChatState}
                  className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition-opacity"
                >
                  <img
                    src={
                      currentProduct.image ||
                      (Array.isArray(currentProduct.images) && currentProduct.images[0]) ||
                      conversation.product.image ||
                      "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=200&q=80"
                    }
                    alt={currentProduct.title || conversation.product.title}
                    className="w-11 h-11 rounded-lg object-cover bg-slate-950 border border-slate-800 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Publicación negociada
                    </span>
                    <h3 className="text-xs font-bold text-white truncate">
                      {currentProduct.title || conversation.product.title}
                    </h3>
                    <span className="text-xs font-black text-indigo-400">
                      {priceInfo.isFree
                        ? "GRATIS"
                        : priceInfo.isContact
                          ? "💬 A consultar"
                          : `${priceInfo.text}${priceInfo.periodSuffix || ""}${priceInfo.currency ? ` ${priceInfo.currency}` : " USD"}`}
                    </span>
                  </div>
                </Link>

                <Link
                  to={productChatLink}
                  state={productChatState}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1 flex-shrink-0 transition-colors"
                >
                  <span>Ver</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 2. Flujo central de mensajes con desplazamiento independiente */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 overscroll-contain">
        {/* Aviso de seguridad para negociaciones seguras */}
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="leading-tight">
            Para tu seguridad, acuerda siempre entregas en lugares públicos concurridos de El Salvador y no envíes anticipos sin verificar el producto.
          </p>
        </div>

        {/* Indicador superior de modo temporal activo */}
        {conversation.isTemporary && (
          <div className="flex items-center justify-center my-1 animate-fade-in">
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-semibold flex items-center gap-1.5 shadow-sm">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Modo temporal activo: los mensajes se borran en {currentTemporaryHours} horas</span>
            </span>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="p-6 text-center text-slate-400 space-y-1.5 my-8">
            <p className="text-xs font-bold text-slate-300">Inicia la conversación</p>
            <p className="text-[11px]">Envía un mensaje para ponerte de acuerdo con el vendedor.</p>
          </div>
        ) : (
          messages.map((msg) => {
            // Renderizado especial de mensajes del sistema (notificaciones de temporales activados, etc.)
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2 animate-fade-in select-none">
                  <div className="max-w-[90%] px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-medium text-center shadow-sm flex items-center gap-1.5 justify-center">
                    <span>{msg.text}</span>
                  </div>
                </div>
              );
            }

            const isMe = isMessageFromMe(msg);
            const isSelected = selectedMessageIds.includes(msg.id);
            const isSelectionMode = selectedMessageIds.length > 0;

            // Renderizado de mensaje eliminado para todos
            if (msg.isDeletedForAll) {
              return (
                <div
                  key={msg.id}
                  onPointerDown={() => handleMessagePointerDown(msg)}
                  onPointerUp={handleMessagePointerUp}
                  onPointerLeave={handleMessagePointerUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleMessagePointerDown(msg);
                  }}
                  onClick={() => handleMessageClick(msg)}
                  className={`flex items-center gap-2 ${isMe ? "justify-end" : "justify-start"} animate-message-enter select-none cursor-pointer`}
                >
                  {/* Checkbox en modo selección */}
                  {isSelectionMode && (
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isSelected
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 scale-105"
                        : "border-2 border-slate-600 bg-slate-900/80"
                        }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm border transition-all ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-950/40 border-indigo-500/40" : ""
                      } ${isMe
                        ? "bg-slate-900/60 border-slate-800 text-slate-400 rounded-br-xs"
                        : "bg-slate-900/40 border-slate-800/80 text-slate-400 rounded-bl-xs"
                      }`}
                  >
                    <p className="italic flex items-center gap-1.5 text-slate-400">
                      <Ban className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span>{isMe ? "Eliminaste este mensaje" : "Este mensaje fue eliminado"}</span>
                    </p>
                    <div className="flex items-center gap-1 justify-end text-[9px] text-slate-500 mt-1">
                      <span>{formatMessageTime(msg.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            // Renderizado de mensaje de tipo imagen (almacenadas localmente en el dispositivo)
            if (msg.type === "image") {
              return (
                <div
                  key={msg.id}
                  onPointerDown={() => handleMessagePointerDown(msg)}
                  onPointerUp={handleMessagePointerUp}
                  onPointerLeave={handleMessagePointerUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleMessagePointerDown(msg);
                  }}
                  onClick={() => handleMessageClick(msg)}
                  className={`flex items-center gap-2 ${isMe ? "justify-end" : "justify-start"} animate-message-enter select-none cursor-pointer`}
                >
                  {/* Checkbox en modo selección */}
                  {isSelectionMode && (
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isSelected
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 scale-105"
                        : "border-2 border-slate-600 bg-slate-900/80"
                        }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl text-xs leading-relaxed shadow-md overflow-hidden relative transition-all ${isSelected ? "ring-2 ring-indigo-500 shadow-indigo-500/30 scale-[1.01]" : ""
                      } ${isMe
                        ? "bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white rounded-br-xs"
                        : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs"
                      }`}
                  >
                    <div>
                      {msg.image ? (
                        <div
                          onClick={(e) => {
                            if (isSelectionMode) {
                              e.stopPropagation();
                              toggleSelectMessage(msg.id);
                            } else {
                              handleOpenFullscreenImage(msg.image, msg.caption);
                            }
                          }}
                          className="relative cursor-pointer group bg-black/30 overflow-hidden"
                          title={isSelectionMode ? "Seleccionar mensaje" : "Toca para ver en pantalla completa"}
                        >
                          <img
                            src={msg.image}
                            alt="Foto enviada"
                            className="w-full max-h-72 object-cover transition-transform group-hover:scale-[1.02] active:scale-95"
                          />
                          {!isSelectionMode && (
                            <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <Maximize2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-slate-400 space-y-1">
                          <ImageIcon className="w-6 h-6 mx-auto text-slate-500" />
                          <p className="text-[11px]">Imagen no disponible en este dispositivo</p>
                        </div>
                      )}

                      {msg.caption && (
                        <p className="px-3 py-2 text-xs text-white whitespace-pre-wrap">
                          {msg.caption}
                        </p>
                      )}

                      <div
                        className={`flex items-center gap-1.5 justify-end text-[9px] px-3 pb-2 pt-0.5 select-none ${isMe ? "text-indigo-200" : "text-slate-400"
                          }`}
                      >
                        <span title="Almacenada exclusivamente en este dispositivo" className="opacity-80">
                          📱 Local
                        </span>
                        <span>{formatMessageTime(msg.createdAt)}</span>
                        {isMe && (
                          <>
                            <span className="text-[8px] opacity-70">·</span>
                            {renderMessageStatus(msg)}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Renderizado de mensaje de texto normal
            return (
              <div
                key={msg.id}
                onPointerDown={() => handleMessagePointerDown(msg)}
                onPointerUp={handleMessagePointerUp}
                onPointerLeave={handleMessagePointerUp}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleMessagePointerDown(msg);
                }}
                onClick={() => handleMessageClick(msg)}
                className={`flex items-center gap-2 ${isMe ? "justify-end" : "justify-start"} animate-message-enter select-none cursor-pointer`}
              >
                {/* Checkbox en modo selección */}
                {isSelectionMode && (
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isSelected
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 scale-105"
                      : "border-2 border-slate-600 bg-slate-900/80"
                      }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                )}

                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-md break-words relative transition-all ${isSelected ? "ring-2 ring-indigo-500 shadow-indigo-500/30 scale-[1.01]" : ""
                    } ${isMe
                      ? "bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white rounded-br-xs"
                      : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs"
                    }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  <div
                    className={`flex items-center gap-1.5 justify-end text-[9px] mt-1 pt-0.5 select-none ${isMe ? "text-indigo-200" : "text-slate-400"
                      }`}
                  >
                    {msg.isTemporary && (
                      <span title="Mensaje temporal" className="opacity-90">
                        ⏱️
                      </span>
                    )}
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMe && (
                      <>
                        <span className="text-[8px] opacity-70">·</span>
                        {renderMessageStatus(msg)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Bloque Inferior FIJO: Sugerencias y Campo para escribir mensaje (o Barra de selección) */}
      <div className="flex-shrink-0 z-40 bg-slate-950 border-t border-slate-800/90 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        {selectedMessageIds.length > 0 ? (
          /* Barra de acción contextual inferior con el contador y las opciones disponibles */
          <div className="p-2.5 bg-slate-900 border-t border-indigo-500/40 flex items-center justify-between gap-2 animate-slide-up-sheet">
            {/* Lado izquierdo: Botón X para cancelar y contador de seleccionados */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={handleCancelSelection}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors active:scale-95 flex-shrink-0"
                title="Deseleccionar mensajes"
                aria-label="Deseleccionar mensajes"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  {selectedMessageIds.length} {selectedMessageIds.length === 1 ? " seleccionado" : " seleccionados"}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Toca otros para agregar o quitar.
                </span>
              </div>
            </div>

            {/* Lado derecho: Botón Eliminar mensajes seleccionados */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition-all active:scale-95 flex items-center gap-1.5"
                title="Eliminar mensajes seleccionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        ) : isBlocked ? (
          <div className="p-3 bg-slate-900/90 border-t border-rose-500/20 text-center space-y-1.5">
            <p className="text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              <span>
                {isBlockedByMe
                  ? "Has bloqueado a este usuario"
                  : "Este usuario te ha bloqueado"}
              </span>
            </p>
            {isBlockedByMe && (
              <button
                type="button"
                onClick={() => toggleBlockUser(conversationId, currentUser)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all active:scale-95"
              >
                Desbloquear para enviar mensajes
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Sugerencias rápidas de negociación */}
            <div className="px-3 py-1.5 bg-slate-950 overflow-x-auto no-scrollbar flex items-center gap-1.5 border-b border-slate-900">
              {QUICK_SUGGESTIONS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(chip)}
                  className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white whitespace-nowrap transition-colors flex-shrink-0 active:scale-95 shadow-sm"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Formulario fijo con campo de texto y botón para adjuntar fotos */}
            <footer className="p-2.5 bg-slate-950">
              {/* Inputs ocultos para Galería y Cámara */}
              <input
                ref={fileInputGalleryRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
              <input
                ref={fileInputCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageFileChange}
                className="hidden"
              />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                {/* Botón de cámara / adjuntar foto */}
                <button
                  type="button"
                  onClick={() => setIsAttachmentMenuOpen(true)}
                  className="w-11 h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all shadow-sm flex-shrink-0 active:scale-95"
                  aria-label="Adjuntar foto de cámara o galería"
                  title="Enviar foto"
                >
                  <Camera className="w-5 h-5 text-indigo-400" />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  required
                  value={inputText}
                  onFocus={handleInputFocus}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje de texto..."
                  className="flex-1 min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-[16px] sm:text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md shadow-indigo-600/30 flex-shrink-0 active:scale-95"
                  aria-label="Enviar mensaje"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>
            </footer>
          </>
        )}
      </div>

      {/* 4. Menú / Bottom Sheet de Ajustes de Configuración del Chat con apertura y cierre suaves */}
      {isSettingsOpen && (
        <div
          onClick={handleCloseSettings}
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isSettingsClosing ? "opacity-0" : "opacity-100 animate-fade-in"
            }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md bg-slate-950 border-t border-slate-800 rounded-t-3xl shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto ${isSettingsClosing ? "animate-slide-down-sheet" : "animate-slide-up-sheet"
              }`}
          >
            {/* Tirador visual estilo iOS */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />

            {/* Cabecera del Menú con Botón X de cierre */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Ajustes del Chat</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseSettings}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors active:scale-95"
                aria-label="Cerrar ajustes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sección 1: Mensajes Temporales (con selector 12h, 24h, 72h y explicación resumida) */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Mensajes temporales</h4>
                    <span className="text-[11px] text-slate-400 block">
                      Los mensajes nuevos desaparecerán tras el tiempo elegido.
                    </span>
                  </div>
                </div>

                {/* Switch interactivo de activación */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(conversation.isTemporary)}
                  onClick={handleToggleTemporaryMode}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 focus:outline-none ${conversation.isTemporary ? "bg-amber-500" : "bg-slate-700"
                    }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-md ${conversation.isTemporary ? "translate-x-6" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Selector de vigencia: 12 horas, 24 horas, 72 horas */}
              {conversation.isTemporary && (
                <div className="pt-1 border-t border-slate-800/80 animate-fade-in space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Tiempo de vigencia
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[12, 24, 72].map((hours) => {
                      const isSelected = currentTemporaryHours === hours;
                      return (
                        <button
                          key={hours}
                          type="button"
                          onClick={() => handleSelectTemporaryHours(hours)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center border ${isSelected
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                            : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                            }`}
                        >
                          {hours} horas
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sección 2: Silenciar Chat (6h, 12h, 24h, Siempre) */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BellOff className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Silenciar notificaciones</h4>
                    <span className="text-[11px] text-slate-400 block">
                      {muteStatus.text}
                    </span>
                  </div>
                </div>

                {/* Switch interactivo de silencio */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={muteStatus.isMuted}
                  onClick={handleToggleMute}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 focus:outline-none ${muteStatus.isMuted ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-md ${muteStatus.isMuted ? "translate-x-6" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Selector de duración de silencio */}
              {muteStatus.isMuted && (
                <div className="pt-1 border-t border-slate-800/80 animate-fade-in space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Silenciar por
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "6h", label: "6 horas" },
                      { id: "12h", label: "12 horas" },
                      { id: "24h", label: "24 horas" },
                      { id: "always", label: "Siempre" }
                    ].map((item) => {
                      const isSelected = (muteStatus.duration || "24h") === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectMuteDuration(item.id)}
                          className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center border truncate ${isSelected
                            ? "bg-indigo-600/25 text-indigo-300 border-indigo-500/50 shadow-sm"
                            : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                            }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sección 3: Bloquear Usuario */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Ban className={`w-4 h-4 flex-shrink-0 ${isBlockedByMe ? "text-emerald-400" : "text-rose-400"}`} />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {isBlockedByMe ? "Desbloquear usuario" : "Bloquear usuario"}
                  </h4>
                  <span className="text-[11px] text-slate-400 block">
                    {isBlockedByMe
                      ? "Permitir volver a recibir mensajes"
                      : "Pausar conversación y no recibir mensajes"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={promptBlockUser}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex-shrink-0 ${isBlockedByMe
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400"
                  }`}
              >
                {isBlockedByMe ? "Desbloquear" : "Bloquear"}
              </button>
            </div>

            {/* Sección 4: Vaciar Copia del Chat */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">Vaciar conversación</h4>
                  <span className="text-[11px] text-slate-400 block">
                    Se vaciará tu copia de la conversación sin afectar la del otro usuario.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={promptClearConversation}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors active:scale-95 flex-shrink-0"
              >
                Vaciar copia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal de Confirmación Personalizado (Aparece SOBRE el menú de ajustes z-[70]) */}
      {confirmModal && (
        <div
          onClick={() => setConfirmModal(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-backdrop-enter"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-up"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {confirmModal.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmAction}
                className={`py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95 ${confirmModal.isDestructive
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
                  }`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5.1 Modal de Confirmación de Eliminación de Mensajes (Eliminar para mí vs Eliminar para todos) */}
      {isDeleteModalOpen && (
        <div
          onClick={() => setIsDeleteModalOpen(false)}
          className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-backdrop-enter"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-up text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">
                ¿Eliminar {selectedMessageIds.length === 1 ? "este mensaje" : `${selectedMessageIds.length} mensajes`}?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Elige cómo deseas eliminar los mensajes seleccionados de la conversación.
              </p>
            </div>

            <div className="space-y-2.5 pt-1 text-left">
              {/* Opción 1: Eliminar para todos (Solo se muestra SI está disponible; no se muestra nada cuando no lo está) */}
              {canDeleteForAll && (
                <button
                  type="button"
                  onClick={handleDeleteForAll}
                  className="w-full p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-start gap-3 shadow-md shadow-indigo-600/30 transition-all active:scale-95 group text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="block text-xs font-bold text-white text-left">
                      Eliminar para todos
                    </span>
                    <span className="block text-[10px] text-indigo-200 text-left font-medium">
                      {getDeleteForAllRemainingText()}
                    </span>
                  </div>
                </button>
              )}

              {/* Opción 2: Cápsula integrada de "Eliminar para mí" con la opción de galería debajo */}
              <div className="rounded-2xl bg-rose-500/15 border border-rose-500/30 overflow-hidden text-left transition-all shadow-sm">
                {/* Botón principal: Eliminar para mí */}
                <button
                  type="button"
                  onClick={handleDeleteForMe}
                  className="w-full p-3 hover:bg-rose-500/20 flex items-center justify-start gap-3 transition-colors active:scale-[0.99] group text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="block text-xs font-bold text-rose-300 text-left">
                      Eliminar para mí
                    </span>
                    <span className="block text-[10px] text-rose-400/80 text-left font-normal">
                      Se borrará solo de tu dispositivo
                    </span>
                  </div>
                </button>

                {/* Casilla integrada debajo del botón: Eliminar también de la galería (si hay imágenes seleccionadas) */}
                {hasImageSelected && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteFromGallery(!deleteFromGallery);
                    }}
                    className="border-t border-rose-500/20 px-3 py-2.5 bg-black/25 hover:bg-black/35 flex items-center gap-2.5 cursor-pointer select-none transition-colors text-left"
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${deleteFromGallery
                        ? "bg-rose-500 border-rose-400 text-white shadow-sm"
                        : "bg-slate-900 border-slate-700 text-transparent"
                        }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span className="text-xs font-medium text-rose-200/90 hover:text-white transition-colors text-left">
                      Eliminar también de la galería
                    </span>
                  </div>
                )}
              </div>

              {/* Opción 3: Cancelar */}
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 transition-colors text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Menú para Seleccionar Foto (Cámara o Galería) */}
      {isAttachmentMenuOpen && (
        <div
          onClick={() => setIsAttachmentMenuOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-950 border-t border-slate-800 rounded-t-3xl shadow-2xl p-5 space-y-3 animate-slide-up-sheet"
          >
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Enviar una imagen
              </h4>
              <button
                type="button"
                onClick={() => setIsAttachmentMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAttachmentMenuOpen(false);
                  fileInputCameraRef.current?.click();
                }}
                className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 flex flex-col items-center justify-center gap-2 text-white transition-all active:scale-95 group shadow-sm"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">Tomar foto</span>
                <span className="text-[10px] text-slate-400">Usar la cámara</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAttachmentMenuOpen(false);
                  fileInputGalleryRef.current?.click();
                }}
                className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 flex flex-col items-center justify-center gap-2 text-white transition-all active:scale-95 group shadow-sm"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">Galería</span>
                <span className="text-[10px] text-slate-400">Elegir de fotos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal de Previsualización antes de enviar foto */}
      {pendingImage && (
        <div className="fixed inset-0 z-[80] bg-slate-950 flex flex-col justify-between p-4 animate-fade-in select-none">
          {/* Cabecera */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1.5 text-xs font-bold active:scale-95"
            >
              <X className="w-4 h-4" />
              <span>Descartar</span>
            </button>

            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Vista previa
            </span>

            <div className="w-16" />
          </div>

          {/* Área de la imagen centrada */}
          <div className="flex-1 flex items-center justify-center p-2 relative overflow-hidden">
            <img
              src={pendingImage.dataUrl}
              alt="Foto por enviar"
              className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800/80"
            />
          </div>

          {/* Barra inferior: Pie de foto y botón enviar */}
          <div className="space-y-3 pt-2 border-t border-slate-800/90">
            <div className="text-[10px] text-slate-400 text-center">
              Las imágenes se guardan exclusivamente en tu dispositivo.
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pendingImage.caption}
                onChange={(e) =>
                  setPendingImage((prev) => ({
                    ...prev,
                    caption: e.target.value
                  }))
                }
                placeholder="Añade un comentario (opcional)..."
                className="flex-1 min-h-[44px] px-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />

              <button
                type="button"
                disabled={sending}
                onClick={handleSendPendingImage}
                className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md shadow-indigo-600/30 flex-shrink-0 active:scale-95"
                title="Enviar foto"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Visor a Pantalla Completa para Fotos con Gestos Táctiles de Retroceso al Chat */}
      {activeFullscreenImage && (
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleCloseFullscreenImage}
          className="fixed inset-0 z-[90] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 animate-fade-in select-none touch-none"
          style={{
            transform: `translate3d(${touchTranslate.x}px, ${touchTranslate.y}px, 0)`,
            transition: isDraggingTouch ? "none" : "transform 0.25s ease-out, opacity 0.25s ease-out",
            opacity: isDraggingTouch
              ? Math.max(0.4, 1 - (touchTranslate.x + Math.abs(touchTranslate.y)) / 400)
              : 1
          }}
        >
          {/* Cabecera del Visor con botón Volver al Chat y Botón X */}
          <div
            className="flex items-center justify-between pb-2 border-b border-white/10 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseFullscreenImage}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-colors"
              title="Volver al chat"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Volver al chat</span>
            </button>

            <button
              type="button"
              onClick={handleCloseFullscreenImage}
              className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors active:scale-95"
              aria-label="Cerrar foto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Área de la imagen con soporte táctil */}
          <div
            className="flex-1 flex flex-col items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeFullscreenImage.src || activeFullscreenImage}
              alt="Foto en pantalla completa"
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform"
            />
            {activeFullscreenImage.caption && (
              <p className="mt-3 text-xs text-white/90 text-center max-w-sm px-4 py-2 bg-black/60 backdrop-blur-sm rounded-xl">
                {activeFullscreenImage.caption}
              </p>
            )}
          </div>

          {/* Pie informativo: indicaciones táctiles */}
          <div
            className="text-center pb-2 z-20 flex flex-col items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[11px] text-slate-400 font-medium">
              Desliza hacia atrás o hacia abajo para volver al chat
            </span>
            <span className="text-[9px] text-slate-500">
              Almacenada exclusivamente en este dispositivo
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDetailPage;

