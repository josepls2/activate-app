import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

async function boot() {
  // Demo de presentación (npm run build:demo): un único HTML con datos ficticios.
  if (import.meta.env.VITE_SHOWCASE === "1") {
    const { startShowcase } = await import("./showcase");
    startShowcase();
    return;
  }

  // Modo demo sólo en desarrollo (npm run dev): http://127.0.0.1:5173/?demo=client
  // Nunca se incluye en la versión publicada.
  if (import.meta.env.DEV) {
    const role = new URLSearchParams(window.location.search).get("demo");
    if (role) {
      const { loadDemo } = await import("./lib/demo");
      loadDemo(role);
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      const base = import.meta.env.BASE_URL;
      const hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker
        .register(`${base}sw.js`, { scope: base, updateViaCache: "none" })
        .then((registration) => {
          // Al volver a la app (p. ej. desde la pantalla de inicio) busca versión nueva.
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
          });
        })
        .catch(() => undefined);
      // Cuando se publica una versión nueva, se recarga una vez para usarla.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    });
  }
}

void boot();
