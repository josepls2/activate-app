// Service worker: guarda la "carcasa" de la app para que abra rápido y sin
// conexión (los datos siempre vienen en vivo de Firebase) y muestra las
// notificaciones push. Funciona en la raíz o en /<repositorio>/ (GitHub Pages).
const CACHE = "activate-shell-v5";
const BASE = new URL("./", self.location).pathname; // "/" o "/repo/"
const SHELL = ["", "index.html", "manifest.webmanifest", "activate-logo.png", "icon-192.png"].map((f) => BASE + f);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // Navegación: siempre la última versión publicada (se revalida con el
  // servidor, sin esperar a la caché de 10 min de GitHub Pages); carcasa en
  // caché si no hay conexión.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request.url, { cache: "no-cache", credentials: "same-origin" }).catch(() =>
        caches.match(BASE + "index.html"),
      ),
    );
    return;
  }

  // Recursos estáticos con hash: caché primero.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith(BASE + "assets/")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

// ---------- Notificaciones push (Firebase Cloud Messaging) ----------
// El notificador envía `data: { title, body, url, tag }` con url tipo "#sessions".

function appUrl(raw) {
  const value = typeof raw === "string" ? raw : "";
  // Admite "#chat", "/#chat" o rutas relativas; siempre dentro de la app.
  const relative = value.replace(/^\/+/, "");
  const target = new URL(relative, self.registration.scope);
  return target.origin === self.location.origin ? target.href : self.registration.scope;
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : "" } };
  }
  const notification = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(notification.title || data.title || "Activate", {
      body: notification.body || data.body || "",
      icon: BASE + "icon-192.png",
      badge: BASE + "icon-192.png",
      tag: data.tag || undefined,
      data: { url: appUrl(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = appUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
