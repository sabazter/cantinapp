export const metadata = { title: "Sin conexión — CantinApp" };

export default function OfflinePage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center p-8">
      <div className="rounded-full bg-muted p-6">
        <svg
          className="h-12 w-12 text-muted-foreground"
          fill="none" stroke="currentColor" strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round" strokeLinejoin="round"
            d="M3 3l18 18M8.111 8.111A7.5 7.5 0 0 0 4.5 12a7.5 7.5 0 0 0 12.49 5.6M10.5 10.5A3.75 3.75 0 0 1 15 14.25M12 20.25a.75.75 0 0 1 0-1.5.75.75 0 0 1 0 1.5z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        No hay conexión a internet. Puedes seguir registrando ventas en la caja —
        se sincronizarán automáticamente cuando vuelva la conexión.
      </p>
      <a
        href="/caja"
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Ir a la caja
      </a>
    </div>
  );
}
