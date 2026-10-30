// Servicio centralizado y reactivo de productos de AnunciosSV
// Garantiza persistencia en Firestore y localStorage con sincronización en tiempo real entre Feed, Perfil y Detalle
import { MOCK_PRODUCTS } from "./mockData.js";
import { db, isFirebaseConfigured } from "./firebase.js";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getPublicProfile, resolveUserAvatar, PROFILE_UPDATED_EVENT } from "./userProfileService.js";

const STORAGE_KEY = "anunciossv_products_v1";
export const UPDATE_EVENT = "anunciossv_products_updated";
export const FAVORITES_STORAGE_KEY = "anunciossv_favorites_v1";
export const FAVORITES_EVENT = "anunciossv_favorites_updated";
export const RECENT_PRODUCTS_KEY = "anunciossv_recent_ids_v1";
export const UNSEEN_PRODUCTS_KEY = "anunciossv_unseen_ids_v1";

/**
 * Obtiene la lista de IDs de publicaciones nuevas aún no vistas/mostradas en el Feed
 */
export const getUnseenProductIds = () => {
  try {
    const raw = localStorage.getItem(UNSEEN_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch (e) {
    console.warn("Aviso al leer unseen IDs:", e);
  }
  return [];
};

/**
 * Marca una publicación como nueva pendiente de mostrar en el Feed
 */
export const markProductAsUnseen = (productId) => {
  if (!productId) return;
  try {
    const idStr = String(productId);
    const current = getUnseenProductIds().filter((id) => id !== idStr);
    localStorage.setItem(UNSEEN_PRODUCTS_KEY, JSON.stringify([idStr, ...current]));
  } catch (e) {
    console.warn("Aviso al registrar unseen ID:", e);
  }
};

/**
 * Remueve IDs de publicaciones una vez que han sido mostradas en el Feed
 */
export const clearUnseenProductIds = (productIdsToClear = null) => {
  try {
    if (!productIdsToClear) {
      localStorage.removeItem(UNSEEN_PRODUCTS_KEY);
    } else {
      const toClearSet = new Set(productIdsToClear.map(String));
      const current = getUnseenProductIds().filter((id) => !toClearSet.has(id));
      localStorage.setItem(UNSEEN_PRODUCTS_KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.warn("Aviso al limpiar unseen IDs:", e);
  }
};

/**
 * Obtiene la lista de IDs de publicaciones recientes registradas
 */
export const getRecentProductIds = () => {
  try {
    const raw = localStorage.getItem(RECENT_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch (e) {
    console.warn("Aviso al leer IDs recientes:", e);
  }
  return [];
};

/**
 * Marca un producto como recién publicado para priorizarlo al inicio del Feed
 */
export const markProductAsRecent = (productId) => {
  if (!productId) return;
  try {
    const idStr = String(productId);
    const current = getRecentProductIds().filter((id) => id !== idStr);
    const updated = [idStr, ...current].slice(0, 50);
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Aviso al registrar ID reciente:", e);
  }
};

/**
 * Remueve un producto del listado de recientes
 */
export const clearRecentProduct = (productId) => {
  if (!productId) return;
  try {
    const idStr = String(productId);
    const current = getRecentProductIds().filter((id) => id !== idStr);
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn("Aviso al remover ID reciente:", e);
  }
};

let isFirestoreSubscribed = false;

/**
 * Suscripción en tiempo real a la colección 'products' de Firestore
 * Garantiza que cualquier anuncio publicado en Firestore aparezca de inmediato en Feed y Perfil
 */
export const initFirestoreProductsListener = () => {
  if (isFirestoreSubscribed || !isFirebaseConfigured || typeof window === "undefined") return;
  isFirestoreSubscribed = true;

  try {
    const productsRef = collection(db, "products");
    onSnapshot(
      productsRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const currentStored = getStoredProducts();
          const currentStoredIds = new Set(currentStored.map((p) => String(p.id)));

          const firestoreProducts = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const idStr = String(docSnap.id);
            if (!currentStoredIds.has(idStr)) {
              markProductAsUnseen(idStr);
              markProductAsRecent(idStr);
            }
            let dateStr = "Hace un momento";
            let createdAtISO = data.createdAtISO || null;
            let publishedTimestamp = data.publishedTimestamp || null;

            if (data.createdAt?.toDate) {
              const d = data.createdAt.toDate();
              createdAtISO = d.toISOString();
              publishedTimestamp = d.getTime();
              const day = d.getDate();
              const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
              const datePart = `${day} ${months[d.getMonth()]}.`;
              let hours = d.getHours();
              const minutes = d.getMinutes().toString().padStart(2, "0");
              const ampm = hours >= 12 ? "PM" : "AM";
              hours = hours % 12;
              hours = hours ? hours : 12;
              const timePart = `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
              dateStr = `${datePart} · ${timePart}`;
            } else if (typeof data.createdAt === "string") {
              dateStr = data.createdAt;
            }

            firestoreProducts.push({
              ...data,
              id: docSnap.id,
              createdAt: dateStr,
              createdAtISO: createdAtISO || data.createdAtISO || null,
              publishedTimestamp: publishedTimestamp || data.publishedTimestamp || null
            });
          });

          // Combinar con productos mock que no colisionen
          const firestoreIds = new Set(firestoreProducts.map((p) => String(p.id)));
          const remainingMocks = MOCK_PRODUCTS.filter((p) => !firestoreIds.has(String(p.id)));

          const combinedList = [...firestoreProducts, ...remainingMocks];

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(combinedList));
          } catch (err) {
            console.warn("Aviso al actualizar caché local de productos:", err);
          }

          // Notificar a toda la aplicación para refresco instantáneo del Feed y Perfil
          window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: combinedList }));
        }
      },
      (error) => {
        console.warn("Aviso en suscripción a Firestore products:", error);
      }
    );
  } catch (err) {
    console.warn("Error al inicializar escucha de Firestore:", err);
  }
};

// Iniciar suscripción automáticamente
initFirestoreProductsListener();

/**
 * Enriquece la lista de productos actualizando el avatar y nombre del vendedor
 * si existe una versión más reciente en el registro central de perfiles públicos.
 */
const enrichProductsWithLatestProfiles = (productsList) => {
  if (!Array.isArray(productsList)) return [];
  const mockMap = new Map(MOCK_PRODUCTS.map((m) => [String(m.id), m]));

  return productsList.map((prod) => {
    let currentProd = prod;
    const mockRef = mockMap.get(String(prod.id));
    if (mockRef) {
      currentProd = {
        ...mockRef,
        ...prod,
        department: prod.department || mockRef.department,
        mainCategory: prod.mainCategory || mockRef.mainCategory,
        subcategory: prod.subcategory || mockRef.subcategory || prod.category,
        location: (prod.location && !prod.location.includes(", ES")) ? prod.location : mockRef.location
      };
    }

    if (!currentProd?.seller) return currentProd;
    const sellerId = currentProd.seller.id || currentProd.seller.uid;
    const sellerUsername = currentProd.seller.username;
    const sellerName = currentProd.seller.name;
    const profile = getPublicProfile(sellerId || sellerUsername || sellerName);

    if (profile?.avatar && currentProd.seller.avatar !== profile.avatar) {
      return {
        ...currentProd,
        seller: {
          ...currentProd.seller,
          avatar: profile.avatar,
          name: profile.displayName || profile.name || currentProd.seller.name
        }
      };
    }
    return currentProd;
  });
};

/**
 * Obtiene todos los productos guardados (localStorage depurado o Firestore)
 */
export const getStoredProducts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Purgar cualquier publicación mock residual anterior (prod-101..106, usr-01..05)
        const realProducts = parsed.filter((p) => {
          if (!p || !p.id) return false;
          const isOldMockId = /^prod-10[1-6]$/.test(String(p.id));
          const isOldMockSeller = p.seller && /^usr-0[1-5]$/.test(String(p.seller.id));
          return !isOldMockId && !isOldMockSeller;
        });

        if (realProducts.length !== parsed.length) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(realProducts));
          } catch (e) {
            console.warn("Aviso al depurar mocks en localStorage:", e);
          }
        }

        return enrichProductsWithLatestProfiles(realProducts);
      }
    }
  } catch (err) {
    console.error("Error al leer productos de localStorage:", err);
  }

  // Si no hay datos en localStorage, inicializar vacío
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.warn("No se pudo escribir en localStorage:", err);
  }
  return [];
};

/**
 * Sincroniza inmediatamente la nueva foto de perfil y nombre en todas las publicaciones
 * pertenecientes a un usuario (en localStorage, memoria MOCK_PRODUCTS y Firestore).
 */
export const syncUserAvatarInProducts = async (userOrIdentifier, newAvatar, newDisplayName = "") => {
  if (!userOrIdentifier || !newAvatar) return [];

  let userId = "";
  let username = "";
  let name = "";
  let email = "";

  if (typeof userOrIdentifier === "object") {
    userId = String(userOrIdentifier.id || userOrIdentifier.uid || "").trim().toLowerCase();
    username = String(userOrIdentifier.username || "").trim().toLowerCase().replace(/^@/, "");
    name = String(userOrIdentifier.displayName || userOrIdentifier.name || "").trim().toLowerCase();
    email = String(userOrIdentifier.email || "").trim().toLowerCase();
  } else {
    const raw = String(userOrIdentifier).trim().toLowerCase().replace(/^@/, "");
    userId = raw;
    username = raw;
    name = raw;
  }

  const currentProducts = getStoredProducts();
  let hasChanges = false;
  const modifiedProductIds = [];

  const updatedProducts = currentProducts.map((prod) => {
    const sId = String(prod.seller?.id || prod.seller?.uid || "").trim().toLowerCase();
    const sUsername = String(prod.seller?.username || "").trim().toLowerCase().replace(/^@/, "");
    const sName = String(prod.seller?.name || "").trim().toLowerCase();
    const sEmail = String(prod.seller?.email || "").trim().toLowerCase();

    const matchesId = userId && sId && sId === userId;
    const matchesUsername = username && sUsername && sUsername === username;
    const matchesName = name && sName && (sName === name || sName === `@${name}`);
    const matchesEmail = email && sEmail && sEmail === email;

    if (matchesId || matchesUsername || matchesName || matchesEmail) {
      hasChanges = true;
      modifiedProductIds.push(prod.id);
      return {
        ...prod,
        seller: {
          ...prod.seller,
          avatar: newAvatar,
          name: newDisplayName || prod.seller?.name || "Usuario"
        }
      };
    }
    return prod;
  });

  // Actualizar también en MOCK_PRODUCTS
  MOCK_PRODUCTS.forEach((prod, index) => {
    const sId = String(prod.seller?.id || "").trim().toLowerCase();
    const sUsername = String(prod.seller?.username || "").trim().toLowerCase().replace(/^@/, "");
    const sName = String(prod.seller?.name || "").trim().toLowerCase();

    if (
      (userId && sId && sId === userId) ||
      (username && sUsername && sUsername === username) ||
      (name && sName && (sName === name || sName === `@${name}`))
    ) {
      MOCK_PRODUCTS[index] = {
        ...prod,
        seller: {
          ...prod.seller,
          avatar: newAvatar,
          name: newDisplayName || prod.seller?.name || "Usuario"
        }
      };
    }
  });

  if (hasChanges) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProducts));
    } catch (err) {
      console.error("Error al persistir productos con nuevo avatar:", err);
    }

    // Actualizar en Firestore si está conectado
    if (isFirebaseConfigured && db) {
      modifiedProductIds.forEach(async (pId) => {
        try {
          const prodRef = doc(db, "products", String(pId));
          const fieldsToUpdate = { "seller.avatar": newAvatar };
          if (newDisplayName) fieldsToUpdate["seller.name"] = newDisplayName;
          await updateDoc(prodRef, fieldsToUpdate);
        } catch (e) {
          // Si el documento no existe en Firestore (ej. era mock), se ignora
        }
      });
    }

    // Notificar a toda la aplicación
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: updatedProducts }));
    }
  }

  return updatedProducts;
};

/**
 * Guarda una nueva publicación en el catálogo y notifica a las vistas activas
 */
export const saveNewProduct = (newProduct) => {
  const currentList = getStoredProducts();
  const isDraft = newProduct.status === "borrador";
  const isFeatured = Boolean(newProduct.featured);

  const formattedProduct = {
    ...newProduct,
    id: newProduct.id || (isDraft ? `draft-${Date.now()}` : `prod-${Date.now()}`),
    likesCount: newProduct.likesCount ?? 0,
    viewsCount: newProduct.viewsCount ?? (isDraft ? 0 : 1),
    status: newProduct.status || "aprobado",
    featured: isFeatured,
    featuredTimestamp: isFeatured ? (newProduct.featuredTimestamp || Date.now()) : null,
    createdAt: newProduct.createdAt || (isDraft ? "Borrador guardado" : "Hace un momento"),
    createdAtISO: newProduct.createdAtISO || new Date().toISOString(),
    publishedTimestamp: isDraft ? null : (newProduct.publishedTimestamp || Date.now()),
    isRecent: !isDraft
  };

  // Registrar como producto reciente para que aparezca obligatoriamente al inicio del feed
  if (!isDraft) {
    markProductAsRecent(formattedProduct.id);
    markProductAsUnseen(formattedProduct.id);
    recordUserPublishToday(formattedProduct.seller, formattedProduct.id);
  }

  // Insertar al inicio para que aparezca primero en el feed y perfil
  const updatedList = [formattedProduct, ...currentList.filter((p) => p.id !== formattedProduct.id)];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error("Error al persistir nuevo producto en localStorage:", err);
  }

  // Actualizar también la lista en memoria de mockData si no es borrador
  if (!isDraft) {
    const existsInMock = MOCK_PRODUCTS.some((p) => p.id === formattedProduct.id);
    if (!existsInMock) {
      MOCK_PRODUCTS.unshift(formattedProduct);
    }
  }

  // Notificar a toda la aplicación para actualización instantánea
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: formattedProduct }));
  }

  return formattedProduct;
};

/**
 * Busca un producto por su identificador
 */
export const getProductById = (id) => {
  const all = getStoredProducts();
  return all.find((p) => String(p.id) === String(id)) || MOCK_PRODUCTS.find((p) => String(p.id) === String(id));
};

/**
 * Filtra los productos pertenecientes a un usuario
 */
export const getUserProducts = (user) => {
  if (!user) return [];
  const all = getStoredProducts();

  const userId = String(user.id || user.uid || "").trim();
  const username = String(user.username || "").toLowerCase().replace(/^@/, "").trim();
  const name = String(user.name || user.displayName || "").toLowerCase().trim();
  const email = String(user.email || "").toLowerCase().trim();

  return all.filter((p) => {
    const sellerId = String(p.seller?.id || p.seller?.uid || "").trim();
    const sellerName = String(p.seller?.name || "").toLowerCase().trim();
    const sellerUsername = String(p.seller?.username || "").toLowerCase().replace(/^@/, "").trim();
    const sellerEmail = String(p.seller?.email || "").toLowerCase().trim();

    const matchesId = userId && sellerId && sellerId === userId;
    const matchesUsername =
      username &&
      (sellerUsername === username ||
        sellerName === `@${username}` ||
        sellerName === username);
    const matchesName =
      name && sellerName && (sellerName === name || sellerName === `@${name}`);
    const matchesEmail = email && sellerEmail && sellerEmail === email;

    return matchesId || matchesUsername || matchesName || matchesEmail;
  });
};

/**
 * Determina si el usuario especificado es el propietario legítimo de una publicación
 */
export const isProductOwner = (product, user) => {
  if (!product || !user) return false;
  const userId = String(user.id || user.uid || "").trim();
  const username = String(user.username || "").toLowerCase().replace(/^@/, "").trim();
  const name = String(user.name || user.displayName || "").toLowerCase().trim();
  const email = String(user.email || "").toLowerCase().trim();

  const sellerId = String(product.seller?.id || product.seller?.uid || product.userId || "").trim();
  const sellerName = String(product.seller?.name || "").toLowerCase().trim();
  const sellerUsername = String(product.seller?.username || "").toLowerCase().replace(/^@/, "").trim();
  const sellerEmail = String(product.seller?.email || "").toLowerCase().trim();

  const matchesId = userId && sellerId && sellerId === userId;
  const matchesUsername =
    username &&
    (sellerUsername === username ||
      sellerName === `@${username}` ||
      sellerName === username);
  const matchesName =
    name && sellerName && (sellerName === name || sellerName === `@${name}`);
  const matchesEmail = email && sellerEmail && sellerEmail === email;

  return Boolean(matchesId || matchesUsername || matchesName || matchesEmail);
};

/**
 * Límite máximo de publicaciones permitidas por usuario al día
 */
export const DAILY_PUBLICATION_LIMIT = 3;

export const DAILY_PUBLISH_STORAGE_KEY = "anunciossv_daily_publish_log_v1";

/**
 * Obtiene el mapa histórico de registros de publicaciones diarias
 * Formato: { "userId_YYYY-MM-DD": [productId1, productId2, ...] }
 */
export const getDailyPublishLog = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DAILY_PUBLISH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn("Aviso al leer registro de publicaciones diarias:", err);
    return {};
  }
};

/**
 * Genera la clave de fecha YYYY-MM-DD según la zona horaria local
 */
export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la clave de identificación única para el usuario en el registro diario
 */
export const getUserPublishKey = (user) => {
  if (!user) return "";
  const id = user.id || user.uid || user.username || user.name || "";
  return String(id).trim();
};

/**
 * Registra formalmente una publicación realizada en el día de hoy por el usuario
 */
export const recordUserPublishToday = (user, productId) => {
  if (!user || !productId) return;
  const userKey = getUserPublishKey(user);
  if (!userKey) return;

  const dateKey = getLocalDateKey();
  const logKey = `${userKey}_${dateKey}`;
  const logs = getDailyPublishLog();
  const currentList = Array.isArray(logs[logKey]) ? logs[logKey] : [];
  const prodIdStr = String(productId);

  if (!currentList.includes(prodIdStr)) {
    logs[logKey] = [...currentList, prodIdStr];
    try {
      localStorage.setItem(DAILY_PUBLISH_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn("Aviso al guardar log de publicaciones diarias:", e);
    }
  }

  // Notificar actualización para que los contadores en pantalla refresquen inmediatamente
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { action: "publish_recorded", productId } }));
  }
};

/**
 * Determina si una fecha/timestamp corresponde al día de hoy (fecha local)
 */
export const isSameLocalDay = (timestampOrIso, referenceDate = new Date()) => {
  if (!timestampOrIso) return false;
  const d = typeof timestampOrIso === "number" ? new Date(timestampOrIso) : new Date(timestampOrIso);
  if (isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === referenceDate.getFullYear() &&
    d.getMonth() === referenceDate.getMonth() &&
    d.getDate() === referenceDate.getDate()
  );
};

/**
 * Obtiene la lista de publicaciones realizadas hoy por el usuario
 * (Revisa tanto las publicaciones activas actuales del usuario como el registro diario persistido)
 */
export const getUserTodayPublications = (user) => {
  if (!user) return [];
  const userKey = getUserPublishKey(user);
  if (!userKey) return [];

  const now = new Date();
  const dateKey = getLocalDateKey(now);
  const logKey = `${userKey}_${dateKey}`;
  const logs = getDailyPublishLog();
  const loggedIds = new Set(Array.isArray(logs[logKey]) ? logs[logKey].map(String) : []);

  const allUserProducts = getUserProducts(user);

  // Filtrar productos aprobados/activos publicados hoy
  const todayProducts = allUserProducts.filter((product) => {
    // Los borradores nunca cuentan como publicaciones efectuadas
    if (product.status === "borrador") return false;

    // Si está en el log de hoy
    if (loggedIds.has(String(product.id))) return true;

    // O si su timestamp o fecha de creación corresponde al día de hoy
    if (product.publishedTimestamp && isSameLocalDay(product.publishedTimestamp, now)) {
      return true;
    }
    if (product.createdAtISO && isSameLocalDay(product.createdAtISO, now)) {
      return true;
    }
    return false;
  });

  return todayProducts;
};

/**
 * Obtiene la cantidad numérica de publicaciones hechas hoy por el usuario
 */
export const getUserTodayPublicationsCount = (user) => {
  return getUserTodayPublications(user).length;
};

/**
 * Consulta el estado del límite diario de publicaciones para el usuario
 */
export const canUserPublishToday = (user) => {
  if (!user) {
    return {
      allowed: false,
      count: 0,
      limit: DAILY_PUBLICATION_LIMIT,
      remaining: DAILY_PUBLICATION_LIMIT,
      reason: "auth_required"
    };
  }

  const count = getUserTodayPublicationsCount(user);
  const limit = DAILY_PUBLICATION_LIMIT;
  const remaining = Math.max(0, limit - count);

  return {
    allowed: count < limit,
    count,
    limit,
    remaining,
    reason: count >= limit ? "limit_reached" : null
  };
};

// Variable singleton para cachear la diferencia entre hora del servidor y performance.now()
let cachedServerTimeBaseline = null;

/**
 * Obtiene la hora real del servidor (o encabezado HTTP) para evitar que el usuario manipule el reloj del dispositivo
 */
export const fetchServerTimestamp = async () => {
  if (cachedServerTimeBaseline && typeof performance !== "undefined") {
    const elapsed = performance.now() - cachedServerTimeBaseline.perfStart;
    return cachedServerTimeBaseline.serverTimeMs + elapsed;
  }

  let serverMs = null;

  if (typeof window !== "undefined") {
    try {
      const res = await fetch(window.location.origin, {
        method: "HEAD",
        cache: "no-store"
      });
      const dateHeader = res.headers.get("date");
      if (dateHeader) {
        const parsed = new Date(dateHeader).getTime();
        if (!isNaN(parsed) && parsed > 0) {
          serverMs = parsed;
        }
      }
    } catch {
      // Fallback si no hay conexión al backend
    }
  }

  if (!serverMs) {
    serverMs = Date.now();
  }

  if (typeof performance !== "undefined") {
    cachedServerTimeBaseline = {
      serverTimeMs: serverMs,
      perfStart: performance.now()
    };
  }

  return serverMs;
};

/**
 * Obtiene el tiempo actual del servidor utilizando el reloj monotónico inmune a cambios del reloj del dispositivo
 */
export const getServerNow = () => {
  if (cachedServerTimeBaseline && typeof performance !== "undefined") {
    const elapsed = performance.now() - cachedServerTimeBaseline.perfStart;
    return cachedServerTimeBaseline.serverTimeMs + elapsed;
  }
  return Date.now();
};

/**
 * Calcula los milisegundos restantes hasta la medianoche (00:00:00) en hora oficial de El Salvador (UTC-6)
 */
export const getMillisecondsUntilNextMidnight = (currentServerMs = getServerNow()) => {
  // El Salvador está fijado en UTC-6 todo el año
  const EL_SALVADOR_OFFSET_MS = 6 * 60 * 60 * 1000;
  const localElSalvadorMs = currentServerMs - EL_SALVADOR_OFFSET_MS;
  const d = new Date(localElSalvadorMs);

  // Medianoche siguiente en El Salvador
  const nextMidnightInElSalvadorUTC = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0
  );

  const nextMidnightTimestamp = nextMidnightInElSalvadorUTC + EL_SALVADOR_OFFSET_MS;
  const diffMs = nextMidnightTimestamp - currentServerMs;
  return Math.max(0, diffMs);
};

/**
 * Formatea el tiempo restante en el formato exacto requerido:
 * "XXhoras, XX minutos, XX Segundos"
 */
export const formatTimeUntilMidnight = (remainingMs) => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)} horas, ${pad(minutes)} minutos, ${pad(seconds)} Segundos`;
};

/**
 * Actualiza los campos de un producto existente y sincroniza en Firestore y localStorage
 */
export const updateProduct = async (productId, updatedFields) => {
  const currentList = getStoredProducts();
  const targetId = String(productId);

  const isBecomingApproved = updatedFields.status === "aprobado";
  const fieldsWithMeta = {
    ...updatedFields,
    ...(isBecomingApproved ? { isRecent: true, publishedTimestamp: Date.now() } : {})
  };

  if (isBecomingApproved) {
    markProductAsRecent(targetId);
    markProductAsUnseen(targetId);
    if (updatedProduct?.seller) {
      recordUserPublishToday(updatedProduct.seller, targetId);
    }
  }

  let updatedProduct = null;
  const updatedList = currentList.map((prod) => {
    if (String(prod.id) === targetId) {
      const willBeFeatured = fieldsWithMeta.featured !== undefined ? Boolean(fieldsWithMeta.featured) : Boolean(prod.featured);
      const resolvedFeaturedTimestamp = willBeFeatured
        ? (fieldsWithMeta.featuredTimestamp || prod.featuredTimestamp || Date.now())
        : null;

      updatedProduct = {
        ...prod,
        ...fieldsWithMeta,
        featured: willBeFeatured,
        featuredTimestamp: resolvedFeaturedTimestamp,
        id: targetId,
        updatedAt: new Date().toISOString()
      };
      return updatedProduct;
    }
    return prod;
  });

  if (!updatedProduct) {
    throw new Error("No se encontró el anuncio para actualizar.");
  }

  // Persistir en localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error("Error al actualizar producto en localStorage:", err);
  }

  // Actualizar también en MOCK_PRODUCTS si reside allí o si pasa a estar aprobado
  const mockIndex = MOCK_PRODUCTS.findIndex((p) => String(p.id) === targetId);
  if (mockIndex !== -1) {
    MOCK_PRODUCTS[mockIndex] = updatedProduct;
  } else if (isBecomingApproved) {
    MOCK_PRODUCTS.unshift(updatedProduct);
  }

  // Actualizar en Firestore si la conexión está habilitada
  if (isFirebaseConfigured && db) {
    try {
      const prodRef = doc(db, "products", targetId);
      await updateDoc(prodRef, updatedFields);
    } catch (err) {
      console.warn("Aviso al actualizar anuncio en Firestore:", err);
    }
  }

  // Emitir evento para actualizar todas las vistas suscritas
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: updatedProduct }));
  }

  return updatedProduct;
};

/**
 * Elimina un producto de la plataforma permanentemente (localStorage y Firestore)
 */
export const deleteProduct = async (productId) => {
  const currentList = getStoredProducts();
  const targetId = String(productId);

  const updatedList = currentList.filter((p) => String(p.id) !== targetId);

  // Persistir en localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error("Error al eliminar producto de localStorage:", err);
  }

  // Eliminar de MOCK_PRODUCTS
  const mockIndex = MOCK_PRODUCTS.findIndex((p) => String(p.id) === targetId);
  if (mockIndex !== -1) {
    MOCK_PRODUCTS.splice(mockIndex, 1);
  }

  // Eliminar en Firestore si aplica
  if (isFirebaseConfigured && db) {
    try {
      const prodRef = doc(db, "products", targetId);
      await deleteDoc(prodRef);
    } catch (err) {
      console.warn("Aviso al eliminar anuncio en Firestore:", err);
    }
  }

  // Notificar a toda la aplicación
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { deletedId: targetId } }));
  }

  return true;
};

/**
 * Alterna el estado de pausa/visibilidad de una publicación (oculta o visible)
 */
export const togglePauseProduct = async (productId) => {
  const product = getProductById(productId);
  if (!product) throw new Error("Anuncio no encontrado");

  const newStatus = product.status === "pausado" ? "aprobado" : "pausado";
  return await updateProduct(productId, { status: newStatus });
};

/**
 * Formatea cualquier valor numérico para que siempre tenga 2 decimales y separador de miles (ej. 0.00, 25.00, 1,250.00)
 */
export const formatMoney = (amount) => {
  const num = Number(amount ?? 0);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Formatea la etiqueta de precio para mostrar en tarjetas y detalle
 * Soporta precios fijos, rangos, alquileres (/mes, /año), servicios (ocasión, mensual, anual) y "A consultar"
 */
export const formatProductPrice = (product) => {
  if (!product) return { text: "$0.00", isFree: false, isContact: false, isRange: false };

  // Caso 1: Solicitar precio por mensaje
  if (product.priceMode === "contact" || product.isContactPrice || product.priceType === "contact") {
    return {
      text: "A consultar",
      subtext: "Precio por mensaje",
      isFree: false,
      isContact: true,
      isRange: false
    };
  }

  // Sufijo de período y etiqueta de modalidad para alquileres y servicios
  let periodSuffix = "";
  let billingLabel = "";

  if (product.rentPeriod) {
    periodSuffix = `/${product.rentPeriod}`;
    billingLabel = product.rentPeriod === "mes" ? "Renta mensual" : "Renta anual";
  } else if (product.servicePaymentType) {
    if (product.servicePaymentType === "mes") {
      periodSuffix = "/mes";
      billingLabel = "Mensual (recurrente)";
    } else if (product.servicePaymentType === "año") {
      periodSuffix = "/año";
      billingLabel = "Anual (recurrente)";
    } else if (product.servicePaymentType === "unico") {
      periodSuffix = " (ocasión)";
      billingLabel = "Un solo pago (ocasión)";
    }
  }

  // Caso 2: Rango de precios (solo si priceMode es explícitamente "range" o si tiene valores numéricos válidos en minPrice y maxPrice)
  const isRangeMode =
    product.priceMode === "range" ||
    (Boolean(product.isPriceRange) &&
      product.priceMode !== "fixed" &&
      product.minPrice != null &&
      product.maxPrice != null &&
      Number(product.maxPrice) > 0);

  if (isRangeMode) {
    const min = Number(product.minPrice || 0);
    const max = Number(product.maxPrice || 0);
    return {
      text: `$${formatMoney(min)} - $${formatMoney(max)}`,
      currency: product.currency || "USD",
      periodSuffix,
      billingLabel,
      isFree: false,
      isContact: false,
      isRange: true
    };
  }

  // Caso 3: Gratis
  if ((product.priceMode === "fixed" && product.isFree) || (!product.priceMode && product.isFree)) {
    return {
      text: "GRATIS",
      isFree: true,
      isContact: false,
      isRange: false
    };
  }

  // Caso 4: Precio fijo regular (siempre formateado a 2 decimales)
  const priceNum = Number(product.price || 0);
  return {
    text: `$${formatMoney(priceNum)}`,
    currency: product.currency || "USD",
    periodSuffix,
    billingLabel,
    isFree: false,
    isContact: false,
    isRange: false
  };
};

/**
 * Obtiene la clave de almacenamiento exclusiva para los favoritos de un usuario
 */
const getUserFavoritesKey = (user) => {
  if (!user) return null;
  const uid = user.id || user.uid || user.username;
  return uid ? `anunciossv_favorites_${String(uid).trim()}` : null;
};

/**
 * Obtiene la lista de IDs de anuncios marcados como favoritos (estrictamente aislada por usuario)
 * Los usuarios invitados nunca tienen favoritos precargados
 */
export const getFavoriteIds = (user = null) => {
  if (!user) return [];
  const userKey = getUserFavoritesKey(user);
  if (!userKey) return [];

  try {
    const raw = localStorage.getItem(userKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error("Error al leer favoritos del usuario:", err);
  }

  return [];
};

/**
 * Verifica si un producto específico está en favoritos del usuario activo
 */
export const isProductFavorite = (productId, user = null) => {
  if (!productId || !user) return false;
  const favorites = getFavoriteIds(user);
  return favorites.includes(String(productId));
};

/**
 * Alterna el estado de favorito de un producto (solo para usuarios autenticados)
 */
export const toggleFavoriteProduct = (productId, user = null) => {
  if (!productId || !user) {
    return { isFavorite: false, likesCount: 0, requiresAuth: true };
  }

  const targetId = String(productId);
  const userKey = getUserFavoritesKey(user);
  const currentFavorites = getFavoriteIds(user);
  const isAlreadyFavorite = currentFavorites.includes(targetId);

  const updatedFavorites = isAlreadyFavorite
    ? currentFavorites.filter((id) => id !== targetId)
    : [...currentFavorites, targetId];

  if (userKey) {
    try {
      localStorage.setItem(userKey, JSON.stringify(updatedFavorites));
    } catch (err) {
      console.error("Error al actualizar favoritos del usuario:", err);
    }
  }

  // Guardar en Firestore si el usuario tiene cuenta registrada
  if (isFirebaseConfigured && db && (user.id || user.uid)) {
    try {
      const userRef = doc(db, "users", String(user.id || user.uid));
      setDoc(userRef, { favorites: updatedFavorites }, { merge: true });
    } catch (err) {
      console.warn("Aviso al guardar favoritos en Firestore:", err);
    }
  }

  // Actualizar también el contador numérico de likes en la publicación
  const products = getStoredProducts();
  let updatedLikesCount = 0;
  const isNowFavorite = !isAlreadyFavorite;

  const updatedProducts = products.map((prod) => {
    if (String(prod.id) === targetId) {
      const currentLikes = Number(prod.likesCount) || 0;
      updatedLikesCount = isNowFavorite ? currentLikes + 1 : Math.max(0, currentLikes - 1);
      return {
        ...prod,
        likesCount: updatedLikesCount
      };
    }
    return prod;
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProducts));
  } catch (err) {
    console.error("Error al persistir productos con like en localStorage:", err);
  }

  // Notificar a toda la aplicación para sincronización instantánea
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(FAVORITES_EVENT, {
        detail: {
          productId: targetId,
          isFavorite: isNowFavorite,
          likesCount: updatedLikesCount,
          userId: user.id || user.uid
        }
      })
    );
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { productId: targetId } }));
  }

  return { isFavorite: isNowFavorite, likesCount: updatedLikesCount };
};

/**
 * Obtiene la lista completa de objetos de productos favoritos del usuario
 */
export const getFavoriteProducts = (user = null) => {
  if (!user) return [];
  const favoriteIds = getFavoriteIds(user);
  if (!favoriteIds.length) return [];
  const all = getStoredProducts();
  return all.filter((p) => favoriteIds.includes(String(p.id)));
};

/**
 * Obtiene todas las publicaciones pertenecientes a un vendedor por su id, uid o nombre
 */
export const getProductsBySellerId = (sellerId) => {
  if (!sellerId) return [];
  let decodedId = String(sellerId).trim().toLowerCase();
  try {
    decodedId = decodeURIComponent(sellerId).trim().toLowerCase();
  } catch (_) {}

  const all = getStoredProducts();

  return all.filter((p) => {
    const sId = String(p.seller?.id || p.seller?.uid || "").trim().toLowerCase();
    const sName = String(p.seller?.name || p.seller?.displayName || "").trim().toLowerCase();
    const sUsername = String(p.seller?.username || "").trim().toLowerCase().replace("@", "");
    return (
      (sId && sId === decodedId) ||
      (sName && sName === decodedId) ||
      (sUsername && sUsername === decodedId)
    );
  });
};

/**
 * Obtiene la información de perfil de un vendedor a partir del registro central de perfiles o sus publicaciones
 */
export const getSellerInfo = (sellerId) => {
  if (!sellerId) return null;
  let decodedId = String(sellerId).trim();
  try {
    decodedId = decodeURIComponent(sellerId).trim();
  } catch (_) {}
  const decodedLower = decodedId.toLowerCase();

  // 1. Consultar registro central de perfiles públicos actualizados
  const cachedProfile = getPublicProfile(sellerId) || getPublicProfile(decodedId);

  const all = getStoredProducts();
  const match = all.find((p) => {
    const sId = String(p.seller?.id || p.seller?.uid || "").trim().toLowerCase();
    const sName = String(p.seller?.name || p.seller?.displayName || "").trim().toLowerCase();
    const sUsername = String(p.seller?.username || "").trim().toLowerCase().replace("@", "");
    return (
      (sId && sId === decodedLower) ||
      (sName && sName === decodedLower) ||
      (sUsername && sUsername === decodedLower)
    );
  });

  if (match?.seller || cachedProfile) {
    const baseSeller = match?.seller || {};
    return {
      id: cachedProfile?.id || cachedProfile?.uid || baseSeller.id || baseSeller.uid || sellerId,
      name: cachedProfile?.displayName || cachedProfile?.name || baseSeller.displayName || baseSeller.name || "Vendedor AnunciosSV",
      username: cachedProfile?.username
        ? `@${cachedProfile.username.replace(/^@/, "")}`
        : (baseSeller.username || (baseSeller.name ? `@${baseSeller.name.toLowerCase().replace(/\s+/g, "_")}` : "@vendedor")),
      avatar: cachedProfile?.avatar || baseSeller.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      rating: cachedProfile?.rating || baseSeller.rating || 5.0,
      reviewsCount: cachedProfile?.reviewsCount || baseSeller.reviewsCount || 0,
      verified: cachedProfile?.verified !== undefined ? cachedProfile.verified : Boolean(baseSeller.verified),
      location: match?.department || match?.location || baseSeller.location || "San Salvador, El Salvador",
      memberSince: "Marzo 2024",
      bio: "Comerciante activo en AnunciosSV ofreciendo productos verificados y atención confiable."
    };
  }

  // Fallback si no hay publicaciones coincidentes
  return {
    id: sellerId,
    name: decodedId,
    username: `@${decodedId.toLowerCase().replace(/\s+/g, "_")}`,
    avatar: resolveUserAvatar(sellerId, "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"),
    rating: 5.0,
    reviewsCount: 0,
    verified: false,
    location: "El Salvador",
    memberSince: "2024",
    bio: "Miembro de la comunidad AnunciosSV."
  };
};

/**
 * Limpia y normaliza el número de teléfono para enlaces de WhatsApp (wa.me)
 */
export const getCleanWhatsappNumber = (phone) => {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  // Si tiene 8 dígitos y no tiene prefijo internacional, asumir El Salvador (503)
  if (digits.length === 8) {
    return "503" + digits;
  }
  return digits;
};
