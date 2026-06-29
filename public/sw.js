const CACHE_NAME = "house-of-edtech-cache-v1";
const ASSETS_TO_CACHE = [
  "/next.svg",
  "/vercel.svg",
  "/globe.svg",
  "/file.svg",
  "/window.svg",
   "/logo.svg",
];

// Install Event - Pre-caches core shells
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Pre-caching offline application assets");
      // Cache core assets
      cache.addAll(ASSETS_TO_CACHE).catch(err => console.error("Error pre-caching core assets:", err));
      
      // Cache pages safely (ignoring redirects/failures)
      const pagesToCache = ["/", "/dashboard", "/login", "/signup"];
      return Promise.all(
        pagesToCache.map((page) => {
          return fetch(page)
            .then((res) => {
              if (res.status === 200) {
                return cache.put(page, res);
              }
            })
            .catch((err) => console.log(`Failed to pre-cache page ${page}:`, err));
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate Event - Prunes old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Pruning obsolete offline cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Core offline proxy behavior
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // We do not intercept API route requests or WebSocket traffic
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next/webpack-hmr")) {
    return;
  }

  const isDev = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (isDev) {
    // Development mode: use Network-First strategy for all requests to ensure fast refresh/hot-reloading
    // works normally while online, but falls back to cache when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseCopy);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
              const requestUrl = new URL(request.url);
              if (requestUrl.pathname.startsWith("/documents/")) {
                return caches.match("/dashboard");
              }
              return caches.match("/dashboard").then((fallback) => {
                if (fallback) return fallback;
                return caches.match("/");
              });
            }
            return new Response("Offline resource not cached", { status: 503, statusText: "Offline" });
          });
        })
    );
    return;
  }

  // Network-first, falling back to cache strategy for document pages
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            const requestUrl = new URL(request.url);
            if (requestUrl.pathname.startsWith("/documents/")) {
              return caches.match("/dashboard");
            }
            return caches.match("/dashboard").then((fallback) => {
              if (fallback) return fallback;
              return caches.match("/");
            });
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate strategy for static JS / CSS bundles, images, and fonts
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
