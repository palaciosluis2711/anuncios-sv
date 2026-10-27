// Configuración e inicialización de Firebase SDK (Auth, Firestore, Storage)
// Diseñado para operar en producción con variables de entorno de Vite o fallback informativo.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Obtenemos las credenciales desde variables de entorno de Vite (VITE_*)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoDummyKeyForInitialization-12345",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mercadosocial-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mercadosocial-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mercadosocial-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890"
};

// Verificamos si el usuario ha suministrado credenciales reales o está en modo demostración
export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);

// Inicialización singleton segura de Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
