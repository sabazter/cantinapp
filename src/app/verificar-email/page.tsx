"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerificarEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token  = params.get("token");

  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!token) {
      setEstado("error");
      setMensaje("Token no proporcionado.");
      return;
    }

    fetch(`/api/auth/verificar-email?token=${encodeURIComponent(token)}`)
      .then(async r => {
        if (r.ok) {
          setEstado("ok");
        } else {
          const e = await r.json();
          setEstado("error");
          setMensaje(e.error ?? "El enlace es inválido o ha expirado.");
        }
      })
      .catch(() => {
        setEstado("error");
        setMensaje("Error de conexión. Intenta de nuevo.");
      });
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">CantinApp</h1>

        {estado === "cargando" && (
          <div className="space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground text-sm">Verificando tu correo…</p>
          </div>
        )}

        {estado === "ok" && (
          <div className="space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <p className="font-semibold text-lg">¡Correo verificado!</p>
              <p className="text-muted-foreground text-sm mt-1">
                Tu dirección de email ha sido confirmada correctamente.
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push("/portal")}>
              Ir al portal
            </Button>
          </div>
        )}

        {estado === "error" && (
          <div className="space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <p className="font-semibold text-lg">No se pudo verificar</p>
              <p className="text-muted-foreground text-sm mt-1">{mensaje}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => router.push("/portal")}>
              Volver al portal
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
