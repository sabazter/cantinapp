"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Wallet, Plus, QrCode, ShoppingBag, Clock, User,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  Users, CreditCard, Loader2, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QrCarnetCard } from "@/components/shared/qr-carnet-card";

interface Alumno {
  id: string;
  nombre: string;
  curso: string;
  seccion: string | null;
  cuentas_alumnos: { saldo: string } | null | { saldo: string }[];
}

interface DetalleVentaItem {
  id: string;
  cantidad: number;
  precio_usd_unitario: number;
  productos: { nombre: string } | null;
}

interface Venta {
  id: string;
  total_usd: number;
  total_bs: number;
  tasa_bcv: number;
  metodo_pago: string;
  es_fiado: boolean;
  created_at: string;
  vendedor: { nombre: string } | null;
  detalle_ventas: DetalleVentaItem[];
}

export function PortalClient() {
  const [hijos, setHijos]             = useState<Alumno[]>([]);
  const [loading, setLoading]         = useState(true);

  // Modales
  const [modalAbono, setModalAbono]   = useState(false);
  const [modalCarnet, setModalCarnet] = useState<Alumno | null>(null);
  const [modalHijo, setModalHijo]     = useState(false);

  // Historial expandido por hijo
  const [comprasHijo, setComprasHijo] = useState<Record<string, Venta[]>>({});
  const [cargandoCompras, setCargandoCompras] = useState<Record<string, boolean>>({});
  const [hijoExpandido, setHijoExpandido]     = useState<string | null>(null);

  // Formulario de Abono
  const [montoAbono, setMontoAbono]               = useState("");
  const [distribucion, setDistribucion]           = useState<"equitativa" | "individual">("equitativa");
  const [hijoSeleccionadoId, setHijoSeleccionadoId] = useState<string>("");
  const [metodoPago, setMetodoPago]               = useState<"pago_movil" | "transferencia" | "efectivo_usd" | "efectivo_bs">("pago_movil");
  const [referencia, setReferencia]               = useState("");
  const [banco, setBanco]                         = useState("");
  const [comprobante, setComprobante]             = useState<File | null>(null);
  const [enviandoAbono, setEnviandoAbono]         = useState(false);

  // Formulario Crear / Vincular Hijo
  const [modoHijo, setModoHijo]   = useState<"crear" | "vincular">("crear");
  const [nombreHijo, setNombreHijo] = useState("");
  const [cursoHijo, setCursoHijo]   = useState("");
  const [seccionHijo, setSeccionHijo] = useState("");
  const [cedulaOCodigo, setCedulaOCodigo] = useState("");
  const [guardandoHijo, setGuardandoHijo] = useState(false);

  // ── Cargar hijos ────────────────────────────────────────────────────────────
  const cargarHijos = useCallback(async () => {
    try {
      const res = await fetch("/api/representante/alumnos");
      if (res.ok) {
        const data = await res.json();
        setHijos(data);
        if (data.length > 0 && !hijoSeleccionadoId) {
          setHijoSeleccionadoId(data[0].id);
        }
      }
    } catch {
      toast.error("Error al cargar alumnos");
    } finally {
      setLoading(false);
    }
  }, [hijoSeleccionadoId]);

  useEffect(() => {
    cargarHijos();
  }, [cargarHijos]);

  // ── Cargar compras de un hijo al expandir ────────────────────────────────────
  const toggleVerCompras = async (hijoId: string) => {
    if (hijoExpandido === hijoId) {
      setHijoExpandido(null);
      return;
    }

    setHijoExpandido(hijoId);

    if (!comprasHijo[hijoId]) {
      setCargandoCompras((prev) => ({ ...prev, [hijoId]: true }));
      try {
        const res = await fetch(`/api/representante/alumnos/${hijoId}`);
        if (res.ok) {
          const d = await res.json();
          setComprasHijo((prev) => ({ ...prev, [hijoId]: d.ventas ?? [] }));
        }
      } finally {
        setCargandoCompras((prev) => ({ ...prev, [hijoId]: false }));
      }
    }
  };

  // ── Cálculos de saldo familiar ──────────────────────────────────────────────
  const getSaldo = (h: Alumno) => {
    const c = Array.isArray(h.cuentas_alumnos) ? h.cuentas_alumnos[0] : h.cuentas_alumnos;
    return Number(c?.saldo ?? 0);
  };

  const saldoFamiliarTotal = useMemo(() => {
    return hijos.reduce((sum, h) => sum + getSaldo(h), 0);
  }, [hijos]);

  // ── Enviar Abono ────────────────────────────────────────────────────────────
  const handleEnviarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(montoAbono);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    const esEfectivo = metodoPago === "efectivo_usd" || metodoPago === "efectivo_bs";
    if (!esEfectivo && (!referencia || referencia.trim().length < 4)) {
      toast.error("Ingresa el número de referencia del pago");
      return;
    }

    setEnviandoAbono(true);
    try {
      const formData = new FormData();
      formData.append("tipoDistribucion", distribucion);
      if (distribucion === "individual") {
        formData.append("alumnoId", hijoSeleccionadoId);
      }
      formData.append("montoUsd", String(monto));
      formData.append("metodo", metodoPago);
      if (!esEfectivo) {
        if (referencia) formData.append("referencia", referencia.trim());
        if (banco) formData.append("banco", banco.trim());
        if (comprobante) formData.append("comprobante", comprobante);
      }

      const res = await fetch("/api/representante/abonos", {
        method: "POST",
        body:   formData,
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Error al reportar el pago");
      }

      toast.success(
        distribucion === "equitativa" && hijos.length > 1
          ? "Abono reportado y distribuido equitativamente entre tus hijos. Pendiente de verificación."
          : "Abono reportado exitosamente. Pendiente de verificación por la cantina."
      );

      setModalAbono(false);
      setMontoAbono("");
      setReferencia("");
      setBanco("");
      setComprobante(null);
      cargarHijos();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setEnviandoAbono(false);
    }
  };

  // ── Registrar o Vincular Hijo ───────────────────────────────────────────────
  const handleGuardarHijo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoHijo(true);
    try {
      let payload: any;
      if (modoHijo === "crear") {
        if (!nombreHijo || !cursoHijo) {
          toast.error("Nombre y curso son requeridos");
          setGuardandoHijo(false);
          return;
        }
        payload = {
          accion:  "crear",
          nombre:  nombreHijo.trim(),
          curso:   cursoHijo.trim(),
          seccion: seccionHijo.trim() || undefined,
        };
      } else {
        if (!cedulaOCodigo) {
          toast.error("Ingresa el código o cédula del alumno");
          setGuardandoHijo(false);
          return;
        }
        payload = {
          accion:        "vincular",
          identificador: cedulaOCodigo.trim(),
        };
      }

      const res = await fetch("/api/representante/alumnos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "No se pudo procesar la solicitud");
      }

      toast.success(modoHijo === "crear" ? "Hijo registrado exitosamente" : "Cuenta de alumno vinculada");
      setModalHijo(false);
      setNombreHijo("");
      setCursoHijo("");
      setSeccionHijo("");
      setCedulaOCodigo("");
      cargarHijos();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGuardandoHijo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Cargando información familiar...</span>
      </div>
    );
  }

  const esEfectivo = metodoPago === "efectivo_usd" || metodoPago === "efectivo_bs";

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portal de la Familia</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Control de cuentas, saldo y carnets escolares
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setModalHijo(true)}
          className="text-xs h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Agregar / Vincular Hijo
        </Button>
      </div>

      {/* Tarjeta de Saldo Consolidado Familiar */}
      <Card className="border shadow-md overflow-hidden bg-gradient-to-br from-card via-card to-muted/30">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-primary" />
                Saldo Familiar Total
              </span>
              <div
                className={`text-3xl sm:text-4xl font-extrabold font-mono mt-1 ${
                  saldoFamiliarTotal >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                ${Math.abs(saldoFamiliarTotal).toFixed(2)}{" "}
                <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                  {saldoFamiliarTotal >= 0 ? "(A favor disponible)" : "(Deuda total acumulada)"}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => {
                setMontoAbono("");
                setReferencia("");
                setBanco("");
                setDistribucion("equitativa");
                setModalAbono(true);
              }}
              className="h-12 px-6 font-bold shadow-md bg-primary hover:bg-primary/90 text-sm gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Abonar a la Cuenta
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-1 border-t">
            {hijos.length === 1
              ? `1 alumno registrado bajo tu cuenta.`
              : `${hijos.length} alumnos registrados. Los abonos por defecto se reparten equitativamente.`}
          </p>
        </CardContent>
      </Card>

      {/* Lista de Hijos */}
      <div className="space-y-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Tus Hijos ({hijos.length})
        </h2>

        {hijos.length === 0 ? (
          <Card className="border border-dashed p-8 text-center space-y-3">
            <User className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <p className="font-semibold text-sm">No tienes ningún hijo registrado aún</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crea la cuenta de tu hijo pequeño o vincula su cuenta existente en un solo paso.
              </p>
            </div>
            <Button size="sm" onClick={() => setModalHijo(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Registrar a mi hijo
            </Button>
          </Card>
        ) : (
          hijos.map((hijo) => {
            const saldo = getSaldo(hijo);
            const expandido = hijoExpandido === hijo.id;
            const compras = comprasHijo[hijo.id] ?? [];
            const cargando = cargandoCompras[hijo.id];

            return (
              <Card key={hijo.id} className="border shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-base text-foreground">{hijo.nombre}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {hijo.curso} {hijo.seccion ? `• Sección ${hijo.seccion}` : ""}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Saldo:</span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          saldo >= 0 ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        ${Math.abs(saldo).toFixed(2)} {saldo < 0 ? "(Deuda)" : "(Disponible)"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-9 flex-1 sm:flex-initial"
                      onClick={() => setModalCarnet(hijo)}
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1.5" />
                      Carnet QR
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs h-9 flex-1 sm:flex-initial"
                      onClick={() => toggleVerCompras(hijo.id)}
                    >
                      <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                      {expandido ? "Ocultar" : "Consumos"}
                      {expandido ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                    </Button>
                  </div>
                </div>

                {/* Desglose de Consumos Detallados del Hijo */}
                {expandido && (
                  <div className="border-t bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Historial de Compras Detalladas
                      </span>
                      {compras.length > 0 && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {compras.length} compras registradas
                        </span>
                      )}
                    </div>

                    {cargando ? (
                      <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando consumos...
                      </div>
                    ) : compras.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Sin compras registradas para este alumno.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {compras.map((v) => {
                          const fecha = new Date(v.created_at).toLocaleString("es-VE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          });

                          return (
                            <div key={v.id} className="p-3 rounded-lg border bg-card text-xs space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-semibold text-foreground">{fecha}</span>
                                    <Badge
                                      variant={v.es_fiado ? "destructive" : "secondary"}
                                      className="text-[10px] py-0"
                                    >
                                      {v.es_fiado ? "Fiado" : "Saldo"}
                                    </Badge>
                                  </div>
                                  {v.vendedor && (
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                      Atendido por: {v.vendedor.nombre}
                                    </div>
                                  )}
                                </div>

                                <div className="text-right font-mono">
                                  <div className="font-bold text-sm text-foreground">
                                    ${Number(v.total_usd).toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Bs. {Number(v.total_bs).toFixed(1)}
                                  </div>
                                </div>
                              </div>

                              {/* Lista de productos consumidos */}
                              <div className="border-t pt-1.5 divide-y divide-border/40">
                                {v.detalle_ventas.map((d) => (
                                  <div key={d.id} className="py-1 flex justify-between items-center text-[11px]">
                                    <span>
                                      <strong className="text-foreground">{d.productos?.nombre ?? "Producto"}</strong>{" "}
                                      <span className="text-muted-foreground font-mono">× {d.cantidad}</span>
                                    </span>
                                    <span className="font-mono text-muted-foreground">
                                      ${(d.cantidad * Number(d.precio_usd_unitario)).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Modal de Abono */}
      <Dialog open={modalAbono} onOpenChange={setModalAbono}>
        <DialogContent className="max-w-md p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Reportar Abono a la Cuenta</DialogTitle>
            <CardDescription>
              Fija los fondos al valor BCV del día para consumos de tus hijos.
            </CardDescription>
          </DialogHeader>

          <form onSubmit={handleEnviarAbono} className="space-y-4 pt-2">
            {/* Monto en USD */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Monto a abonar (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.5"
                placeholder="Ej. 20.00"
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
                className="h-11 font-mono text-base"
                required
              />
            </div>

            {/* Reparto Familiar si tiene más de 1 hijo */}
            {hijos.length > 1 && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-semibold">¿Cómo deseas repartir este abono?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDistribucion("equitativa")}
                    className={`p-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                      distribucion === "equitativa"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    Equitativo (Todos)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDistribucion("individual")}
                    className={`p-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                      distribucion === "individual"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    Un solo hijo
                  </button>
                </div>

                {distribucion === "individual" && (
                  <div className="pt-2">
                    <Select value={hijoSeleccionadoId} onValueChange={(v) => setHijoSeleccionadoId(v ?? "")}>
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Selecciona el hijo" />
                      </SelectTrigger>
                      <SelectContent>
                        {hijos.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.nombre} ({h.curso})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Método de Pago */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Método de pago</Label>
              <Select
                value={metodoPago}
                onValueChange={(v) => setMetodoPago(v as any)}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago_movil">Pago Móvil</SelectItem>
                  <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                  <SelectItem value="efectivo_usd">Efectivo USD (Presencial)</SelectItem>
                  <SelectItem value="efectivo_bs">Efectivo Bs (Presencial)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Referencia y Banco (SOLO si NO es efectivo) */}
            {!esEfectivo ? (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Número de Referencia *</Label>
                  <Input
                    placeholder="Últimos 4 o 6 dígitos de la referencia"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="h-10 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Banco emisor (Opcional)</Label>
                  <Input
                    placeholder="Banesco, Mercantil, Venezuela..."
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Comprobante de captura (Opcional)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                    className="text-xs h-9 cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Pago en efectivo presencial. No requiere ingresar referencia bancaria; el administrador lo confirmará al recibir los billetes.
                </span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalAbono(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviandoAbono}>
                {enviandoAbono ? "Enviando..." : "Reportar Abono"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Carnet QR */}
      <Dialog open={!!modalCarnet} onOpenChange={(o) => !o && setModalCarnet(null)}>
        <DialogContent className="max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-center">
              Carnet Escolar de {modalCarnet?.nombre}
            </DialogTitle>
          </DialogHeader>

          {modalCarnet && (
            <div className="pt-1">
              <QrCarnetCard
                alumnoId={modalCarnet.id}
                nombre={modalCarnet.nombre}
                curso={modalCarnet.curso}
                seccion={modalCarnet.seccion}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Registrar o Vincular Hijo */}
      <Dialog open={modalHijo} onOpenChange={setModalHijo}>
        <DialogContent className="max-w-md p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Agregar o Vincular Hijo</DialogTitle>
            <CardDescription>
              {modoHijo === "crear"
                ? "Crea una cuenta para tu hijo pequeño si aún no tiene cédula."
                : "Si tu hijo es más grande y ya se registró por su cuenta, ingrésalo aquí."}
            </CardDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModoHijo("crear")}
              className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                modoHijo === "crear" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
            >
              Registrar pequeño
            </button>
            <button
              type="button"
              onClick={() => setModoHijo("vincular")}
              className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                modoHijo === "vincular" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
            >
              Vincular existente
            </button>
          </div>

          <form onSubmit={handleGuardarHijo} className="space-y-3 pt-3">
            {modoHijo === "crear" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nombre y Apellido del alumno *</Label>
                  <Input
                    placeholder="Ej. Sofía Hernández"
                    value={nombreHijo}
                    onChange={(e) => setNombreHijo(e.target.value)}
                    className="h-10 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Grado / Curso *</Label>
                    <Input
                      placeholder="Ej. 3er Grado"
                      value={cursoHijo}
                      onChange={(e) => setCursoHijo(e.target.value)}
                      className="h-10 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Sección</Label>
                    <Input
                      placeholder="Ej. A o B"
                      value={seccionHijo}
                      onChange={(e) => setSeccionHijo(e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cédula o Código de Alumno *</Label>
                <Input
                  placeholder="Ingresa la cédula o código"
                  value={cedulaOCodigo}
                  onChange={(e) => setCedulaOCodigo(e.target.value)}
                  className="h-10 text-xs"
                  required
                />
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalHijo(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoHijo}>
                {guardandoHijo ? "Guardando..." : modoHijo === "crear" ? "Registrar Hijo" : "Vincular"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
