// Servicio centralizado de Reputación y Calificaciones de Vendedores para AnunciosSV
// Permite a usuarios registrados calificar con 1 a 5 estrellas a cualquier vendedor
// Persiste en localStorage y sincroniza reactivamente en tiempo real en toda la plataforma
import { resolveUserAvatar } from "./userProfileService.js";
import { db, isFirebaseConfigured } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { addNotification } from "./notificationService.js";

export const STORAGE_KEY_RATINGS = "anunciossv_seller_ratings_v1";
export const RATING_UPDATED_EVENT = "anunciossv_seller_rating_updated";

/**
 * Normaliza un identificador para búsquedas consistentes sin importar mayúsculas ni arrobas
 */
const normalizeKey = (val) => {
  if (!val) return "";
  return String(val).toLowerCase().replace(/^@/, "").trim();
};

/**
 * Obtiene el registro completo de calificaciones de vendedores almacenadas en el cliente
 */
export const getStoredRatings = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATINGS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.error("Error al leer valoraciones de vendedores:", err);
    return {};
  }
};

/**
 * Consulta las estadísticas acumuladas de calificación de un vendedor (promedio y cantidad total de votos)
 */
export const getSellerRatingStats = (sellerOrId, fallbackRating = 5.0, fallbackCount = 0) => {
  const sellerKey = typeof sellerOrId === "object"
    ? normalizeKey(sellerOrId?.id || sellerOrId?.username || sellerOrId?.name)
    : normalizeKey(sellerOrId);

  const defaultStats = {
    average: Number(Number(fallbackRating || 5.0).toFixed(1)),
    count: Number(fallbackCount || 0),
    ratingsMap: {}
  };

  if (!sellerKey) return defaultStats;

  const allRatings = getStoredRatings();
  const sellerData = allRatings[sellerKey] || {};
  const ratingsMap = sellerData.ratings || {};
  const userEntries = Object.entries(ratingsMap);

  if (userEntries.length === 0) {
    return defaultStats;
  }

  // Calcular promedio ponderado con base histórica o votos reales de usuarios
  const baseCount = Number(fallbackCount || 0);
  const baseSum = baseCount > 0 ? (Number(fallbackRating || 5.0) * baseCount) : 0;

  const userSum = userEntries.reduce((acc, [, entry]) => acc + (Number(entry.score) || 5), 0);
  const totalCount = baseCount + userEntries.length;
  const average = totalCount > 0 ? (baseSum + userSum) / totalCount : 5.0;

  return {
    average: Number(average.toFixed(1)),
    count: totalCount,
    ratingsMap
  };
};

/**
 * Obtiene la puntuación específica que el usuario actual ha emitido para un vendedor determinado
 */
export const getUserRatingForSeller = (sellerOrId, currentUser) => {
  if (!currentUser) return null;
  const sellerKey = typeof sellerOrId === "object"
    ? normalizeKey(sellerOrId?.id || sellerOrId?.username || sellerOrId?.name)
    : normalizeKey(sellerOrId);
  if (!sellerKey) return null;

  const allRatings = getStoredRatings();
  const sellerData = allRatings[sellerKey] || {};
  const ratingsMap = sellerData.ratings || {};

  const userKey = normalizeKey(currentUser.id || currentUser.uid || currentUser.username);
  if (!userKey) return null;

  return ratingsMap[userKey]?.score || null;
};

/**
 * Emite o actualiza una puntuación de 1 a 5 estrellas para un vendedor por parte de un usuario autenticado
 */
export const submitSellerRating = async ({ seller, raterUser, score }) => {
  if (!seller) throw new Error("Datos del vendedor requeridos");
  if (!raterUser) throw new Error("Debes iniciar sesión para calificar al vendedor");

  const ratingScore = Math.max(1, Math.min(5, Math.round(Number(score))));
  const sellerKey = normalizeKey(seller.id || seller.username || seller.name);
  const raterKey = normalizeKey(raterUser.id || raterUser.uid || raterUser.username);

  // Validación: evitar que un vendedor se califique a sí mismo
  if (sellerKey === raterKey || (seller.username && normalizeKey(seller.username) === raterKey)) {
    throw new Error("No puedes calificar tu propio perfil de vendedor");
  }

  const allRatings = getStoredRatings();
  if (!allRatings[sellerKey] || typeof allRatings[sellerKey] !== "object") {
    allRatings[sellerKey] = { ratings: {} };
  }
  if (!allRatings[sellerKey].ratings || typeof allRatings[sellerKey].ratings !== "object") {
    allRatings[sellerKey].ratings = {};
  }

  const raterName = raterUser.displayName || raterUser.name || raterUser.username || "Usuario";
  const raterAvatar = raterUser.avatar || raterUser.photoURL || resolveUserAvatar(raterKey, "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80");

  // Guardar puntuación emitida (1 por usuario, actualizable)
  allRatings[sellerKey].ratings[raterKey] = {
    raterId: raterKey,
    score: ratingScore,
    raterName,
    raterAvatar,
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(allRatings));
  } catch (err) {
    console.error("Error al guardar calificación de vendedor en localStorage:", err);
  }

  const updatedStats = getSellerRatingStats(sellerKey, seller.rating, seller.reviewsCount);

  // Disparar evento para actualizar interfaces en tiempo real
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(RATING_UPDATED_EVENT, {
        detail: {
          sellerKey,
          score: ratingScore,
          raterKey,
          stats: updatedStats
        }
      })
    );
  }

  // Notificar al vendedor en su panel de notificaciones
  try {
    addNotification({
      userId: sellerKey,
      title: "Nueva calificación recibida",
      message: `${raterName} te ha calificado con ${ratingScore} estrella${ratingScore > 1 ? "s" : ""}.`,
      type: "rating",
      link: "/profile/reputation"
    });
  } catch (err) {
    console.warn("Aviso al notificar calificación:", err);
  }

  // Persistir en Firestore en tiempo real si está configurado
  if (isFirebaseConfigured) {
    try {
      const ratingDocRef = doc(db, "ratings", `${sellerKey}_${raterKey}`);
      await setDoc(ratingDocRef, {
        sellerKey,
        raterKey,
        score: ratingScore,
        raterName,
        raterAvatar,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Actualizar perfil del vendedor en Firestore si existe
      try {
        const userDocRef = doc(db, "users", sellerKey);
        await setDoc(userDocRef, {
          rating: updatedStats.average,
          reviewsCount: updatedStats.count
        }, { merge: true });
      } catch (_) {}
    } catch (e) {
      console.warn("Aviso al guardar calificación en Firestore:", e);
    }
  }

  return updatedStats;
};

/**
 * Suscripción en tiempo real a las calificaciones de un vendedor
 */
export const subscribeToSellerRatings = (sellerOrId, callback) => {
  const sellerKey = typeof sellerOrId === "object"
    ? normalizeKey(sellerOrId?.id || sellerOrId?.uid || sellerOrId?.username || sellerOrId?.name)
    : normalizeKey(sellerOrId);

  if (!sellerKey) return () => {};

  if (typeof callback === "function") {
    callback(getSellerRatingStats(sellerKey));
  }

  const handleLocal = (e) => {
    if (!e.detail?.sellerKey || e.detail.sellerKey === sellerKey) {
      if (typeof callback === "function") {
        callback(getSellerRatingStats(sellerKey));
      }
    }
  };
  window.addEventListener(RATING_UPDATED_EVENT, handleLocal);

  let unsubscribeFirestore = () => {};
  if (isFirebaseConfigured) {
    try {
      const q = query(collection(db, "ratings"), where("sellerKey", "==", sellerKey));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const allRatings = getStoredRatings();
          if (!allRatings[sellerKey] || typeof allRatings[sellerKey] !== "object") {
            allRatings[sellerKey] = { ratings: {} };
          }
          if (!allRatings[sellerKey].ratings || typeof allRatings[sellerKey].ratings !== "object") {
            allRatings[sellerKey].ratings = {};
          }

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const rKey = data.raterKey;
            if (rKey) {
              allRatings[sellerKey].ratings[rKey] = {
                raterId: rKey,
                score: Number(data.score) || 5,
                raterName: data.raterName || "Usuario",
                raterAvatar: data.raterAvatar || "",
                updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString()
              };
            }
          });

          try {
            localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(allRatings));
          } catch (_) {}

          const updatedStats = getSellerRatingStats(sellerKey);
          if (typeof callback === "function") {
            callback(updatedStats);
          }
        },
        (err) => {
          console.warn("Aviso en listener de reputación Firestore:", err);
        }
      );
    } catch (_) {}
  }

  return () => {
    window.removeEventListener(RATING_UPDATED_EVENT, handleLocal);
    unsubscribeFirestore();
  };
};

/**
 * Obtiene el listado de calificaciones detalladas recibidas por un usuario o vendedor
 * Retorna array de objetos ordenados por fecha descendente (más recientes primero)
 */
export const getSellerRatingsList = (sellerOrId) => {
  const sellerKey = typeof sellerOrId === "object"
    ? normalizeKey(sellerOrId?.id || sellerOrId?.uid || sellerOrId?.username || sellerOrId?.name)
    : normalizeKey(sellerOrId);

  if (!sellerKey) return [];

  const allRatings = getStoredRatings();
  const sellerData = allRatings[sellerKey] || {};
  const ratingsMap = sellerData.ratings || {};

  return Object.entries(ratingsMap)
    .map(([raterKey, data]) => {
      return {
        raterId: raterKey,
        raterName: data.raterName || "Usuario",
        raterAvatar:
          data.raterAvatar ||
          resolveUserAvatar(raterKey, "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"),
        score: Number(data.score) || 5,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

