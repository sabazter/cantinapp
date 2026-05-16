"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GraduationCap, Wallet, ShoppingBag, Plus, CheckCircle2, XCircle, Clock,
} from "lucide-react";

interface Alumno {
  id: string;
  nombre: string;
  curso: string;
  seccion: string | null;
  activo: boolean;
  cuentas_alumnos: { saldo: string } | null;
}

interface Venta {
  id: string;
  total_usd: string;
  total_bs: string;
  metodo_pago: string;
  es_fiado: boolean;
  created_at: string;
  detalle_ventas: {
    cantidad: number;
    precio_usd_unitario: string;
    productos: { nombre: string } | null;
  }[];
}

interface Abono {
  id: string;
  monto_usd: string;
  monto_bs: string | null;
  metodo: string;
  banco: string | null;
  estado: "pendiente" | "confirmado" | "rechazado";
  created_at: string;
  confirmado_at: string | null;
  motivo_rechazo: string | null;
}

const abonoSchema = z.object({
  montoUsd:   z.number().positive("Ingrese un monto válido"),
  metodo:     z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia: z.string().max(100).optional(),
  banco:      z.string().max(60).optional(),
});

type AbonoForm = z.infer<typeof abonoSchema>;

const METODO_LABEL: Record<string, string> = {
  efectivo_usd:  "Efectivo USD",
  efectivo_bs:   "Efectivo Bs",
  pago_movil:    "Pago Móvil",
  transferencia: "Transferencia",
  fiado:         "Fiado",
};

export function PortalClient() {
  const [hijos, setHijos]         = useState<Alumno[]>([]);
  const [selectedHijo, setSelectedHijo] = useState<Alumno | null>(null);
  const [ventas, setVentas]       = useState<Venta[]>([]);
  const [abonos, setAbonos]       = useState<Abono[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [modalAbono, setModalAbono] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [abonoSuccess, setAbonoSuccess] = useState(false);
  const [actionErr, setActionErr]   = useState<string | null>(null);
  const comprobanteRef              = useRef<HTMLInputElement>(null);

  const form = useForm<AbonoForm>({
    resolver: zodResolver(abonoSchema),
    defaultValues: { metodo: "transferencia" },
  });

  useEffect(() => {
    fetch("/api/representante/alumnos")
      .then(r => r.json())
      .then((data: Alumno[]) => {
        setHijos(data);
        if (data.length === 1) cargarDetalle(data[0]);
      })
      .catch(() => setError("Error al cargar datos"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarDetalle(hijo: Alumno) {
    setSelectedHijo(hijo);
    setLoadingDetalle(true);
    try {
      const [ventasRes, abonosRes] = await Promise.all([
        fetch(`/api/representante/alumnos/${hijo.id}`).then(r => r.json()),
        fetch(`/api/representante/abonos?alumnoId=${hijo.id}`).then(r => r.json()),
      ]);
      setVentas(ventasRes.ventas ?? []);
      setAbonos(abonosRes);
    } catch {
      setError("Error al cargar historial");
    } finally {
      setLoadingDetalle(false);
    }
  }

  async function onReportarAbono(values: AbonoForm) {
    if (!selectedHijo) return;
    setSaving(true);
    setActionErr(null);

    try {
      const formData = new FormData();
      formData.append("alumnoId",  selectedHijo.id);
      formData.append("montoUsd",  String(values.montoUsd));
      formData.append("metodo",    values.metodo);
      if (values.referencia) formData.append("referencia", values.referencia);
      if (values.banco)      formData.append("banco",      values.banco);

      const file = comprobanteRef.current?.files?.[0];
      if (file) formData.append("comprobante", file);

      const res = await fetch("/api/representante/abonos", {
        method: "POST",
        body:   formData,
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Error al reportar");
      }

      setAbonoSuccess(true);
      form.reset({ metodo: "transferencia" });
      if (comprobanteRef.current) comprobanteRef.current.value = "";
      // Refrescar abonos
      const abonosRes = await fetch(`/api/representante/abonos?alumnoId=${selectedHijo.id}`);
      if (abonosRes.ok) setAbonos(await abonosRes.json());
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  const fmtUsd  = (n: string | number) => `$${Number(n).toFixed(2)}`;
  const fmtBs   = (n: string | number) =>
    new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(Number(n)) + " Bs";
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });

  const saldoColor = (saldo: string | undefined) => {
    const n = Number(saldo ?? 0);
    return n < 0 ? "text-red-600" : n > 0 ? "text-green-700" : "text-muted-foreground";
  };

  const estadoIcon = (estado: Abono["estado"]) => {
    if (estado === "confirmado") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (estado === "rechazado")  return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Mi Portal</h1>
        <p className="text-muted-foreground text-sm">Consulta el saldo y el historial de tus hijos</p>
      </div>

      {/* Selector de hijo si hay más de uno */}
      {hijos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {hijos.map(h => (
            <button
              key={h.id}
              onClick={() => cargarDetalle(h)}
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedHijo?.id === h.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              {h.nombre}
            </button>
          ))}
        </div>
      )}

      {hijos.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay alumnos registrados bajo tu cuenta.
          </CardContent>
        </Card>
      )}

      {selectedHijo && (
        <>
          {/* Tarjeta de saldo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4" />
                  {selectedHijo.nombre}
                </CardDescription>
                <CardTitle className="text-sm text-muted-foreground font-normal">
                  {selectedHijo.curso}{selectedHijo.seccion ? ` ${selectedHijo.seccion}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-1">Saldo actual</p>
                <p className={`text-3xl font-bold tabular-nums ${saldoColor(selectedHijo.cuentas_alumnos?.saldo)}`}>
                  {fmtUsd(selectedHijo.cuentas_alumnos?.saldo ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Number(selectedHijo.cuentas_alumnos?.saldo ?? 0) < 0
                    ? "Tiene deuda pendiente"
                    : Number(selectedHijo.cuentas_alumnos?.saldo ?? 0) > 0
                    ? "Tiene saldo a favor"
                    : "Sin deuda ni saldo"}
                </p>
              </CardContent>
            </Card>

            <Card className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  Reportar un pago
                </CardDescription>
                <CardTitle className="text-sm text-muted-foreground font-normal">
                  El administrador confirmará el abono
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => { setModalAbono(true); setActionErr(null); setAbonoSuccess(false); form.reset({ metodo: "transferencia" }); }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Reportar abono
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Historial */}
          {loadingDetalle ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          ) : (
            <Tabs defaultValue="compras">
              <TabsList>
                <TabsTrigger value="compras">
                  <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                  Compras
                </TabsTrigger>
                <TabsTrigger value="abonos">
                  <Wallet className="h-3.5 w-3.5 mr-1.5" />
                  Mis abonos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compras">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Método</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ventas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Sin compras registradas
                            </TableCell>
                          </TableRow>
                        ) : (
                          ventas.map(v => (
                            <TableRow key={v.id}>
                              <TableCell className="text-xs">{fmtDate(v.created_at)}</TableCell>
                              <TableCell className="text-xs">
                                {v.detalle_ventas.map(d =>
                                  `${d.productos?.nombre ?? "?"} ×${d.cantidad}`
                                ).join(", ")}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {fmtUsd(v.total_usd)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={v.es_fiado ? "destructive" : "outline"} className="text-xs">
                                  {METODO_LABEL[v.metodo_pago] ?? v.metodo_pago}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="abonos">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {abonos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Sin abonos reportados
                            </TableCell>
                          </TableRow>
                        ) : (
                          abonos.map(a => (
                            <TableRow key={a.id}>
                              <TableCell className="text-xs">{fmtDate(a.created_at)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {fmtUsd(a.monto_usd)}
                                {a.monto_bs && (
                                  <span className="block text-xs text-muted-foreground">
                                    {fmtBs(a.monto_bs)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{METODO_LABEL[a.metodo] ?? a.metodo}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {estadoIcon(a.estado)}
                                  <span className="text-xs capitalize">{a.estado}</span>
                                </div>
                                {a.estado === "rechazado" && a.motivo_rechazo && (
                                  <p className="text-xs text-destructive mt-0.5">{a.motivo_rechazo}</p>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* Modal reportar abono */}
      <Dialog open={modalAbono} onOpenChange={setModalAbono}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar abono — {selectedHijo?.nombre}</DialogTitle>
          </DialogHeader>

          {abonoSuccess ? (
            <div className="py-4 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="font-medium">Abono reportado con éxito</p>
              <p className="text-sm text-muted-foreground">
                El administrador revisará y confirmará el pago.
              </p>
              <Button onClick={() => setModalAbono(false)} className="w-full">
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onReportarAbono)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
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
                  <Label>Método</Label>
                  <Select
                    defaultValue="transferencia"
                    onValueChange={(v: string | null) => form.setValue("metodo", (v ?? "transferencia") as AbonoForm["metodo"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo_usd">Efectivo USD</SelectItem>
                      <SelectItem value="efectivo_bs">Efectivo Bs</SelectItem>
                      <SelectItem value="pago_movil">Pago Móvil</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
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
              </div>

              <div className="space-y-1.5">
                <Label>Comprobante (opcional)</Label>
                <Input
                  ref={comprobanteRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">JPG, PNG o WebP — máximo 5 MB</p>
              </div>

              {actionErr && <p className="text-xs text-destructive">{actionErr}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalAbono(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Enviando..." : "Reportar abono"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
