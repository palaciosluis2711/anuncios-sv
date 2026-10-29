// Contexto global de autenticación: Registro con Nombre de Usuario, Correo y Contraseña
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { isFirebaseConfigured, auth, db } from "../services/firebase";
import { AuthRequiredModal } from "../components/common/AuthRequiredModal";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signOut as fbSignOut,
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { MOCK_USERS } from "../services/mockData";
import { savePublicProfile, getPublicProfile } from "../services/userProfileService";
import { syncUserAvatarInProducts } from "../services/productsService";
import { syncUserAvatarInChats } from "../services/chatService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("mercadosocial_user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error("Error al parsear usuario de localStorage:", e);
      }
    }
    // Si no hay sesión activa guardada, arrancar en modo invitado (null)
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Control interactivo del modal para solicitar inicio de sesión en acciones restringidas
  const [authModalConfig, setAuthModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    actionType: "action"
  });

  const openAuthPrompt = useCallback(({ title, message, actionType = "action" } = {}) => {
    setAuthModalConfig({
      isOpen: true,
      title: title || "",
      message: message || "",
      actionType
    });
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setAuthModalConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const requireAuth = useCallback(
    (callback, promptOptions = {}) => {
      if (currentUser) {
        if (typeof callback === "function") {
          return callback();
        }
        return true;
      }
      openAuthPrompt(promptOptions);
      return false;
    },
    [currentUser, openAuthPrompt]
  );

  // Sincronizar usuario actual con localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("mercadosocial_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("mercadosocial_user");
    }
  }, [currentUser]);

  // Escuchar sesión activa en Firebase Auth
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, "users", fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setCurrentUser({
              id: fbUser.uid,
              username: data.username || fbUser.email.split("@")[0],
              name: data.displayName || data.name || `@${data.username || fbUser.email.split("@")[0]}`,
              displayName: data.displayName || "",
              phone: data.phone || "",
              email: fbUser.email,
              role: data.role || "user",
              avatar: data.avatar || fbUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
              status: data.status || "activo"
            });
          } else {
            setCurrentUser({
              id: fbUser.uid,
              username: fbUser.email.split("@")[0],
              name: fbUser.displayName || `@${fbUser.email.split("@")[0]}`,
              displayName: fbUser.displayName || "",
              phone: fbUser.phoneNumber || "",
              email: fbUser.email,
              role: "user",
              avatar: fbUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
              status: "activo"
            });
          }
        } catch (err) {
          console.warn("Aviso al consultar Firestore para perfil:", err.message);
        }
      } else {
        // Si no hay sesión en Firebase Auth, comprobar si hay usuario de prueba en localStorage
        const savedUser = localStorage.getItem("mercadosocial_user");
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            // Si el usuario guardado no era explícitamente demo, limpiar para no restaurar sesión
            if (parsed && !parsed.isDemoUser) {
              setCurrentUser(null);
              localStorage.removeItem("mercadosocial_user");
            }
          } catch (e) { }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 1. Verificación de disponibilidad del Nombre de Usuario
  const checkUsernameAvailability = async (rawUsername) => {
    if (!rawUsername) return { available: false, error: null };

    const cleanUsername = rawUsername.trim().replace(/^@/, "");
    const regex = /^[a-zA-Z0-9_]{3,20}$/;

    if (!regex.test(cleanUsername)) {
      if (cleanUsername.length < 3) {
        return { available: false, error: "Mínimo 3 caracteres" };
      }
      if (cleanUsername.length > 20) {
        return { available: false, error: "Máximo 20 caracteres" };
      }
      return { available: false, error: "Solo letras, números y guion bajo (_)" };
    }

    if (!isFirebaseConfigured) {
      const isTaken = ["admin", "carlos_m", "vivasol", "spam_bot"].includes(cleanUsername.toLowerCase());
      return {
        available: !isTaken,
        username: cleanUsername,
        error: isTaken ? `El usuario @${cleanUsername} ya está ocupado` : null,
        message: !isTaken ? `@${cleanUsername} disponible` : null
      };
    }

    try {
      const usernameDocRef = doc(db, "usernames", cleanUsername.toLowerCase());
      const docSnap = await getDoc(usernameDocRef);

      if (docSnap.exists()) {
        return {
          available: false,
          username: cleanUsername,
          error: `El usuario @${cleanUsername} ya está en uso`
        };
      } else {
        return {
          available: true,
          username: cleanUsername,
          message: `¡@${cleanUsername} está disponible!`
        };
      }
    } catch (err) {
      console.warn("Error consultando disponibilidad en Firestore:", err.message);
      return { available: true, username: cleanUsername, message: `@${cleanUsername} válido` };
    }
  };

  // 2. Verificación de disponibilidad del Correo Electrónico
  const checkEmailAvailability = async (email) => {
    if (!email) return { available: false, error: null };

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      return { available: false, error: "Formato de correo no válido" };
    }

    if (!isFirebaseConfigured) {
      const isTaken = MOCK_USERS.some((u) => u.email.toLowerCase() === cleanEmail);
      return {
        available: !isTaken,
        email: cleanEmail,
        error: isTaken ? "Este correo ya está registrado" : null,
        message: !isTaken ? "Correo disponible" : null
      };
    }

    try {
      // Método nativo de Firebase Auth para verificar métodos asociados al correo
      const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
      if (methods && methods.length > 0) {
        return {
          available: false,
          email: cleanEmail,
          error: "Este correo ya está en uso en otra cuenta"
        };
      }
      return {
        available: true,
        email: cleanEmail,
        message: "Correo disponible"
      };
    } catch (err) {
      // Si la protección contra enumeración de correos está activada en Firebase, devuelve disponible
      return { available: true, email: cleanEmail, message: "Correo válido" };
    }
  };

  // 3. Registro con Nombre de Usuario, Correo y Contraseña
  const registerUser = async (rawUsername, email, password) => {
    setLoading(true);
    setAuthError(null);

    try {
      // Validar usuario
      const usernameCheck = await checkUsernameAvailability(rawUsername);
      if (!usernameCheck.available) {
        throw new Error(usernameCheck.error || "El nombre de usuario no está disponible");
      }
      const cleanUsername = usernameCheck.username;
      const cleanEmail = email.trim().toLowerCase();

      // Validar correo
      const emailCheck = await checkEmailAvailability(cleanEmail);
      if (!emailCheck.available) {
        throw new Error(emailCheck.error || "El correo no está disponible");
      }

      if (!isFirebaseConfigured) {
        const mockUser = {
          id: "usr-" + Date.now(),
          username: cleanUsername,
          name: `@${cleanUsername}`,
          email: cleanEmail,
          role: cleanUsername.toLowerCase() === "admin" || cleanEmail.includes("admin") ? "admin" : "user",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
          status: "activo"
        };
        setCurrentUser(mockUser);
        return mockUser;
      }

      // Registro real en Firebase Auth con su correo real y contraseña
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80";

      // Actualizar display name con el nombre de usuario
      await updateProfile(user, {
        displayName: `@${cleanUsername}`,
        photoURL: defaultAvatar
      });

      const role = cleanUsername.toLowerCase() === "admin" || cleanEmail.includes("admin") ? "admin" : "user";

      // 1. Reservar de forma atómica en 'usernames'
      try {
        await setDoc(doc(db, "usernames", cleanUsername.toLowerCase()), {
          uid: user.uid,
          username: cleanUsername,
          email: cleanEmail,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Aviso al reservar username en Firestore:", e.message);
      }

      // 2. Guardar perfil completo en 'users/{uid}'
      const userDocData = {
        uid: user.uid,
        username: cleanUsername,
        name: `@${cleanUsername}`,
        email: cleanEmail,
        role: role,
        avatar: defaultAvatar,
        status: "activo",
        joinedDate: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }),
        postsCount: 0,
        reportedCount: 0,
        createdAt: serverTimestamp()
      };

      try {
        await setDoc(doc(db, "users", user.uid), userDocData);
      } catch (e) {
        console.warn("Aviso al escribir en 'users':", e.message);
      }

      const finalUserState = { id: user.uid, ...userDocData };
      setCurrentUser(finalUserState);
      return finalUserState;
    } catch (err) {
      console.error("Error en registro:", err);
      const humanMessage = getFirebaseErrorMessage(err.code, err.message);
      setAuthError(humanMessage);
      throw new Error(humanMessage);
    } finally {
      setLoading(false);
    }
  };

  // 4. Inicio de sesión (acepta Nombre de Usuario o Correo)
  const loginUser = async (usernameOrEmail, password) => {
    setLoading(true);
    setAuthError(null);

    try {
      const input = usernameOrEmail.trim().replace(/^@/, "");
      let emailToAuth = input;

      // Si no es un formato de correo tradicional, resolvemos el correo asociado al username
      if (!input.includes("@") || !input.includes(".")) {
        if (isFirebaseConfigured) {
          try {
            const usernameDocRef = doc(db, "usernames", input.toLowerCase());
            const snap = await getDoc(usernameDocRef);
            if (snap.exists() && snap.data().email) {
              emailToAuth = snap.data().email;
            } else {
              // Si no encontramos el mapeo, intentamos con el correo interno o el mismo input
              emailToAuth = `${input.toLowerCase()}@anunciossv.app`;
            }
          } catch (e) {
            console.warn("No se pudo resolver el username a email:", e);
          }
        }
      }

      if (!isFirebaseConfigured) {
        const found = MOCK_USERS.find(
          (u) =>
            u.email.toLowerCase() === input.toLowerCase() ||
            u.name.toLowerCase().includes(input.toLowerCase())
        );
        const userToSet = found
          ? { ...found, username: input, name: `@${input}` }
          : {
            id: "usr-" + Date.now(),
            username: input,
            name: `@${input}`,
            email: emailToAuth,
            role: input.toLowerCase() === "admin" ? "admin" : "user",
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
            status: "activo"
          };
        setCurrentUser(userToSet);
        return userToSet;
      }

      const userCredential = await signInWithEmailAndPassword(auth, emailToAuth, password);
      const user = userCredential.user;

      // Leer datos desde Firestore
      try {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
          const data = snap.data();
          if (data.status === "suspendido") {
            await fbSignOut(auth);
            throw new Error("Esta cuenta ha sido suspendida por el Webmaster.");
          }
          const userObj = { id: user.uid, ...data };
          setCurrentUser(userObj);
          return userObj;
        }
      } catch (firestoreErr) {
        console.warn("Aviso leyendo Firestore en login:", firestoreErr);
      }

      const basicUser = {
        id: user.uid,
        username: input,
        name: user.displayName || `@${input}`,
        email: user.email,
        role: user.email.includes("admin") ? "admin" : "user",
        avatar: user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
        status: "activo"
      };
      setCurrentUser(basicUser);
      return basicUser;
    } catch (err) {
      console.error("Error en login:", err);
      const humanMessage = getFirebaseErrorMessage(err.code, err.message);
      setAuthError(humanMessage);
      throw new Error(humanMessage);
    } finally {
      setLoading(false);
    }
  };

  // 5. Iniciar con cuenta Google
  const loginWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const snap = await getDoc(userDocRef);

      let finalUser;
      if (!snap.exists()) {
        const baseUsername = (user.email ? user.email.split("@")[0] : "usuario")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 15);
        const uniqueUsername = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;

        const newUserData = {
          uid: user.uid,
          username: uniqueUsername,
          name: `@${uniqueUsername}`,
          email: user.email,
          role: "user",
          avatar: user.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
          status: "activo",
          joinedDate: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }),
          postsCount: 0,
          reportedCount: 0,
          createdAt: serverTimestamp()
        };

        try {
          await setDoc(doc(db, "usernames", uniqueUsername), {
            uid: user.uid,
            username: uniqueUsername,
            email: user.email,
            createdAt: serverTimestamp()
          });
          await setDoc(userDocRef, newUserData);
        } catch (e) {
          console.warn("Aviso al guardar usuario de Google:", e);
        }

        finalUser = { id: user.uid, ...newUserData };
      } else {
        finalUser = { id: user.uid, ...snap.data() };
      }

      setCurrentUser(finalUser);
      return finalUser;
    } catch (err) {
      console.error("Error en Google Auth:", err);
      const humanMessage = getFirebaseErrorMessage(err.code, err.message);
      setAuthError(humanMessage);
      throw new Error(humanMessage);
    } finally {
      setLoading(false);
    }
  };

  // 6. Alternar roles de prueba desde el simulador
  const switchDemoRole = (targetRole) => {
    setLoading(true);
    setTimeout(() => {
      if (targetRole === "admin") {
        const cachedAdmin = getPublicProfile("usr-admin");
        const demoAdmin = {
          ...MOCK_USERS[0],
          username: "admin",
          name: cachedAdmin?.displayName || cachedAdmin?.name || "@admin",
          displayName: cachedAdmin?.displayName || "@admin",
          avatar: cachedAdmin?.avatar || MOCK_USERS[0].avatar,
          phone: cachedAdmin?.phone || MOCK_USERS[0].phone || "",
          isDemoUser: true
        };
        setCurrentUser(demoAdmin);
        localStorage.setItem("mercadosocial_user", JSON.stringify(demoAdmin));
      } else if (targetRole === "user") {
        const cachedUser = getPublicProfile("usr-01");
        const demoUser = {
          ...MOCK_USERS[1],
          username: "carlos_m",
          name: cachedUser?.displayName || cachedUser?.name || "@carlos_m",
          displayName: cachedUser?.displayName || "@carlos_m",
          avatar: cachedUser?.avatar || MOCK_USERS[1].avatar,
          phone: cachedUser?.phone || MOCK_USERS[1].phone || "",
          isDemoUser: true
        };
        setCurrentUser(demoUser);
        localStorage.setItem("mercadosocial_user", JSON.stringify(demoUser));
      } else {
        setCurrentUser(null);
        localStorage.removeItem("mercadosocial_user");
      }
      setLoading(false);
    }, 100);
  };

  // 7. Cerrar sesión definitivamente (se mantiene cerrada incluso al recargar)
  const logout = async () => {
    if (isFirebaseConfigured) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.error("Error al cerrar sesión:", err);
      }
    }
    localStorage.removeItem("mercadosocial_user");
    setCurrentUser(null);
  };

  // 8. Actualizar perfil del usuario (nombre de pila, teléfono y foto de perfil)
  const updateUserProfile = async ({ displayName, phone, avatar }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const trimmedDisplayName = displayName !== undefined ? displayName.trim() : (currentUser?.displayName || "");
      const trimmedPhone = phone !== undefined ? phone.trim() : (currentUser?.phone || "");
      const newAvatar = avatar !== undefined ? avatar : (currentUser?.avatar || "");

      const updatedUser = {
        ...currentUser,
        displayName: trimmedDisplayName,
        name: trimmedDisplayName || `@${currentUser?.username || "usuario"}`,
        phone: trimmedPhone,
        avatar: newAvatar
      };

      // 1. Guardar en el directorio central de perfiles públicos (indexado por ID y username)
      savePublicProfile(updatedUser);

      // 2. Propagar y actualizar inmediatamente todas las publicaciones del usuario
      await syncUserAvatarInProducts(updatedUser, newAvatar, trimmedDisplayName);

      // 3. Propagar y actualizar inmediatamente todas las conversaciones y mensajes
      await syncUserAvatarInChats(updatedUser, newAvatar, trimmedDisplayName);

      if (isFirebaseConfigured && auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: trimmedDisplayName || auth.currentUser.displayName,
            photoURL: newAvatar || auth.currentUser.photoURL
          });
        } catch (e) {
          console.warn("Aviso al actualizar profile en Auth:", e);
        }

        try {
          const userDocRef = doc(db, "users", auth.currentUser.uid);
          await setDoc(userDocRef, {
            displayName: trimmedDisplayName,
            name: trimmedDisplayName || `@${currentUser?.username || "usuario"}`,
            phone: trimmedPhone,
            avatar: newAvatar,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn("Aviso al actualizar en Firestore:", e);
        }
      }

      setCurrentUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.error("Error al actualizar perfil:", err);
      const humanMessage = getFirebaseErrorMessage(err.code, err.message);
      setAuthError(humanMessage);
      throw new Error(humanMessage);
    } finally {
      setLoading(false);
    }
  };

  // 9. Actualizar correo electrónico
  const updateUserEmail = async (newEmail) => {
    setLoading(true);
    setAuthError(null);
    try {
      const cleanEmail = newEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error("Por favor ingresa un correo electrónico válido.");
      }

      if (isFirebaseConfigured && auth.currentUser) {
        await updateEmail(auth.currentUser, cleanEmail);

        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userDocRef, {
          email: cleanEmail,
          updatedAt: serverTimestamp()
        }, { merge: true });

        if (currentUser?.username) {
          try {
            const usernameDocRef = doc(db, "usernames", currentUser.username.toLowerCase());
            await setDoc(usernameDocRef, { email: cleanEmail }, { merge: true });
          } catch (e) {
            console.warn("Aviso al actualizar email en usernames:", e);
          }
        }
      }

      const updatedUser = { ...currentUser, email: cleanEmail };
      setCurrentUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.error("Error al actualizar correo:", err);
      let humanMessage = getFirebaseErrorMessage(err.code, err.message);
      if (err.code === "auth/requires-recent-login") {
        humanMessage = "Por seguridad, debes cerrar sesión y volver a entrar antes de cambiar tu correo.";
      }
      setAuthError(humanMessage);
      throw new Error(humanMessage);
    } finally {
      setLoading(false);
    }
  };

  // 10. Actualizar contraseña
  const updateUserPassword = async (newPassword) => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      }

      if (isFirebaseConfigured && auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
      }

      return true;
    } catch (err) {
      console.error("Error al actualizar contraseña:", err);
      let humanMessage = getFirebaseErrorMessage(err.code, err.message);
      if (err.code === "auth/requires-recent-login") {
        humanMessage = "Por seguridad, debes cerrar sesión y volver a entrar antes de cambiar tu contraseña.";
      }
      setAuthError(humanMessage);
      throw new Error(humanMessage);
    } finally {
      setLoading(false);
    }
  };

  // 11. Eliminar cuenta permanentemente (Danger Zone)
  const deleteAccount = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const uid = currentUser?.id || auth.currentUser?.uid;
      const username = currentUser?.username;

      if (isFirebaseConfigured) {
        if (uid) {
          try {
            await deleteDoc(doc(db, "users", uid));
          } catch (e) {
            console.warn("Aviso al eliminar documento en Firestore:", e);
          }
        }

        if (username) {
          try {
            await deleteDoc(doc(db, "usernames", username.toLowerCase()));
          } catch (e) {
            console.warn("Aviso al liberar username en Firestore:", e);
          }
        }

        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      }

      setCurrentUser(null);
      localStorage.removeItem("mercadosocial_user");
      return true;
    } catch (err) {
      console.error("Error al eliminar cuenta:", err);
      let humanMessage = getFirebaseErrorMessage(err.code, err.message);
      if (err.code === "auth/requires-recent-login") {
        humanMessage = "Por razones de seguridad, vuelve a iniciar sesión e intenta eliminar la cuenta inmediatamente.";
      }
      setAuthError(humanMessage);
      throw new Error(humanMessage);
    } finally {
      setLoading(false);
    }
  };

  const getFirebaseErrorMessage = (code, fallback) => {
    switch (code) {
      case "auth/operation-not-allowed":
        return "El proveedor de inicio de sesión no está habilitado en tu Consola de Firebase. Ve a Authentication > Sign-in method y activa Correo electrónico/contraseña.";
      case "auth/email-already-in-use":
        return "Este correo electrónico ya se encuentra registrado en otra cuenta.";
      case "auth/weak-password":
        return "La contraseña debe tener al menos 6 caracteres.";
      case "auth/invalid-email":
        return "El formato del correo electrónico no es válido.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Nombre de usuario, correo o contraseña incorrectos.";
      case "auth/popup-closed-by-user":
        return "Se cerró la ventana de Google antes de completar el inicio de sesión.";
      default:
        return fallback || "Ocurrió un error con la autenticación.";
    }
  };

  const value = {
    currentUser,
    isAuthenticated: Boolean(currentUser),
    isAdmin: currentUser?.role === "admin",
    loading,
    authError,
    setAuthError,
    checkUsernameAvailability,
    checkEmailAvailability,
    registerUser,
    loginUser,
    loginWithGoogle,
    switchDemoRole,
    logout,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
    deleteAccount,
    openAuthPrompt,
    closeAuthPrompt,
    requireAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthRequiredModal
        isOpen={authModalConfig.isOpen}
        onClose={closeAuthPrompt}
        title={authModalConfig.title}
        message={authModalConfig.message}
        actionType={authModalConfig.actionType}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};
