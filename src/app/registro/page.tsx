"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, ChevronLeft, UserPlus, User, Users } from "lucide-react";

// ── Schemas ───────────────────────────────────────────────────────────────────

const repSchema = z.object({
  nombre:          z.string().min(2, "Mínimo 2 caracteres").max(100),
  email:           z.string().email("Email inválido"),
  telefono:        z.string().max(20).optional(),
  password:        z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string().min(1, "Requerido"),
}).refine(d => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

const alumnoSchema = z.object({
  nombre:  z.string().min(2, "Mínimo 2 caracteres").max(100),
  curso:   z.string().min(1, "Requerido").max(20),
  seccion: z.string().max(10).optional(),
  cedula:  z.string().max(20).optional(),
});

type RepForm    = z.infer<typeof repSchema>;
type AlumnoForm = z.infer<typeof alumnoSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

const STEPS = ["Tu cuenta", "Titular", "Listo"];

export default function RegistroPage() {
  const router = useRouter();
  const [step,         setStep]         = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [paraMiMismo,  setParaMiMismo]  = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState<"representante" | "profesor">("representante");

  const repForm = useForm<RepForm>({
    resolver: zodResolver(repSchema),
    defaultValues: { nombre: "", email: "", telefono: "", password: "", confirmPassword: "" },
  });

  const alumnoForm = useForm<AlumnoForm>({
    resolver: zodResolver(alumnoSchema),
    defaultValues: { nombre: "", curso: "", seccion: "", cedula: "" },
  });

  async function onStep0(values: RepForm) {
    setError(null);
    if (paraMiMismo) {
      alumnoForm.setValue("nombre", values.nombre);
    }
    setStep(1);
  }

  async function onStep1(values: AlumnoForm) {
    setError(null);
    setLoading(true);

    const repValues = repForm.getValues();

    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre:   repValues.nombre,
          email:    repValues.email,
          password: repValues.password,
          telefono: repValues.telefono || undefined,
          rol:      tipoRegistro,
          alumno: {
            nombre:  values.nombre,
            curso:   values.curso,
            seccion: values.seccion || undefined,
            cedula:  values.cedula  || undefined,
          },
        }),
      });

      if (!res.ok) {
        const e = await res.json();
        setError(e.error ?? "Error al registrar. Intenta de nuevo.");
        return;
      }

      setStep(2);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CantinApp</h1>
          <p className="text-gray-500 mt-1 text-sm">Crea tu cuenta de representante</p>
        </div>

        {/* Progress */}
        {step < 2 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  i <= step ? "text-primary" : "text-muted-foreground"
                }`}>
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs border-2 transition-colors ${
                    i < step  ? "bg-primary border-primary text-white" :
                    i === step ? "border-primary text-primary" :
                                 "border-muted-foreground/30 text-muted-foreground"
                  }`}>
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className="hidden sm:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-6 ${i < step ? "bg-primary" : "bg-muted-foreground/20"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 0 — Datos del representante */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Tu cuenta</CardTitle>
              </div>
              <CardDescription>Ingresa tus datos de acceso</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={repForm.handleSubmit(onStep0)} className="space-y-4">
                {/* Tipo de cuenta */}
                <div className="space-y-1.5">
                  <Label>Tipo de cuenta</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoRegistro("representante");
                        setParaMiMismo(false);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        tipoRegistro === "representante"
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-input bg-transparent hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      Representante
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoRegistro("profesor");
                        setParaMiMismo(true);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        tipoRegistro === "profesor"
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-input bg-transparent hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      Profesor / Personal
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre completo</Label>
                  <Input
                    id="nombre"
                    placeholder="María García"
                    {...repForm.register("nombre")}
                  />
                  {repForm.formState.errors.nombre && (
                    <p className="text-xs text-destructive">{repForm.formState.errors.nombre.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    autoComplete="email"
                    {...repForm.register("email")}
                  />
                  {repForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{repForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telefono">Teléfono / WhatsApp (opcional)</Label>
                  <Input
                    id="telefono"
                    type="tel"
                    placeholder="+58 412 000 0000"
                    {...repForm.register("telefono")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    {...repForm.register("password")}
                  />
                  {repForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{repForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...repForm.register("confirmPassword")}
                  />
                  {repForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">{repForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                {/* ¿Para quién es la cuenta? */}
                {tipoRegistro === "representante" && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      ¿Para quién es la cuenta en la cantina?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setParaMiMismo(false)}
                        className={`flex flex-col items-center gap-1 rounded-md border-2 px-3 py-2 text-sm transition-colors ${
                          !paraMiMismo
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-muted text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <Users className="h-4 w-4" />
                        Para mi hijo/a
                      </button>
                      <button
                        type="button"
                        onClick={() => setParaMiMismo(true)}
                        className={`flex flex-col items-center gap-1 rounded-md border-2 px-3 py-2 text-sm transition-colors ${
                          paraMiMismo
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-muted text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <User className="h-4 w-4" />
                        Para mí mismo
                      </button>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full gap-2">
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  ¿Ya tienes cuenta?{" "}
                  <Link href="/login" className="text-primary underline hover:no-underline">
                    Inicia sesión
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 1 — Titular de la cuenta */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {tipoRegistro === "profesor"
                  ? <User className="h-5 w-5 text-primary" />
                  : paraMiMismo
                    ? <User className="h-5 w-5 text-primary" />
                    : <Users className="h-5 w-5 text-primary" />}
                <CardTitle className="text-xl">
                  {tipoRegistro === "profesor" ? "Datos del Profesor" : "Titular de la cuenta"}
                </CardTitle>
              </div>
              <CardDescription>
                {tipoRegistro === "profesor"
                  ? "Configura tu perfil de consumo en la cantina. Tu cuenta estará inactiva por defecto hasta que un administrador la apruebe."
                  : paraMiMismo
                    ? "Tu propia cuenta de consumidor en la cantina. El crédito queda desactivado hasta que el administrador lo habilite."
                    : "Cuenta del consumidor en la cantina (puede ser tu hijo/a u otro familiar). El crédito queda desactivado hasta que el administrador lo habilite."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={alumnoForm.handleSubmit(onStep1)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="alumno-nombre">
                    {paraMiMismo ? "Tu nombre completo" : "Nombre completo del titular"}
                  </Label>
                  <Input
                    id="alumno-nombre"
                    placeholder="Juan García"
                    {...alumnoForm.register("nombre")}
                  />
                  {alumnoForm.formState.errors.nombre && (
                    <p className="text-xs text-destructive">{alumnoForm.formState.errors.nombre.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="curso">Curso / Grado</Label>
                    <Input
                      id="curso"
                      placeholder="3ro A"
                      {...alumnoForm.register("curso")}
                    />
                    {alumnoForm.formState.errors.curso && (
                      <p className="text-xs text-destructive">{alumnoForm.formState.errors.curso.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seccion">Sección (opcional)</Label>
                    <Input
                      id="seccion"
                      placeholder="A"
                      {...alumnoForm.register("seccion")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cedula">Cédula (opcional)</Label>
                  <Input
                    id="cedula"
                    placeholder="V-12.345.678"
                    {...alumnoForm.register("cedula")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se almacena cifrada. Solo visible para el administrador.
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setStep(0)}
                    disabled={loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Atrás
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Registrando…" : "Crear cuenta"}
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Al registrarte aceptas nuestra{" "}
                  <Link href="/privacidad" className="underline hover:no-underline">
                    política de privacidad
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Éxito */}
        {step === 2 && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-5">
              <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
              <div>
                <h2 className="text-xl font-bold">¡Cuenta creada!</h2>
                <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
                  Revisa tu correo para verificar tu email.
                  {tipoRegistro === "profesor"
                    ? " Una vez verificado, un administrador deberá aprobar y activar tu cuenta para que puedas iniciar sesión."
                    : " Luego podrás ingresar al portal con tus credenciales."}
                </p>
              </div>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => router.push("/login")}>
                  Ir al inicio de sesión
                </Button>
                <p className="text-xs text-muted-foreground">
                  {tipoRegistro === "profesor"
                    ? "Tu cuenta estará inactiva hasta que el administrador valide tu registro."
                    : "El crédito está desactivado por defecto. El administrador lo habilitará una vez verifique los datos."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
