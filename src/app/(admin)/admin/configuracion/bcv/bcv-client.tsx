"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, TrendingUp, AlertCircle } from "lucide-react";

interface TasaActiva {
  tasa: number;
  fecha: string;
  fuente: "automatica" | "manual";
}

interface HistorialEntry {
  id: string;
  fecha: string;
  tasa_usd_bs: string;
  fuente: "automatica" | "manual";
  created_at: string;
}

const overrideSchema = z.object({
  tasa:  z.number().positive("Debe ser mayor a 0"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").optional(),
});

type OverrideForm = z.infer<typeof overrideSchema>;

export function BcvClient() {
  const [activa, setActiva]       = useState<TasaActiva | null>(null);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const form = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10) },
  });

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bcv");
      if (!res.ok) throw new Error("Error al cargar tasa");
      const json = await res.json();
      setActiva(json.activa);
      setHistorial(json.historial);
    } catch {
      setError("No se pudo cargar la tasa BCV");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function onSubmit(values: OverrideForm) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bcv", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Error al guardar");
      }
      setModalOpen(false);
      form.reset({ fecha: new Date().toISOString().slice(0, 10) });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const formatTasa = (tasa: number) =>
    new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(tasa);

  const formatFecha = (fecha: string) =>
    new Date(fecha + "T12:00:00").toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasa BCV</h1>
          <p className="text-muted-foreground text-sm">Tasa oficial USD/Bs del Banco Central de Venezuela</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Override manual
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tasa activa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasa activa</CardTitle>
          <CardDescription>Tasa vigente para el día de hoy</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-16 animate-pulse rounded bg-muted" />
          ) : activa ? (
            <div className="flex items-end gap-4">
              <div>
                <p className="text-4xl font-bold tabular-nums">
                  Bs {formatTasa(activa.tasa)}
                </p>
                <p className="text-muted-foreground text-sm mt-1">por 1 USD</p>
              </div>
              <div className="mb-1 space-y-1">
                <Badge variant={activa.fuente === "manual" ? "secondary" : "outline"}>
                  {activa.fuente === "manual" ? "Override manual" : "BCV automática"}
                </Badge>
                <p className="text-xs text-muted-foreground">{formatFecha(activa.fecha)}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin tasa registrada para hoy.</p>
          )}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de tasas</CardTitle>
          <CardDescription>Últimas 30 entradas</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Tasa USD/Bs</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Sin historial disponible
                  </TableCell>
                </TableRow>
              ) : (
                historial.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatFecha(entry.fecha)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatTasa(Number(entry.tasa_usd_bs))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.fuente === "manual" ? "secondary" : "outline"} className="text-xs">
                        {entry.fuente === "manual" ? "Manual" : "Automática"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal override manual */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Override manual de tasa</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tasa">Tasa USD/Bs</Label>
              <Input
                id="tasa"
                type="number"
                step="0.0001"
                placeholder="47.1200"
                {...form.register("tasa", { valueAsNumber: true })}
              />
              {form.formState.errors.tasa && (
                <p className="text-xs text-destructive">{form.formState.errors.tasa.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha">Fecha (opcional)</Label>
              <Input
                id="fecha"
                type="date"
                {...form.register("fecha")}
              />
              <p className="text-xs text-muted-foreground">Deja en blanco para usar la fecha de hoy</p>
              {form.formState.errors.fecha && (
                <p className="text-xs text-destructive">{form.formState.errors.fecha.message}</p>
              )}
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
