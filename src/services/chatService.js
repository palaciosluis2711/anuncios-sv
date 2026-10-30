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
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  FieldPath,
  writeBatch
} from "firebase/firestore";
import { getPublicProfile, resolveUserAvatar, PROFILE_UPDATED_EVENT } from "./userProfileService.js";

/**
 * Convierte recursivamente los Timestamps de Firestore a cadenas ISO
 * para mantener un formato homogéneo entre datos locales y remotos.
 */
const normalizeFirestoreData = (value, depth = 0) => {
  if (value == null || depth > 4) return value;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch (_) {
      return null;
    }
  }
  if (Array.isArray(value)) return value.map((v) => normalizeFirestoreData(v, depth + 1));
  if (typeof value === "object") {
    if (typeof value.seconds === "number" && typeof value.nanoseconds === "number" && Object.keys(value).length === 2) {
      return new Date(value.seconds * 1000).toISOString();
    }
    const out = {};
    Object.keys(value).forEach((k) => {
      out[k] = normalizeFirestoreData(value[k], depth + 1);
    });
    return out;
  }
  return value;
};

/**
 * Ejecuta un updateDoc usando FieldPath para cada clave de mapa.
 * Esto evita que claves con punto (ej. correos) se interpreten como rutas anidadas
 * y que setDoc cree campos literales "mapa.clave".
 * entries: Array<[string | string[], any]>
 */
const updateDocFields = (ref, entries) => {
  const args = [];
  entries.forEach(([path, value]) => {
    if (Array.isArray(path)) {
      args.push(new FieldPath(...path.map(String)), value);
    } else {
      args.push(path, value);
    }
  });
  if (args.length < 2) return Promise.resolve();
  return updateDoc(ref, ...args);
};

/**
 * Obtiene el usuario de la sesión activa guardada localmente (para filtros por usuario)
 */
const getSessionUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("mercadosocial_user");
    return saved ? JSON.parse(saved) : null;
  } catch (_) {
    return null;
  }
};

// Escrituras pendientes de creación de conversaciones (para evitar carreras con el primer mensaje)
const pendingConversationWrites = new Map();

const STORAGE_KEY_CONVERSATIONS = "anunciossv_conversations_v1";
const STORAGE_KEY_MESSAGES_PREFIX = "anunciossv_messages_v1_";
const STORAGE_KEY_BLOCKED_USERS = "anunciossv_blocked_users_v1";
const STORAGE_KEY_PINNED_PREFIX = "anunciossv_pinned_convs_";
const STORAGE_KEY_DELETED_PREFIX = "anunciossv_deleted_convs_";
export const CHAT_EVENT = "anunciossv_chat_updated";
export const INCOMING_MESSAGE_EVENT = "anunciossv_incoming_message";

/**
 * Emite una notificación flotante in-app cuando un usuario responde a otro
 */
export const notifyIncomingMessage = (detail = {}) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INCOMING_MESSAGE_EVENT, { detail }));
  }
};

// Conversaciones y mensajes reales entre usuarios registrados en Firestore
const INITIAL_DEMO_CONVERSATIONS = [];
const INITIAL_DEMO_MESSAGES = {};

// Control seguro de eventos para evitar bucles infinitos y recursión reentrante (Maximum call stack)
let isDispatchingChatEvent = false;
const pendingChatEventsQueue = [];
let chatEventBurstCount = 0;
let lastBurstResetTime = Date.now();

// Dispara evento reactivo global para actualizar componentes suscritos de forma segura
export const notifyChatUpdated = (detail = {}) => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastBurstResetTime > 1000) {
    chatEventBurstCount = 0;
    lastBurstResetTime = now;
  }

  // Prevenir bucles infinitos en cascada limitando a un máximo razonable por segundo
  chatEventBurstCount++;
  if (chatEventBurstCount > 50) {
    return;
  }

  // Si ya se está procesando un despacho síncrono, encolar para el siguiente tick y evitar Maximum Call Stack
  if (isDispatchingChatEvent) {
    pendingChatEventsQueue.push(detail);
    return;
  }

  isDispatchingChatEvent = true;
  try {
    window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail }));
  } catch (err) {
    console.warn("Aviso al emitir evento de chat:", err);
  } finally {
    isDispatchingChatEvent = false;
    if (pendingChatEventsQueue.length > 0) {
      const nextBatch = pendingChatEventsQueue.splice(0);
      queueMicrotask(() => {
        nextBatch.forEach((item) => notifyChatUpdated(item));
      });
    }
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
 * Obtiene todas las conversaciones almacenadas localmente, depurando chats demo antiguos
 */
export const getStoredConversations = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Limpiar cualquier residuo de bots antiguos o usuarios de prueba mock
    const realConvs = parsed.filter((c) => {
      if (!c || !c.id) return false;
      if (String(c.id).startsWith("conv_demo")) return false;
      const parts = Array.isArray(c.participants) ? c.participants : [];
      const hasMockUser = parts.some((p) => /^usr-0[1-5]$/.test(String(p)));
      return !hasMockUser;
    });
    if (realConvs.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(realConvs));
    }
    return enrichConversationsWithLatestProfiles(realConvs);
  } catch (err) {
    console.error("Error al leer conversaciones de localStorage:", err);
    return [];
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
      return [];
    } else {
      const parsed = JSON.parse(raw);
      rawMessages = Array.isArray(parsed) ? parsed : [];
    }

    // Filtrar mensajes temporales expirados (24 horas)
    const now = new Date();
    const validMessages = rawMessages.filter((msg) => {
      if (!msg || typeof msg !== "object") return false;
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

    // Ocultar mensajes eliminados "para mí", vaciados o anteriores a la eliminación del chat
    const sessionUser = getSessionUser();
    const hiddenSet = new Set(getHiddenMessageIds(conversationId, sessionUser));
    const deletedIso = getConversationDeletedAt(conversationId, sessionUser);
    const clearedIso = getConversationClearedAt(conversationId, sessionUser);
    const cutoffMs = Math.max(
      deletedIso ? new Date(deletedIso).getTime() || 0 : 0,
      clearedIso ? new Date(clearedIso).getTime() || 0 : 0
    );
    const visibleMessages = validMessages.filter((msg) => {
      if (hiddenSet.has(String(msg.id))) return false;
      if (cutoffMs) {
        const t = new Date(msg.createdAt).getTime();
        if (!isNaN(t) && t <= cutoffMs) return false;
      }
      return true;
    });

    // Enriquecer reactivamente el avatar de los remitentes con el perfil más reciente
    const enrichedMessages = visibleMessages.map((msg) => {
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
 * Obtiene el mapa { conversationId: fechaISOdeEliminación } del usuario.
 * Migra automáticamente el formato antiguo (arreglo de IDs) al nuevo formato con fecha de corte.
 */
export const getDeletedConversationsMap = (userOrId) => {
  const userId = normalizeUserId(userOrId);
  if (!userId || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_DELETED_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Formato antiguo: convertir a mapa con la fecha actual como corte
      const nowIso = new Date().toISOString();
      const migrated = {};
      parsed.forEach((id) => {
        migrated[String(id)] = nowIso;
      });
      localStorage.setItem(`${STORAGE_KEY_DELETED_PREFIX}${userId}`, JSON.stringify(migrated));
      return migrated;
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
};

const saveDeletedConversationsMap = (userOrId, map) => {
  const userId = normalizeUserId(userOrId);
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_DELETED_PREFIX}${userId}`, JSON.stringify(map || {}));
  } catch (_) { }
};

/**
 * Obtiene el listado de IDs de conversaciones eliminadas por un usuario
 */
export const getDeletedConversationIds = (userOrId) => Object.keys(getDeletedConversationsMap(userOrId));

/**
 * Registra una o más conversaciones como eliminadas para un usuario con fecha de corte.
 * Si luego llega un mensaje más reciente, la conversación reaparece solo con los mensajes nuevos.
 */
export const addDeletedConversationIds = (userOrId, conversationIds = [], deletedAtIso = null) => {
  const userId = normalizeUserId(userOrId);
  if (!userId || typeof window === "undefined") return;
  const map = getDeletedConversationsMap(userId);
  const stamp = deletedAtIso || new Date().toISOString();
  conversationIds.map(String).forEach((id) => {
    map[id] = stamp;
  });
  saveDeletedConversationsMap(userId, map);
};

/**
 * Devuelve la fecha de corte (ISO) a partir de la cual el usuario vuelve a ver mensajes de una conversación.
 * Combina la eliminación local y la eliminación sincronizada en Firestore (deletedFor.{uid}).
 */
export const getConversationDeletedAt = (conversationId, userOrId, conv = null) => {
  const userId = normalizeUserId(userOrId);
  if (!conversationId || !userId) return null;
  const localIso = getDeletedConversationsMap(userId)[String(conversationId)] || null;

  let remoteIso = null;
  const sourceConv = conv || (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.find((c) => c && String(c.id) === String(conversationId)) : null;
    } catch (_) {
      return null;
    }
  })();
  if (sourceConv?.deletedFor && typeof sourceConv.deletedFor === "object") {
    const val = normalizeFirestoreData(sourceConv.deletedFor[userId]);
    if (typeof val === "string") remoteIso = val;
  }

  if (!localIso) return remoteIso;
  if (!remoteIso) return localIso;
  return new Date(localIso) > new Date(remoteIso) ? localIso : remoteIso;
};

/**
 * Determina si una conversación debe mostrarse en la bandeja del usuario
 */
const isConversationVisibleForUser = (conv, userOrId, candidatesLower) => {
  if (!conv || !conv.id || !Array.isArray(conv.participants)) return false;
  const isParticipant = conv.participants.some((p) => {
    const normP = String(p).trim().toLowerCase().replace(/^@/, "");
    return candidatesLower.includes(normP);
  });
  if (!isParticipant) return false;

  // Conversaciones vacías creadas por el otro usuario (aún sin mensajes) no se muestran
  if (!conv.lastMessage && conv.createdBy) {
    const creatorNorm = String(conv.createdBy).trim().toLowerCase();
    if (!candidatesLower.includes(creatorNorm)) return false;
  }

  // Si fue eliminada, solo reaparece si llegó un mensaje posterior a la eliminación
  const deletedAt = getConversationDeletedAt(conv.id, userOrId, conv);
  if (deletedAt) {
    const lastMs = new Date(conv.lastMessageAt || 0).getTime();
    const delMs = new Date(deletedAt).getTime();
    if (!(lastMs > delMs)) return false;
  }
  return true;
};

const STORAGE_KEY_HIDDEN_MSGS_PREFIX = "anunciossv_hidden_msgs_v1_";
const STORAGE_KEY_CLEARED_PREFIX = "anunciossv_cleared_convs_v1_";

export const getConversationClearedAt = (conversationId, userOrId) => {
  const userId = normalizeUserId(userOrId) || "anon";
  if (!conversationId || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${STORAGE_KEY_CLEARED_PREFIX}${userId}_${conversationId}`) || null;
  } catch (_) {
    return null;
  }
};

const setConversationClearedAt = (conversationId, userOrId, isoStr) => {
  const userId = normalizeUserId(userOrId) || "anon";
  if (!conversationId || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_CLEARED_PREFIX}${userId}_${conversationId}`, isoStr || new Date().toISOString());
  } catch (_) { }
};

/**
 * Obtiene los IDs de mensajes eliminados "para mí" en una conversación (persisten frente a la sincronización remota)
 */
export const getHiddenMessageIds = (conversationId, userOrId) => {
  const userId = normalizeUserId(userOrId) || "anon";
  if (!conversationId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_HIDDEN_MSGS_PREFIX}${userId}_${conversationId}`);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String) : [];
  } catch (_) {
    return [];
  }
};

const addHiddenMessageIds = (conversationId, userOrId, ids = []) => {
  const userId = normalizeUserId(userOrId) || "anon";
  if (!conversationId || typeof window === "undefined") return;
  const next = new Set([...getHiddenMessageIds(conversationId, userId), ...ids.map(String)]);
  try {
    localStorage.setItem(`${STORAGE_KEY_HIDDEN_MSGS_PREFIX}${userId}_${conversationId}`, JSON.stringify(Array.from(next)));
  } catch (_) { }
};

/**
 * Obtiene el listado de IDs de conversaciones fijadas (destacadas arriba) por el usuario
 */
export const getPinnedConversationIds = (userOrId) => {
  const userId = normalizeUserId(userOrId);
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PINNED_PREFIX}${userId}`);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(String) : [];
  } catch (_) {
    return [];
  }
};

/**
 * Verifica si una conversación está fijada en la parte superior
 */
export const isConversationPinned = (conversationId, userOrId) => {
  if (!conversationId) return false;
  const pinned = getPinnedConversationIds(userOrId);
  return pinned.includes(String(conversationId));
};

/**
 * Fija o desfija una conversación en la zona superior de la bandeja
 */
export const togglePinConversation = (conversationId, userOrId) => {
  const userId = normalizeUserId(userOrId);
  if (!userId || !conversationId || typeof window === "undefined") return false;
  const current = getPinnedConversationIds(userId);
  const targetId = String(conversationId);
  const exists = current.includes(targetId);
  const nextList = exists ? current.filter((id) => id !== targetId) : [targetId, ...current];

  try {
    localStorage.setItem(`${STORAGE_KEY_PINNED_PREFIX}${userId}`, JSON.stringify(nextList));
  } catch (_) { }

  notifyChatUpdated({
    type: "conversation_pin_toggled",
    conversationId: targetId,
    isPinned: !exists
  });

  return !exists;
};

/**
 * Obtiene todos los identificadores representativos de un usuario para comparaciones consistentes
 */
export const getUserCandidateKeys = (userOrId) => {
  if (!userOrId) return [];
  const keys = new Set();
  if (typeof userOrId === "object") {
    if (userOrId.id) keys.add(String(userOrId.id).trim());
    if (userOrId.uid) keys.add(String(userOrId.uid).trim());
    if (userOrId.email) keys.add(String(userOrId.email).trim().toLowerCase());
    if (userOrId.username) keys.add(String(userOrId.username).trim().toLowerCase().replace(/^@/, ""));
  } else {
    const raw = String(userOrId).trim();
    keys.add(raw);
    keys.add(raw.toLowerCase());
    keys.add(raw.toLowerCase().replace(/^@/, ""));
  }
  return Array.from(keys);
};

/**
 * Obtiene la cantidad de mensajes no leídos de una conversación para un usuario específico,
 * contrastando con todos sus identificadores posibles (UID, id, email, username)
 */
export const getConversationUnreadCount = (conv, userOrId) => {
  if (!conv || !conv.unreadCounts || typeof conv.unreadCounts !== "object" || !userOrId) return 0;
  const candidates = getUserCandidateKeys(userOrId).map((k) => k.toLowerCase());

  for (const [key, count] of Object.entries(conv.unreadCounts)) {
    const normKey = String(key).trim().toLowerCase().replace(/^@/, "");
    if (candidates.some((cand) => cand === normKey || cand === String(key).trim().toLowerCase())) {
      const num = Number(count);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return 0;
};

/**
 * Obtiene todas las conversaciones del usuario activo, filtrando eliminadas y posicionando destacadas arriba
 */
export const getUserConversations = (currentUser) => {
  const userId = normalizeUserId(currentUser);
  if (!userId && !currentUser) return [];

  const candidates = getUserCandidateKeys(currentUser).map((k) => k.toLowerCase());
  const pinnedSet = new Set(getPinnedConversationIds(userId));

  const all = getStoredConversations();
  return all
    .filter((conv) => isConversationVisibleForUser(conv, userId, candidates))
    .sort((a, b) => {
      const aPinned = pinnedSet.has(String(a.id));
      const bPinned = pinnedSet.has(String(b.id));
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
    });
};

// ============================================================
// PRESENCIA EN LÍNEA (conectado / desconectado) EN TIEMPO REAL
// ============================================================

// Un usuario se considera conectado si su último latido es más reciente que este umbral
const PRESENCE_STALE_MS = 75000;
// Intervalo del latido de presencia mientras la app está visible
const PRESENCE_HEARTBEAT_MS = 25000;

/**
 * Actualiza el estado de conexión (online/offline) del usuario en Firestore
 */
export const setUserOnlineStatus = async (currentUser, isOnline) => {
  if (!currentUser) return;
  const userId = normalizeUserId(currentUser);
  if (!userId) return;

  if (isFirebaseConfigured) {
    try {
      const presenceRef = doc(db, "presence", userId);
      await setDoc(
        presenceRef,
        {
          userId,
          isOnline: Boolean(isOnline),
          lastActive: serverTimestamp()
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Aviso al actualizar presencia en línea:", err?.code || err);
    }
  }
};

/**
 * Inicia el seguimiento de presencia del usuario actual:
 * - Latido periódico mientras la pestaña está visible
 * - Desconectado al ocultar/cerrar la app, conectado al volver
 * Devuelve una función de limpieza.
 */
export const startPresenceTracking = (currentUser) => {
  if (!currentUser || typeof window === "undefined") return () => { };
  let heartbeatTimer = null;

  const goOnline = () => {
    setUserOnlineStatus(currentUser, true);
    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => setUserOnlineStatus(currentUser, true), PRESENCE_HEARTBEAT_MS);
    }
  };
  const goOffline = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    setUserOnlineStatus(currentUser, false);
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") goOnline();
    else goOffline();
  };

  if (document.visibilityState === "visible") goOnline();
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", goOffline);
  window.addEventListener("beforeunload", goOffline);
  window.addEventListener("online", goOnline);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pagehide", goOffline);
    window.removeEventListener("beforeunload", goOffline);
    window.removeEventListener("online", goOnline);
    goOffline();
  };
};

/**
 * Suscribe a la presencia en línea de un usuario para saber si está conectado en tiempo real.
 * callback(isOnline: boolean, lastActiveIso: string | null)
 * Reevalúa periódicamente para detectar desconexiones abruptas (sin latido reciente).
 */
export const subscribeToUserOnlineStatus = (userOrId, callback) => {
  if (!userOrId || typeof callback !== "function") return () => { };

  // Identificadores posibles del documento de presencia (uid principal)
  const ids = Array.from(
    new Set(
      (typeof userOrId === "object"
        ? [userOrId.id, userOrId.uid]
        : [userOrId]
      )
        .filter(Boolean)
        .map((v) => String(v).trim())
        .filter((v) => v && !v.includes("/"))
    )
  );
  if (ids.length === 0) {
    callback(false, null);
    return () => { };
  }

  if (!isFirebaseConfigured) {
    callback(false, null);
    return () => { };
  }

  const latest = {}; // id -> { isOnline, lastActiveMs }
  let lastEmitted = null;

  const evaluate = () => {
    let online = false;
    let newestMs = 0;
    Object.values(latest).forEach((p) => {
      if (!p) return;
      if (p.lastActiveMs > newestMs) newestMs = p.lastActiveMs;
      if (p.isOnline && Date.now() - p.lastActiveMs < PRESENCE_STALE_MS) online = true;
    });
    const lastIso = newestMs ? new Date(newestMs).toISOString() : null;
    const signature = `${online}_${lastIso}`;
    if (signature !== lastEmitted) {
      lastEmitted = signature;
      callback(online, lastIso);
    }
  };

  const unsubs = ids.map((id) => {
    try {
      return onSnapshot(
        doc(db, "presence", id),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data({ serverTimestamps: "estimate" });
            const lastActiveMs =
              data.lastActive?.toMillis?.() ||
              (data.lastActive?.seconds ? data.lastActive.seconds * 1000 : 0);
            latest[id] = { isOnline: Boolean(data.isOnline), lastActiveMs };
          } else {
            latest[id] = null;
          }
          evaluate();
        },
        () => {
          latest[id] = null;
          evaluate();
        }
      );
    } catch (_) {
      return () => { };
    }
  });

  // Reevaluar cada 15 s para marcar como desconectado a quien dejó de enviar latidos
  const recheckTimer = setInterval(evaluate, 15000);

  return () => {
    clearInterval(recheckTimer);
    unsubs.forEach((u) => {
      try {
        u();
      } catch (_) { }
    });
  };
};

/**
 * Formatea la última conexión de un usuario ("hace 5 min", "ayer a las 14:30")
 */
export const formatLastSeen = (lastActiveIso) => {
  if (!lastActiveIso) return "Desconectado";
  const d = new Date(lastActiveIso);
  if (isNaN(d.getTime())) return "Desconectado";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "Últ. vez hace un momento";
  if (diffMin < 60) return `Últ. vez hace ${diffMin} min`;
  const time = d.toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Últ. vez hoy a las ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Últ. vez ayer a las ${time}`;
  return `Últ. vez el ${d.toLocaleDateString("es-SV", { day: "numeric", month: "short" })}`;
};

/**
 * Registra si el usuario está actualmente DENTRO de una sala de chat específica (en pantalla)
 */
export const setUserActiveInChat = async (conversationId, currentUser, isActive) => {
  if (!conversationId || !currentUser) return;
  const candidates = getUserCandidateKeys(currentUser);
  const userId = normalizeUserId(currentUser);

  // Reflejar también en la copia local para que el emisor calcule correctamente el estado
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const idx = list.findIndex((c) => c && String(c.id) === String(conversationId));
      if (idx !== -1) {
        const activeInChat = { ...(list[idx].activeInChat || {}) };
        candidates.forEach((cand) => {
          activeInChat[cand] = Boolean(isActive);
        });
        list[idx] = { ...list[idx], activeInChat };
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(list));
      }
    }
  } catch (_) { }

  if (isFirebaseConfigured) {
    try {
      const convRef = doc(db, "conversations", conversationId);
      const entries = [];
      candidates.forEach((cand) => {
        entries.push([["activeInChat", cand], Boolean(isActive)]);
        if (isActive) {
          entries.push([["unreadCounts", cand], 0]);
        }
      });
      if (userId) {
        entries.push([[isActive ? "lastSeenInChat" : "lastLeftChat", userId], serverTimestamp()]);
      }
      await updateDocFields(convRef, entries);
    } catch (err) {
      // La conversación aún puede no existir en Firestore (se crea con el primer mensaje)
      if (err?.code !== "not-found") {
        console.warn("Aviso al actualizar presencia en chat:", err?.code || err);
      }
    }
  }
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
 * Construye y normaliza el objeto de datos del producto asociado a una conversación,
 * conservando el precio exacto, rangos, periodicidades y modalidades de pago.
 */
export const buildConversationProductData = (product) => {
  if (!product) return null;
  const priceNum = Number(product.price);
  const minNum = product.minPrice != null ? Number(product.minPrice) : null;
  const maxNum = product.maxPrice != null ? Number(product.maxPrice) : null;
  const isFree = Boolean(product.isFree);
  const isContact = Boolean(product.isContactPrice || product.priceMode === "contact" || product.priceType === "contact");
  const isRange = Boolean(
    product.priceMode === "range" ||
    product.isPriceRange ||
    (minNum !== null && maxNum !== null && maxNum > 0 && product.priceMode !== "fixed")
  );

  return {
    id: product.id,
    title: product.title || "Publicación",
    price: !isNaN(priceNum) ? priceNum : 0,
    minPrice: minNum,
    maxPrice: maxNum,
    isPriceRange: isRange,
    priceMode: isContact ? "contact" : (isRange ? "range" : (isFree ? "free" : (product.priceMode || "fixed"))),
    isFree,
    isContactPrice: isContact,
    currency: product.currency || "USD",
    rentPeriod: product.rentPeriod || null,
    servicePaymentType: product.servicePaymentType || null,
    // Limitar el tamaño de la miniatura (las imágenes base64 pueden exceder el límite de 1 MB de Firestore)
    image: (() => {
      const img = product.image || (Array.isArray(product.images) && product.images[0]) || "";
      return typeof img === "string" && img.length < 150000 ? img : "";
    })(),
    seller: product.seller
      ? {
        id: product.seller.id || product.seller.uid || null,
        name: product.seller.name || product.seller.displayName || null,
        username: product.seller.username || null
      }
      : null
  };
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

  // Generar ID canónico determinista para que ambos usuarios coincidan en la misma sala de chat
  const sortedIds = [currentId, recipientId].sort();
  const canonicalConvId = product?.id
    ? `conv_${sortedIds[0]}_${sortedIds[1]}_${product.id}`
    : `conv_${sortedIds[0]}_${sortedIds[1]}`;

  // Buscar conversación existente entre ambos usuarios
  let existing = all.find((conv) => {
    if (conv.id === canonicalConvId) return true;
    const hasCurrent = conv.participants && conv.participants.includes(currentId);
    const hasRecipient = conv.participants && conv.participants.includes(recipientId);
    if (!hasCurrent || !hasRecipient) return false;

    if (product?.id && conv.product?.id) {
      return String(conv.product.id) === String(product.id);
    }
    return !product?.id && !conv.product?.id;
  });

  const currentCandidates = getUserCandidateKeys(currentUser);
  const recipientCandidates = getUserCandidateKeys(recipient);
  const currentName = currentUser.displayName || currentUser.name || `@${currentUser.username || "usuario"}`;
  const recipientName = recipient.displayName || recipient.name || `@${recipient.username || "vendedor"}`;

  // Avatares base64 muy pesados no se replican en la conversación (se resuelven desde el perfil público)
  const compactAvatar = (avatar, name) => {
    const resolved = avatar || resolveUserAvatar(avatar, name);
    return typeof resolved === "string" && resolved.length < 60000 ? resolved : "";
  };

  const currentParticipantData = {
    id: currentId,
    name: currentName,
    username: currentUser.username || currentName.toLowerCase().replace(/\s+/g, "_"),
    avatar: compactAvatar(currentUser.avatar, currentName)
  };
  const recipientParticipantData = {
    id: recipientId,
    name: recipientName,
    username: recipient.username || recipientName.toLowerCase().replace(/\s+/g, "_"),
    avatar: compactAvatar(recipient.avatar, recipientName)
  };

  if (existing) {
    let shouldSave = false;

    // Actualizar producto si se proporciona uno más completo o con precio actualizado
    if (product) {
      const freshProd = buildConversationProductData(product);
      const isOutdated =
        !existing.product ||
        existing.product.id !== freshProd.id ||
        !existing.product.priceMode ||
        (existing.product.price === 0 && freshProd.price > 0) ||
        (freshProd.isPriceRange && !existing.product.isPriceRange);

      if (isOutdated) {
        existing = {
          ...existing,
          product: freshProd
        };
        shouldSave = true;
      }
    }

    // Asegurar que participantsData contenga índices para todas las claves candidatas
    const updatedPData = { ...(existing.participantsData || {}) };
    let pDataChanged = false;

    if (!updatedPData[currentId]) {
      updatedPData[currentId] = currentParticipantData;
      pDataChanged = true;
    }
    if (!updatedPData[recipientId]) {
      updatedPData[recipientId] = recipientParticipantData;
      pDataChanged = true;
    }

    currentCandidates.forEach((key) => {
      const normKey = String(key).trim().toLowerCase();
      if (normKey && !updatedPData[normKey] && !normKey.includes("@")) {
        updatedPData[normKey] = currentParticipantData;
        pDataChanged = true;
      }
    });

    recipientCandidates.forEach((key) => {
      const normKey = String(key).trim().toLowerCase();
      if (normKey && !updatedPData[normKey] && !normKey.includes("@")) {
        updatedPData[normKey] = recipientParticipantData;
        pDataChanged = true;
      }
    });

    if (pDataChanged) {
      existing = {
        ...existing,
        participantsData: updatedPData
      };
      shouldSave = true;
    }

    if (shouldSave) {
      const updatedList = all.map((c) => (c.id === existing.id ? existing : c));
      saveStoredConversations(updatedList);
    }

    // Asegurar que la conversación también exista en Firestore (pudo fallar antes)
    ensureRemoteConversation(existing);
    return existing;
  }

  // Todos los identificadores posibles de ambos participantes para coincidencia infalible
  const allParticipantKeys = Array.from(
    new Set([...currentCandidates, ...recipientCandidates, currentId, recipientId])
  );

  // Crear una nueva conversación con identificador único determinista
  const newConvId = canonicalConvId;

  const unreadMap = {};
  allParticipantKeys.forEach((key) => {
    unreadMap[key] = 0;
  });

  const participantsDataMap = {
    [currentId]: currentParticipantData,
    [recipientId]: recipientParticipantData
  };

  currentCandidates.forEach((key) => {
    const normKey = String(key).trim().toLowerCase();
    if (normKey && !participantsDataMap[normKey] && !normKey.includes("@")) {
      participantsDataMap[normKey] = currentParticipantData;
    }
  });

  recipientCandidates.forEach((key) => {
    const normKey = String(key).trim().toLowerCase();
    if (normKey && !participantsDataMap[normKey] && !normKey.includes("@")) {
      participantsDataMap[normKey] = recipientParticipantData;
    }
  });

  const newConversation = {
    id: newConvId,
    participants: allParticipantKeys,
    participantsData: participantsDataMap,
    product: buildConversationProductData(product),
    lastMessage: "",
    lastMessageAt: new Date().toISOString(),
    lastSenderId: null,
    unreadCounts: unreadMap,
    activeInChat: {},
    createdBy: currentId,
    createdAt: new Date().toISOString()
  };

  const updatedConversations = [newConversation, ...all];
  saveStoredConversations(updatedConversations);

  // Registrar en Firestore sin sobrescribir datos de una conversación remota existente
  ensureRemoteConversation(newConversation);

  return newConversation;
};

/**
 * Garantiza que la conversación exista en Firestore con sus participantes.
 * - Si no existe: la crea completa.
 * - Si existe: solo agrega participantes/datos de perfil/producto, sin tocar
 *   el último mensaje ni los contadores de no leídos.
 * Devuelve una promesa que sendMessage espera para evitar carreras.
 */
const ensureRemoteConversation = (conv) => {
  if (!isFirebaseConfigured || !conv?.id) return Promise.resolve(false);
  if (pendingConversationWrites.has(conv.id)) return pendingConversationWrites.get(conv.id);

  const task = (async () => {
    const convRef = doc(db, "conversations", conv.id);
    try {
      const snap = await getDoc(convRef);
      if (!snap.exists()) {
        await setDoc(convRef, {
          id: conv.id,
          participants: conv.participants || [],
          participantsData: conv.participantsData || {},
          product: conv.product || null,
          lastMessage: "",
          lastSenderId: null,
          unreadCounts: conv.unreadCounts || {},
          activeInChat: {},
          createdBy: conv.createdBy || null,
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp()
        });
      } else {
        const entries = [];
        if (Array.isArray(conv.participants) && conv.participants.length > 0) {
          entries.push(["participants", arrayUnion(...conv.participants)]);
        }
        Object.entries(conv.participantsData || {}).forEach(([key, value]) => {
          if (key && value) entries.push([["participantsData", key], value]);
        });
        if (conv.product) entries.push(["product", conv.product]);
        if (entries.length > 0) await updateDocFields(convRef, entries);
      }
      return true;
    } catch (err) {
      console.warn("Aviso al registrar conversación en Firestore:", err?.code || err);
      return false;
    } finally {
      // Permitir reintentos posteriores
      setTimeout(() => pendingConversationWrites.delete(conv.id), 0);
    }
  })();

  pendingConversationWrites.set(conv.id, task);
  return task;
};

/**
 * Núcleo común de envío de mensajes (texto e imagen).
 * 1. Guarda el mensaje localmente con estado "enviando" (respuesta inmediata en la UI).
 * 2. Escribe de forma ATÓMICA (writeBatch) el mensaje y los metadatos de la conversación en Firestore,
 *    incrementando los no leídos del destinatario con increment() (sin depender de copias locales).
 * 3. Si la conversación aún no existe en Firestore, la crea y reintenta.
 * 4. Actualiza el estado local a "enviado"/"leido" al confirmar, o "error" si falla.
 */
const deliverMessage = async ({ conversationId, sender, messageFields, summaryText }) => {
  const senderId = normalizeUserId(sender);
  const senderCandidates = getUserCandidateKeys(sender).map((k) => k.toLowerCase());
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

  // Identificar los candidatos del destinatario
  const allParticipantKeys = Array.isArray(targetConv?.participants) ? targetConv.participants : [];
  const recipientCandidates = allParticipantKeys.filter(
    (p) => p && !senderCandidates.includes(String(p).trim().toLowerCase())
  );

  // Validar si el interlocutor se encuentra DENTRO de la conversación activa en este momento
  const isRecipientInChat = Boolean(
    targetConv?.activeInChat &&
    typeof targetConv.activeInChat === "object" &&
    recipientCandidates.some((cand) => cand && targetConv.activeInChat?.[cand] === true)
  );

  // Si está dentro de la sala de chat, nace directamente como "leído"
  const confirmedStatus = isRecipientInChat ? "leido" : "enviado";
  const senderName = sender.displayName || sender.name || `@${sender.username || "usuario"}`;
  const rawAvatar = sender.avatar || resolveUserAvatar(sender.avatar, senderName);

  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    conversationId,
    senderId,
    senderName,
    senderAvatar: typeof rawAvatar === "string" && rawAvatar.length < 60000 ? rawAvatar : "",
    ...messageFields,
    createdAt: timestamp,
    status: isFirebaseConfigured ? "enviando" : confirmedStatus,
    read: isRecipientInChat,
    isTemporary,
    temporaryHours: isTemporary ? temporaryHours : null,
    expiresAt
  };

  // 1. Guardar mensaje en el almacenamiento local
  saveStoredMessages(conversationId, [...getStoredMessages(conversationId), newMessage]);

  // 2. Actualizar metadatos de la conversación en almacenamiento local
  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    const newUnreadCounts = { ...(conv.unreadCounts || {}) };
    if (!isRecipientInChat) {
      recipientCandidates.forEach((cand) => {
        newUnreadCounts[cand] = (Number(newUnreadCounts[cand]) || 0) + 1;
      });
    }
    senderCandidates.forEach((cand) => {
      newUnreadCounts[cand] = 0;
    });
    const updatedConv = {
      ...conv,
      lastMessage: summaryText,
      lastMessageAt: timestamp,
      lastSenderId: senderId,
      unreadCounts: newUnreadCounts
    };
    const remaining = allConversations.filter((c) => String(c.id) !== String(conversationId));
    saveStoredConversations([updatedConv, ...remaining]);
  }

  // Actualiza el estado del mensaje en la copia local
  const setLocalStatus = (status) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId);
      const list = raw ? JSON.parse(raw) : [];
      const next = (Array.isArray(list) ? list : []).map((m) =>
        m && m.id === newMessage.id && (m.status === "enviando" || m.status === "error") ? { ...m, status } : m
      );
      saveStoredMessages(conversationId, next);
    } catch (_) { }
  };

  // 3. Persistir en Firestore en tiempo real (escritura atómica de mensaje + conversación)
  if (isFirebaseConfigured) {
    const convRef = doc(db, "conversations", conversationId);
    const msgRef = doc(db, "conversations", conversationId, "messages", newMessage.id);

    const commitBatch = async () => {
      const batch = writeBatch(db);
      const args = [
        "lastMessage", summaryText,
        "lastMessageAt", serverTimestamp(),
        "lastSenderId", senderId
      ];
      senderCandidates.forEach((cand) => {
        args.push(new FieldPath("unreadCounts", cand), 0);
      });
      if (!isRecipientInChat) {
        recipientCandidates.forEach((cand) => {
          args.push(new FieldPath("unreadCounts", String(cand)), increment(1));
        });
      }
      batch.update(convRef, ...args);
      batch.set(msgRef, {
        ...newMessage,
        status: confirmedStatus,
        clientCreatedAt: timestamp,
        createdAt: serverTimestamp()
      });
      await batch.commit();
    };

    try {
      // Esperar a que termine la creación de la conversación si está en curso
      if (pendingConversationWrites.has(conversationId)) {
        await pendingConversationWrites.get(conversationId);
      }
      try {
        await commitBatch();
      } catch (err) {
        // La conversación no existe aún en Firestore: crearla y reintentar
        if ((err?.code === "not-found" || err?.code === "permission-denied") && targetConv) {
          const created = await ensureRemoteConversation(targetConv);
          if (!created) throw err;
          await commitBatch();
        } else {
          throw err;
        }
      }
      setLocalStatus(confirmedStatus);
      newMessage.status = confirmedStatus;
    } catch (err) {
      console.warn("Aviso al enviar mensaje a Firestore:", err?.code || err);
      setLocalStatus("error");
      newMessage.status = "error";
    }
  }

  // Notificar reactivamente la salida del mensaje para actualización inmediata de la UI
  notifyChatUpdated({ type: "message_sent", conversationId, message: newMessage });
  return newMessage;
};

/**
 * Envía un mensaje de texto dentro de una conversación
 */
export const sendMessage = async ({ conversationId, sender, text }) => {
  if (!conversationId || !sender || !text || !text.trim()) {
    throw new Error("El mensaje no puede estar vacío.");
  }
  const trimmedText = text.trim();
  return deliverMessage({
    conversationId,
    sender,
    messageFields: { text: trimmedText },
    summaryText: trimmedText
  });
};

/**
 * Envía un mensaje con imagen dentro de la conversación.
 * Se sincroniza en tiempo real entre los participantes mediante Firestore.
 */
export const sendImageMessage = async ({ conversationId, sender, imageData, caption = "" }) => {
  if (!conversationId || !sender || !imageData) {
    throw new Error("Se requiere una imagen válida para enviar.");
  }
  // Firestore admite documentos de hasta 1 MB: las imágenes se comprimen antes de enviarse
  if (isFirebaseConfigured && imageData.length > 900000) {
    throw new Error("La imagen es demasiado pesada para enviarse. Intenta con una foto más pequeña.");
  }
  const trimmedCaption = caption ? caption.trim() : "";
  return deliverMessage({
    conversationId,
    sender,
    messageFields: { type: "image", image: imageData, caption: trimmedCaption },
    summaryText: trimmedCaption ? `📷 ${trimmedCaption}` : "📷 Foto"
  });
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
      }).catch(() => { });

      const msgColRef = collection(db, "conversations", conversationId, "messages");
      addDoc(msgColRef, {
        ...sysMessage,
        createdAt: serverTimestamp()
      }).catch(() => { });
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
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
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
    localStorage.setItem(STORAGE_KEY_BLOCKED_USERS, JSON.stringify(map && typeof map === "object" ? map : {}));
  } catch (e) {
    console.error("Error al guardar usuarios bloqueados:", e);
  }
};

/**
 * Resuelve de forma infalible los datos del interlocutor en una conversación,
 * descartando todas las claves candidatas del usuario actual (UID, id, correo, username).
 */
export const resolveConversationPeer = (conv, currentUser = null) => {
  const activeUser = currentUser || getSessionUser();
  const rawMyCandidates = activeUser ? getUserCandidateKeys(activeUser) : [];
  const myCandidates = Array.from(
    new Set(
      rawMyCandidates.flatMap((k) => {
        const lower = String(k).trim().toLowerCase();
        return [lower, lower.replace(/^@/, "")];
      }).filter(Boolean)
    )
  );

  if (!conv) {
    return {
      id: "",
      name: "Usuario",
      username: "usuario",
      avatar: ""
    };
  }

  const enrichPeer = (peer, fallbackId = "") => {
    const peerId = peer?.id || peer?.uid || fallbackId || "";
    const latestProfile = getPublicProfile(peerId || peer?.username || peer?.name);
    const resolvedName =
      latestProfile?.displayName ||
      latestProfile?.name ||
      (peer?.name && peer.name !== "Vendedor / Usuario" ? peer.name : "") ||
      (peer?.username ? `@${String(peer.username).replace(/^@/, "")}` : "Usuario");
    const resolvedUsername =
      latestProfile?.username ||
      peer?.username ||
      (peerId && !peerId.includes("@") ? peerId : "usuario");
    const rawAv = latestProfile?.avatar || peer?.avatar || "";
    return {
      ...peer,
      id: peerId,
      name: resolvedName,
      username: String(resolvedUsername).replace(/^@/, ""),
      avatar: rawAv || resolveUserAvatar(rawAv, resolvedName) || ""
    };
  };

  // 1. Buscar en los valores de participantsData el objeto cuyos candidatos no coincidan con el usuario actual
  if (conv.participantsData && typeof conv.participantsData === "object") {
    const list = Object.values(conv.participantsData).filter(Boolean);
    const other = list.find((p) => {
      if (!p) return false;
      if (myCandidates.length === 0) return true;
      const pKeys = getUserCandidateKeys(p).flatMap((k) => {
        const lower = String(k).trim().toLowerCase();
        return [lower, lower.replace(/^@/, "")];
      });
      return !pKeys.some((pk) => pk && myCandidates.includes(pk));
    });

    if (other && other.name && other.name !== "Vendedor / Usuario") {
      return enrichPeer(other);
    }
  }

  // 2. Buscar en el arreglo participants la clave que no pertenezca al usuario actual (priorizando UIDs sin @)
  const rawParts = Array.isArray(conv.participants) ? conv.participants : [];
  const otherKeys = rawParts.filter((p) => {
    const lower = String(p).trim().toLowerCase();
    return lower && !myCandidates.includes(lower) && !myCandidates.includes(lower.replace(/^@/, ""));
  });
  const preferredOtherKey = otherKeys.find((k) => !String(k).includes("@")) || otherKeys[0] || "";

  if (preferredOtherKey && conv.participantsData && typeof conv.participantsData === "object") {
    for (const keyToTry of [preferredOtherKey, ...otherKeys]) {
      if (conv.participantsData[keyToTry]) {
        return enrichPeer(conv.participantsData[keyToTry], preferredOtherKey);
      }
      const normTry = String(keyToTry).trim().toLowerCase();
      for (const [k, v] of Object.entries(conv.participantsData)) {
        if (v && String(k).trim().toLowerCase() === normTry) {
          return enrichPeer(v, preferredOtherKey);
        }
      }
    }
  }

  // 3. Si el producto negociado tiene vendedor y no es el usuario actual
  if (conv.product?.seller) {
    const s = conv.product.seller;
    const sKeys = getUserCandidateKeys(s).map((k) => String(k).trim().toLowerCase().replace(/^@/, ""));
    if (!sKeys.some((k) => k && myCandidates.includes(k))) {
      return enrichPeer(s, s.id || s.uid || preferredOtherKey);
    }
  }

  // 4. Perfil público guardado localmente para cualquiera de las claves del interlocutor
  for (const keyToTry of [preferredOtherKey, ...otherKeys]) {
    if (!keyToTry) continue;
    const pub = getPublicProfile(keyToTry);
    if (pub && (pub.displayName || pub.name)) {
      return enrichPeer(
        {
          id: pub.id || pub.uid || keyToTry,
          name: pub.displayName || pub.name,
          username: pub.username || keyToTry,
          avatar: pub.avatar || ""
        },
        keyToTry
      );
    }
  }

  // 5. Respaldo con cualquier entrada de participantsData disponible
  if (conv.participantsData && typeof conv.participantsData === "object") {
    const list = Object.values(conv.participantsData).filter(Boolean);
    if (list.length > 0) return enrichPeer(list[0], preferredOtherKey);
  }

  return {
    id: preferredOtherKey || "",
    name: "Usuario",
    username: "usuario",
    avatar: ""
  };
};

/**
 * Retorna la lista de usuarios bloqueados por el usuario actual
 */
export const getBlockedUsers = (currentUser) => {
  const currentUserId = normalizeUserId(currentUser);
  if (!currentUserId) return [];

  const map = getRawBlockedUsersMap();
  const userList = Array.isArray(map?.[currentUserId]) ? [...map[currentUserId]] : [];

  // También sincronizar cualquier conversación donde el usuario actual figure como bloqueador
  const allConversations = getStoredConversations();
  allConversations.forEach((conv) => {
    if (conv.blockedBy === currentUserId) {
      const peer = resolveConversationPeer(conv, currentUser);
      const otherId = peer.id;
      if (otherId && !userList.some((u) => u.id === otherId)) {
        userList.push({
          id: otherId,
          name: peer.name || "Usuario",
          username: peer.username || "usuario",
          avatar: peer.avatar || "",
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
  if (map && Array.isArray(map[currentUserId])) {
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

      const sysMessage = {
        id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId: conv.id,
        senderId: "system",
        senderName: "Sistema",
        senderAvatar: "",
        text: "🛡️ Desbloqueaste a este usuario. Ya pueden volver a comunicarse.",
        createdAt: timestamp,
        isSystem: true,
        status: "leido",
        read: true
      };

      const currentMessages = getStoredMessages(conv.id);
      saveStoredMessages(conv.id, [...currentMessages, sysMessage]);
      conv.lastMessage = sysMessage.text;
      conv.lastMessageAt = timestamp;

      if (isFirebaseConfigured) {
        updateDoc(doc(db, "conversations", conv.id), {
          blockedBy: null,
          blockedAt: null,
          lastMessage: sysMessage.text,
          lastMessageAt: serverTimestamp()
        }).catch(() => { });
        setDoc(doc(db, "conversations", conv.id, "messages", sysMessage.id), {
          ...sysMessage,
          createdAt: serverTimestamp()
        }).catch(() => { });
      }
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
  const peer = resolveConversationPeer(conv, currentUser);
  const otherParticipantId = peer.id;

  const isCurrentlyBlocked = Boolean(conv.blockedBy);
  const isBlockedByMe = conv.blockedBy === currentUserId;

  let newBlockedBy = null;
  let systemText = "";

  if (isCurrentlyBlocked) {
    if (isBlockedByMe) {
      newBlockedBy = null;
      systemText = "🛡️ Desbloqueaste a este usuario. Ya pueden volver a comunicarse.";

      if (otherParticipantId) {
        const map = getRawBlockedUsersMap();
        if (map && Array.isArray(map[currentUserId])) {
          map[currentUserId] = map[currentUserId].filter((u) => u.id !== otherParticipantId);
          saveRawBlockedUsersMap(map);
        }
      }
    } else {
      throw new Error("No tienes permisos para desbloquear a este usuario.");
    }
  } else {
    newBlockedBy = currentUserId;
    systemText = "🚫 Has bloqueado a este usuario. Ya no podrán enviarse mensajes.";

    if (otherParticipantId) {
      const map = getRawBlockedUsersMap() || {};
      const currentList = Array.isArray(map[currentUserId]) ? map[currentUserId] : [];
      if (!currentList.some((u) => u.id === otherParticipantId)) {
        currentList.push({
          id: otherParticipantId,
          name: peer.name || "Usuario",
          username: peer.username || "usuario",
          avatar: peer.avatar || "",
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

  if (isFirebaseConfigured) {
    updateDoc(doc(db, "conversations", conversationId), {
      blockedBy: newBlockedBy,
      blockedAt: newBlockedBy ? serverTimestamp() : null,
      lastMessage: sysMessage.text,
      lastMessageAt: serverTimestamp()
    }).catch(() => { });
    setDoc(doc(db, "conversations", conversationId, "messages", sysMessage.id), {
      ...sysMessage,
      createdAt: serverTimestamp()
    }).catch(() => { });
  }

  notifyChatUpdated({
    type: "block_status_updated",
    conversationId,
    blockedBy: newBlockedBy
  });

  return Boolean(newBlockedBy);
};

/**
 * Marca una o múltiples conversaciones como leídas para el usuario activo
 */
export const markConversationsAsRead = async (conversationIds, currentUser) => {
  const userId = normalizeUserId(currentUser);
  if (!userId || !conversationIds || typeof window === "undefined") return;

  const idList = Array.isArray(conversationIds) ? conversationIds.map(String) : [String(conversationIds)];
  if (idList.length === 0) return;

  const userCandidates = getUserCandidateKeys(currentUser);
  const userCandidatesLower = userCandidates.map((k) => k.toLowerCase());

  const allConversations = getStoredConversations();
  let hasChanges = false;

  const updatedConvs = allConversations.map((conv) => {
    if (idList.includes(String(conv.id))) {
      hasChanges = true;
      const nextUnreads = { ...(conv.unreadCounts || {}) };
      Object.keys(nextUnreads).forEach((k) => {
        if (userCandidatesLower.includes(k.toLowerCase().replace(/^@/, "")) || userCandidatesLower.includes(k.toLowerCase())) {
          nextUnreads[k] = 0;
        }
      });
      userCandidates.forEach((cand) => {
        nextUnreads[cand] = 0;
      });
      return {
        ...conv,
        unreadCounts: nextUnreads
      };
    }
    return conv;
  });

  if (hasChanges) {
    saveStoredConversations(updatedConvs);
  }

  // Actualizar también en Firestore usando FieldPath seguro para cualquier candidato
  if (isFirebaseConfigured) {
    await Promise.all(
      idList.map(async (cId) => {
        try {
          const convRef = doc(db, "conversations", cId);
          const entries = [[["lastSeenInChat", userId], serverTimestamp()]];
          userCandidates.forEach((cand) => {
            entries.push([["unreadCounts", cand], 0]);
          });
          await updateDocFields(convRef, entries);
        } catch (err) {
          if (err?.code !== "not-found") {
            console.warn("Aviso al marcar conversación leída en Firestore:", err?.code || err);
          }
        }
      })
    );
  }

  notifyChatUpdated({
    type: "conversations_marked_read",
    conversationIds: idList
  });
};

/**
 * Elimina una o múltiples conversaciones del buzón del usuario actual (con fecha de corte).
 * - No destruye el documento en Firestore para no afectar la bandeja del otro participante.
 * - La conversación no vuelve a aparecer al recargar ni en otros dispositivos, salvo que
 *   posteriormente llegue un mensaje nuevo real (mostrando únicamente los mensajes nuevos).
 */
export const deleteMultipleConversations = async (conversationIds, currentUser) => {
  if (!conversationIds || typeof window === "undefined") return false;
  const userId = normalizeUserId(currentUser);
  const userCandidates = getUserCandidateKeys(currentUser);
  const userCandidatesLower = userCandidates.map((k) => k.toLowerCase());
  const idList = (Array.isArray(conversationIds) ? conversationIds : [conversationIds]).map(String);
  if (idList.length === 0) return false;

  const allConversations = getStoredConversations();
  const idSet = new Set(idList);

  // Garantizar que la fecha de corte supere cualquier lastMessageAt actual (a prueba de desfase de reloj)
  const maxExistingMs = idList.reduce((max, cId) => {
    const conv = allConversations.find((item) => String(item.id) === String(cId));
    const t = conv?.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
    return !isNaN(t) && t > max ? t : max;
  }, Date.now());
  const deletedAtIso = new Date(maxExistingMs + 1000).toISOString();

  // 1. Registrar fecha de corte local de eliminación por conversación
  if (userId) {
    addDeletedConversationIds(userId, idList, deletedAtIso);
  }

  // 2. Actualizar metadatos locales (conservar deletedFor y limpiar no leídos del usuario)
  const updatedLocal = allConversations.map((conv) => {
    if (!idSet.has(String(conv.id))) return conv;
    const nextUnreads = { ...(conv.unreadCounts || {}) };
    Object.keys(nextUnreads).forEach((k) => {
      if (userCandidatesLower.includes(k.toLowerCase().replace(/^@/, "")) || userCandidatesLower.includes(k.toLowerCase())) {
        nextUnreads[k] = 0;
      }
    });
    userCandidates.forEach((cand) => {
      nextUnreads[cand] = 0;
    });
    return {
      ...conv,
      unreadCounts: nextUnreads,
      deletedFor: {
        ...(conv.deletedFor || {}),
        ...(userId ? { [userId]: deletedAtIso } : {})
      }
    };
  });
  saveStoredConversations(updatedLocal);

  // 3. Limpiar los mensajes anteriores almacenados en localStorage
  idList.forEach((cId) => {
    try {
      localStorage.removeItem(STORAGE_KEY_MESSAGES_PREFIX + cId);
    } catch (_) { }
  });

  // 4. Sincronizar eliminación por usuario en Firestore (sin borrar el chat del interlocutor)
  if (isFirebaseConfigured && userId) {
    await Promise.all(
      idList.map(async (cId) => {
        try {
          const convRef = doc(db, "conversations", cId);
          const entries = [[["deletedFor", userId], deletedAtIso]];
          userCandidates.forEach((cand) => {
            entries.push([["unreadCounts", cand], 0]);
          });
          await updateDocFields(convRef, entries);
        } catch (err) {
          if (err?.code !== "not-found") {
            console.warn("Aviso al registrar eliminación de chat en Firestore:", err?.code || err);
          }
        }
      })
    );
  }

  notifyChatUpdated({
    type: "conversations_deleted",
    conversationIds: idList
  });

  return true;
};

/**
 * Elimina una conversación del buzón del usuario actual
 */
export const deleteConversation = (conversationId, currentUser) => {
  return deleteMultipleConversations([conversationId], currentUser);
};

/**
 * Vacía la copia local de los mensajes de una conversación para el usuario actual
 */
export const clearConversationMessages = (conversationId) => {
  if (!conversationId) return false;

  const sessionUser = getSessionUser();
  const currentMsgs = getStoredMessages(conversationId);
  const maxMsgMs = currentMsgs.reduce((max, m) => {
    const t = m?.createdAt ? new Date(m.createdAt).getTime() : 0;
    return !isNaN(t) && t > max ? t : max;
  }, Date.now());
  const cutoffIso = new Date(maxMsgMs + 1000).toISOString();

  setConversationClearedAt(conversationId, sessionUser, cutoffIso);
  if (currentMsgs.length > 0) {
    addHiddenMessageIds(conversationId, sessionUser, currentMsgs.map((m) => m.id));
  }
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
  const myCandidates = getUserCandidateKeys(currentUser).map((k) => k.toLowerCase().replace(/^@/, ""));
  const now = Date.now();

  return messages.every((msg) => {
    const senderNorm = String(msg.senderId || "").trim().toLowerCase().replace(/^@/, "");
    if (!myCandidates.includes(senderNorm)) return false;
    if (msg.isDeletedForAll) return false;
    const createdAtTime = new Date(msg.createdAt).getTime();
    if (isNaN(createdAtTime)) return false;
    return now - createdAtTime <= DELETE_FOR_ALL_LIMIT_MS;
  });
};

/**
 * Elimina mensajes seleccionados exclusivamente de la copia del usuario actual ("Eliminar para mí")
 * y los persiste en la lista de ocultos para que no reaparezcan con Firestore.
 */
export const deleteMessagesForMe = (conversationId, messageIds, options = {}) => {
  if (!conversationId || !messageIds || messageIds.length === 0) return false;
  const idList = (Array.isArray(messageIds) ? messageIds : [messageIds]).map(String);

  addHiddenMessageIds(conversationId, getSessionUser(), idList);

  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId);
    const list = raw ? JSON.parse(raw) : [];
    const filteredRaw = (Array.isArray(list) ? list : []).filter((msg) => msg && !idList.includes(String(msg.id)));
    saveStoredMessages(conversationId, filteredRaw);
  } catch (_) { }

  const visibleRemaining = getStoredMessages(conversationId);

  // Actualizar último mensaje local de la conversación si fue afectado
  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    const lastMsg = visibleRemaining[visibleRemaining.length - 1];
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
  const idList = (Array.isArray(messageIds) ? messageIds : [messageIds]).map(String);
  const myCandidates = getUserCandidateKeys(currentUser).map((k) => k.toLowerCase().replace(/^@/, ""));
  const now = Date.now();
  const timestamp = new Date().toISOString();

  const currentMessages = getStoredMessages(conversationId);

  // Validar que los mensajes cumplan las condiciones
  const targetMessages = currentMessages.filter((m) => idList.includes(String(m.id)));
  const isValid = targetMessages.every((msg) => {
    const senderNorm = String(msg.senderId || "").trim().toLowerCase().replace(/^@/, "");
    if (!myCandidates.includes(senderNorm)) return false;
    const createdAtTime = new Date(msg.createdAt).getTime();
    return !isNaN(createdAtTime) && now - createdAtTime <= DELETE_FOR_ALL_LIMIT_MS;
  });

  if (!isValid) {
    throw new Error("Solo puedes eliminar para todos los mensajes que hayas enviado tú en los últimos 15 minutos.");
  }

  let updatedRaw = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId);
    const list = raw ? JSON.parse(raw) : [];
    updatedRaw = (Array.isArray(list) ? list : []).map((msg) => {
      if (msg && idList.includes(String(msg.id))) {
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
  } catch (_) { }

  saveStoredMessages(conversationId, updatedRaw);
  const visibleMessages = getStoredMessages(conversationId);

  // Actualizar metadatos de la conversación
  const allConversations = getStoredConversations();
  const convIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  if (convIndex !== -1) {
    const conv = allConversations[convIndex];
    const lastMsg = visibleMessages[visibleMessages.length - 1];
    allConversations[convIndex] = {
      ...conv,
      lastMessage: lastMsg ? (lastMsg.isDeletedForAll ? "🚫 Mensaje eliminado" : lastMsg.type === "image" ? "📷 Foto" : lastMsg.text) : "No hay mensajes",
      lastMessageAt: lastMsg ? lastMsg.createdAt : conv.lastMessageAt
    };
    saveStoredConversations(allConversations);
  }

  // Sincronizar eliminación en Firestore para todos los participantes
  if (isFirebaseConfigured) {
    try {
      idList.forEach((msgId) => {
        const msgRef = doc(db, "conversations", conversationId, "messages", msgId);
        updateDoc(msgRef, {
          isDeletedForAll: true,
          deletedForAllAt: serverTimestamp(),
          text: "🚫 Este mensaje fue eliminado",
          image: null,
          caption: ""
        }).catch(() => { });
      });

      const convRef = doc(db, "conversations", conversationId);
      const lastMsg = visibleMessages[visibleMessages.length - 1];
      if (lastMsg) {
        updateDoc(convRef, {
          lastMessage: lastMsg.isDeletedForAll ? "🚫 Mensaje eliminado" : lastMsg.type === "image" ? "📷 Foto" : lastMsg.text
        }).catch(() => { });
      }
    } catch (err) {
      console.warn("Aviso al eliminar mensajes en Firestore:", err);
    }
  }

  notifyChatUpdated({ type: "messages_deleted_for_all", conversationId, messageIds: idList });
  return true;
};

/**
 * Marca una conversación como leída para el usuario activo
 */
export const markConversationAsRead = (conversationId, currentUser) => {
  if (!conversationId || !currentUser) return;
  const userId = normalizeUserId(currentUser);
  const userCandidates = getUserCandidateKeys(currentUser);
  const userCandidatesLower = userCandidates.map((k) => k.toLowerCase());
  const userCandidatesClean = userCandidatesLower.map((k) => k.replace(/^@/, ""));

  // Actualizar mensajes dirigidos a este usuario al estado "leido" sobre la lista cruda
  let rawMessages = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId);
    const parsed = raw ? JSON.parse(raw) : [];
    rawMessages = Array.isArray(parsed) ? parsed : [];
  } catch (_) { }

  let changed = false;
  const readMessageIds = [];
  const updatedMessages = rawMessages.map((msg) => {
    if (!msg) return msg;
    const senderNorm = String(msg.senderId || "").trim().toLowerCase().replace(/^@/, "");
    const isFromMe = userCandidatesClean.includes(senderNorm) || userCandidatesLower.includes(senderNorm);
    if (!isFromMe && msg.senderId !== "system" && (msg.status !== "leido" || !msg.read)) {
      changed = true;
      readMessageIds.push(msg.id);
      return { ...msg, read: true, status: "leido" };
    }
    return msg;
  });

  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId, JSON.stringify(updatedMessages));
    } catch (_) { }
  }

  // Restablecer contador en la conversación para todos los identificadores del usuario
  const allConversations = getStoredConversations();
  const cIndex = allConversations.findIndex((c) => String(c.id) === String(conversationId));
  let unreadsChanged = false;

  if (cIndex !== -1 && allConversations[cIndex]) {
    const conv = allConversations[cIndex];
    const newUnreads = (conv.unreadCounts && typeof conv.unreadCounts === "object") ? { ...conv.unreadCounts } : {};

    Object.keys(newUnreads).forEach((k) => {
      const normK = k.toLowerCase().replace(/^@/, "");
      if (userCandidatesClean.includes(normK) || userCandidatesLower.includes(k.toLowerCase())) {
        if (newUnreads[k] !== 0) {
          newUnreads[k] = 0;
          unreadsChanged = true;
        }
      }
    });
    userCandidates.forEach((cand) => {
      if (newUnreads[cand] !== 0) {
        if (newUnreads[cand] !== undefined) unreadsChanged = true;
        newUnreads[cand] = 0;
      }
    });

    if (unreadsChanged) {
      allConversations[cIndex] = {
        ...conv,
        unreadCounts: newUnreads,
        lastSeenInChat: {
          ...(conv.lastSeenInChat || {}),
          ...(userId ? { [userId]: new Date().toISOString() } : {})
        }
      };
      try {
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(allConversations));
      } catch (_) { }
    }
  }

  if (isFirebaseConfigured && (changed || unreadsChanged)) {
    try {
      const convRef = doc(db, "conversations", conversationId);
      const entries = [];
      if (userId) {
        entries.push([["lastSeenInChat", userId], serverTimestamp()]);
      }
      userCandidates.forEach((cand) => {
        entries.push([["unreadCounts", cand], 0]);
      });
      if (entries.length > 0) {
        updateDocFields(convRef, entries).catch(() => { });
      }

      readMessageIds.forEach((mId) => {
        const mRef = doc(db, "conversations", conversationId, "messages", mId);
        updateDoc(mRef, { status: "leido", read: true }).catch(() => { });
      });
    } catch (_) { }
  }

  // Solo notificar si hubo una actualización real para evitar bucles infinitos de eventos
  if (changed || unreadsChanged) {
    notifyChatUpdated({ type: "conversation_marked_read", conversationId });
  }
};

/**
 * Cuenta el total de mensajes no leídos para el usuario activo en todas sus conversaciones
 */
export const getTotalUnreadCount = (currentUser) => {
  if (!currentUser) return 0;
  const userConversations = getUserConversations(currentUser);
  return userConversations.reduce((sum, conv) => {
    return sum + getConversationUnreadCount(conv, currentUser);
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

/**
 * Suscripción en tiempo real a los mensajes de una conversación.
 * Utiliza Firestore onSnapshot en tiempo real y sincroniza con localStorage y entre pestañas.
 */
export const subscribeToConversationMessages = (conversationId, callback) => {
  if (!conversationId) return () => { };

  // Emitir mensajes locales inmediatamente (cero latencia)
  const initialLocal = getStoredMessages(conversationId);
  if (typeof callback === "function") {
    callback(initialLocal);
  }

  // Listener reactivo para actualizaciones locales del chat
  const handleLocal = (e) => {
    if (e.detail?.type === "conversation_marked_read" && e.detail?.conversationId === conversationId) {
      return;
    }
    if (!e.detail?.conversationId || e.detail.conversationId === conversationId) {
      if (typeof callback === "function") {
        callback(getStoredMessages(conversationId));
      }
    }
  };

  // Sincronización instantánea entre pestañas del mismo navegador
  const handleStorage = (e) => {
    if (!e.key || e.key === STORAGE_KEY_MESSAGES_PREFIX + conversationId) {
      if (typeof callback === "function") {
        callback(getStoredMessages(conversationId));
      }
    }
  };

  window.addEventListener(CHAT_EVENT, handleLocal);
  window.addEventListener("storage", handleStorage);

  let unsubscribeFirestore = () => { };

  if (isFirebaseConfigured) {
    try {
      const messagesColRef = collection(db, "conversations", conversationId, "messages");
      const q = query(messagesColRef, orderBy("createdAt", "asc"));

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const remoteList = [];
          const sessionUser = getSessionUser();
          const myCandidates = sessionUser
            ? getUserCandidateKeys(sessionUser).map((k) => k.toLowerCase().replace(/^@/, ""))
            : [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data({ serverTimestamps: "estimate" });
            let createdAtStr = null;
            if (data.createdAt && typeof data.createdAt.toDate === "function") {
              createdAtStr = data.createdAt.toDate().toISOString();
            } else if (data.createdAt && data.createdAt.seconds) {
              createdAtStr = new Date(data.createdAt.seconds * 1000).toISOString();
            } else if (typeof data.createdAt === "string") {
              createdAtStr = data.createdAt;
            }
            if (!createdAtStr) {
              createdAtStr = data.clientCreatedAt || new Date().toISOString();
            }

            // Confirmar recepción ("recibido") si el mensaje es de otro usuario y sigue en "enviado"
            const senderNorm = String(data.senderId || "").trim().toLowerCase().replace(/^@/, "");
            if (
              myCandidates.length > 0 &&
              senderNorm &&
              senderNorm !== "system" &&
              !myCandidates.includes(senderNorm) &&
              data.status === "enviado" &&
              !data.read
            ) {
              updateDoc(docSnap.ref, { status: "recibido" }).catch(() => { });
            }

            remoteList.push({
              ...normalizeFirestoreData(data),
              id: docSnap.id,
              createdAt: createdAtStr
            });
          });

          // Leer mensajes crudos locales para conservar los que aún están en tránsito ("enviando" / "error")
          let rawLocal = [];
          try {
            const raw = localStorage.getItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId);
            const parsed = raw ? JSON.parse(raw) : [];
            rawLocal = Array.isArray(parsed) ? parsed : [];
          } catch (_) { }

          const localMap = new Map(rawLocal.filter(Boolean).map((m) => [m.id, m]));
          const remoteIds = new Set(remoteList.map((m) => m.id));

          const mergedRaw = remoteList.map((rem) => {
            const loc = localMap.get(rem.id);
            if (loc && loc.image && !rem.image && !rem.isDeletedForAll && !rem.viewed) {
              return { ...rem, image: loc.image };
            }
            return rem;
          });

          // Conservar mensajes locales pendientes que aún no entraron al snapshot remoto
          rawLocal.forEach((loc) => {
            if (loc && !remoteIds.has(loc.id) && (loc.status === "enviando" || loc.status === "error")) {
              mergedRaw.push(loc);
            }
          });

          mergedRaw.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

          try {
            localStorage.setItem(STORAGE_KEY_MESSAGES_PREFIX + conversationId, JSON.stringify(mergedRaw));
          } catch (_) { }

          if (typeof callback === "function") {
            callback(getStoredMessages(conversationId));
          }
        },
        (err) => {
          console.warn("Aviso en suscripción a mensajes Firestore:", err?.code || err);
        }
      );
    } catch (err) {
      console.warn("Aviso al iniciar listener de Firestore:", err);
    }
  }

  return () => {
    window.removeEventListener(CHAT_EVENT, handleLocal);
    window.removeEventListener("storage", handleStorage);
    unsubscribeFirestore();
  };
};

// Streams activos compartidos por usuario para evitar listeners y toasts triplicados
const activeConversationStreams = new Map();

/**
 * Suscripción en tiempo real a las conversaciones del usuario.
 * Multiplexa un único stream de Firestore por usuario entre todos los componentes suscritos
 * (MobileLayout, MessagesPage, InAppMessageToast) evitando duplicar lecturas y notificaciones.
 */
export const subscribeToUserConversations = (currentUser, callback) => {
  if (!currentUser) return () => { };
  const userId = normalizeUserId(currentUser);
  const userCandidates = getUserCandidateKeys(currentUser);
  const userCandidatesLower = userCandidates.map((k) => k.toLowerCase());
  const userCandidatesClean = userCandidatesLower.map((k) => k.replace(/^@/, ""));

  if (!userId || userCandidates.length === 0) return () => { };

  // Emitir conversaciones locales de inmediato
  if (typeof callback === "function") {
    callback(getUserConversations(currentUser));
  }

  let stream = activeConversationStreams.get(userId);

  if (!stream) {
    const subscribers = new Set();
    const remoteBySource = { primary: new Map(), secondary: new Map() };
    const notifiedSignatures = new Map();
    let primaryInitialDone = false;
    let secondaryInitialDone = false;

    const emitToAll = () => {
      const list = getUserConversations(stream.currentUser);
      subscribers.forEach((cb) => {
        try {
          cb(list);
        } catch (err) {
          console.warn("Aviso en callback de conversaciones:", err);
        }
      });
    };

    const syncRemoteSnapshot = (sourceKey, snapshot, isInitialForSource) => {
      const targetMap = remoteBySource[sourceKey];
      targetMap.clear();

      snapshot.forEach((docSnap) => {
        if (docSnap.id === "conv_demo_usr01" || String(docSnap.id).startsWith("conv_demo")) return;
        const rawData = docSnap.data({ serverTimestamps: "estimate" });
        const norm = normalizeFirestoreData(rawData);
        targetMap.set(docSnap.id, {
          ...norm,
          id: docSnap.id,
          lastMessageAt: norm.lastMessageAt || norm.createdAt || new Date().toISOString()
        });
      });

      // Evaluar cambios entrantes para notificaciones in-app y acuse de recibido ("lastDeliveredAt")
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added" && change.type !== "modified") return;
        const convId = change.doc.id;
        const cData = targetMap.get(convId);
        if (!cData) return;

        const signature = `${cData.lastSenderId || ""}_${cData.lastMessage || ""}_${cData.lastMessageAt || ""}`;
        const prevSig = notifiedSignatures.get(convId);
        notifiedSignatures.set(convId, signature);

        if (isInitialForSource || signature === prevSig) return;

        const lastSenderNorm = String(cData.lastSenderId || "").trim().toLowerCase().replace(/^@/, "");
        const isSenderMe =
          userCandidatesClean.includes(lastSenderNorm) ||
          userCandidatesLower.includes(String(cData.lastSenderId || "").trim().toLowerCase());
        const unreadForUser = getConversationUnreadCount(cData, stream.currentUser);

        if (cData.lastSenderId && cData.lastSenderId !== "system" && !isSenderMe && unreadForUser > 0 && cData.lastMessage) {
          // Confirmar entrega al servidor ("Recibido") porque la app del destinatario ya recibió el evento en línea
          if (isFirebaseConfigured && userId) {
            updateDocFields(doc(db, "conversations", convId), [
              [["lastDeliveredAt", userId], serverTimestamp()]
            ]).catch(() => { });
          }

          // Verificar que la conversación sea visible y no esté silenciada
          const isVisible = isConversationVisibleForUser(cData, userId, userCandidatesClean);
          const muteInfo = getChatMuteStatus(cData, stream.currentUser);
          const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

          if (isVisible && !muteInfo.isMuted && currentPath !== `/messages/${convId}`) {
            const peer = resolveConversationPeer(cData, stream.currentUser);
            notifyIncomingMessage({
              conversationId: convId,
              senderId: cData.lastSenderId,
              senderName: peer.name || "Usuario",
              senderAvatar: peer.avatar || "",
              text: cData.lastMessage,
              targetUserId: userId
            });
          }
        }
      });

      // Combinar documentos remotos de ambas fuentes con el almacenamiento local
      const combinedRemote = new Map([...remoteBySource.secondary, ...remoteBySource.primary]);
      const localConvs = getStoredConversations();
      const mergedMap = new Map(localConvs.map((c) => [String(c.id), c]));

      combinedRemote.forEach((rem, id) => {
        const prev = mergedMap.get(String(id)) || {};
        mergedMap.set(String(id), {
          ...prev,
          ...rem,
          participantsData: { ...(prev.participantsData || {}), ...(rem.participantsData || {}) },
          product: rem.product || prev.product || null
        });
      });

      try {
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(Array.from(mergedMap.values())));
      } catch (_) { }

      notifyChatUpdated({ type: "firestore_conversations_synced" });
      emitToAll();
    };

    const handleLocal = (e) => {
      if (e.detail?.type === "firestore_conversations_synced") return;
      emitToAll();
    };

    const handleStorage = (e) => {
      if (!e.key || e.key === STORAGE_KEY_CONVERSATIONS || e.key.startsWith(STORAGE_KEY_DELETED_PREFIX) || e.key.startsWith(STORAGE_KEY_PINNED_PREFIX)) {
        emitToAll();
      }
    };

    window.addEventListener(CHAT_EVENT, handleLocal);
    window.addEventListener(PROFILE_UPDATED_EVENT, handleLocal);
    window.addEventListener("storage", handleStorage);

    let unsubPrimary = () => { };
    let unsubSecondary = () => { };

    if (isFirebaseConfigured) {
      const convsRef = collection(db, "conversations");

      // 1. Listener principal por UID: 100% compatible con reglas de seguridad estrictas por participante
      try {
        const primaryQuery = query(convsRef, where("participants", "array-contains", userId));
        unsubPrimary = onSnapshot(
          primaryQuery,
          (snapshot) => {
            const wasInitial = !primaryInitialDone;
            primaryInitialDone = true;
            syncRemoteSnapshot("primary", snapshot, wasInitial);
          },
          (err) => {
            console.warn("Aviso en listener principal de conversaciones Firestore:", err?.code || err);
          }
        );
      } catch (err) {
        console.warn("Aviso al iniciar listener principal de conversaciones:", err);
      }

      // 2. Listener complementario opcional para candidatos secundarios (correo / username en chats legados)
      const secondaryCandidates = userCandidates.filter((c) => c && c !== userId).slice(0, 9);
      if (secondaryCandidates.length > 0) {
        try {
          const secondaryQuery = query(convsRef, where("participants", "array-contains-any", secondaryCandidates));
          unsubSecondary = onSnapshot(
            secondaryQuery,
            (snapshot) => {
              const wasInitial = !secondaryInitialDone;
              secondaryInitialDone = true;
              syncRemoteSnapshot("secondary", snapshot, wasInitial);
            },
            () => {
              // Ignorar silenciosamente si las reglas de Firestore restringen consultas exclusivamente al UID
            }
          );
        } catch (_) { }
      }
    }

    stream = {
      currentUser,
      subscribers,
      cleanup: () => {
        window.removeEventListener(CHAT_EVENT, handleLocal);
        window.removeEventListener(PROFILE_UPDATED_EVENT, handleLocal);
        window.removeEventListener("storage", handleStorage);
        unsubPrimary();
        unsubSecondary();
        activeConversationStreams.delete(userId);
      }
    };
    activeConversationStreams.set(userId, stream);
  } else {
    stream.currentUser = currentUser;
  }

  if (typeof callback === "function") {
    stream.subscribers.add(callback);
  }

  return () => {
    if (typeof callback === "function") {
      stream.subscribers.delete(callback);
    }
    if (stream.subscribers.size === 0) {
      stream.cleanup();
    }
  };
};

/**
 * Suscripción reactiva a una conversación específica en tiempo real
 */
export const subscribeToConversation = (conversationId, callback) => {
  if (!conversationId) return () => { };

  const initial = getConversationById(conversationId);
  if (typeof callback === "function") {
    callback(initial);
  }

  const handleLocal = (e) => {
    if (e.detail?.type === "conversation_marked_read" && e.detail?.conversationId === conversationId) {
      return;
    }
    if (!e.detail?.conversationId || e.detail.conversationId === conversationId) {
      if (typeof callback === "function") {
        callback(getConversationById(conversationId));
      }
    }
  };

  const handleStorage = (e) => {
    if (!e.key || e.key === STORAGE_KEY_CONVERSATIONS) {
      if (typeof callback === "function") {
        callback(getConversationById(conversationId));
      }
    }
  };

  window.addEventListener(CHAT_EVENT, handleLocal);
  window.addEventListener("storage", handleStorage);

  let unsubscribeFirestore = () => { };
  if (isFirebaseConfigured) {
    try {
      const convRef = doc(db, "conversations", conversationId);
      unsubscribeFirestore = onSnapshot(
        convRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const rawData = docSnap.data({ serverTimestamps: "estimate" });
            const norm = normalizeFirestoreData(rawData);
            const remoteConv = { id: docSnap.id, ...norm };

            // Sincronizar en localStorage sin disparar bucle de eventos
            let mergedConv = remoteConv;
            try {
              const all = getStoredConversations();
              const idx = all.findIndex((c) => String(c.id) === String(conversationId));
              if (idx !== -1) {
                mergedConv = {
                  ...all[idx],
                  ...remoteConv,
                  participantsData: { ...(all[idx].participantsData || {}), ...(remoteConv.participantsData || {}) },
                  product: remoteConv.product || all[idx].product || null
                };
                all[idx] = mergedConv;
              } else {
                all.unshift(remoteConv);
              }
              localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(all));
            } catch (_) { }

            const [enriched] = enrichConversationsWithLatestProfiles([mergedConv]);
            if (typeof callback === "function") {
              callback(enriched || mergedConv);
            }
          }
        },
        (err) => {
          console.warn("Aviso en suscripción a conversación Firestore:", err?.code || err);
        }
      );
    } catch (_) { }
  }

  return () => {
    window.removeEventListener(CHAT_EVENT, handleLocal);
    window.removeEventListener("storage", handleStorage);
    unsubscribeFirestore();
  };
};
