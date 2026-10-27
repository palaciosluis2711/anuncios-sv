// Servicio centralizado y reactivo de productos de AnunciosSV
// Garantiza persistencia en localStorage y sincronización en tiempo real entre Feed, Perfil y Detalle
import { MOCK_PRODUCTS } from "./mockData";

const STORAGE_KEY = "anunciossv_products_v1";
const UPDATE_EVENT = "anunciossv_products_updated";
export const FAVORITES_STORAGE_KEY = "anunciossv_favorites_v1";
export const FAVORITES_EVENT = "anunciossv_favorites_updated";

/**
 * Obtiene todos los productos guardados (localStorage + mock inicial)
 */
export const getStoredProducts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error al leer productos de localStorage:", err);
  }

  // Si no hay datos en localStorage, inicializar con los productos de demostración
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_PRODUCTS));
  } catch (err) {
    console.warn("No se pudo escribir MOCK_PRODUCTS en localStorage:", err);
  }
  return MOCK_PRODUCTS;
};

/**
 * Guarda una nueva publicación en el catálogo y notifica a las vistas activas
 */
export const saveNewProduct = (newProduct) => {
  const currentList = getStoredProducts();

  const formattedProduct = {
    ...newProduct,
    id: newProduct.id || `prod-${Date.now()}`,
    likesCount: newProduct.likesCount ?? 0,
    viewsCount: newProduct.viewsCount ?? 1,
    status: newProduct.status || "aprobado",
    createdAt: newProduct.createdAt || "Hace un momento"
  };

  // Insertar al inicio para que aparezca primero en el feed
  const updatedList = [formattedProduct, ...currentList.filter((p) => p.id !== formattedProduct.id)];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error("Error al persistir nuevo producto en localStorage:", err);
  }

  // Actualizar también la lista en memoria de mockData
  const existsInMock = MOCK_PRODUCTS.some((p) => p.id === formattedProduct.id);
  if (!existsInMock) {
    MOCK_PRODUCTS.unshift(formattedProduct);
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

  const userId = user.id || user.uid;
  const username = user.username ? `@${user.username.replace("@", "")}` : "";
  const name = user.name || "";
  const email = user.email || "";

  return all.filter((p) => {
    const sellerId = p.seller?.id;
    const sellerName = p.seller?.name;
    const sellerEmail = p.seller?.email;

    return (
      (userId && sellerId && String(sellerId) === String(userId)) ||
      (name && sellerName && sellerName.toLowerCase() === name.toLowerCase()) ||
      (username && sellerName && sellerName.toLowerCase() === username.toLowerCase()) ||
      (email && sellerEmail && sellerEmail.toLowerCase() === email.toLowerCase())
    );
  });
};

/**
 * Obtiene la lista de IDs de anuncios marcados como favoritos
 */
export const getFavoriteIds = (user = null) => {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error("Error al leer favoritos de localStorage:", err);
  }

  // Inicializar con los productos marcados inicialmente con isLiked en los datos mock
  const initialFavorites = MOCK_PRODUCTS.filter((p) => p.isLiked).map((p) => String(p.id));
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(initialFavorites));
  } catch (err) {
    console.warn("No se pudo escribir favoritos iniciales en localStorage:", err);
  }
  return initialFavorites;
};

/**
 * Verifica si un producto específico está en favoritos
 */
export const isProductFavorite = (productId, user = null) => {
  if (!productId) return false;
  const favorites = getFavoriteIds(user);
  return favorites.includes(String(productId));
};

/**
 * Alterna el estado de favorito de un producto y actualiza sus me gusta
 */
export const toggleFavoriteProduct = (productId, user = null) => {
  if (!productId) return { isFavorite: false, likesCount: 0 };
  const targetId = String(productId);
  const currentFavorites = getFavoriteIds(user);
  const isAlreadyFavorite = currentFavorites.includes(targetId);

  const updatedFavorites = isAlreadyFavorite
    ? currentFavorites.filter((id) => id !== targetId)
    : [...currentFavorites, targetId];

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updatedFavorites));
  } catch (err) {
    console.error("Error al actualizar favoritos en localStorage:", err);
  }

  // Actualizar también el contador de likes en la lista persistida de productos
  const products = getStoredProducts();
  let updatedLikesCount = 0;
  const isNowFavorite = !isAlreadyFavorite;

  const updatedProducts = products.map((prod) => {
    if (String(prod.id) === targetId) {
      const currentLikes = Number(prod.likesCount) || 0;
      updatedLikesCount = isNowFavorite ? currentLikes + 1 : Math.max(0, currentLikes - 1);
      return {
        ...prod,
        likesCount: updatedLikesCount,
        isLiked: isNowFavorite
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
        detail: { productId: targetId, isFavorite: isNowFavorite, likesCount: updatedLikesCount }
      })
    );
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { productId: targetId } }));
  }

  return { isFavorite: isNowFavorite, likesCount: updatedLikesCount };
};

/**
 * Obtiene la lista completa de objetos de productos favoritos
 */
export const getFavoriteProducts = (user = null) => {
  const favoriteIds = getFavoriteIds(user);
  const all = getStoredProducts();
  return all.filter((p) => favoriteIds.includes(String(p.id)));
};

/**
 * Obtiene todas las publicaciones pertenecientes a un vendedor por su id o nombre
 */
export const getProductsBySellerId = (sellerId) => {
  if (!sellerId) return [];
  const decodedId = decodeURIComponent(sellerId).trim().toLowerCase();
  const all = getStoredProducts();

  return all.filter((p) => {
    const sId = String(p.seller?.id || "").trim().toLowerCase();
    const sName = String(p.seller?.name || "").trim().toLowerCase();
    const sUsername = String(p.seller?.username || "").trim().toLowerCase().replace("@", "");
    return sId === decodedId || sName === decodedId || sUsername === decodedId;
  });
};

/**
 * Obtiene la información de perfil de un vendedor a partir de sus publicaciones
 */
export const getSellerInfo = (sellerId) => {
  if (!sellerId) return null;
  const decodedId = decodeURIComponent(sellerId).trim().toLowerCase();
  const all = getStoredProducts();

  const match = all.find((p) => {
    const sId = String(p.seller?.id || "").trim().toLowerCase();
    const sName = String(p.seller?.name || "").trim().toLowerCase();
    const sUsername = String(p.seller?.username || "").trim().toLowerCase().replace("@", "");
    return sId === decodedId || sName === decodedId || sUsername === decodedId;
  });

  if (match?.seller) {
    return {
      id: match.seller.id || sellerId,
      name: match.seller.name || "Vendedor AnunciosSV",
      username: match.seller.username || (match.seller.name ? `@${match.seller.name.toLowerCase().replace(/\s+/g, "_")}` : "@vendedor"),
      avatar: match.seller.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      rating: match.seller.rating || 5.0,
      reviewsCount: match.seller.reviewsCount || 0,
      verified: Boolean(match.seller.verified),
      location: match.department || match.location || "San Salvador, El Salvador",
      memberSince: "Marzo 2024",
      bio: "Comerciante activo en AnunciosSV ofreciendo productos verificados y atención confiable."
    };
  }

  // Fallback si no hay publicaciones coincidentes
  return {
    id: sellerId,
    name: decodeURIComponent(sellerId),
    username: `@${decodeURIComponent(sellerId).toLowerCase().replace(/\s+/g, "_")}`,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    rating: 5.0,
    reviewsCount: 0,
    verified: false,
    location: "El Salvador",
    memberSince: "2024",
    bio: "Miembro de la comunidad AnunciosSV."
  };
};
