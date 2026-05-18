"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, TrendingUp, KeyRound, Save, ExternalLink } from "lucide-react";

// ── Schemas ──────────────────────────────────────────────────────────────────

const cantinSchema = z.object({
  nombre:           z.string().min(1, "Requerido").max(100),
  escuela:          z.string().min(1, "Requerido").max(200),
  direccion:        z.string().max(300).optional(),
  limite_fiado_usd: z.number({ invalid_type_error: "Número requerido" }).min(0),
  umbral_deuda_usd: z.number({ invalid_type_error: "Número requerido" }).min(0),
  tasa_manual:      z.number({ invalid_type_error: "Número requerido" }).positive().nullable().optional(),
  notif_email:      z.boolean(),
  notif_whatsapp:   z.boolean(),
});

const pwdSchema = z.object({
  currentPassword: z.string().min(1, "Requerido"),
  newPassword:     z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string().min(1, "Requerido"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type CantinForm = z.infer<typeof cantinSchema>;
type PwdForm    = z.infer<typeof pwdSchema>;

// ── Component ────────────────────────────────────────────────────────────────

export function ConfiguracionClient() {
  const [loading, setLoading] = useState(true);

  const cantinForm = useForm<CantinForm>({
    resolver: zodResolver(cantinSchema),
    defaultValues: {
      nombre: "", escuela: "", direccion: "",
      limite_fiado_usd: 0, umbral_deuda_usd: 0,
      tasa_manual: null, notif_email: true, notif_whatsapp: false,
    },
  });

  const pwdForm = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  // Load cantina data
  useEffect(() => {
    fetch("/api/admin/configuracion")
      .then((r) => r.json())
      .then((data) => {
        cantinForm.reset({
          nombre:           data.nombre ?? "",
          escuela:          data.escuela ?? "",
          direccion:        data.direccion ?? "",
          limite_fiado_usd: Number(data.limite_fiado_usd ?? 0),
          umbral_deuda_usd: Number(data.umbral_deuda_usd ?? 0),
          tasa_manual:      data.tasa_manual ? Number(data.tasa_manual) : null,
          notif_email:      data.notif_email ?? true,
          notif_whatsapp:   data.notif_whatsapp ?? false,
        });
      })
      .catch(() => toast.error("Error al cargar configuración"))
      .finally(() => setLoading(false));
  }, [cantinForm]);

  async function onSaveCantina(values: CantinForm) {
    const res = await fetch("/api/admin/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success("Configuración guardada");
    } else {
      const e = await res.json();
      toast.error(e.error ?? "Error al guardar");
    }
  }

  async function onChangePassword(values: PwdForm) {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: values.currentPassword,
        newPassword:     values.newPassword,
      }),
    });
    if (res.ok) {
      toast.success("Contraseña actualizada");
      pwdForm.reset();
    } else {
      const e = await res.json();
      toast.error(e.error ?? "Error al cambiar contraseña");
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ajustes generales de la cantina y tu cuenta
        </p>
      </div>

      {/* ── Cantina settings ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Datos de la cantina</CardTitle>
          <CardDescription>Información general y parámetros operativos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={cantinForm.handleSubmit(onSaveCantina)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre de la cantina</Label>
                <Input id="nombre" {...cantinForm.register("nombre")} />
                {cantinForm.formState.errors.nombre && (
                  <p className="text-xs text-destructive">{cantinForm.formState.errors.nombre.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escuela">Escuela / Institución</Label>
                <Input id="escuela" {...cantinForm.register("escuela")} />
                {cantinForm.formState.errors.escuela && (
                  <p className="text-xs text-destructive">{cantinForm.formState.errors.escuela.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="direccion">Dirección (opcional)</Label>
              <Input id="direccion" {...cantinForm.register("direccion")} />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="limite_fiado_usd">Límite de fiado (USD)</Label>
                <Input
                  id="limite_fiado_usd"
                  type="number"
                  step="0.01"
                  {...cantinForm.register("limite_fiado_usd", { valueAsNumber: true })}
                />
                {cantinForm.formState.errors.limite_fiado_usd && (
                  <p className="text-xs text-destructive">{cantinForm.formState.errors.limite_fiado_usd.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="umbral_deuda_usd">Umbral de alerta deuda (USD)</Label>
                <Input
                  id="umbral_deuda_usd"
                  type="number"
                  step="0.01"
                  {...cantinForm.register("umbral_deuda_usd", { valueAsNumber: true })}
                />
                {cantinForm.formState.errors.umbral_deuda_usd && (
                  <p className="text-xs text-destructive">{cantinForm.formState.errors.umbral_deuda_usd.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tasa_manual">Tasa manual USD/Bs (opcional — sobreescribe BCV)</Label>
              <Input
                id="tasa_manual"
                type="number"
                step="0.0001"
                placeholder="Ej: 47.1200"
                {...cantinForm.register("tasa_manual", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              />
              <p className="text-xs text-muted-foreground">
                Deja vacío para usar la tasa automática del BCV
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Notificaciones</p>
              <label htmlFor="notif_email" className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">Notificaciones por email</span>
                <input
                  id="notif_email"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                  {...cantinForm.register("notif_email")}
                />
              </label>
              <label htmlFor="notif_whatsapp" className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">Notificaciones por WhatsApp</span>
                <input
                  id="notif_whatsapp"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                  {...cantinForm.register("notif_whatsapp")}
                />
              </label>
            </div>

            <Button type="submit" disabled={cantinForm.formState.isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {cantinForm.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Password change ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Cambiar contraseña</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={pwdForm.handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input id="currentPassword" type="password" {...pwdForm.register("currentPassword")} />
              {pwdForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">{pwdForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input id="newPassword" type="password" {...pwdForm.register("newPassword")} />
              {pwdForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{pwdForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <Input id="confirmPassword" type="password" {...pwdForm.register("confirmPassword")} />
              {pwdForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{pwdForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" variant="outline" disabled={pwdForm.formState.isSubmitting} className="gap-2">
              <KeyRound className="h-4 w-4" />
              {pwdForm.formState.isSubmitting ? "Cambiando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Links to sub-pages ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <Link href="/admin/configuracion/mfa" className="flex items-center gap-3 group">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Autenticación MFA</p>
                <p className="text-xs text-muted-foreground">Gestiona el segundo factor</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <Link href="/admin/configuracion/bcv" className="flex items-center gap-3 group">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Tasa BCV</p>
                <p className="text-xs text-muted-foreground">Historial y override manual</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
