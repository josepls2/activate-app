import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// GitHub Pages no permite cabeceras HTTP propias: la política de seguridad de
// contenido (CSP) se añade como <meta> sólo en la versión publicada (en
// desarrollo rompería la recarga en caliente de Vite).
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://www.google.com/recaptcha/",
  "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://*.firebaseapp.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function securityMeta(): Plugin {
  return {
    name: "activate-security-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`,
      );
    },
  };
}

export default defineConfig(() => {
  // En GitHub Pages la web vive en /<repositorio>/ (lo define el workflow).
  const rawBase = process.env.BASE_PATH ?? "/";
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return {
    base,
    plugins: [react(), securityMeta()],
    build: {
      target: "es2022",
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Firebase y React en trozos propios: se cachean entre versiones.
          manualChunks(id: string) {
            // Sólo se descargan si se usan (App Check, notificaciones push).
            if (/app-check|@firebase\/messaging|firebase\/messaging|@firebase\/installations/.test(id)) return undefined;
            if (id.includes("node_modules/@firebase/firestore") || id.includes("node_modules/firebase/firestore")) {
              return "firebase-firestore";
            }
            if (id.includes("node_modules/@firebase") || id.includes("node_modules/firebase")) return "firebase-core";
            if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
            return undefined;
          },
        },
      },
    },
  };
});
