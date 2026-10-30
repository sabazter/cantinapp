"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Search, Trash2, Plus, Minus, CheckCircle,
  AlertCircle, RefreshCw, QrCode, User, X,
  FileDown, Camera,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { encolarVenta } from "@/lib/idb";
import { QrScannerModal } from "@/components/pos/qr-scanner-modal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio_usd: string;
  precio_jornada_usd?: string | null;
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
  fiado_habilitado?: boolean;
  limite_fiado_usd?: string | null;
  cuentas_alumnos: { saldo: string } | null | { saldo: string }[];
}

interface TasaBcv {
  tasa: number;
  fecha: string;
  fuente: string;
}

interface Recibo {
  id: string;
  totalUsd: number;
  totalBs: number;
  tasa: number;
  items: { nombre: string; cantidad: number; precioUsd: number }[];
  alumnoNombre: string | null;
  metodoPago: string;
  fecha: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CajaClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tasa, setTasa]           = useState<TasaBcv | null>(null);
  const [loading, setLoading]     = useState(true);

  // Filtros
  const [catFilter, setCatFilter]   = useState<"todos" | "tienda" | "menu">("todos");
  const [prodSearch, setProdSearch] = useState("");

  // Carrito
  const [carrito, setCarrito] = useState<CartItem[]>([]);

  // Alumno
  const [alumnoSearch, setAlumnoSearch]       = useState("");
  const [alumnoResults, setAlumnoResults]     = useState<Alumno[]>([]);
  const [selectedAlumno, setSelectedAlumno]   = useState<Alumno | null>(null);
  const [searchingAlumno, setSearchingAlumno] = useState(false);
  const [scannerOpen, setScannerOpen]         = useState(false);

  // Modo de pago: "saldo" (débito de cuenta virtual) o "fiado" (crédito manual)
  const [metodoPago, setMetodoPago] = useState<"saldo" | "fiado">("saldo");

  // Estado de checkout
  const [processing, setProcessing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState(false);
  const [lastRecibo, setLastRecibo]     = useState<Recibo | null>(null);

  // ── Cargar productos y tasa BCV ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [prodRes, bcvRes] = await Promise.all([
        fetch("/api/admin/inventario"),
        fetch("/api/admin/bcv"),
      ]);
      if (prodRes.ok) setProductos(await prodRes.json());
      if (bcvRes.ok) {
        const bcvData = await bcvRes.json();
        setTasa(bcvData.activa);
      }
    } catch {
      toast.error("Error al cargar datos de caja");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Búsqueda de alumno por texto (debounced) ────────────────────────────────
  useEffect(() => {
    if (alumnoSearch.length < 2) {
      setAlumnoResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingAlumno(true);
      try {
        const res = await fetch(`/api/admin/alumnos/buscar?q=${encodeURIComponent(alumnoSearch)}`);
        if (res.ok) {
          const list = await res.json();
          setAlumnoResults(list);
        }
      } catch {
      } finally {
        setSearchingAlumno(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [alumnoSearch]);

  // ── Identificación por escaneo QR ───────────────────────────────────────────
  const handleQrScan = useCallback(async (scannedId: string) => {
    toast.info("Identificando alumno...", { duration: 1200 });
    try {
      // Intentar primero por ID exacto
      let res = await fetch(`/api/admin/alumnos/buscar?id=${encodeURIComponent(scannedId)}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setSelectedAlumno(list[0]);
          setAlumnoSearch("");
          setAlumnoResults([]);
          setMetodoPago("saldo");
          toast.success(`Alumno identificado: ${list[0].nombre}`);
          return;
        }
      }
      // Si no encontró por ID, intentar por q
      res = await fetch(`/api/admin/alumnos/buscar?q=${encodeURIComponent(scannedId)}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setSelectedAlumno(list[0]);
          setAlumnoSearch("");
          setAlumnoResults([]);
          setMetodoPago("saldo");
          toast.success(`Alumno identificado: ${list[0].nombre}`);
          return;
        }
      }
      toast.error("Código QR no corresponde a ningún alumno activo");
    } catch {
      toast.error("Error al buscar alumno por QR");
    }
  }, []);

  // ── Carrito ─────────────────────────────────────────────────────────────────
  const precioEfectivo = (p: Producto) =>
    p.precio_jornada_usd ? Number(p.precio_jornada_usd) : Number(p.precio_usd);

  const addToCart = (prod: Producto) => {
    setCarrito((prev) => {
      const exists = prev.find((i) => i.id === prod.id);
      if (exists) {
        return prev.map((i) => (i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, { ...prod, cantidad: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCarrito((prev) =>
      prev.flatMap((i) => {
        if (i.id !== id) return [i];
        const next = i.cantidad + delta;
        if (next <= 0) return [];
        return [{ ...i, cantidad: next }];
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCarrito((prev) => prev.filter((i) => i.id !== id));
  };

  const totalUsd = useMemo(() => {
    return carrito.reduce((sum, item) => sum + precioEfectivo(item) * item.cantidad, 0);
  }, [carrito]);

  const totalBs = tasa ? totalUsd * tasa.tasa : null;

  // Saldo del alumno seleccionado
  const saldoAlumno = useMemo(() => {
    if (!selectedAlumno) return 0;
    const c = Array.isArray(selectedAlumno.cuentas_alumnos)
      ? selectedAlumno.cuentas_alumnos[0]
      : selectedAlumno.cuentas_alumnos;
    return Number(c?.saldo ?? 0);
  }, [selectedAlumno]);

  // ── Confirmar cobro ─────────────────────────────────────────────────────────
  async function confirmarCobro() {
    if (carrito.length === 0) {
      setError("El carrito está vacío");
      return;
    }
    if (!selectedAlumno) {
      setError("Es obligatorio escanear el QR o seleccionar al alumno para cobrar");
      return;
    }

    // Validación de cobro con saldo o fiado
    if (metodoPago === "fiado") {
      if (!selectedAlumno.fiado_habilitado) {
        setError(`"${selectedAlumno.nombre}" no tiene habilitado el fiado`);
        return;
      }
      const limite = selectedAlumno.limite_fiado_usd ? Number(selectedAlumno.limite_fiado_usd) : null;
      const deudaActual = saldoAlumno < 0 ? Math.abs(saldoAlumno) : 0;
      if (limite !== null && deudaActual + totalUsd > limite) {
        setError(`Excede el límite de fiado ($${limite.toFixed(2)}). Deuda actual: $${deudaActual.toFixed(2)}`);
        return;
      }
    } else {
      // metodoPago === "saldo"
      // Si el saldo no alcanza completamente, verificar si puede pasar a fiado
      if (saldoAlumno < totalUsd && !selectedAlumno.fiado_habilitado) {
        setError(`Saldo insuficiente ($${saldoAlumno.toFixed(2)} disp.) y no tiene fiado habilitado`);
        return;
      }
    }

    setProcessing(true);
    setError(null);

    const payload = {
      alumnoId:   selectedAlumno.id,
      metodoPago: "fiado", // En backend se procesa contra la cuenta del alumno
      items:      carrito.map((i) => ({ productoId: i.id, cantidad: i.cantidad })),
    };

    // Modo offline (IndexedDB)
    if (!navigator.onLine) {
      await encolarVenta(payload);
      setLastRecibo({
        id:           `OFFLINE-${Date.now()}`,
        totalUsd,
        totalBs:      totalBs ?? 0,
        tasa:         tasa?.tasa ?? 0,
        items:        carrito.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precioUsd: precioEfectivo(i) })),
        alumnoNombre: selectedAlumno.nombre,
        metodoPago:   metodoPago === "saldo" ? "Saldo en Cuenta" : "Fiado a Crédito",
        fecha:        new Date().toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" }),
      });
      setCarrito([]);
      setSelectedAlumno(null);
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

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Error al procesar la venta");
      }

      const d = await res.json();
      setLastRecibo({
        id:           d.id ?? `V-${Date.now()}`,
        totalUsd,
        totalBs:      totalBs ?? 0,
        tasa:         tasa?.tasa ?? 0,
        items:        carrito.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precioUsd: precioEfectivo(i) })),
        alumnoNombre: selectedAlumno.nombre,
        metodoPago:   metodoPago === "saldo" ? "Saldo en Cuenta" : "Fiado a Crédito",
        fecha:        new Date().toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" }),
      });

      setCarrito([]);
      setSelectedAlumno(null);
      setSuccessModal(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  // ── Generar ticket PDF ──────────────────────────────────────────────────────
  function descargarReciboPdf() {
    if (!lastRecibo) return;
    const doc = new jsPDF({ format: [80, 160], unit: "mm" });
    doc.setFontSize(12);
    doc.text("CantinApp — Recibo de Cobro", 40, 10, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Fecha: ${lastRecibo.fecha}`, 40, 16, { align: "center" });
    if (lastRecibo.alumnoNombre) {
      doc.text(`Cliente: ${lastRecibo.alumnoNombre}`, 40, 20, { align: "center" });
    }
    doc.text(`Modo: ${lastRecibo.metodoPago}`, 40, 24, { align: "center" });
    doc.text(`Tasa BCV: ${lastRecibo.tasa.toFixed(2)} Bs/$`, 40, 28, { align: "center" });

    autoTable(doc, {
      startY: 32,
      head: [["Prod", "Cant", "$ Unit", "Total"]],
      body: lastRecibo.items.map((i) => [
        i.nombre,
        i.cantidad,
        `$${i.precioUsd.toFixed(2)}`,
        `$${(i.cantidad * i.precioUsd).toFixed(2)}`,
      ]),
      theme: "plain",
      styles: { fontSize: 7, cellPadding: 1 },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 10 }, 2: { cellWidth: 14 }, 3: { cellWidth: 14 } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 60;
    doc.setFontSize(10);
    doc.text(`Total USD: $${lastRecibo.totalUsd.toFixed(2)}`, 40, finalY + 6, { align: "center" });
    doc.text(`Total Bs:  Bs. ${lastRecibo.totalBs.toFixed(2)}`, 40, finalY + 11, { align: "center" });
    doc.setFontSize(7);
    doc.text("¡Gracias por su compra!", 40, finalY + 18, { align: "center" });
    doc.save(`recibo-${lastRecibo.id}.pdf`);
  }

  // ── Productos filtrados ─────────────────────────────────────────────────────
  const prodsFiltrados = productos.filter((p) => {
    if (!p.activo) return false;
    if (catFilter !== "todos" && p.categoria !== catFilter) return false;
    if (prodSearch && !p.nombre.toLowerCase().includes(prodSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Barra superior de tasa y estado */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Caja / Punto de Cobro</h1>
          {tasa && (
            <Badge variant="outline" className="text-xs font-mono bg-background">
              BCV: {tasa.tasa.toFixed(2)} Bs/$
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      {/* Grid principal: Izquierda Catálogo | Derecha Carrito y Cobro */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-20 lg:pb-0">
        {/* Catálogo de Productos (7 columnas en desktop) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Buscador y categorías */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                className="pl-9 text-base sm:text-sm h-10"
              />
            </div>
            <div className="flex gap-1">
              {(["todos", "tienda", "menu"] as const).map((cat) => (
                <Button
                  key={cat}
                  variant={catFilter === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCatFilter(cat)}
                  className="h-10 text-xs px-3 capitalize"
                >
                  {cat === "todos" ? "Todos" : cat === "tienda" ? "Tienda" : "Menú"}
                </Button>
              ))}
            </div>
          </div>

          {/* Grilla de productos sin stock */}
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Cargando catálogo...</div>
          ) : prodsFiltrados.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground border rounded-xl bg-card">
              No hay productos disponibles
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {prodsFiltrados.map((p) => {
                const precio = precioEfectivo(p);
                const enCarrito = carrito.find((i) => i.id === p.id);

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="p-3 text-left rounded-xl border bg-card hover:bg-accent/40 active:scale-[0.98] transition-all flex flex-col justify-between min-h-[96px] shadow-2xs relative group"
                  >
                    <div>
                      <div className="font-semibold text-sm line-clamp-2 leading-tight">{p.nombre}</div>
                      <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{p.categoria}</div>
                    </div>
                    <div className="flex items-baseline justify-between mt-2 pt-1 border-t w-full">
                      <span className="font-mono font-bold text-sm text-primary">${precio.toFixed(2)}</span>
                      {tasa && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          Bs. {(precio * tasa.tasa).toFixed(1)}
                        </span>
                      )}
                    </div>
                    {enCarrito && (
                      <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-xs">
                        {enCarrito.cantidad}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel Lateral: Identificación y Carrito (5 columnas en desktop) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Identificación Obligatoria del Alumno */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" />
                  Identificación de Cuenta
                </span>
                {selectedAlumno && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground px-1"
                    onClick={() => setSelectedAlumno(null)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Cambiar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {!selectedAlumno ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setScannerOpen(true)}
                      className="flex-1 h-12 text-sm font-semibold gap-2 shadow-xs bg-primary hover:bg-primary/90"
                    >
                      <Camera className="h-5 w-5" />
                      Escanear QR
                    </Button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="O buscar nombre / cédula..."
                      value={alumnoSearch}
                      onChange={(e) => setAlumnoSearch(e.target.value)}
                      className="pl-9 h-11 text-base sm:text-sm"
                    />
                  </div>

                  {searchingAlumno && (
                    <p className="text-xs text-muted-foreground text-center">Buscando alumno...</p>
                  )}

                  {alumnoResults.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto divide-y bg-popover shadow-md">
                      {alumnoResults.map((a) => {
                        const c = Array.isArray(a.cuentas_alumnos) ? a.cuentas_alumnos[0] : a.cuentas_alumnos;
                        const s = Number(c?.saldo ?? 0);
                        return (
                          <button
                            key={a.id}
                            onClick={() => {
                              setSelectedAlumno(a);
                              setAlumnoSearch("");
                              setAlumnoResults([]);
                              setMetodoPago("saldo");
                            }}
                            className="w-full text-left p-2.5 hover:bg-accent text-xs flex justify-between items-center"
                          >
                            <div>
                              <div className="font-semibold">{a.nombre}</div>
                              <div className="text-muted-foreground">
                                {a.curso} {a.seccion ? `• Sec. ${a.seccion}` : ""}
                              </div>
                            </div>
                            <span
                              className={`font-mono font-bold ${
                                s >= 0 ? "text-emerald-600" : "text-destructive"
                              }`}
                            >
                              ${s.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground text-center">
                    Escanea el carnet o selecciona al alumno para activar el cobro.
                  </p>
                </div>
              ) : (
                /* Alumno Identificado */
                <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-base">{selectedAlumno.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedAlumno.curso} {selectedAlumno.seccion ? `• Sec. ${selectedAlumno.seccion}` : ""}
                      </div>
                    </div>
                    <Badge variant={selectedAlumno.fiado_habilitado ? "outline" : "secondary"} className="text-[10px]">
                      {selectedAlumno.fiado_habilitado ? "Fiado Autorizado" : "Sin Fiado"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="text-muted-foreground">Saldo actual en cuenta:</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        saldoAlumno >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      ${saldoAlumno.toFixed(2)} {saldoAlumno < 0 ? "(Deuda)" : "(Disponible)"}
                    </span>
                  </div>

                  {/* Selector de Modo de Cobro */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setMetodoPago("saldo")}
                      className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                        metodoPago === "saldo"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <span>Saldo / QR</span>
                      <span className="text-[10px] opacity-80">Débito a favor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMetodoPago("fiado")}
                      disabled={!selectedAlumno.fiado_habilitado}
                      className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                        metodoPago === "fiado"
                          ? "bg-destructive text-destructive-foreground border-destructive shadow-xs"
                          : !selectedAlumno.fiado_habilitado
                          ? "opacity-50 cursor-not-allowed bg-muted"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <span>Fiado (Crédito)</span>
                      <span className="text-[10px] opacity-80">Ingreso manual</span>
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carrito de Compra */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">Carrito de Compra</CardTitle>
              {carrito.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCarrito([])}
                  className="h-6 text-xs text-muted-foreground hover:text-destructive px-1"
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Vaciar
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {carrito.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-6">
                  Toca productos del catálogo para agregarlos
                </p>
              ) : (
                <div className="divide-y max-h-56 overflow-y-auto pr-1">
                  {carrito.map((item) => {
                    const p = precioEfectivo(item);
                    return (
                      <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{item.nombre}</div>
                          <div className="text-muted-foreground font-mono text-[11px]">${p.toFixed(2)} c/u</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-md"
                            onClick={() => updateQty(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-mono font-bold w-5 text-center">{item.cantidad}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-md"
                            onClick={() => updateQty(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="font-mono font-bold text-right min-w-[50px]">
                          ${(p * item.cantidad).toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Totales */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="font-medium text-muted-foreground">Total USD:</span>
                  <span className="font-mono font-bold text-xl text-primary">${totalUsd.toFixed(2)}</span>
                </div>
                {totalBs !== null && (
                  <div className="flex justify-between items-baseline text-xs text-muted-foreground">
                    <span>Equivalente en Bs:</span>
                    <span className="font-mono font-semibold">
                      Bs. {totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botón de Confirmación Principal (Desktop) */}
              <div className="hidden lg:block pt-1">
                <Button
                  onClick={confirmarCobro}
                  disabled={processing || carrito.length === 0 || !selectedAlumno}
                  className="w-full h-12 text-sm font-bold tracking-wide shadow-md"
                >
                  {processing
                    ? "Procesando..."
                    : !selectedAlumno
                    ? "Identifica al alumno para cobrar"
                    : metodoPago === "fiado"
                    ? `Confirmar Fiado ($${totalUsd.toFixed(2)})`
                    : `Cobrar $${totalUsd.toFixed(2)} de Cuenta`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Barra Fija Inferior para Teléfonos Móviles (Sticky Mobile Bar) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-md border-t shadow-lg z-40 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground truncate">
            {selectedAlumno ? selectedAlumno.nombre : "Sin alumno seleccionado"}
          </div>
          <div className="font-mono font-bold text-base leading-none text-primary">
            ${totalUsd.toFixed(2)}{" "}
            {totalBs !== null && <span className="text-xs text-muted-foreground font-normal">/ Bs. {totalBs.toFixed(1)}</span>}
          </div>
        </div>

        <Button
          onClick={confirmarCobro}
          disabled={processing || carrito.length === 0 || !selectedAlumno}
          className="h-12 px-5 font-bold shadow-md shrink-0"
        >
          {processing
            ? "..."
            : !selectedAlumno
            ? "Seleccionar Alumno"
            : metodoPago === "fiado"
            ? "Confirmar Fiado"
            : "Cobrar"}
        </Button>
      </div>

      {/* Modal de Escáner QR de Cámara */}
      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleQrScan}
      />

      {/* Modal de Éxito y Recibo */}
      <Dialog open={successModal} onOpenChange={setSuccessModal}>
        <DialogContent className="max-w-sm text-center p-6 space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="h-10 w-10" />
            </div>
          </div>

          <div>
            <DialogTitle className="text-xl font-bold">¡Cobro Registrado!</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              La cuenta de {lastRecibo?.alumnoNombre ?? "alumno"} ha sido actualizada.
            </p>
          </div>

          {lastRecibo && (
            <div className="bg-muted/40 p-3.5 rounded-xl text-left text-xs space-y-1.5 border font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total USD:</span>
                <span className="font-bold text-sm text-foreground">${lastRecibo.totalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bs:</span>
                <span>Bs. {lastRecibo.totalBs.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modalidad:</span>
                <span>{lastRecibo.metodoPago}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha:</span>
                <span>{lastRecibo.fecha}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={descargarReciboPdf}>
              <FileDown className="h-4 w-4 mr-1.5" /> Recibo PDF
            </Button>
            <Button className="flex-1" onClick={() => setSuccessModal(false)}>
              Listo / Siguiente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
