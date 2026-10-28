// Servicio centralizado y reactivo de mensajería interna para AnunciosSV
// Soporta sincronización en tiempo real con Firestore y respaldo local en localStorage
import { db, isFirebaseConfigured } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { getPublicProfile, resolveUserAvatar, PROFILE_UPDATED_EVENT } from "./userProfileService.js";

const STORAGE_KEY_CONVERSATIONS = "anunciossv_conversations_v1";
const STORAGE_KEY_MESSAGES_PREFIX = "anunciossv_messages_v1_";
const STORAGE_KEY_BLOCKED_USERS = "anunciossv_blocked_users_v1";
export const CHAT_EVENT = "anunciossv_chat_updated";

// Semilla de conversaciones de ejemplo para demostración si el almacenamiento local está vacío
const INITIAL_DEMO_CONVERSATIONS = [
  {
    id: "conv_demo_usr01",
    participants: ["usr-01", "usr-admin"],
    participantsData: {
      "usr-01": {
        id: "usr-01",
        name: "Carlos Méndez",
        username: "carlos_mendez",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
      },
      "usr-admin": {
        id: "usr-admin",
        name: "Admin Webmaster",
        username: "admin_sv",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80"
      }
    },
    product: {
      id: "prod-01",
      title: "iPhone 13 Pro Max 128GB - Impecable",
      price: 680,
      currency: "USD",
      priceMode: "fixed",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80"
    },
    lastMessage: "Hola, ¿podemos acordar la entrega en Metrocentro San Salvador?",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    lastSenderId: "usr-01",
    unreadCounts: {
      "usr-01": 0,
      "usr-admin": 1
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  }
];

const INITIAL_DEMO_MESSAGES = {
  conv_demo_usr01: [
    {
      id: "msg_init_1",
      conversationId: "conv_demo_usr01",
      senderId: "usr-01",
      senderName: "Carlos Méndez",
      senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      text: "¡Hola! Vi tu publicación del iPhone 13 Pro Max. ¿Aún está disponible?",
      createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      status: "leido",
      read: true
    },
    {
      id: "msg_init_2",
      conversationId: "conv_demo_usr01",
      senderId: "usr-admin",
      senderName: "Admin Webmaster",
      senderAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
      text: "¡Hola Carlos! Sí, está completamente disponible y en excelente estado con batería al 89%.",
      createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      status: "leido",
      read: true
    },
    {
      id: "msg_init_3",
      conversationId: "conv_demo_usr01",
      senderId: "usr-01",
      senderName: "Carlos Méndez",
      senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      text: "Hola, ¿podemos acordar la entrega en Metrocentro San Salvador?",
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      status: "recibido",
      read: false
    }
  ]
};

// Dispara evento reactivo global para actualizar componentes suscritos
export const notifyChatUpdated = (detail = {}) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail }));
  }
};

/**
 * Enriquece la lista de conversaciones sincronizando los avatares y nombres
 * de los participantes con el registro central de perfiles actualizados
 */
const enrichConversationsWithLatestProfiles = (conversationsList) => {
  if (!Array.isArray(conversationsList)) return [];
  return conversationsList.map((conv) => {
    if (!conv?.participantsData || typeof conv.participantsData !== "object") return conv;

    let hasChange = false;
    const updatedParticipantsData = { ...conv.participantsData };

    Object.keys(updatedParticipantsData).forEach((pKey) => {
      const pData = updatedParticipantsData[pKey];
      if (!pData) return;
      const profile = getPublicProfile(pKey || pData.id || pData.username || pData.name);

      if (profile?.avatar && pData.avatar !== profile.avatar) {
        hasChange = true;
        updatedParticipantsData[pKey] = {
          ...pData,
          avatar: profile.avatar,
          name: profile.displayName || profile.name || pData.name
        };
      }
    });

    if (hasChange) {
      return {
        ...conv,
        participantsData: updatedParticipantsData
      };
    }
    return conv;
  });
};

/**
 * Obtiene todas las conversaciones almacenadas localmente
 */
export const getStoredConversations = () => {
  if (typeof window === "undefined") return INITIAL_DEMO_CONVERSATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(INITIAL_DEMO_CONVERSATIONS));
      return enrichConversationsWithLatestProfiles(INITIAL_DEMO_CONVERSATIONS);
    }
    const parsed = JSON.parse(raw);
    return enrichConversationsWithLatestProfiles(parsed);
  } catch (err) {
    console.error("Error al leer conversaciones de localStorage:", err);
    return enrichConversationsWithLatestProfiles(INITIAL_DEMO_CONVERSATIONS);
  }
};

/**
 * Guarda el listado de conversaciones en almacenamiento local
 */
const saveStoredConversations = (conversations) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations));
    notifyChatUpdated({ type: "conversations_updated" });
  } catch (err) {
    console.error("Error al guardar conversaciones en localStorage:", err);
  }
};

/**
 * Sincroniza inmediatamente la nueva foto de perfil y nombre en todas las conversaciones
 * y mensajes (en localStorage, memoria demo y Firestore).
 */
export const syncUserAvatarInChats = async (userOrIdentifier, newAvatar, newDisplayName = "") => {
  if (!userOrIdentifier || !newAvatar) return [];

  let userId = "";
  let username = "";
  let name = "";

  if (typeof userOrIdentifier === "object") {
    userId = String(userOrIdentifier.id || userOrIdentifier.uid || "").trim().toLowerCase();
    username = String(userOrIdentifier.username || "").trim().toLowerCase().replace(/^@/, "");
    name = String(userOrIdentifier.displayName || userOrIdentifier.name || "").trim().toLowerCase();
  } else {
    const raw = String(userOrIdentifier).trim().toLowerCase().replace(/^@/, "");
    userId = raw;
    username = raw;
    name = raw;
  }

  const allConversations = getStoredConversations();
  let conversationsUpdated = false;

  const updatedConversations = allConversations.map((conv) => {
    if (!conv.participantsData) return conv;

    let convChanged = false;
    const newPData = { ...conv.participantsData };

    Object.keys(newPData).forEach((key) => {
      const p = newPData[key];
      const pId = String(p.id || key).trim().toLowerCase();
      const pUsername = String(p.username || "").trim().toLowerCase().replace(/^@/, "");
      const pName = String(p.name || "").trim().toLowerCase();

      const isMatch =
        (userId && pId === userId) ||
        (username && pUsername === username) ||
        (name && (pName === name || pName === `@${name}`));

      if (isMatch) {
        convChanged = true;
        newPData[key] = {
          ...p,
          avatar: newAvatar,
          name: newDisplayName || p.name
        };
      }
    });

    // Sincronizar también los mensajes de esta conversación
    try {
      const rawMessages = getStoredMessages(conv.id);
      let messagesChanged = false;
      const updatedMessages = rawMessages.map((m) => {
        const mSenderId = String(m.senderId || "").trim().toLowerCase();
        const mSenderName = String(m.senderName || "").trim().toLowerCase();

        const isSenderMatch =
          (userId && mSenderId === userId) ||
          (name && (mSenderName === name || mSenderName === `@${name}`));

        if (isSenderMatch && m.senderAvatar !== newAvatar) {
          messagesChanged = true;
          return {
            ...m,
            senderAvatar: newAvatar,
            senderName: newDisplayName || m.senderName
          };
        }
        return m;
      });

      if (messagesChanged) {
        localStorage.setItem(STORAGE_KEY_MESSAGES_PREFIX + conv.id, JSON.stringify(updatedMessages));
      }
    } catch (err) {
      console.warn("Aviso al sincronizar mensajes del chat:", err);
    }

    if (convChanged) {
      conversationsUpdated = true;
      return {
        ...conv,
        participantsData: newPData
      };
    }
    return conv;
  });

  // Actualizar también en INITIAL_DEMO_CONVERSATIONS e INITIAL_DEMO_MESSAGES en memoria
  INITIAL_DEMO_CONVERSATIONS.forEach((conv) => {
    if (conv.participantsData) {
      Object.keys(conv.participantsData).forEach((k) => {
        const p = conv.participantsData[k];
        const pId = String(p.id || k).trim().toLowerCase();
        const pUsername = String(p.username || "").trim().toLowerCase().replace(/^@/, "");
        if ((userId && pId === userId) || (username && pUsername === username)) {
          p.avatar = newAvatar;
          if (newDisplayName) p.name = newDisplayName;
        }
      });
    }
  });

  Object.keys(INITIAL_DEMO_MESSAGES).forEach((convId) => {
    INITIAL_DEMO_MESSAGES[convId].forEach((msg) => {
      const mSenderId = String(msg.senderId || "").trim().toLowerCase();
      if (userId && mSenderId === userId) {
        msg.senderAvatar = newAvatar;
        if (newDisplayName) msg.senderName = newDisplayName;
      }
    });
  });

  if (conversationsUpdated) {
    saveStoredConversations(updatedConversations);
  }

  notifyChatUpdated({ type: "user_avatar_updated", userId, newAvatar });
  return updatedConversations;
};

/**
 * Obtiene los mensajes de una conversación, filtrando los mensajes temporales que hayan expirado
 */
export const getStoredMessages = (conversationId) => {
  if (!conversationId || typeof window === "undefined") return [];
  try {
    let rawMessages = [];
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId);
    if (!raw) {
      if (INITIAL_DEMO_MESSAGES[conversationId]) {
        rawMessages = INITIAL_DEMO_MESSAGES[conversationId];
        localStorage.setItem(
          STORAGE_KEY_MESSAGES_PREFIX + conversationId,
          JSON.stringify(rawMessages)
        );
      } else {
        return [];
      }
    } else {
      rawMessages = JSON.parse(raw);
    }

    // Filtrar mensajes temporales expirados (24 horas)
    const now = new Date();
    const validMessages = rawMessages.filter((msg) => {
      if (!msg.expiresAt) return true;
      const expireDate = new Date(msg.expiresAt);
      return !isNaN(expireDate.getTime()) && expireDate > now;
    });

    // Si expiró algún mensaje, actualizar almacenamiento automáticamente
    if (validMessages.length !== rawMessages.length) {
      localStorage.setItem(
        STORAGE_KEY_MESSAGES_PREFIX + conversationId,
        JSON.stringify(validMessages)
      );
    }

    // Enriquecer reactivamente el avatar de los remitentes con el perfil más reciente
    const enrichedMessages = validMessages.map((msg) => {
      if (msg.senderId || msg.senderName) {
        const profile = getPublicProfile(msg.senderId || msg.senderName);
        if (profile?.avatar && msg.senderAvatar !== profile.avatar) {
          return {
            ...msg,
            senderAvatar: profile.avatar,
            senderName: profile.displayName || profile.name || msg.senderName
          };
        }
      }
      return msg;
    });

    return enrichedMessages;
  } catch (err) {
    console.error("Error al leer mensajes de localStorage:", err);
    return [];
  }
};

/**
 * Guarda los mensajes de una conversación en almacenamiento local
 */
const saveStoredMessages = (conversationId, messages) => {
  if (!conversationId || typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId, JSON.stringify(messages));
    notifyChatUpdated({ type: "messages_updated", conversationId });
  } catch (err) {
    console.error("Error al guardar mensajes en localStorage:", err);
  }
};

/**
 * Normaliza el ID de usuario para comparaciones consistentes
 */
export const normalizeUserId = (userOrId) => {
  if (!userOrId) return "";
  if (typeof userOrId === "string") return userOrId.trim();
  return String(userOrId.id || userOrId.uid || "").trim();
};

/**
 * Obtiene todas las conversaciones del usuario activo
 */
export const getUserConversations = (currentUser) => {
  const userId = normalizeUserId(currentUser);
  if (!userId) return [];

  const all = getStoredConversations();
  return all
    .filter((conv) => Array.isArray(conv.participants) && conv.participants.includes(userId))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
};

/**
 * Obtiene una conversación por su identificador único
 */
export const getConversationById = (conversationId) => {
  if (!conversationId) return null;
  const all = getStoredConversations();
  return all.find((c) => String(c.id) === String(conversationId)) || null;
};

/**
 * Obtiene o crea una conversación entre el usuario actual y el vendedor/destinatario.
 * Asocia opcionalmente el anuncio (producto) para dar contexto de negociación.
 */
export const getOrCreateConversation = ({ currentUser, recipient, product = null }) => {
  const currentId = normalizeUserId(currentUser);
  const recipientId = normalizeUserId(recipient);

  if (!currentId || !recipientId) {
    throw new Error("Se requieren usuarios válidos para iniciar la conversación.");
  }

  const all = getStoredConversations();

  // Buscar conversación existente entre ambos usuarios (para el mismo producto si se especifica)
  let existing = all.find((conv) => {
    const hasCurrent = conv.participants.includes(currentId);
    const hasRecipient = conv.participants.includes(recipientId);
    if (!hasCurrent || !hasRecipient) return false;

    if (product?.id && conv.product?.id) {
      return String(conv.product.id) === String(product.id);
    }
    return true;
  });

  if (existing) {
    // Si la conversación existe pero se seleccionó un producto que no tenía asociado, actualizarla
    if (product && (!existing.product || existing.product.id !== product.id)) {
      existing = {
        ...existing,
        product: {
          id: product.id,
          title: product.title,
          price: product.price,
          currency: product.currency || "USD",
          priceMode: product.priceMode || "fixed",
          isFree: Boolean(product.isFree),
          image: product.image || (product.images && product.images[0]) || ""
        }
      };
      const updatedList = all.map((c) => (c.id === existing.id ? existing : c));
      saveStoredConversations(updatedList);
    }
    return existing;
  }

  // Crear una nueva conversación
  const newConvId = `conv_${currentId}_${recipientId}_${Date.now()}`;
  const currentName = currentUser.displayName || currentUser.name || `@${currentUser.username || "usuario"}`;
  const recipientName = recipient.displayName || recipient.name || `@${recipient.username || "vendedor"}`;

  const newConversation = {
    id: newConvId,
    participants: [currentId, recipientId],
    participantsData: {
      [currentId]: {
        id: currentId,
        name: currentName,
        username: currentUser.username || currentName.toLowerCase().replace(/\s+/g, "_"),
        avatar: currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
      },
      [recipientId]: {
        id: recipientId,
        name: recipientName,
        username: recipient.username || recipientName.toLowerCase().replace(/\s+/g, "_"),
        avatar: recipient.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
      }
    },
    product: product
      ? {
          id: product.id,
          title: product.title,
          price: product.price,
          currency: product.currency || "USD",
          priceMode: product.priceMode || "fixed",
          isFree: Boolean(product.isFree),
          image: product.image || (product.images && product.images[0]) || ""
        }
      : null,
    lastMessage: "",
    lastMessageAt: new Date().toISOString(),
    lastSenderId: null,
    unreadCounts: {
      [currentId]: 0,
      [recipientId]: 0
    },
    createdAt: new Date().toISOString()
  };

  const updatedConversations = [newConversation, ...all];
  saveStoredConversations(updatedConversations);

  // Intentar crear en Firestore si está disponible
  if (isFirebaseConfigured) {
    try {
      const convDocRef = doc(db, "conversations", newConvId);
      setDoc(convDocRef, {
        ...newConversation,
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp()
      }).catch((err) => console.warn("Aviso al guardar conversación en Firestore:", err));
    } catch (e) {
      console.warn("Aviso de sincronización Firestore:", e);
    }
  }

  return newConversation;
};

/**
 * Envía un mensaje de texto dentro de una conversación
 */
export const sendMessage = async ({ conversationId, sender, text }) => {
  if (!conversationId || !sender || !text || !text.trim()) {
    throw new Error("El mensaje no puede estar vacío.");
  }

  const senderId = normalizeUserId(sender);
  const trimmedText = text.trim();
  const timestamp = new Date().toISOString();

  // Verificar si la conversación está bloqueada
  const targetConv = getConversationById(conversationId);
  if (targetConv?.blockedBy) {
    throw new Error("No es posible enviar mensajes en un chat bloqueado.");
  }

  // Verificar si la conversación tiene activo el modo de mensajes temporales (12, 24 o 72 horas)
  const isTemporary = Boolean(targetConv?.isTemporary);
  const temporaryHours = [12, 24, 72].includes(Number(targetConv?.temporaryHours))
    ? Number(targetConv.temporaryHours)
    : 24;
  const expiresAt = isTemporary
    ? new Date(Date.now() + temporaryHours * 60 * 60 * 1000).toISOString()
    : null;

  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    conversationId,
    senderId,
    senderName: sender.displayName || sender.name || `@${sender.username || "usuario"}`,
    senderAvatar: sender.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    text: trimmedText,
    createdAt: timestamp,
    status: "enviado", // "enviando" | "enviado" | "recibido" | "leido"
    read: false,
    isTemporary,
    temporaryHours: isTemporary ? temporaryHours : null,
    expiresAt
  };

  // 1. Guardar mensaje localmente
  const currentMessages = getStoredMessages(conversationId);
  const updatedMessages = [...currentMessages, newMessage];
  saveStoredMessages(conversationId, updatedMessages);

  // 2. Actualizar metadatos de la conversación
  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));

  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    const otherParticipantId = conv.participants.find((p) => p !== senderId);

    const newUnreadCounts = { ...(conv.unreadCounts || {}) };
    if (otherParticipantId) {
      newUnreadCounts[otherParticipantId] = (newUnreadCounts[otherParticipantId] || 0) + 1;
    }
    newUnreadCounts[senderId] = 0;

    const updatedConv = {
      ...conv,
      lastMessage: trimmedText,
      lastMessageAt: timestamp,
      lastSenderId: senderId,
      unreadCounts: newUnreadCounts
    };

    // Reordenar poniendo la conversación al principio de la lista
    const remaining = allConversations.filter((c) => String(c.id) !== String(conversationId));
    saveStoredConversations([updatedConv, ...remaining]);

    // 3. Persistir en Firestore si está conectado
    if (isFirebaseConfigured) {
      try {
        const convRef = doc(db, "conversations", conversationId);
        updateDoc(convRef, {
          lastMessage: trimmedText,
          lastMessageAt: serverTimestamp(),
          lastSenderId: senderId,
          [`unreadCounts.${otherParticipantId}`]: (conv.unreadCounts?.[otherParticipantId] || 0) + 1,
          [`unreadCounts.${senderId}`]: 0
        }).catch(() => {});

        const msgColRef = collection(db, "conversations", conversationId, "messages");
        addDoc(msgColRef, {
          ...newMessage,
          createdAt: serverTimestamp()
        }).catch(() => {});
      } catch (err) {
        console.warn("Aviso al guardar mensaje en Firestore:", err);
      }
    }

    // 4. Confirmación de entrega ("Recibido") tras 1.2 segundos si no ha sido leído aún
    setTimeout(() => {
      const msgs = getStoredMessages(conversationId);
      const targetMsgIndex = msgs.findIndex((m) => m.id === newMessage.id);
      if (targetMsgIndex !== -1 && msgs[targetMsgIndex].status === "enviado") {
        msgs[targetMsgIndex].status = "recibido";
        saveStoredMessages(conversationId, msgs);
      }
    }, 1200);
  }

  return newMessage;
};

/**
 * Envía un mensaje con imagen dentro de la conversación.
 * Las imágenes se almacenan exclusivamente en el dispositivo del usuario
 * para evitar alojarlas en el servidor y proteger la privacidad.
 */
export const sendImageMessage = async ({ conversationId, sender, imageData, caption = "" }) => {
  if (!conversationId || !sender || !imageData) {
    throw new Error("Se requiere una imagen válida para enviar.");
  }

  // Verificar si la conversación está bloqueada
  const targetConv = getConversationById(conversationId);
  if (targetConv?.blockedBy) {
    throw new Error("No es posible enviar imágenes en un chat bloqueado.");
  }

  const senderId = normalizeUserId(sender);
  const timestamp = new Date().toISOString();
  const trimmedCaption = caption ? caption.trim() : "";

  // Verificar si la conversación tiene activo el modo de mensajes temporales (12, 24 o 72 horas)
  const isTemporary = Boolean(targetConv?.isTemporary);
  const temporaryHours = [12, 24, 72].includes(Number(targetConv?.temporaryHours))
    ? Number(targetConv.temporaryHours)
    : 24;
  const expiresAt = isTemporary
    ? new Date(Date.now() + temporaryHours * 60 * 60 * 1000).toISOString()
    : null;

  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    conversationId,
    senderId,
    senderName: sender.displayName || sender.name || `@${sender.username || "usuario"}`,
    senderAvatar: sender.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    type: "image",
    image: imageData, // Almacenado exclusivamente en el dispositivo del usuario
    caption: trimmedCaption,
    createdAt: timestamp,
    status: "enviado",
    read: false,
    isTemporary,
    temporaryHours: isTemporary ? temporaryHours : null,
    expiresAt
  };

  // 1. Guardar mensaje con imagen en el almacenamiento local del dispositivo
  const currentMessages = getStoredMessages(conversationId);
  const updatedMessages = [...currentMessages, newMessage];
  saveStoredMessages(conversationId, updatedMessages);

  // 2. Actualizar metadatos de la conversación
  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));

  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    const otherParticipantId = conv.participants.find((p) => p !== senderId);

    const newUnreadCounts = { ...(conv.unreadCounts || {}) };
    if (otherParticipantId) {
      newUnreadCounts[otherParticipantId] = (newUnreadCounts[otherParticipantId] || 0) + 1;
    }
    newUnreadCounts[senderId] = 0;

    const summaryText = trimmedCaption ? `📷 ${trimmedCaption}` : "📷 Foto";

    const updatedConv = {
      ...conv,
      lastMessage: summaryText,
      lastMessageAt: timestamp,
      lastSenderId: senderId,
      unreadCounts: newUnreadCounts
    };

    const remaining = allConversations.filter((c) => String(c.id) !== String(conversationId));
    saveStoredConversations([updatedConv, ...remaining]);

    // 3. Persistir en Firestore SIN el payload de la imagen para evitar que se guarde en el servidor
    if (isFirebaseConfigured) {
      try {
        const convRef = doc(db, "conversations", conversationId);
        updateDoc(convRef, {
          lastMessage: summaryText,
          lastMessageAt: serverTimestamp(),
          lastSenderId: senderId,
          [`unreadCounts.${otherParticipantId}`]: (conv.unreadCounts?.[otherParticipantId] || 0) + 1,
          [`unreadCounts.${senderId}`]: 0
        }).catch(() => {});

        // Enviar solo metadatos a Firestore, omitiendo image: imageData
        const msgColRef = collection(db, "conversations", conversationId, "messages");
        addDoc(msgColRef, {
          ...newMessage,
          image: null,
          isLocalOnly: true,
          createdAt: serverTimestamp()
        }).catch(() => {});
      } catch (err) {
        console.warn("Aviso al guardar metadatos de imagen en Firestore:", err);
      }
    }

    // 4. Confirmación de entrega
    setTimeout(() => {
      const msgs = getStoredMessages(conversationId);
      const targetMsgIndex = msgs.findIndex((m) => m.id === newMessage.id);
      if (targetMsgIndex !== -1 && msgs[targetMsgIndex].status === "enviado") {
        msgs[targetMsgIndex].status = "recibido";
        saveStoredMessages(conversationId, msgs);
      }
    }, 1200);
  }

  return newMessage;
};

/**
 * Marca una imagen de visualización única como vista y elimina sus datos del almacenamiento
 */
export const markViewOnceAsViewed = (conversationId, messageId) => {
  if (!conversationId || !messageId) return false;

  const msgs = getStoredMessages(conversationId);
  const msgIndex = msgs.findIndex((m) => m.id === messageId);
  if (msgIndex === -1) return false;

  const targetMsg = msgs[msgIndex];
  if (!targetMsg.viewOnce || targetMsg.viewed) return false;

  // Marcar como visto y ELIMINAR los datos de la imagen para que no puedan volver a abrirse
  msgs[msgIndex] = {
    ...targetMsg,
    viewed: true,
    openedAt: new Date().toISOString(),
    image: null // Borrado definitivo del almacenamiento
  };

  saveStoredMessages(conversationId, msgs);
  notifyChatUpdated({
    type: "view_once_consumed",
    conversationId,
    messageId
  });

  return true;
};

/**
 * Configura los mensajes temporales y su vigencia (12h, 24h o 72h).
 * Cualquiera de los dos participantes puede activar o cambiar la duración.
 */
export const setTemporaryChatConfig = (conversationId, { isTemporary, hours = 24 }, currentUser) => {
  if (!conversationId) return null;

  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex === -1) return null;

  const conv = allConversations[convIndex];
  const validHours = [12, 24, 72].includes(Number(hours)) ? Number(hours) : 24;
  const newStatus = Boolean(isTemporary);
  const senderName = currentUser?.displayName || currentUser?.name || "Un participante";

  // Determinar texto del mensaje del sistema
  let systemText = "";
  if (newStatus) {
    if (!conv.isTemporary) {
      systemText = `⏱️ ${senderName} activó los mensajes temporales (${validHours} horas).`;
    } else {
      systemText = `⏱️ ${senderName} cambió los mensajes temporales a ${validHours} horas.`;
    }
  } else {
    systemText = `⏱️ ${senderName} desactivó los mensajes temporales.`;
  }

  const timestamp = new Date().toISOString();
  const sysMessage = {
    id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId,
    senderId: "system",
    senderName: "Sistema",
    senderAvatar: "",
    text: systemText,
    createdAt: timestamp,
    isSystem: true,
    status: "leido",
    read: true
  };

  // Guardar mensaje de sistema en la conversación
  const currentMessages = getStoredMessages(conversationId);
  saveStoredMessages(conversationId, [...currentMessages, sysMessage]);

  // Actualizar metadatos de la conversación
  const updatedConv = {
    ...conv,
    isTemporary: newStatus,
    temporaryHours: newStatus ? validHours : (conv.temporaryHours || 24),
    temporaryUpdatedAt: timestamp,
    lastMessage: sysMessage.text,
    lastMessageAt: timestamp
  };

  allConversations[convIndex] = updatedConv;
  saveStoredConversations(allConversations);

  // Sincronizar en Firestore si está conectado
  if (isFirebaseConfigured) {
    try {
      const convRef = doc(db, "conversations", conversationId);
      updateDoc(convRef, {
        isTemporary: newStatus,
        temporaryHours: newStatus ? validHours : 24,
        temporaryUpdatedAt: serverTimestamp(),
        lastMessage: sysMessage.text,
        lastMessageAt: serverTimestamp()
      }).catch(() => {});

      const msgColRef = collection(db, "conversations", conversationId, "messages");
      addDoc(msgColRef, {
        ...sysMessage,
        createdAt: serverTimestamp()
      }).catch(() => {});
    } catch (e) {
      console.warn("Aviso al sincronizar mensajes temporales en Firestore:", e);
    }
  }

  notifyChatUpdated({
    type: "temporary_mode_toggled",
    conversationId,
    isTemporary: newStatus,
    temporaryHours: validHours
  });

  return updatedConv;
};

/**
 * Alterna de forma directa los mensajes temporales (por compatibilidad hacia atrás)
 */
export const toggleTemporaryChat = (conversationId, currentUser) => {
  const conv = getConversationById(conversationId);
  if (!conv) return false;
  const newStatus = !Boolean(conv.isTemporary);
  setTemporaryChatConfig(conversationId, { isTemporary: newStatus, hours: conv.temporaryHours || 24 }, currentUser);
  return newStatus;
};

/**
 * Silencia o reactiva las notificaciones del chat para el usuario actual.
 * Duraciones admitidas: "6h", "12h", "24h", "always" (o null para desactivar silencio)
 */
export const setChatMute = (conversationId, { isMuted, duration = "always" }, currentUser) => {
  const userId = normalizeUserId(currentUser);
  if (!conversationId || !userId) return null;

  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex === -1) return null;

  const conv = allConversations[convIndex];
  const mutedBy = { ...(conv.mutedBy || {}) };

  if (!isMuted) {
    mutedBy[userId] = {
      isMuted: false,
      duration: null,
      until: null
    };
  } else {
    let until = null;
    const now = Date.now();
    if (duration === "6h") {
      until = new Date(now + 6 * 60 * 60 * 1000).toISOString();
    } else if (duration === "12h") {
      until = new Date(now + 12 * 60 * 60 * 1000).toISOString();
    } else if (duration === "24h") {
      until = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    } else {
      duration = "always";
      until = null; // Silenciado hasta que se indique lo contrario
    }

    mutedBy[userId] = {
      isMuted: true,
      duration,
      until
    };
  }

  const updatedConv = {
    ...conv,
    mutedBy
  };

  allConversations[convIndex] = updatedConv;
  saveStoredConversations(allConversations);

  notifyChatUpdated({
    type: "chat_mute_updated",
    conversationId,
    mutedState: mutedBy[userId]
  });

  return mutedBy[userId];
};

/**
 * Consulta el estado de silencio para el usuario actual en una conversación
 */
export const getChatMuteStatus = (conversation, currentUser) => {
  const userId = normalizeUserId(currentUser);
  if (!conversation || !userId || !conversation.mutedBy || !conversation.mutedBy[userId]) {
    return { isMuted: false, text: "Recibirás notificaciones normalmente" };
  }

  const setting = conversation.mutedBy[userId];
  if (!setting.isMuted) {
    return { isMuted: false, text: "Recibirás notificaciones normalmente" };
  }

  if (setting.duration === "always" || !setting.until) {
    return { isMuted: true, duration: "always", text: "Silenciado hasta que lo reactives" };
  }

  const untilDate = new Date(setting.until);
  if (isNaN(untilDate.getTime()) || untilDate <= new Date()) {
    return { isMuted: false, text: "Recibirás notificaciones normalmente" };
  }

  const timeLabel = untilDate.toLocaleTimeString("es-SV", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return {
    isMuted: true,
    duration: setting.duration,
    until: setting.until,
    text: `Silenciado hasta las ${timeLabel}`
  };
};

/**
 * Obtiene el mapa completo de usuarios bloqueados desde localStorage
 */
const getRawBlockedUsersMap = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BLOCKED_USERS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Error al leer usuarios bloqueados:", e);
    return {};
  }
};

/**
 * Guarda el mapa de usuarios bloqueados en localStorage
 */
const saveRawBlockedUsersMap = (map) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_BLOCKED_USERS, JSON.stringify(map));
  } catch (e) {
    console.error("Error al guardar usuarios bloqueados:", e);
  }
};

/**
 * Retorna la lista de usuarios bloqueados por el usuario actual
 */
export const getBlockedUsers = (currentUser) => {
  const currentUserId = normalizeUserId(currentUser);
  if (!currentUserId) return [];

  const map = getRawBlockedUsersMap();
  const userList = Array.isArray(map[currentUserId]) ? [...map[currentUserId]] : [];

  // También sincronizar cualquier conversación donde el usuario actual figure como bloqueador
  const allConversations = getStoredConversations();
  allConversations.forEach((conv) => {
    if (conv.blockedBy === currentUserId) {
      const otherId = conv.participants?.find((p) => p !== currentUserId);
      if (otherId && !userList.some((u) => u.id === otherId)) {
        const otherData = conv.participantsData?.[otherId] || {
          id: otherId,
          name: "Usuario",
          username: "usuario",
          avatar: ""
        };
        userList.push({
          id: otherId,
          name: otherData.name || "Usuario",
          username: otherData.username || "usuario",
          avatar: otherData.avatar || "",
          blockedAt: conv.blockedAt || new Date().toISOString()
        });
      }
    }
  });

  return userList;
};

/**
 * Desbloquea a un usuario específico por su ID
 */
export const unblockUser = (targetUserId, currentUser) => {
  const currentUserId = normalizeUserId(currentUser);
  if (!targetUserId || !currentUserId) return false;

  // 1. Quitar de la lista en localStorage
  const map = getRawBlockedUsersMap();
  if (Array.isArray(map[currentUserId])) {
    map[currentUserId] = map[currentUserId].filter((u) => String(u.id) !== String(targetUserId));
    saveRawBlockedUsersMap(map);
  }

  // 2. Desbloquear en las conversaciones correspondientes
  const allConversations = getStoredConversations();
  let updatedAny = false;
  const timestamp = new Date().toISOString();

  allConversations.forEach((conv) => {
    if (
      conv.blockedBy === currentUserId &&
      Array.isArray(conv.participants) &&
      conv.participants.includes(targetUserId)
    ) {
      conv.blockedBy = null;
      conv.blockedAt = null;
      updatedAny = true;

      // Mensaje de sistema informativo
      const sysMessage = {
        id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId: conv.id,
        senderId: "system",
        senderName: "Sistema",
        senderAvatar: "",
        text: `🛡️ Desbloqueaste a este usuario. Ya pueden volver a comunicarse.`,
        createdAt: timestamp,
        isSystem: true,
        status: "leido",
        read: true
      };

      const currentMessages = getStoredMessages(conv.id);
      saveStoredMessages(conv.id, [...currentMessages, sysMessage]);
      conv.lastMessage = sysMessage.text;
      conv.lastMessageAt = timestamp;
    }
  });

  if (updatedAny) {
    saveStoredConversations(allConversations);
  }

  notifyChatUpdated({
    type: "user_unblocked",
    targetUserId,
    currentUserId
  });

  return true;
};

/**
 * Bloquea o desbloquea al usuario dentro de la conversación.
 */
export const toggleBlockUser = (conversationId, currentUser) => {
  const currentUserId = normalizeUserId(currentUser);
  if (!conversationId || !currentUserId) return false;

  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex === -1) return false;

  const conv = allConversations[convIndex];
  const otherParticipantId = conv.participants?.find((p) => p !== currentUserId);
  const otherParticipantData = conv.participantsData?.[otherParticipantId] || {};

  const isCurrentlyBlocked = Boolean(conv.blockedBy);
  const isBlockedByMe = conv.blockedBy === currentUserId;

  let newBlockedBy = null;
  let systemText = "";

  if (isCurrentlyBlocked) {
    if (isBlockedByMe) {
      newBlockedBy = null;
      systemText = `🛡️ Desbloqueaste a este usuario. Ya pueden volver a comunicarse.`;

      // Remover de lista de bloqueados
      if (otherParticipantId) {
        const map = getRawBlockedUsersMap();
        if (Array.isArray(map[currentUserId])) {
          map[currentUserId] = map[currentUserId].filter((u) => u.id !== otherParticipantId);
          saveRawBlockedUsersMap(map);
        }
      }
    } else {
      throw new Error("No tienes permisos para desbloquear a este usuario.");
    }
  } else {
    newBlockedBy = currentUserId;
    systemText = `🚫 Has bloqueado a este usuario. Ya no podrán enviarse mensajes.`;

    // Agregar a lista de bloqueados
    if (otherParticipantId) {
      const map = getRawBlockedUsersMap();
      const currentList = Array.isArray(map[currentUserId]) ? map[currentUserId] : [];
      if (!currentList.some((u) => u.id === otherParticipantId)) {
        currentList.push({
          id: otherParticipantId,
          name: otherParticipantData.name || "Usuario",
          username: otherParticipantData.username || "usuario",
          avatar: otherParticipantData.avatar || "",
          blockedAt: new Date().toISOString()
        });
      }
      map[currentUserId] = currentList;
      saveRawBlockedUsersMap(map);
    }
  }

  const timestamp = new Date().toISOString();
  const sysMessage = {
    id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId,
    senderId: "system",
    senderName: "Sistema",
    senderAvatar: "",
    text: systemText,
    createdAt: timestamp,
    isSystem: true,
    status: "leido",
    read: true
  };

  const currentMessages = getStoredMessages(conversationId);
  saveStoredMessages(conversationId, [...currentMessages, sysMessage]);

  const updatedConv = {
    ...conv,
    blockedBy: newBlockedBy,
    blockedAt: newBlockedBy ? timestamp : null,
    lastMessage: sysMessage.text,
    lastMessageAt: timestamp
  };

  allConversations[convIndex] = updatedConv;
  saveStoredConversations(allConversations);

  notifyChatUpdated({
    type: "block_status_updated",
    conversationId,
    blockedBy: newBlockedBy
  });

  return Boolean(newBlockedBy);
};

/**
 * Elimina una conversación por completo del buzón y borra sus mensajes asociados
 */
export const deleteConversation = (conversationId) => {
  if (!conversationId || typeof window === "undefined") return false;

  const allConversations = getStoredConversations();
  const remaining = allConversations.filter((c) => String(c.id) !== String(conversationId));
  saveStoredConversations(remaining);

  try {
    localStorage.removeItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId);
  } catch (e) {
    console.error("Error al eliminar mensajes de conversación:", e);
  }

  notifyChatUpdated({
    type: "conversation_deleted",
    conversationId
  });

  return true;
};

/**
 * Vacía la copia local de los mensajes de una conversación
 */
export const clearConversationMessages = (conversationId) => {
  if (!conversationId) return false;

  saveStoredMessages(conversationId, []);

  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    allConversations[convIndex] = {
      ...conv,
      lastMessage: "Se vació tu copia de la conversación",
      lastMessageAt: new Date().toISOString()
    };
    saveStoredConversations(allConversations);
  }

  notifyChatUpdated({ type: "chat_cleared", conversationId });
  return true;
};

/**
 * Constante del tiempo límite para "Eliminar para todos" (15 minutos en milisegundos)
 */
export const DELETE_FOR_ALL_LIMIT_MS = 15 * 60 * 1000;

/**
 * Verifica si un conjunto de mensajes seleccionados puede ser eliminado para todos.
 * Regla: Todos los mensajes deben haber sido enviados por el usuario actual y tener <= 15 minutos.
 */
export const canDeleteMessagesForAll = (messages, currentUser) => {
  if (!messages || messages.length === 0 || !currentUser) return false;
  const currentUserId = normalizeUserId(currentUser);
  const now = Date.now();

  return messages.every((msg) => {
    if (msg.senderId !== currentUserId) return false;
    if (msg.isDeletedForAll) return false;
    const createdAtTime = new Date(msg.createdAt).getTime();
    if (isNaN(createdAtTime)) return false;
    return now - createdAtTime <= DELETE_FOR_ALL_LIMIT_MS;
  });
};

/**
 * Elimina mensajes seleccionados exclusivamente de la copia local del usuario actual ("Eliminar para mí")
 * Permite además indicar si se eliminan también los archivos de la galería local (options.deleteFromGallery)
 */
export const deleteMessagesForMe = (conversationId, messageIds, options = {}) => {
  if (!conversationId || !messageIds || messageIds.length === 0) return false;
  const idList = Array.isArray(messageIds) ? messageIds : [messageIds];

  const currentMessages = getStoredMessages(conversationId);
  const updatedMessages = currentMessages.filter((msg) => !idList.includes(msg.id));

  saveStoredMessages(conversationId, updatedMessages);

  // Actualizar último mensaje de la conversación si fue afectado
  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    const lastMsg = updatedMessages[updatedMessages.length - 1];
    allConversations[convIndex] = {
      ...conv,
      lastMessage: lastMsg ? (lastMsg.type === "image" ? "📷 Foto" : lastMsg.text) : "No hay mensajes",
      lastMessageAt: lastMsg ? lastMsg.createdAt : conv.lastMessageAt
    };
    saveStoredConversations(allConversations);
  }

  notifyChatUpdated({
    type: "messages_deleted_for_me",
    conversationId,
    messageIds: idList,
    deleteFromGallery: Boolean(options.deleteFromGallery)
  });
  return true;
};

/**
 * Elimina mensajes seleccionados para todos los participantes ("Eliminar para todos")
 * Reemplaza el texto por "🚫 Este mensaje fue eliminado" y destruye imágenes adjuntas.
 * Solo disponible si los mensajes son propios y tienen menos de 15 minutos.
 */
export const deleteMessagesForAll = (conversationId, messageIds, currentUser) => {
  if (!conversationId || !messageIds || messageIds.length === 0) return false;
  const idList = Array.isArray(messageIds) ? messageIds : [messageIds];
  const currentUserId = normalizeUserId(currentUser);
  const now = Date.now();
  const timestamp = new Date().toISOString();

  const currentMessages = getStoredMessages(conversationId);

  // Validar que los mensajes cumplan las condiciones
  const targetMessages = currentMessages.filter((m) => idList.includes(m.id));
  const isValid = targetMessages.every((msg) => {
    if (msg.senderId !== currentUserId) return false;
    const createdAtTime = new Date(msg.createdAt).getTime();
    return !isNaN(createdAtTime) && now - createdAtTime <= DELETE_FOR_ALL_LIMIT_MS;
  });

  if (!isValid) {
    throw new Error("Solo puedes eliminar para todos los mensajes que hayas enviado tú en los últimos 15 minutos.");
  }

  const updatedMessages = currentMessages.map((msg) => {
    if (idList.includes(msg.id)) {
      return {
        ...msg,
        isDeletedForAll: true,
        deletedForAllAt: timestamp,
        text: "🚫 Este mensaje fue eliminado",
        image: null,
        caption: ""
      };
    }
    return msg;
  });

  saveStoredMessages(conversationId, updatedMessages);

  // Actualizar metadatos de la conversación
  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    const lastMsg = updatedMessages[updatedMessages.length - 1];
    allConversations[convIndex] = {
      ...conv,
      lastMessage: lastMsg ? (lastMsg.isDeletedForAll ? "🚫 Mensaje eliminado" : lastMsg.type === "image" ? "📷 Foto" : lastMsg.text) : "No hay mensajes",
      lastMessageAt: lastMsg ? lastMsg.createdAt : conv.lastMessageAt
    };
    saveStoredConversations(allConversations);
  }

  notifyChatUpdated({ type: "messages_deleted_for_all", conversationId, messageIds: idList });
  return true;
};

/**
 * Marca una conversación como leída para el usuario activo
 */
export const markConversationAsRead = (conversationId, currentUser) => {
  const userId = normalizeUserId(currentUser);
  if (!conversationId || !userId) return;

  // Actualizar mensajes dirigidos a este usuario al estado "leido"
  const messages = getStoredMessages(conversationId);
  let changed = false;
  const updatedMessages = messages.map((msg) => {
    if (msg.senderId !== userId && (msg.status !== "leido" || !msg.read)) {
      changed = true;
      return { ...msg, read: true, status: "leido" };
    }
    return msg;
  });

  if (changed) {
    saveStoredMessages(conversationId, updatedMessages);
  }

  // Restablecer contador en la conversación
  const allConversations = getStoredConversations();
  const cIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (cIndex !== -1) {
    const conv = allConversations[cIndex];
    if (conv.unreadCounts?.[userId] && conv.unreadCounts[userId] > 0) {
      const updatedConv = {
        ...conv,
        unreadCounts: {
          ...(conv.unreadCounts || {}),
          [userId]: 0
        }
      };
      allConversations[cIndex] = updatedConv;
      saveStoredConversations(allConversations);

      if (isFirebaseConfigured) {
        try {
          const convRef = doc(db, "conversations", conversationId);
          updateDoc(convRef, {
            [`unreadCounts.${userId}`]: 0
          }).catch(() => {});
        } catch (e) {}
      }
    }
  }
};

/**
 * Cuenta el total de mensajes no leídos para el usuario activo en todas sus conversaciones
 */
export const getTotalUnreadCount = (currentUser) => {
  const userId = normalizeUserId(currentUser);
  if (!userId) return 0;

  const userConversations = getUserConversations(userId);
  return userConversations.reduce((sum, conv) => {
    return sum + (Number(conv.unreadCounts?.[userId]) || 0);
  }, 0);
};

/**
 * Formatea fechas y horas amigables para los mensajes (estilo WhatsApp / iOS)
 */
export const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const timeStr = d.toLocaleTimeString("es-SV", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  if (isToday) return timeStr;
  if (isYesterday) return `Ayer ${timeStr}`;
  return `${d.toLocaleDateString("es-SV", { day: "numeric", month: "short" })} ${timeStr}`;
};

/**
 * Formatea fechas para la lista de conversaciones
 */
export const formatConversationTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMinutes = Math.floor((now - d) / (1000 * 60));

  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString("es-SV", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Ayer";

  return d.toLocaleDateString("es-SV", { day: "numeric", month: "short" });
};

