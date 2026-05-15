"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MfaSetupClient() {
  const { data: session, update } = useSession();
  const [qr,      setQr]      = useState<string | null>(null);
  const [secret,  setSecret]  = useState<string | null>(null);
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);

  // Fase 1: generar QR
  const generarQr = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa");
      if (!res.ok) { toast.error("Error al generar el QR"); return; }
      const { qr: qrData, secret: sec } = await res.json();
      setQr(qrData);
      setSecret(sec);
    } finally {
      setLoading(false);
    }
  };

  // Fase 2: verificar código y activar
  const activarMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error("El código debe tener 6 dígitos"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        toast.success("MFA activado correctamente");
        setQr(null);
        setSecret(null);
        setCode("");
        await update();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Código incorrecto");
      }
    } finally {
      setLoading(false);
    }
  };

  // Desactivar MFA
  const desactivarMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error("El código debe tener 6 dígitos"); return; }
    if (!confirm("¿Seguro que quieres desactivar la autenticación en dos pasos?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        toast.success("MFA desactivado");
        setCode("");
        await update();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Código incorrecto");
      }
    } finally {
      setLoading(false);
    }
  };

  // Estado actual del usuario (nota: session no incluye mfaHabilitado — usamos una flag local)
  // Para obtener el estado real consultamos la API al montar
  const [mfaActivo, setMfaActivo] = useState<boolean | null>(null);

  useState(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        // La session estándar no expone mfa_habilitado; lo leeremos de la API de usuario
        fetch("/api/admin/usuarios")
          .then((r) => r.json())
          .then((usuarios: { id: string; mfa_habilitado: boolean }[]) => {
            const yo = usuarios.find((u) => u.id === s?.user?.id);
            setMfaActivo(yo?.mfa_habilitado ?? false);
          })
          .catch(() => setMfaActivo(false));
      });
  });

  if (mfaActivo === null) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  // ── MFA ya activo — mostrar opción de desactivar ───────────────────────────
  if (mfaActivo && !qr) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <CardTitle>MFA activo</CardTitle>
          </div>
          <CardDescription>
            Tu cuenta está protegida con autenticación en dos pasos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={desactivarMfa} className="space-y-4">
            <div className="space-y-1">
              <Label>Código MFA para confirmar desactivación</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="text-center tracking-widest"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || code.length !== 6}
              className="gap-2"
            >
              <ShieldOff className="h-4 w-4" />
              {loading ? "Desactivando..." : "Desactivar MFA"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // ── MFA no activo — mostrar setup ─────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
          <CardTitle>MFA no configurado</CardTitle>
        </div>
        <CardDescription>
          Configura la autenticación en dos pasos para mayor seguridad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!qr ? (
          <Button onClick={generarQr} disabled={loading}>
            {loading ? "Generando..." : "Configurar MFA"}
          </Button>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium">
                1. Escanea este código QR con Google Authenticator, Authy u otra app TOTP:
              </p>
              <div className="flex justify-center">
                <Image src={qr} alt="QR MFA" width={200} height={200} />
              </div>
              {secret && (
                <p className="text-xs text-muted-foreground text-center">
                  Clave manual: <span className="font-mono">{secret}</span>
                </p>
              )}
            </div>

            <form onSubmit={activarMfa} className="space-y-4">
              <div className="space-y-1">
                <Label>2. Ingresa el código generado para verificar:</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                  className="text-center text-xl tracking-widest"
                />
              </div>
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={loading || code.length !== 6}
              >
                <ShieldCheck className="h-4 w-4" />
                {loading ? "Activando..." : "Activar MFA"}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
