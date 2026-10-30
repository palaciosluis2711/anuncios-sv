// Servicio centralizado de perfiles públicos de usuario para AnunciosSV
// Garantiza persistencia, consulta y sincronización inmediata de fotos de perfil y nombres
// a lo largo de toda la aplicación (publicaciones, chats, mensajes, feed y perfiles).

import { MOCK_USERS } from "./mockData.js";

export const STORAGE_KEY_PROFILES = "anunciossv_user_profiles_v1";
export const PROFILE_UPDATED_EVENT = "anunciossv_profile_updated";

/**
 * Obtiene el mapa completo de perfiles almacenados localmente
 */
export const getStoredProfiles = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.error("Error al leer perfiles de usuarios de localStorage:", err);
    return {};
  }
};

/**
 * Normaliza una cadena para búsquedas insensibles a mayúsculas, espacios y arrobas
 */
const normalizeKey = (val) => {
  if (!val) return "";
  return String(val).toLowerCase().replace(/^@/, "").trim();
};

/**
 * Consulta la información pública más reciente de un usuario (avatar, nombre, teléfono)
 * a partir de cualquier identificador: ID (uid), username o nombre.
 */
export const getPublicProfile = (userOrIdentifier) => {
  if (!userOrIdentifier) return null;

  const profiles = getStoredProfiles();

  // Si es un objeto de usuario o vendedor
  if (typeof userOrIdentifier === "object") {
    const id = normalizeKey(userOrIdentifier.id || userOrIdentifier.uid);
    const username = normalizeKey(userOrIdentifier.username);
    const name = normalizeKey(userOrIdentifier.displayName || userOrIdentifier.name);

    if (id && profiles[id]) return profiles[id];
    if (username && profiles[username]) return profiles[username];
    if (name && profiles[name]) return profiles[name];

    // Buscar en MOCK_USERS si coincide
    const matchedMock = MOCK_USERS.find((u) => {
      const uId = normalizeKey(u.id);
      const uUsername = normalizeKey(u.username || u.name);
      const uName = normalizeKey(u.name);
      return (id && uId === id) || (username && uUsername === username) || (name && uName === name);
    });

    if (matchedMock) {
      return {
        id: matchedMock.id,
        username: matchedMock.username || matchedMock.name?.toLowerCase().replace(/\s+/g, "_"),
        name: matchedMock.name,
        displayName: matchedMock.name,
        avatar: matchedMock.avatar,
        phone: matchedMock.phone || "",
        rating: 5.0,
        reviewsCount: 0,
        verified: Boolean(matchedMock.verified)
      };
    }

    return null;
  }

  // Si es una cadena (ID, username o nombre)
  const query = normalizeKey(userOrIdentifier);
  if (!query) return null;

  if (profiles[query]) {
    return profiles[query];
  }

  // Buscar coincidencia en MOCK_USERS
  const matchedMock = MOCK_USERS.find((u) => {
    const uId = normalizeKey(u.id);
    const uUsername = normalizeKey(u.username || u.name);
    const uName = normalizeKey(u.name);
    return uId === query || uUsername === query || uName === query;
  });

  if (matchedMock) {
    return {
      id: matchedMock.id,
      username: matchedMock.username || matchedMock.name?.toLowerCase().replace(/\s+/g, "_"),
      name: matchedMock.name,
      displayName: matchedMock.name,
      avatar: matchedMock.avatar,
      phone: matchedMock.phone || "",
      rating: 5.0,
      reviewsCount: 0,
      verified: Boolean(matchedMock.verified)
    };
  }

  return null;
};

/**
 * Guarda o actualiza el perfil público de un usuario indexándolo por múltiples claves
 * (ID, username y nombre) para facilitar su resolución reactiva en toda la app.
 */
export const savePublicProfile = (profileData) => {
  if (!profileData || typeof window === "undefined") return null;

  const currentProfiles = getStoredProfiles();

  const id = String(profileData.id || profileData.uid || "").trim();
  const rawUsername = String(profileData.username || "").trim();
  const cleanUsername = normalizeKey(rawUsername);
  const displayName = String(profileData.displayName || "").trim();
  const name = String(profileData.name || displayName || (rawUsername ? `@${cleanUsername}` : "Usuario")).trim();
  const cleanName = normalizeKey(name);
  const avatar = String(profileData.avatar || "").trim();
  const phone = String(profileData.phone || "").trim();

  const standardizedProfile = {
    id: id || profileData.id || `usr-${Date.now()}`,
    username: cleanUsername || rawUsername || "",
    displayName: displayName || name,
    name: name,
    avatar: avatar,
    phone: phone,
    rating: profileData.rating ?? 5.0,
    reviewsCount: profileData.reviewsCount ?? 0,
    verified: Boolean(profileData.verified),
    updatedAt: new Date().toISOString()
  };

  // Indexar bajo todas sus posibles claves de búsqueda
  if (id) {
    currentProfiles[id] = standardizedProfile;
    currentProfiles[normalizeKey(id)] = standardizedProfile;
  }
  if (cleanUsername) {
    currentProfiles[cleanUsername] = standardizedProfile;
    currentProfiles[`@${cleanUsername}`] = standardizedProfile;
  }
  if (cleanName) {
    currentProfiles[cleanName] = standardizedProfile;
  }

  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(currentProfiles));
  } catch (err) {
    console.error("Error al guardar perfil público en localStorage:", err);
  }

  // Actualizar también en el array MOCK_USERS en memoria si coincide
  const mockIndex = MOCK_USERS.findIndex((u) => {
    const uId = normalizeKey(u.id);
    const uUsername = normalizeKey(u.username || u.name);
    return (id && uId === normalizeKey(id)) || (cleanUsername && uUsername === cleanUsername);
  });

  if (mockIndex !== -1) {
    MOCK_USERS[mockIndex] = {
      ...MOCK_USERS[mockIndex],
      name: standardizedProfile.name,
      avatar: standardizedProfile.avatar,
      phone: standardizedProfile.phone || MOCK_USERS[mockIndex].phone
    };
  }

  // Notificar a toda la aplicación
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PROFILE_UPDATED_EVENT, {
        detail: standardizedProfile
      })
    );
  }

  return standardizedProfile;
};

/**
 * Resuelve el avatar más fresco de un usuario o devuelve el fallback si no existe
 */
export const resolveUserAvatar = (userOrIdentifier, fallbackAvatar = null) => {
  const profile = getPublicProfile(userOrIdentifier);
  if (profile?.avatar) {
    return profile.avatar;
  }
  if (typeof userOrIdentifier === "object" && userOrIdentifier?.avatar) {
    return userOrIdentifier.avatar;
  }
  return fallbackAvatar || null;
};
