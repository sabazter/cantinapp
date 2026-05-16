"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, RefreshCw, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AbonoRow {
  id: string;
  monto_usd: string;
  monto_bs: string | null;
  metodo: string;
  banco: string | null;
  estado: "pendiente" | "confirmado" | "rechazado";
  created_at: string;
  confirmado_at: string | null;
  cuentas_alumnos: {
    alumno_id: string;
    alumnos: { id: string; nombre: string; curso: string } | null;
  } | null;
}

const rechazarSchema = z.object({
  motivo: z.string().min(3, "Mínimo 3 caracteres").max(300),
});

const nuevoAbonoSchema = z.object({
  alumnoId:   z.string().min(1, "Seleccione un alumno"),
  montoUsd:   z.number().positive("Debe ser mayor a 0"),
  metodo:     z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia: z.string().max(100).optional(),
  banco:      z.string().max(60).optional(),
});

type RechazarForm  = z.infer<typeof rechazarSchema>;
type NuevoForm     = z.infer<typeof nuevoAbonoSchema>;

const METODO_LABEL: Record<string, string> = {
  efectivo_usd: "Efectivo USD",
  efectivo_bs:  "Efectivo Bs",
  pago_movil:   "Pago Móvil",
  transferencia: "Transferencia",
};

export function AbonosClient() {
  const [abonos, setAbonos]       = useState<AbonoRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"pendiente" | "confirmado" | "rechazado">("pendiente");
  const [error, setError]         = useState<string | null>(null);

  const [modalRechazar, setModalRechazar] = useState(false);
  const [modalNuevo, setModalNuevo]       = useState(false);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);
  const [actionErr, setActionErr]         = useState<string | null>(null);

  // Alumno search for new abono
  const [alumnoSearch, setAlumnoSearch]   = useState("");
  const [alumnoResults, setAlumnoResults] = useState<{ id: string; nombre: string; curso: string }[]>([]);
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(null);
  const [selectedAlumnoName, setSelectedAlumnoName] = useState<string>("");

  const rechazarForm = useForm<RechazarForm>({ resolver: zodResolver(rechazarSchema) });
  const nuevoForm    = useForm<NuevoForm>({ resolver: zodResolver(nuevoAbonoSchema) });

  const fetchAbonos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/abonos?estado=${tab}`);
      if (!res.ok) throw new Error();
      setAbonos(await res.json());
    } catch {
      setError("No se pudieron cargar los abonos");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchAbonos(); }, [fetchAbonos]);

  // Alumno search debounced
  useEffect(() => {
    if (alumnoSearch.length < 2) { setAlumnoResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/alumnos/buscar?q=${encodeURIComponent(alumnoSearch)}`);
      if (res.ok) setAlumnoResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [alumnoSearch]);

  async function accionAbono(id: string, accion: "confirmar") {
    setSaving(true);
    try {
      await fetch(`/api/admin/abonos/${id}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accion }),
      });
      await fetchAbonos();
    } catch {
      setError("Error al procesar");
    } finally {
      setSaving(false);
    }
  }

  async function onRechazar(values: RechazarForm) {
    if (!selectedId) return;
    setSaving(true);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/abonos/${selectedId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accion: "rechazar", motivo: values.motivo }),
      });
      if (!res.ok) throw new Error();
      setModalRechazar(false);
      rechazarForm.reset();
      await fetchAbonos();
    } catch {
      setActionErr("Error al rechazar");
    } finally {
      setSaving(false);
    }
  }

  async function onNuevoAbono(values: NuevoForm) {
    setSaving(true);
    setActionErr(null);
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
      setModalNuevo(false);
      nuevoForm.reset();
      setSelectedAlumnoId(null);
      setSelectedAlumnoName("");
      setAlumnoSearch("");
      await fetchAbonos();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setSaving(false);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Abonos</h1>
          <p className="text-muted-foreground text-sm">Gestión de pagos de saldo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAbonos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => { setModalNuevo(true); setActionErr(null); nuevoForm.reset(); setSelectedAlumnoId(null); setSelectedAlumnoName(""); }}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar abono
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v: string) => setTab(v as "pendiente" | "confirmado" | "rechazado")}>
        <TabsList>
          <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
          <TabsTrigger value="confirmado">Confirmados</TabsTrigger>
          <TabsTrigger value="rechazado">Rechazados</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              {tab === "pendiente" && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : abonos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Sin abonos {tab === "pendiente" ? "pendientes" : tab === "confirmado" ? "confirmados" : "rechazados"}
                </TableCell>
              </TableRow>
            ) : (
              abonos.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.cuentas_alumnos?.alumnos?.nombre ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{a.cuentas_alumnos?.alumnos?.curso}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${Number(a.monto_usd).toFixed(2)}
                  </TableCell>
                  <TableCell>{METODO_LABEL[a.metodo] ?? a.metodo}</TableCell>
                  <TableCell className="text-xs">{fmtDate(a.created_at)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        a.estado === "confirmado" ? "default"
                          : a.estado === "rechazado" ? "destructive"
                          : "secondary"
                      }
                    >
                      {a.estado}
                    </Badge>
                  </TableCell>
                  {tab === "pendiente" && (
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={saving}
                        onClick={() => accionAbono(a.id, "confirmar")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" />
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setSelectedId(a.id); setModalRechazar(true); rechazarForm.reset(); setActionErr(null); }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1 text-destructive" />
                        Rechazar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal rechazar */}
      <Dialog open={modalRechazar} onOpenChange={setModalRechazar}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar abono</DialogTitle>
          </DialogHeader>
          <form onSubmit={rechazarForm.handleSubmit(onRechazar)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Motivo del rechazo</Label>
              <Input placeholder="Describe el motivo..." {...rechazarForm.register("motivo")} />
              {rechazarForm.formState.errors.motivo && (
                <p className="text-xs text-destructive">{rechazarForm.formState.errors.motivo.message}</p>
              )}
            </div>
            {actionErr && <p className="text-xs text-destructive">{actionErr}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalRechazar(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={saving}>
                {saving ? "Rechazando..." : "Rechazar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal nuevo abono */}
      <Dialog open={modalNuevo} onOpenChange={setModalNuevo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={nuevoForm.handleSubmit(onNuevoAbono)}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label>Alumno</Label>
              {selectedAlumnoId ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium border rounded px-3 py-1.5">{selectedAlumnoName}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedAlumnoId(null); setSelectedAlumnoName(""); setAlumnoSearch(""); nuevoForm.setValue("alumnoId", ""); }}>
                    ×
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar alumno..."
                    value={alumnoSearch}
                    onChange={e => setAlumnoSearch(e.target.value)}
                  />
                  {alumnoResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-40 overflow-y-auto">
                      {alumnoResults.map(a => (
                        <button
                          type="button"
                          key={a.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setSelectedAlumnoId(a.id);
                            setSelectedAlumnoName(a.nombre);
                            nuevoForm.setValue("alumnoId", a.id);
                            setAlumnoSearch("");
                            setAlumnoResults([]);
                          }}
                        >
                          {a.nombre} — {a.curso}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {nuevoForm.formState.errors.alumnoId && (
                <p className="text-xs text-destructive">{nuevoForm.formState.errors.alumnoId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto USD</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="20.00"
                  {...nuevoForm.register("montoUsd", { valueAsNumber: true })}
                />
                {nuevoForm.formState.errors.montoUsd && (
                  <p className="text-xs text-destructive">{nuevoForm.formState.errors.montoUsd.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select
                  onValueChange={(v) => nuevoForm.setValue("metodo", v as NuevoForm["metodo"])}
                  defaultValue="efectivo_usd"
                >
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
                <Input placeholder="Nº de operación" {...nuevoForm.register("referencia")} />
              </div>
              <div className="space-y-1.5">
                <Label>Banco (opcional)</Label>
                <Input placeholder="Banco origen" {...nuevoForm.register("banco")} />
              </div>
            </div>

            {actionErr && <p className="text-xs text-destructive">{actionErr}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalNuevo(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Registrando..." : "Registrar abono"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
