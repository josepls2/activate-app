import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, inMemoryPersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const env = import.meta.env;

// Configuración PÚBLICA de la app web de Firebase (activayte-34e0b). No es un
// secreto: va dentro de la web que descarga cualquier visitante. La seguridad
// la dan las reglas de Firestore (y App Check / restricción de la API key).
// Se puede sobrescribir con variables VITE_FIREBASE_* en .env.local.
const PUBLIC_CONFIG = {
  apiKey: "AIzaSyAkaiT0XpAzWh5whYyrdCamTFjzVE2rR84",
  authDomain: "activayte-34e0b.firebaseapp.com",
  projectId: "activayte-34e0b",
  storageBucket: "activayte-34e0b.firebasestorage.app",
  messagingSenderId: "786729623429",
  appId: "1:786729623429:web:276333d3f1573490382eec",
};

const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY || PUBLIC_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || PUBLIC_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || PUBLIC_CONFIG.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || PUBLIC_CONFIG.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || PUBLIC_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || PUBLIC_CONFIG.appId,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.languageCode = "es";
  db = getFirestore(app);

  // App Check (opcional): define VITE_APPCHECK_SITE_KEY con la clave de
  // reCAPTCHA Enterprise registrada en Firebase Console → App Check.
  const siteKey = env.VITE_APPCHECK_SITE_KEY;
  if (siteKey) {
    const appInstance = app;
    void import("firebase/app-check").then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      initializeAppCheck(appInstance, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    });
  }
}

export const firebaseAuth = auth;
export const firebaseDb = db;

let provisioning: Auth | null = null;

/**
 * App secundaria para dar de alta cuentas sin cerrar la sesión de Dirección
 * (mismo enfoque que `activate-provisioning` en iOS). Usa persistencia en
 * memoria para que la cuenta recién creada nunca quede guardada en el navegador.
 */
export function provisioningAuth(): Auth {
  if (!firebaseConfigured) throw new Error("Firebase no está configurado.");
  if (provisioning) return provisioning;
  const name = "activate-provisioning";
  const existing = getApps().find((a) => a.name === name);
  const secondary = existing ?? initializeApp(firebaseConfig, name);
  provisioning = existing ? getAuth(secondary) : initializeAuth(secondary, { persistence: inMemoryPersistence });
  provisioning.languageCode = "es";
  return provisioning;
}
