"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { contarVentasPendientes } from "@/lib/idb";

export function SwRegister() {
  const [offline,  setOffline]  = useState(false);
  const [pending,  setPending]  = useState(0);
  const [syncing,  setSyncing]  = useState(false);

  useEffect(() => {
    // Registrar SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => { /* SW no disponible en dev sin HTTPS */ });
    }

    // Estado de conexión
    const onOnline  = async () => {
      setOffline(false);
      setSyncing(true);
      // El SW maneja el sync; aquí solo actualizamos contador
      setTimeout(async () => {
        const count = await contarVentasPendientes().catch(() => 0);
        setPending(count);
        setSyncing(false);
      }, 2000);
    };
    const onOffline = () => setOffline(true);

    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(!navigator.onLine);

    // Revisar ventas pendientes al montar
    contarVentasPendientes().catch(() => 0).then(setPending);

    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline && pending === 0 && !syncing) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg border ${
        offline
          ? "bg-red-50 border-red-200 text-red-800"
          : syncing
          ? "bg-amber-50 border-amber-200 text-amber-800"
          : "bg-green-50 border-green-200 text-green-700"
      }`}
    >
      {offline ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Sin conexión — las ventas se guardarán localmente</span>
          {pending > 0 && (
            <span className="ml-1 rounded-full bg-red-200 px-1.5 text-xs tabular-nums">
              {pending}
            </span>
          )}
        </>
      ) : syncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
          <span>Sincronizando ventas pendientes...</span>
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>{pending} venta{pending !== 1 ? "s" : ""} pendiente{pending !== 1 ? "s" : ""} de sincronizar</span>
        </>
      )}
    </div>
  );
}
