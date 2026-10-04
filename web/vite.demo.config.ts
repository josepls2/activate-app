// Demo de presentación en un único HTML (sin Firebase ni datos reales):
//   npm run build:demo  →  dist-demo/index.html
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  define: { "import.meta.env.VITE_SHOWCASE": JSON.stringify("1") },
  build: { outDir: "dist-demo", target: "es2022", assetsInlineLimit: 100_000_000 },
});
