// Servicio centralizado de Notificaciones en la aplicación AnunciosSV
// Permite registrar, listar, marcar como leídas y gestionar alertas del usuario
// Persistencia local por usuario y sincronización reactiva en tiempo real
import { db, isFirebaseConfigured } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";

export const NOTIFICATION_EVENT = "anunciossv_notifications_updated";
const STORAGE_KEY_PREFIX = "anunciossv_notifications_";

/**
 * Normaliza el identificador de usuario para almacenamiento uniforme
 */
export const normalizeNotificationUserId = (userOrId) => {
  if (!userOrId) return "";
  if (typeof userOrId === "object") {
    return String(userOrId.id || userOrId.uid || userOrId.email || userOrId.username || "")
      .toLowerCase()
      .replace(/^@/, "")
      .trim();
  }
  return String(userOrId).toLowerCase().replace(/^@/, "").trim();
};

/**
 * Emite un evento en la ventana para sincronizar componentes reactivos (badges, listas, etc.)
 */
const notifyNotificationsUpdated = (detail = {}) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail }));
  }
};

/**
 * Obtiene la lista completa de notificaciones asociadas al usuario actual
 * Si no hay notificaciones o el usuario no existe, devuelve una lista vacía []
 */
export const getUserNotifications = (currentUser) => {
  const userId = normalizeNotificationUserId(currentUser);
  if (!userId || typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Los mensajes de chat no van al panel de notificaciones (tienen su propio canal y toast flotante)
    return list.filter((item) => item && item.type !== "message");
  } catch (err) {
    console.error("Error al leer notificaciones del usuario:", err);
    return [];
  }
};

/**
 * Guarda las notificaciones de un usuario en el almacenamiento local
 */
const saveUserNotifications = (userId, notifications) => {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(notifications));
  } catch (err) {
    console.error("Error al persistir notificaciones:", err);
  }
};

/**
 * Retorna la cantidad de notificaciones no leídas del usuario
 */
export const getUnreadNotificationsCount = (currentUser) => {
  const list = getUserNotifications(currentUser);
  return list.filter((notif) => !notif.read).length;
};

/**
 * Agrega una nueva notificación al destinatario especificado
 * @param {Object} params
 * @param {string|Object} params.userId - Identificador o usuario destinatario
 * @param {string} params.title - Título de la notificación
 * @param {string} params.message - Mensaje explicativo
 * @param {string} [params.type] - "info" | "promotion" | "rating" | "message" | "success" | "warning"
 * @param {string} [params.link] - URL o ruta interna de navegación opcional
 */
export const addNotification = async ({
  userId,
  title,
  message,
  type = "info",
  link = null
}) => {
  // Los mensajes de chat NO van al panel general de notificaciones (tienen su propio canal y toast in-app)
  if (type === "message") {
    return null;
  }

  const normalizedId = normalizeNotificationUserId(userId);
  if (!normalizedId || !title) return null;

  const currentList = getUserNotifications(normalizedId);
  const newNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: String(title).trim(),
    message: String(message || "").trim(),
    type: type || "info",
    link: link || null,
    read: false,
    createdAt: new Date().toISOString()
  };

  // Insertar al inicio para que las más recientes aparezcan primero
  const updatedList = [newNotification, ...currentList];
  saveUserNotifications(normalizedId, updatedList);
  notifyNotificationsUpdated({ type: "notification_added", userId: normalizedId, notification: newNotification });

  // Persistir en Firestore en tiempo real si está configurado
  if (isFirebaseConfigured) {
    try {
      const notifDocRef = doc(db, "notifications", newNotification.id);
      await setDoc(notifDocRef, {
        ...newNotification,
        recipientId: normalizedId,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Aviso al guardar notificación en Firestore:", e);
    }
  }

  return newNotification;
};

/**
 * Marca una notificación específica como leída
 */
export const markNotificationAsRead = async (notificationId, currentUser) => {
  const userId = normalizeNotificationUserId(currentUser);
  if (!userId || !notificationId) return;

  const list = getUserNotifications(userId);
  let changed = false;

  const updatedList = list.map((item) => {
    if (item.id === notificationId && !item.read) {
      changed = true;
      return { ...item, read: true };
    }
    return item;
  });

  if (changed) {
    saveUserNotifications(userId, updatedList);
    notifyNotificationsUpdated({ type: "notification_read", userId, notificationId });

    if (isFirebaseConfigured) {
      try {
        const notifDocRef = doc(db, "notifications", notificationId);
        await updateDoc(notifDocRef, { read: true });
      } catch (_) {}
    }
  }
};

/**
 * Suscripción en tiempo real a las notificaciones dirigidas al usuario autenticado
 */
export const subscribeToUserNotifications = (currentUser, callback) => {
  const userId = normalizeNotificationUserId(currentUser);
  if (!userId) return () => {};

  if (typeof callback === "function") {
    callback(getUserNotifications(userId));
  }

  const handleLocal = () => {
    if (typeof callback === "function") {
      callback(getUserNotifications(userId));
    }
  };
  window.addEventListener(NOTIFICATION_EVENT, handleLocal);

  let unsubscribeFirestore = () => {};
  if (isFirebaseConfigured) {
    try {
      const q = query(collection(db, "notifications"), where("recipientId", "==", userId));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const currentLocal = getUserNotifications(userId);
          const map = new Map(currentLocal.map((n) => [n.id, n]));

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.type !== "message") {
              const createdAtStr = data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString();
              map.set(docSnap.id, {
                ...data,
                id: docSnap.id,
                createdAt: createdAtStr
              });
            }
          });

          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveUserNotifications(userId, merged);
          notifyNotificationsUpdated({ type: "firestore_notifications_synced", userId });
          if (typeof callback === "function") {
            callback(merged);
          }
        },
        (err) => {
          console.warn("Aviso en listener de notificaciones Firestore:", err);
        }
      );
    } catch (_) {}
  }

  return () => {
    window.removeEventListener(NOTIFICATION_EVENT, handleLocal);
    unsubscribeFirestore();
  };
};

/**
 * Marca todas las notificaciones del usuario como leídas
 */
export const markAllNotificationsAsRead = (currentUser) => {
  const userId = normalizeNotificationUserId(currentUser);
  if (!userId) return;

  const list = getUserNotifications(userId);
  const hasUnread = list.some((item) => !item.read);

  if (!hasUnread) return;

  const updatedList = list.map((item) => ({ ...item, read: true }));
  saveUserNotifications(userId, updatedList);
  notifyNotificationsUpdated({ type: "all_read", userId });
};

/**
 * Elimina una notificación específica
 */
export const deleteNotification = (notificationId, currentUser) => {
  const userId = normalizeNotificationUserId(currentUser);
  if (!userId || !notificationId) return;

  const list = getUserNotifications(userId);
  const updatedList = list.filter((item) => item.id !== notificationId);

  saveUserNotifications(userId, updatedList);
  notifyNotificationsUpdated({ type: "notification_deleted", userId, notificationId });
};

/**
 * Elimina todas las notificaciones del usuario (vacia la bandeja)
 */
export const clearAllNotifications = (currentUser) => {
  const userId = normalizeNotificationUserId(currentUser);
  if (!userId) return;

  saveUserNotifications(userId, []);
  notifyNotificationsUpdated({ type: "notifications_cleared", userId });
};

/**
 * Formatea la fecha de creación de una notificación a formato amigable relativo
 */
export const formatNotificationTime = (isoString) => {
  if (!isoString) return "Reciente";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Reciente";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return "Hace un momento";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short"
  });
};

