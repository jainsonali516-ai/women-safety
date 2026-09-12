// Tulip service worker — cache-first for static assets, so the app shell loads instantly and
// cheaply once visited, without needing a hardcoded precache manifest (Next.js's build hashes
// its asset filenames on every build, which would make a static list go stale immediately).
const CACHE_NAME = "tulip-static-v2";

const STATIC_DESTINATIONS = new Set(["style", "script", "image", "font"]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API routes and navigations always go to the network — this app is data-driven, and a
  // stale cached API response would be actively misleading (e.g. an old route or contact
  // list). Only static build assets are served cache-first.
  if (url.pathname.startsWith("/api/")) return;

  const isStaticAsset = url.pathname.startsWith("/_next/static/") || STATIC_DESTINATIONS.has(request.destination);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return cached || Response.error();
      }
    })
  );
});
