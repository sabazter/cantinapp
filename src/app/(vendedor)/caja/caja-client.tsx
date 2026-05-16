"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Minus, Plus, Trash2, Search, ShoppingCart, User, Loader2, CheckCircle2, Download, WifiOff,
} from "lucide-react";
import { encolarVenta } from "@/lib/idb";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Producto {
  id: string;
  nombre: string;
  categoria: "tienda" | "menu";
  precio_usd: string;
  precio_jornada_usd: string | null;
  stock: number;
  activo: boolean;
}

interface CartItem extends Producto {
  cantidad: number;
}

interface Alumno {
  id: string;
  nombre: string;
  curso: string;
  seccion: string | null;
  fiado_habilitado: boolean;
  limite_fiado_usd: string | null;
  cuentas_alumnos: { saldo: string } | null;
}

interface TasaBcv {
  tasa: number;
  fecha: string;
  fuente: "automatica" | "manual";
}

type MetodoPago = "efectivo_usd" | "efectivo_bs" | "pago_movil" | "fiado";

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: "efectivo_usd", label: "Efectivo USD" },
  { value: "efectivo_bs",  label: "Efectivo Bs"  },
  { value: "pago_movil",   label: "Pago Móvil"   },
  { value: "fiado",        label: "Fiado"         },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function CajaClient() {
  // Products & cart
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [carrito, setCarrito]       = useState<CartItem[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  const [catFilter, setCatFilter]   = useState<"todos" | "tienda" | "menu">("todos");

  // Alumno
  const [alumnoSearch, setAlumnoSearch]   = useState("");
  const [alumnoResults, setAlumnoResults] = useState<Alumno[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [searchingAlumno, setSearchingAlumno] = useState(false);

  // BCV
  const [tasa, setTasa] = useState<TasaBcv | null>(null);

  // Payment
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo_usd");
  const [referencia, setReferencia] = useState("");

  // State
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState(false);
  const [lastRecibo, setLastRecibo]     = useState<{
    id: string; totalUsd: number; totalBs: number; tasa: number;
    items: { nombre: string; cantidad: number; precioUsd: number }[];
    alumnoNombre: string | null;
    metodoPago: string;
    fecha: string;
  } | null>(null);

  // Load productos & BCV rate
  useEffect(() => {
    async function load() {
      const [prodRes, bcvRes] = await Promise.all([
        fetch("/api/admin/inventario"),
        fetch("/api/admin/bcv"),
      ]);
      if (prodRes.ok) setProductos(await prodRes.json());
      if (bcvRes.ok) {
        const bcvData = await bcvRes.json();
        setTasa(bcvData.activa);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Alumno search (debounced)
  useEffect(() => {
    if (alumnoSearch.length < 2) {
      setAlumnoResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingAlumno(true);
      try {
        const res = await fetch(`/api/admin/alumnos/buscar?q=${encodeURIComponent(alumnoSearch)}`);
        if (res.ok) setAlumnoResults(await res.json());
      } finally {
        setSearchingAlumno(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [alumnoSearch]);

  const addToCart = useCallback((prod: Producto) => {
    if (prod.stock === 0) return;
    setCarrito(prev => {
      const existing = prev.find(i => i.id === prod.id);
      if (existing) {
        if (existing.cantidad >= prod.stock) return prev;
        return prev.map(i => i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { ...prod, cantidad: 1 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCarrito(prev =>
      prev.flatMap(i => {
        if (i.id !== id) return [i];
        const next = i.cantidad + delta;
        if (next <= 0) return [];
        if (next > i.stock) return [i];
        return [{ ...i, cantidad: next }];
      })
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCarrito(prev => prev.filter(i => i.id !== id));
  }, []);

  const precioEfectivo = (prod: Producto) =>
    prod.precio_jornada_usd ? Number(prod.precio_jornada_usd) : Number(prod.precio_usd);

  const totalUsd  = carrito.reduce((s, i) => s + precioEfectivo(i) * i.cantidad, 0);
  const totalBs   = tasa ? totalUsd * tasa.tasa : null;

  const prodsFiltrados = productos.filter(p => {
    if (!p.activo) return false;
    if (catFilter !== "todos" && p.categoria !== catFilter) return false;
    if (prodSearch && !p.nombre.toLowerCase().includes(prodSearch.toLowerCase())) return false;
    return true;
  });

  async function confirmarVenta() {
    if (carrito.length === 0) return;
    if (metodoPago === "fiado" && !selectedAlumno) {
      setError("Fiado requiere seleccionar un alumno");
      return;
    }
    setProcessing(true);
    setError(null);

    const payload = {
      alumnoId:   selectedAlumno?.id,
      metodoPago,
      referencia: referencia || undefined,
      items:      carrito.map(i => ({ productoId: i.id, cantidad: i.cantidad })),
    };

    // Sin conexión: encolar en IndexedDB
    if (!navigator.onLine) {
      await encolarVenta(payload);
      setLastRecibo({
        id:           `OFFLINE-${Date.now()}`,
        totalUsd,
        totalBs:      totalBs ?? 0,
        tasa:         tasa?.tasa ?? 0,
        items:        carrito.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precioUsd: precioEfectivo(i) })),
        alumnoNombre: selectedAlumno?.nombre ?? null,
        metodoPago,
        fecha:        new Date().toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" }),
      });
      setCarrito([]);
      setSelectedAlumno(null);
      setAlumnoSearch("");
      setReferencia("");
      setSuccessModal(true);
      setProcessing(false);
      return;
    }

    try {
      const res = await fetch("/api/ventas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Error al procesar la venta");
      }

      setLastRecibo({
        id:          data.id,
        totalUsd:    data.totalUsd,
        totalBs:     data.totalBs,
        tasa:        data.tasaBcv,
        items:       carrito.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precioUsd: precioEfectivo(i) })),
        alumnoNombre: selectedAlumno?.nombre ?? null,
        metodoPago,
        fecha:       new Date().toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" }),
      });
      setCarrito([]);
      setSelectedAlumno(null);
      setAlumnoSearch("");
      setReferencia("");
      setSuccessModal(true);

      // Refrescar stock
      const prodRes = await fetch("/api/admin/inventario");
      if (prodRes.ok) setProductos(await prodRes.json());

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setProcessing(false);
    }
  }

  const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
  const fmtBs  = (n: number) =>
    new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(n) + " Bs";

  const descargarPDF = async () => {
    if (!lastRecibo) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: [80, 160], orientation: "portrait" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CantinApp", 40, 12, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Fecha: ${lastRecibo.fecha}`, 6, 20);
    doc.text(`Ref: ${lastRecibo.id.slice(-8).toUpperCase()}`, 6, 25);
    doc.text(`Pago: ${lastRecibo.metodoPago.replace(/_/g, " ")}`, 6, 30);
    if (lastRecibo.alumnoNombre) {
      doc.text(`Alumno: ${lastRecibo.alumnoNombre}`, 6, 35);
    }

    doc.setDrawColor(180);
    doc.line(6, 38, 74, 38);

    let y = 44;
    doc.setFont("helvetica", "bold");
    doc.text("Producto", 6, y);
    doc.text("Cant", 46, y, { align: "right" });
    doc.text("USD", 74, y, { align: "right" });
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.line(6, y, 74, y);
    y += 4;

    for (const item of lastRecibo.items) {
      const nombre = item.nombre.length > 22 ? item.nombre.slice(0, 21) + "…" : item.nombre;
      doc.text(nombre, 6, y);
      doc.text(String(item.cantidad), 46, y, { align: "right" });
      doc.text(fmtUsd(item.precioUsd * item.cantidad), 74, y, { align: "right" });
      y += 5;
    }

    doc.setDrawColor(180);
    doc.line(6, y, 74, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Total USD:", 6, y);
    doc.text(fmtUsd(lastRecibo.totalUsd), 74, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Total Bs (${lastRecibo.tasa.toFixed(2)}):`, 6, y);
    doc.text(fmtBs(lastRecibo.totalBs), 74, y, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text("Gracias por su compra", 40, y, { align: "center" });

    doc.save(`recibo-${lastRecibo.id.slice(-8).toUpperCase()}.pdf`);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left: Product catalog */}
      <div className="flex-1 flex flex-col overflow-hidden border-r">
        {/* BCV status bar */}
        <div className="px-4 py-1.5 bg-muted/50 border-b flex items-center gap-2 text-xs text-muted-foreground">
          {tasa ? (
            <>
              <span className="font-medium text-foreground">
                Tasa BCV: {fmtBs(tasa.tasa).replace(" Bs", "")} Bs/USD
              </span>
              <Badge variant={tasa.fuente === "manual" ? "secondary" : "outline"} className="text-[10px] py-0">
                {tasa.fuente === "manual" ? "manual" : "automática"}
              </Badge>
              <span>{tasa.fecha}</span>
            </>
          ) : (
            <span className="text-amber-600">Sin tasa BCV — contacte al administrador</span>
          )}
        </div>

        {/* Search & filters */}
        <div className="flex gap-2 p-3 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Buscar producto..."
              value={prodSearch}
              onChange={e => setProdSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(["todos", "tienda", "menu"] as const).map(cat => (
              <Button
                key={cat}
                variant={catFilter === cat ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCatFilter(cat)}
              >
                {cat === "todos" ? "Todos" : cat === "tienda" ? "Tienda" : "Menú"}
              </Button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : prodsFiltrados.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">Sin productos</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {prodsFiltrados.map(prod => {
                const enCarrito = carrito.find(i => i.id === prod.id)?.cantidad ?? 0;
                const sinStock  = prod.stock === 0;
                return (
                  <button
                    key={prod.id}
                    disabled={sinStock}
                    onClick={() => addToCart(prod)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      sinStock
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : "hover:bg-accent hover:border-primary/40 cursor-pointer"
                    }`}
                  >
                    <p className="text-sm font-medium leading-tight line-clamp-2">{prod.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {prod.precio_jornada_usd ? (
                        <span className="text-blue-600 font-semibold">{fmtUsd(Number(prod.precio_jornada_usd))}</span>
                      ) : fmtUsd(Number(prod.precio_usd))}
                      {tasa && (
                        <span className="ml-1 text-[10px]">
                          · {fmtBs(precioEfectivo(prod) * tasa.tasa)}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">Stock: {prod.stock}</span>
                      {enCarrito > 0 && (
                        <Badge className="text-[10px] py-0 h-4">{enCarrito}</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & checkout */}
      <div className="w-80 flex flex-col bg-background">
        {/* Alumno identification */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            {selectedAlumno ? selectedAlumno.nombre : "Sin identificar"}
          </div>
          {selectedAlumno ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-muted-foreground">
                {selectedAlumno.curso}{selectedAlumno.seccion ? ` ${selectedAlumno.seccion}` : ""} ·
                Saldo: {" "}
                <span className={Number(selectedAlumno.cuentas_alumnos?.saldo ?? 0) < 0 ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
                  {fmtUsd(Number(selectedAlumno.cuentas_alumnos?.saldo ?? 0))}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedAlumno(null); setAlumnoSearch(""); }}>
                ×
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                className="pl-7 h-7 text-xs"
                placeholder="Buscar alumno (nombre o cédula)"
                value={alumnoSearch}
                onChange={e => setAlumnoSearch(e.target.value)}
              />
              {searchingAlumno && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
              )}
              {alumnoResults.length > 0 && !selectedAlumno && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                  {alumnoResults.map(a => (
                    <button
                      key={a.id}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-accent"
                      onClick={() => {
                        setSelectedAlumno(a);
                        setAlumnoSearch("");
                        setAlumnoResults([]);
                        // Si el alumno no tiene fiado, quitar fiado del método de pago
                        if (!a.fiado_habilitado && metodoPago === "fiado") {
                          setMetodoPago("efectivo_usd");
                        }
                      }}
                    >
                      <p className="font-medium">{a.nombre}</p>
                      <p className="text-muted-foreground">{a.curso}{a.seccion ? ` ${a.seccion}` : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <ShoppingCart className="h-8 w-8 opacity-30" />
              <p className="text-xs">Carrito vacío</p>
            </div>
          ) : (
            carrito.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.nombre}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtUsd(precioEfectivo(item))} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="text-xs w-5 text-center">{item.cantidad}</span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
                <p className="text-xs font-medium w-14 text-right tabular-nums">
                  {fmtUsd(precioEfectivo(item) * item.cantidad)}
                </p>
                <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totals & checkout */}
        <div className="border-t p-3 space-y-3">
          <Card className="shadow-none border">
            <CardHeader className="p-2 pb-0">
              <CardTitle className="text-xs text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <p className="text-2xl font-bold tabular-nums">{fmtUsd(totalUsd)}</p>
              {totalBs !== null && (
                <p className="text-sm text-muted-foreground tabular-nums">{fmtBs(totalBs)}</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Método de pago</label>
            <Select
              value={metodoPago}
              onValueChange={(v) => {
                const val = (v ?? "efectivo_usd") as MetodoPago;
                if (val === "fiado" && selectedAlumno && !selectedAlumno.fiado_habilitado) return;
                setMetodoPago(val);
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODOS.map(m => {
                  const fiadoBloqueado = m.value === "fiado" && selectedAlumno && !selectedAlumno.fiado_habilitado;
                  return (
                    <SelectItem
                      key={m.value}
                      value={m.value}
                      disabled={!!fiadoBloqueado}
                      className={fiadoBloqueado ? "opacity-40 cursor-not-allowed" : ""}
                    >
                      {m.label}
                      {fiadoBloqueado ? " (no habilitado)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {/* Aviso si fiado no está habilitado para el alumno seleccionado */}
            {selectedAlumno && !selectedAlumno.fiado_habilitado && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Este alumno no tiene fiado habilitado. Contacte al administrador.
              </p>
            )}
            {selectedAlumno?.fiado_habilitado && selectedAlumno.limite_fiado_usd && (
              <p className="text-[11px] text-muted-foreground">
                Límite fiado: ${Number(selectedAlumno.limite_fiado_usd).toFixed(2)} ·
                Saldo: {Number(selectedAlumno.cuentas_alumnos?.saldo ?? 0) < 0
                  ? `-$${Math.abs(Number(selectedAlumno.cuentas_alumnos?.saldo ?? 0)).toFixed(2)}`
                  : `$${Number(selectedAlumno.cuentas_alumnos?.saldo ?? 0).toFixed(2)}`}
              </p>
            )}
          </div>

          {(metodoPago === "pago_movil" || metodoPago === "transferencia" as MetodoPago) && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Referencia</label>
              <Input
                className="h-8 text-sm"
                placeholder="Número de referencia"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive rounded bg-destructive/10 px-2 py-1">{error}</p>
          )}

          <Button
            className="w-full"
            disabled={carrito.length === 0 || processing || !tasa}
            onClick={confirmarVenta}
          >
            {processing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
            ) : (
              `Cobrar ${fmtUsd(totalUsd)}`
            )}
          </Button>

          {carrito.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => setCarrito([])}
            >
              Vaciar carrito
            </Button>
          )}
        </div>
      </div>

      {/* Success modal / receipt */}
      <Dialog open={successModal} onOpenChange={setSuccessModal}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              {lastRecibo?.id.startsWith("OFFLINE-") ? (
                <>
                  <WifiOff className="h-5 w-5 text-amber-600" />
                  Venta guardada (sin conexión)
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Venta registrada
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {lastRecibo && (
            <div className="space-y-3 py-2">
              {lastRecibo.id.startsWith("OFFLINE-") && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  La venta se enviará al servidor cuando se restablezca la conexión.
                </p>
              )}
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total USD</span>
                  <span className="font-bold">{fmtUsd(lastRecibo.totalUsd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bs</span>
                  <span className="font-semibold">{fmtBs(lastRecibo.totalBs)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tasa BCV</span>
                  <span>{lastRecibo.tasa.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Referencia</span>
                  <span className="font-mono text-xs">{lastRecibo.id.slice(-8).toUpperCase()}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2">
            {lastRecibo && !lastRecibo.id.startsWith("OFFLINE-") && (
              <Button variant="outline" className="w-full gap-2" onClick={descargarPDF}>
                <Download className="h-4 w-4" /> Descargar PDF
              </Button>
            )}
            <Button className="w-full" onClick={() => setSuccessModal(false)}>
              Nueva venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
