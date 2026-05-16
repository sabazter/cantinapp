"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Search } from "lucide-react";

const schema = z.object({
  alumnoId:   z.string().min(1, "Seleccione un alumno"),
  montoUsd:   z.number().positive("Ingrese un monto válido"),
  metodo:     z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia: z.string().max(100).optional(),
  banco:      z.string().max(60).optional(),
});

type Form = z.infer<typeof schema>;

const METODO_LABEL: Record<string, string> = {
  efectivo_usd:  "Efectivo USD",
  efectivo_bs:   "Efectivo Bs",
  pago_movil:    "Pago Móvil",
  transferencia: "Transferencia",
};

export default function VendedorAbonosPage() {
  const [alumnoSearch, setAlumnoSearch]     = useState("");
  const [alumnoResults, setAlumnoResults]   = useState<{ id: string; nombre: string; curso: string }[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<{ id: string; nombre: string } | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [success, setSuccess]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { metodo: "efectivo_usd" },
  });

  useEffect(() => {
    if (alumnoSearch.length < 2) { setAlumnoResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/alumnos/buscar?q=${encodeURIComponent(alumnoSearch)}`);
      if (res.ok) setAlumnoResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [alumnoSearch]);

  async function onSubmit(values: Form) {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/abonos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Error al registrar");
      }
      setSuccess(true);
      form.reset({ metodo: "efectivo_usd" });
      setSelectedAlumno(null);
      setAlumnoSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registrar abono</h1>
        <p className="text-sm text-muted-foreground">El administrador debe confirmar el abono.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Abono registrado. Pendiente de confirmación del administrador.
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Alumno */}
        <div className="space-y-1.5">
          <Label>Alumno</Label>
          {selectedAlumno ? (
            <div className="flex gap-2">
              <span className="flex-1 border rounded px-3 py-2 text-sm font-medium">{selectedAlumno.nombre}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedAlumno(null); setAlumnoSearch(""); form.setValue("alumnoId", ""); }}>
                ×
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar alumno..."
                value={alumnoSearch}
                onChange={e => setAlumnoSearch(e.target.value)}
              />
              {alumnoResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                  {alumnoResults.map(a => (
                    <button
                      type="button"
                      key={a.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => { setSelectedAlumno(a); form.setValue("alumnoId", a.id); setAlumnoSearch(""); setAlumnoResults([]); }}
                    >
                      {a.nombre} — {a.curso}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {form.formState.errors.alumnoId && (
            <p className="text-xs text-destructive">{form.formState.errors.alumnoId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Monto USD</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="20.00"
            {...form.register("montoUsd", { valueAsNumber: true })}
          />
          {form.formState.errors.montoUsd && (
            <p className="text-xs text-destructive">{form.formState.errors.montoUsd.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Método de pago</Label>
          <Select onValueChange={(v: string | null) => form.setValue("metodo", (v ?? "efectivo_usd") as Form["metodo"])} defaultValue="efectivo_usd">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(METODO_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Referencia (opcional)</Label>
          <Input placeholder="Nº de operación" {...form.register("referencia")} />
        </div>

        <div className="space-y-1.5">
          <Label>Banco (opcional)</Label>
          <Input placeholder="Banco origen" {...form.register("banco")} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Registrando..." : "Registrar abono"}
        </Button>
      </form>
    </div>
  );
}
