/* CantinApp Service Worker — offline-first para la caja */

const CACHE_NAME  = "cantinapp-v1";
const SYNC_TAG    = "cantinapp-venta-sync";
const IDB_NAME    = "cantinapp-offline";
const IDB_STORE   = "ventas-pendientes";

// ── Recursos a precachear ──────────────────────────────────────────────────────

const PRECACHE_URLS = [
  "/caja",
  "/login",
  "/offline",
];

// ── Install: precache shell ────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Si falla alguna URL durante install, no bloqueamos
      })
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar caches viejos ───────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ─────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar mismo origen
  if (url.origin !== self.location.origin) return;

  // Datos del inventario y BCV: network-first con cache fallback
  if (url.pathname === "/api/admin/inventario" || url.pathname.startsWith("/api/bcv")) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Assets estáticos: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API routes de escritura — no cachear
  if (url.pathname.startsWith("/api/")) return;

  // Páginas: network-first con fallback offline
  event.respondWith(networkFirstWithOfflineFallback(request));
});

// ── Strategies ─────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offlinePage = await caches.match("/offline");
    return offlinePage ?? new Response("Sin conexión", { status: 503 });
  }
}

// ── Background Sync: sincronizar ventas encoladas ─────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncVentasPendientes());
  }
});

async function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function syncVentasPendientes() {
  const db = await openIdb();

  const ventas = await new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });

  for (const venta of ventas) {
    try {
      const res = await fetch("/api/ventas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(venta.payload),
      });

      if (res.ok) {
        const tx    = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.delete(venta.id);
      }
    } catch {
      // Mantenemos en cola para el próximo sync
    }
  }
}

// ── Push notifications (futuro) ───────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/caja";
  event.waitUntil(clients.openWindow(url));
});
