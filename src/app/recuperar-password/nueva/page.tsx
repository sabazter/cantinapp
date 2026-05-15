"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function NuevaPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirmar) { setError("Las contraseñas no coinciden"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/recuperar-password/nueva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        const data = await res.json();
        setError(data.error ?? "Enlace inválido o expirado");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-red-600">
        Enlace inválido.{" "}
        <Link href="/recuperar-password" className="underline">Solicitar uno nuevo</Link>
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva contraseña</CardTitle>
        <CardDescription>Elige una contraseña segura de al menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            Contraseña actualizada. Redirigiendo al inicio de sesión…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmar">Confirmar contraseña</Label>
              <Input
                id="confirmar"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function NuevaPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
          <NuevaPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
