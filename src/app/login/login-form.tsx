"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const ROLE_REDIRECTS: Record<string, string> = {
  admin:         "/admin/dashboard",
  superadmin:    "/admin/dashboard",
  vendedor:      "/caja",
  representante: "/portal",
  directivo:     "/reportes",
};

export function LoginForm() {
  const router = useRouter();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [totp,     setTotp]     = useState("");
  const [step,     setStep]     = useState<"credentials" | "mfa">("credentials");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) { setError(result.error.issues[0].message); return; }

    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });

      if (res?.error === "mfa_required") {
        setStep("mfa");
        return;
      }
      handleSignInResult(res?.ok ?? false, res?.error ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (totp.length !== 6) { setError("El código debe tener 6 dígitos"); return; }

    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, totp, redirect: false });
      if (res?.error === "mfa_invalid") {
        setError("Código incorrecto. Intenta de nuevo.");
        return;
      }
      handleSignInResult(res?.ok ?? false, res?.error ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignInResult(ok: boolean, error: string | null) {
    if (!ok) {
      if (error === "bloqueado_temporal")   setError("Cuenta bloqueada temporalmente. Intenta en 15 minutos.");
      else if (error === "bloqueado_permanente") setError("Cuenta bloqueada. Contacta al administrador.");
      else setError("Email o contraseña incorrectos.");
      return;
    }
    const sessionRes = await fetch("/api/auth/session");
    const session    = await sessionRes.json();
    const rol        = session?.user?.rol ?? "";
    router.push(ROLE_REDIRECTS[rol] ?? "/");
    router.refresh();
  }

  if (step === "mfa") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Verificación en dos pasos</CardTitle>
          </div>
          <CardDescription>
            Ingresa el código de 6 dígitos de tu aplicación de autenticación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMfa} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="totp">Código MFA</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
                disabled={loading}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading || totp.length !== 6}>
              {loading ? "Verificando…" : "Verificar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => { setStep("credentials"); setTotp(""); setError(""); }}
            >
              Volver
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Iniciar sesión</CardTitle>
        <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCredentials} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/recuperar-password" className="underline hover:text-foreground">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="text-primary underline hover:no-underline">
              Regístrate
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/privacidad" className="hover:underline">
              Política de privacidad
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
