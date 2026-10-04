// Notificaciones de la web app.
//
// - Con la app abierta: el store detecta cambios en Firestore y llama a
//   `systemNotify` (aviso del sistema si la pestaña está en segundo plano).
// - Con la app cerrada: push real con Firebase Cloud Messaging. Este módulo
//   registra el dispositivo en users/{uid}/pushTokens; el envío lo hace el
//   notificador (../notifier), porque el plan Spark no permite Cloud Functions.
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseDb } from "./firebase";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

export type PushState =
  | "unsupported" // el navegador no tiene notificaciones
  | "needs-install" // iPhone/iPad: hay que añadirla a la pantalla de inicio
  | "denied" // el usuario las bloqueó en el navegador
  | "off"
  | "foreground" // permitidas, pero sin push (falta VITE_FCM_VAPID_KEY o FCM no disponible)
  | "on"; // push activado en este dispositivo

export const pushConfigured = Boolean(VAPID_KEY);

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function storageKey(uid: string) {
  return `activate.push.${uid}`;
}

function readLocal(uid: string): string | null {
  try {
    return localStorage.getItem(storageKey(uid));
  } catch {
    return null;
  }
}

function writeLocal(uid: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(storageKey(uid));
    else localStorage.setItem(storageKey(uid), value);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function pushState(uid: string): PushState {
  if (!("Notification" in window)) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const local = readLocal(uid);
  if (Notification.permission === "granted" && local) return local === "foreground" ? "foreground" : "on";
  return "off";
}

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Debe llamarse desde un toque del usuario (requisito de Safari). */
export async function enablePush(uid: string): Promise<{ state: PushState; message: string }> {
  if (!("Notification" in window)) {
    return isIos() && !isStandalone()
      ? { state: "needs-install", message: "En el iPhone, añade la app a la pantalla de inicio para recibir avisos." }
      : { state: "unsupported", message: "Este navegador no admite notificaciones." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { state: "denied", message: "Has bloqueado las notificaciones. Actívalas en los ajustes del navegador." };
  }

  if (!VAPID_KEY || !firebaseDb || !("serviceWorker" in navigator) || import.meta.env.DEV) {
    writeLocal(uid, "foreground");
    return { state: "foreground", message: "Avisos activados mientras la app esté abierta." };
  }

  try {
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) {
      writeLocal(uid, "foreground");
      return { state: "foreground", message: "Avisos activados mientras la app esté abierta." };
    }
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) throw new Error("Sin token");
    const tokenId = await sha256(token);
    await setDoc(doc(firebaseDb, "users", uid, "pushTokens", tokenId), {
      token,
      userAgent: navigator.userAgent.slice(0, 300),
      updatedAt: serverTimestamp(),
    });
    writeLocal(uid, tokenId);
    return { state: "on", message: "Notificaciones activadas en este dispositivo." };
  } catch (error) {
    console.warn("[Activate] push", error);
    writeLocal(uid, "foreground");
    return {
      state: "foreground",
      message: "No se ha podido activar el push; recibirás avisos mientras la app esté abierta.",
    };
  }
}

export async function disablePush(uid: string): Promise<void> {
  const tokenId = readLocal(uid);
  writeLocal(uid, null);
  if (!tokenId || tokenId === "foreground" || !firebaseDb) return;
  try {
    await deleteDoc(doc(firebaseDb, "users", uid, "pushTokens", tokenId));
    const { getMessaging, deleteToken, isSupported } = await import("firebase/messaging");
    if (await isSupported()) await deleteToken(getMessaging());
  } catch (error) {
    console.warn("[Activate] push off", error);
  }
}

/** Al cerrar sesión: el dispositivo deja de recibir push de esa cuenta. */
export async function forgetDevice(uid: string) {
  await disablePush(uid);
}

/**
 * Aviso del sistema con la app abierta pero en segundo plano. Si la pestaña
 * está visible no hace nada: ya se muestra el aviso dentro de la app.
 */
export async function systemNotify(uid: string, title: string, body: string, tab: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!readLocal(uid) || document.visibilityState === "visible") return;
  const options: NotificationOptions = {
    body,
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icon-192.png`,
    tag,
    data: { url: `#${tab}` },
  };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        window.location.hash = `#${tab}`;
        notification.close();
      };
    }
  } catch {
    /* sin permiso o sin soporte */
  }
}
