/**
 * Service Worker mínimo para que Chrome considere AI-Team instalable como PWA.
 *
 * Estrategia: network-first sin caché agresivo.
 * No cacheamos respuestas para evitar el dolor de caché vieja que tuvimos.
 * El SW solo existe para cumplir el criterio "installable" de Chrome.
 */

const CACHE_VERSION = "v1";

self.addEventListener("install", (event) => {
  // Activar inmediatamente sin esperar
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Tomar control de todas las pestañas abiertas inmediatamente
  event.waitUntil(self.clients.claim());

  // Limpiar caches viejos (no usamos ninguno, pero por si acaso)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  // Network-first puro: pedimos siempre a red, si falla devolvemos error.
  // No cacheamos. El navegador hace su caché HTTP normal.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("Sin conexión", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }),
  );
});
