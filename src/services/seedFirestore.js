// Servicio para inicializar y sembrar colecciones y documentos en Firestore
import { db } from "./firebase";
import { collection, doc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { MOCK_PRODUCTS, MOCK_CATEGORIES, MOCK_USERS, MOCK_ADS } from "./mockData";

export const seedFirestoreDatabase = async (onProgress) => {
  try {
    onProgress?.("Conectando con Firestore...");

    // 1. Sembrar Categorías
    onProgress?.("Sembrando colección 'categories'...");
    for (const cat of MOCK_CATEGORIES) {
      await setDoc(doc(db, "categories", cat.id), {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        count: cat.count,
        updatedAt: serverTimestamp()
      });
    }

    // 2. Sembrar Usuarios Iniciales y Reservar sus Nombres de Usuario Únicos
    onProgress?.("Sembrando colección 'users' y 'usernames'...");
    const usernameMap = {
      "usr-admin": "admin",
      "usr-01": "carlos_m",
      "usr-02": "vivasol"
    };

    for (const user of MOCK_USERS) {
      const assignedUsername = usernameMap[user.id] || user.name.toLowerCase().replace(/\s+/g, "_");

      // Guardar usuario en 'users/{uid}'
      await setDoc(doc(db, "users", user.id), {
        uid: user.id,
        username: assignedUsername,
        name: `@${assignedUsername}`,
        email: user.email,
        role: user.role, // 'admin' o 'user'
        avatar: user.avatar,
        status: user.status, // 'activo' o 'suspendido'
        joinedDate: user.joinedDate,
        postsCount: user.postsCount,
        reportedCount: user.reportedCount,
        createdAt: serverTimestamp()
      });

      // Reservar atómicamente en 'usernames/{username}'
      await setDoc(doc(db, "usernames", assignedUsername.toLowerCase()), {
        uid: user.id,
        username: assignedUsername,
        createdAt: serverTimestamp()
      });
    }

    // 3. Sembrar Anuncios Clasificados (Products)
    onProgress?.("Sembrando colección 'products'...");
    for (const prod of MOCK_PRODUCTS) {
      await setDoc(doc(db, "products", prod.id), {
        id: prod.id,
        title: prod.title,
        price: Number(prod.price),
        currency: prod.currency,
        category: prod.category,
        categoryName: prod.categoryName,
        location: prod.location,
        image: prod.image,
        description: prod.description,
        likesCount: prod.likesCount || 0,
        viewsCount: prod.viewsCount || 0,
        status: prod.status, // 'aprobado' o 'pendiente'
        featured: Boolean(prod.featured),
        seller: prod.seller,
        createdAt: serverTimestamp()
      });
    }

    // 4. Sembrar Campañas Publicitarias (Ads)
    onProgress?.("Sembrando colección 'ads'...");
    for (const ad of MOCK_ADS) {
      await setDoc(doc(db, "ads", ad.id), {
        id: ad.id,
        title: ad.title,
        advertiser: ad.advertiser,
        image: ad.image,
        link: ad.link,
        impressions: ad.impressions || 0,
        clicks: ad.clicks || 0,
        status: ad.status, // 'activo' o 'pausado'
        placement: ad.placement,
        createdAt: serverTimestamp()
      });
    }

    onProgress?.("¡Sembrado completado con éxito!");
    return {
      success: true,
      stats: {
        categories: MOCK_CATEGORIES.length,
        users: MOCK_USERS.length,
        products: MOCK_PRODUCTS.length,
        ads: MOCK_ADS.length
      }
    };
  } catch (error) {
    console.error("Error al sembrar Firestore:", error);
    throw error;
  }
};
