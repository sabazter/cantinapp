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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Plus, Search, UserX, Pencil, Eye, QrCode, CreditCard, CreditCardIcon } from "lucide-react";
import Image from "next/image";

interface Alumno {
  id: string;
  nombre: string;
  curso: string;
  seccion: string | null;
  foto_url: string | null;
  qr_code: string | null;
  fiado_habilitado: boolean;
  limite_fiado_usd: string | null;
  activo: boolean;
  created_at: string;
  cuentas_alumnos: { saldo: string } | null;
}

interface AlumnoDetalle extends Alumno {
  cedula: string;
  consentimiento_ip: string | null;
  consentimiento_at: string | null;
}

const crearSchema = z.object({
  nombre:          z.string().min(1, "Requerido").max(100),
  cedula:          z.string().min(1, "Requerido").max(20),
  curso:           z.string().min(1, "Requerido").max(20),
  seccion:         z.string().max(10).optional(),
  limiteFiadoUsd:  z.number().min(0).optional(),
  consentimiento:  z.boolean().refine(v => v, "Debe confirmar el consentimiento"),
});

const editarSchema = z.object({
  nombre:          z.string().min(1, "Requerido").max(100),
  curso:           z.string().min(1, "Requerido").max(20),
  seccion:         z.string().max(10).optional(),
  fiadoHabilitado: z.boolean(),
  limiteFiadoUsd:  z.number().min(0).optional(),
});

type CrearForm  = z.infer<typeof crearSchema>;
type EditarForm = z.infer<typeof editarSchema>;

export function AlumnosClient() {
  const [alumnos, setAlumnos]         = useState<Alumno[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [cursoFilter, setCursoFilter] = useState("todos");
  const [cursos, setCursos]           = useState<string[]>([]);
  const [error, setError]             = useState<string | null>(null);

  // Modales
  const [modalCrear, setModalCrear]     = useState(false);
  const [modalEditar, setModalEditar]   = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [modalQr, setModalQr]           = useState(false);
  const [selected, setSelected]         = useState<Alumno | null>(null);
  const [detalle, setDetalle]           = useState<AlumnoDetalle | null>(null);
  const [saving, setSaving]             = useState(false);
  const [actionErr, setActionErr]       = useState<string | null>(null);

  const crearForm  = useForm<CrearForm>({ resolver: zodResolver(crearSchema) });
  const editarForm = useForm<EditarForm>({ resolver: zodResolver(editarSchema) });

  const fetchAlumnos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (cursoFilter !== "todos") params.set("curso", cursoFilter);
      const res = await fetch(`/api/admin/alumnos?${params}`);
      if (!res.ok) throw new Error();
      const data: Alumno[] = await res.json();
      setAlumnos(data);
      const uniqueCursos = Array.from(new Set(data.map(a => a.curso))).sort();
      setCursos(uniqueCursos);
    } catch {
      setError("No se pudieron cargar los alumnos");
    } finally {
      setLoading(false);
    }
  }, [search, cursoFilter]);

  useEffect(() => { fetchAlumnos(); }, [fetchAlumnos]);

  async function onCrear(values: CrearForm) {
    setSaving(true);
    setActionErr(null);
    try {
      const res = await fetch("/api/admin/alumnos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nombre:          values.nombre,
          cedula:          values.cedula,
          curso:           values.curso,
          seccion:         values.seccion,
          limiteFiadoUsd:  values.limiteFiadoUsd,
          consentimientoIp: "web-form",
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Error al crear");
      }
      setModalCrear(false);
      crearForm.reset();
      await fetchAlumnos();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Error al crear alumno");
    } finally {
      setSaving(false);
    }
  }

  async function onEditar(values: EditarForm) {
    if (!selected) return;
    setSaving(true);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/alumnos/${selected.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      setModalEditar(false);
      setSelected(null);
      await fetchAlumnos();
    } catch {
      setActionErr("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  }

  async function onDesactivar(alumno: Alumno) {
    if (!confirm(`¿Desactivar a ${alumno.nombre}? Esta acción puede revertirse.`)) return;
    try {
      await fetch(`/api/admin/alumnos/${alumno.id}`, { method: "DELETE" });
      await fetchAlumnos();
    } catch {
      setError("Error al desactivar alumno");
    }
  }

  async function verDetalle(alumno: Alumno) {
    setSelected(alumno);
    setModalDetalle(true);
    setDetalle(null);
    try {
      const res = await fetch(`/api/admin/alumnos/${alumno.id}`);
      if (res.ok) setDetalle(await res.json());
    } catch {}
  }

  function abrirEditar(alumno: Alumno) {
    setSelected(alumno);
    editarForm.reset({
      nombre:          alumno.nombre,
      curso:           alumno.curso,
      seccion:         alumno.seccion ?? "",
      fiadoHabilitado: alumno.fiado_habilitado,
      limiteFiadoUsd:  alumno.limite_fiado_usd ? Number(alumno.limite_fiado_usd) : undefined,
    });
    setModalEditar(true);
    setActionErr(null);
  }

  async function toggleFiado(alumno: Alumno) {
    const habilitar = !alumno.fiado_habilitado;
    const accion    = habilitar ? "habilitar" : "deshabilitar";
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el fiado para ${alumno.nombre}?`)) return;
    try {
      const res = await fetch(`/api/admin/alumnos/${alumno.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fiadoHabilitado: habilitar }),
      });
      if (!res.ok) throw new Error();
      await fetchAlumnos();
    } catch {
      setError(`Error al ${accion} el fiado`);
    }
  }

  const formatSaldo = (saldo: string | undefined) => {
    if (!saldo) return "$0.00";
    const n = Number(saldo);
    return n >= 0
      ? `$${n.toFixed(2)}`
      : `-$${Math.abs(n).toFixed(2)}`;
  };

  const saldoColor = (saldo: string | undefined) => {
    if (!saldo) return "";
    return Number(saldo) < 0 ? "text-red-600 font-semibold" : "text-green-700";
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alumnos</h1>
          <p className="text-muted-foreground text-sm">{alumnos.length} alumno(s) registrado(s)</p>
        </div>
        <Button onClick={() => { setModalCrear(true); setActionErr(null); crearForm.reset(); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo alumno
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={cursoFilter} onValueChange={(v) => setCursoFilter(v ?? "todos")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Curso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los cursos</SelectItem>
            {cursos.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Fiado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : alumnos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No se encontraron alumnos
                </TableCell>
              </TableRow>
            ) : (
              alumnos.map(alumno => (
                <TableRow key={alumno.id}>
                  <TableCell className="font-medium">{alumno.nombre}</TableCell>
                  <TableCell>
                    {alumno.curso}{alumno.seccion ? ` ${alumno.seccion}` : ""}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${saldoColor(alumno.cuentas_alumnos?.saldo)}`}>
                    {formatSaldo(alumno.cuentas_alumnos?.saldo)}
                  </TableCell>
                  <TableCell>
                    {alumno.fiado_habilitado ? (
                      <Badge variant="default" className="text-[10px] gap-1">
                        <CreditCard className="h-3 w-3" />
                        Habilitado
                        {alumno.limite_fiado_usd && ` · $${Number(alumno.limite_fiado_usd).toFixed(0)}`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        No habilitado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={alumno.activo ? "default" : "secondary"}>
                      {alumno.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => verDetalle(alumno)}>
                          <Eye className="mr-2 h-3.5 w-3.5" />
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirEditar(alumno)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleFiado(alumno)}>
                          <CreditCardIcon className="mr-2 h-3.5 w-3.5" />
                          {alumno.fiado_habilitado ? "Deshabilitar fiado" : "Habilitar fiado"}
                        </DropdownMenuItem>
                        {alumno.qr_code && (
                          <DropdownMenuItem onClick={() => { setSelected(alumno); setModalQr(true); }}>
                            <QrCode className="mr-2 h-3.5 w-3.5" />
                            Ver QR
                          </DropdownMenuItem>
                        )}
                        {alumno.activo && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDesactivar(alumno)}
                          >
                            <UserX className="mr-2 h-3.5 w-3.5" />
                            Desactivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal: Crear alumno */}
      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo alumno</DialogTitle>
          </DialogHeader>
          <form onSubmit={crearForm.handleSubmit(onCrear)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre completo</Label>
                <Input placeholder="Juan Pérez" {...crearForm.register("nombre")} />
                {crearForm.formState.errors.nombre && (
                  <p className="text-xs text-destructive">{crearForm.formState.errors.nombre.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Cédula</Label>
                <Input placeholder="V-12345678" {...crearForm.register("cedula")} />
                {crearForm.formState.errors.cedula && (
                  <p className="text-xs text-destructive">{crearForm.formState.errors.cedula.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Curso</Label>
                <Input placeholder="3°" {...crearForm.register("curso")} />
                {crearForm.formState.errors.curso && (
                  <p className="text-xs text-destructive">{crearForm.formState.errors.curso.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Sección (opcional)</Label>
                <Input placeholder="A" {...crearForm.register("seccion")} />
              </div>
              <div className="space-y-1.5">
                <Label>Límite de fiado USD</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="20.00"
                  {...crearForm.register("limiteFiadoUsd", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Consentimiento */}
            <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                Consentimiento del representante legal
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Al marcar esta casilla, confirmo que el representante ha dado su consentimiento
                para el registro de los datos del alumno en el sistema CantinApp.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  {...crearForm.register("consentimiento")}
                />
                <span className="text-xs font-medium">Consentimiento otorgado</span>
              </label>
              {crearForm.formState.errors.consentimiento && (
                <p className="text-xs text-destructive">{crearForm.formState.errors.consentimiento.message}</p>
              )}
            </div>

            {actionErr && <p className="text-xs text-destructive">{actionErr}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalCrear(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Crear alumno"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar alumno */}
      <Dialog open={modalEditar} onOpenChange={setModalEditar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar alumno — {selected?.nombre}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editarForm.handleSubmit(onEditar)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre completo</Label>
                <Input {...editarForm.register("nombre")} />
                {editarForm.formState.errors.nombre && (
                  <p className="text-xs text-destructive">{editarForm.formState.errors.nombre.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Curso</Label>
                <Input {...editarForm.register("curso")} />
              </div>
              <div className="space-y-1.5">
                <Label>Sección</Label>
                <Input {...editarForm.register("seccion")} />
              </div>
              <div className="col-span-2">
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Fiado habilitado</p>
                      <p className="text-xs text-muted-foreground">
                        El representante solicitó habilitar el crédito en cantina
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        {...editarForm.register("fiadoHabilitado")}
                      />
                      <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors
                        after:content-[''] after:absolute after:top-0.5 after:left-0.5
                        after:bg-white after:rounded-full after:h-4 after:w-4
                        after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                  {editarForm.watch("fiadoHabilitado") && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs">Límite de fiado USD (vacío = sin límite)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Sin límite"
                        className="h-8 text-sm"
                        {...editarForm.register("limiteFiadoUsd", { valueAsNumber: true })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {actionErr && <p className="text-xs text-destructive">{actionErr}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEditar(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalle */}
      <Dialog open={modalDetalle} onOpenChange={setModalDetalle}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle — {selected?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {!detalle ? (
              <div className="h-32 animate-pulse rounded bg-muted" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Cédula</p>
                    <p className="font-mono font-medium">{detalle.cedula}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Curso</p>
                    <p>{detalle.curso}{detalle.seccion ? ` ${detalle.seccion}` : ""}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Saldo</p>
                    <p className={`font-semibold ${saldoColor(detalle.cuentas_alumnos?.saldo)}`}>
                      {formatSaldo(detalle.cuentas_alumnos?.saldo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fiado</p>
                    {detalle.fiado_habilitado ? (
                      <p className="font-medium text-green-700">
                        Habilitado
                        {detalle.limite_fiado_usd
                          ? ` · límite $${Number(detalle.limite_fiado_usd).toFixed(2)}`
                          : " · sin límite"}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">No habilitado</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Consentimiento registrado</p>
                    <p>{detalle.consentimiento_at
                      ? new Date(detalle.consentimiento_at).toLocaleDateString("es-VE", { dateStyle: "long" })
                      : "No registrado"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Estado</p>
                    <Badge variant={detalle.activo ? "default" : "secondary"}>
                      {detalle.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDetalle(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: QR */}
      <Dialog open={modalQr} onOpenChange={setModalQr}>
        <DialogContent className="sm:max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Código QR — {selected?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {selected?.qr_code && (
              <Image
                src={selected.qr_code}
                alt="QR del alumno"
                width={220}
                height={220}
                unoptimized
              />
            )}
            <p className="text-xs text-muted-foreground">
              Presentar este código en caja para identificar al alumno
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setModalQr(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
