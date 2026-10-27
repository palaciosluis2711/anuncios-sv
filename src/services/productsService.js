// Servicio centralizado y reactivo de productos de AnunciosSV
// Garantiza persistencia en localStorage y sincronización en tiempo real entre Feed, Perfil y Detalle
import { MOCK_PRODUCTS } from "./mockData";

const STORAGE_KEY = "anunciossv_products_v1";
const UPDATE_EVENT = "anunciossv_products_updated";

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
