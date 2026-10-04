import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the private Activate admin shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="es"/i);
  assert.match(html, /<title>Dirección · Activate Personal Training<\/title>/i);
  assert.match(html, /Panel no configurado|Comprobando acceso seguro/);
  assert.doesNotMatch(html, /direccio@activate\.demo|demo123/);
  assert.match(html, /name="robots" content="noindex, nofollow"/i);
  assert.match(html, /property="og:image"[^>]*content="https?:\/\/[^\"]+\/og-panel\.png"/i);
  assert.doesNotMatch(html, /codex-preview/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
});

test("keeps access and Firebase configuration explicit", async () => {
  const [page, layout, firebase, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /profile\.data\(\)\.role !== "boss"/);
  assert.match(page, /createUserWithEmailAndPassword/);
  assert.match(page, /clientDocuments/);
  assert.match(page, /normalizedDni/);
  assert.match(page, /staffDirectory/);
  assert.match(page, /activeView/);
  assert.doesNotMatch(page, /direccio@activate\.demo|demo123/);
  assert.doesNotMatch(page, /Stripe|PayPal|tarjeta|precio/i);

  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
  assert.match(layout, /\/og-panel\.png/);

  assert.match(firebase, /NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
  assert.match(packageJson, /"firebase"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await access(new URL("../public/activate-logo.png", import.meta.url));
  await access(new URL("../public/activate-icon.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});
