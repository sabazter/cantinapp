"use client";

const IDB_NAME  = "cantinapp-offline";
const IDB_STORE = "ventas-pendientes";
const SYNC_TAG  = "cantinapp-venta-sync";

interface VentaPendiente {
  id:        string;
  payload:   unknown;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function encolarVenta(payload: unknown): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.add({ id, payload, timestamp: Date.now() } as VentaPendiente);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });

  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
      .sync.register(SYNC_TAG);
  }

  return id;
}

export async function obtenerVentasPendientes(): Promise<VentaPendiente[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result as VentaPendiente[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function eliminarVentaPendiente(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function contarVentasPendientes(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req   = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
