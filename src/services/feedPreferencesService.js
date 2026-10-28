// Servicio de persistencia y sincronización de preferencias de filtros del feed
// Permite guardar de manera aislada por usuario tanto en localStorage (offline-first/instantáneo)
// como en la nube en Firestore (users/{userId}/feedPreferences) para que persistan entre recargas,
// cierres de sesión e inicios de sesión posteriores en cualquier dispositivo.

import { isFirebaseConfigured, db } from "./firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const STORAGE_PREFIX = "anunciossv_feed_prefs_";

export const DEFAULT_FEED_PREFERENCES = {
  department: "all",
  category: "all",
  subcategory: "all"
};

/**
 * Obtiene la clave identificadora única para aislar las preferencias por usuario
 * @param {Object|null} currentUser Usuario actual o null
 * @returns {string} Clave de usuario única o "guest"
 */
export const getUserStorageKey = (currentUser) => {
  if (!currentUser) return "guest";
  const id = currentUser.id || currentUser.uid || currentUser.username;
  return id ? String(id).trim() : "guest";
};

/**
 * Obtiene las preferencias almacenadas localmente para el usuario actual
 * @param {Object|null} currentUser
 * @returns {{ department: string, category: string, subcategory: string }}
 */
export const getStoredFeedPreferences = (currentUser) => {
  if (typeof window === "undefined") return { ...DEFAULT_FEED_PREFERENCES };

  try {
    const userKey = getUserStorageKey(currentUser);
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userKey}`);
    if (!raw) return { ...DEFAULT_FEED_PREFERENCES };

    const parsed = JSON.parse(raw);
    return {
      department: typeof parsed?.department === "string" ? parsed.department : "all",
      category: typeof parsed?.category === "string" ? parsed.category : "all",
      subcategory: typeof parsed?.subcategory === "string" ? parsed.subcategory : "all"
    };
  } catch (error) {
    console.warn("Aviso al leer preferencias de feed desde localStorage:", error);
    return { ...DEFAULT_FEED_PREFERENCES };
  }
};

/**
 * Guarda las preferencias de filtros tanto en localStorage (inmediato) como en Firestore (en la nube, aislado por usuario)
 * @param {Object|null} currentUser
 * @param {{ department?: string, category?: string, subcategory?: string }} preferences
 */
export const saveFeedPreferences = async (currentUser, preferences) => {
  const safePreferences = {
    department: preferences?.department || "all",
    category: preferences?.category || "all",
    subcategory: preferences?.subcategory || "all"
  };

  const userKey = getUserStorageKey(currentUser);

  // 1. Guardar de forma síncrona en localStorage para respuesta instantánea
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userKey}`, JSON.stringify(safePreferences));
    } catch (err) {
      console.warn("Aviso al guardar preferencias de feed en localStorage:", err);
    }
  }

  // 2. Guardar en Firestore de manera aislada en el documento del usuario (doc(db, "users", userId))
  const userId = currentUser?.id || currentUser?.uid;
  if (userId && isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, "users", String(userId));
      await setDoc(
        userRef,
        {
          feedPreferences: {
            ...safePreferences,
            updatedAt: serverTimestamp()
          }
        },
        { merge: true }
      );
    } catch (err) {
      // Si falla Firestore por red o cuota, se mantiene la persistencia local de forma resiliente
      console.warn("Aviso al sincronizar preferencias de feed con Firestore:", err?.message || err);
    }
  }

  return safePreferences;
};

/**
 * Consulta y sincroniza las preferencias del usuario desde Firestore si están disponibles
 * @param {Object|null} currentUser
 * @returns {Promise<{ department: string, category: string, subcategory: string } | null>}
 */
export const fetchUserFeedPreferencesFromFirestore = async (currentUser) => {
  const userId = currentUser?.id || currentUser?.uid;
  if (!userId || !isFirebaseConfigured || !db) return null;

  try {
    const userRef = doc(db, "users", String(userId));
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data?.feedPreferences) {
        const cloudPrefs = {
          department: data.feedPreferences.department || "all",
          category: data.feedPreferences.category || "all",
          subcategory: data.feedPreferences.subcategory || "all"
        };

        // Actualizar la caché local del usuario con las preferencias sincronizadas de Firestore
        const userKey = getUserStorageKey(currentUser);
        if (typeof window !== "undefined") {
          localStorage.setItem(`${STORAGE_PREFIX}${userKey}`, JSON.stringify(cloudPrefs));
        }

        return cloudPrefs;
      }
    }
  } catch (err) {
    console.warn("Aviso al obtener preferencias de feed desde Firestore:", err?.message || err);
  }

  return null;
};

