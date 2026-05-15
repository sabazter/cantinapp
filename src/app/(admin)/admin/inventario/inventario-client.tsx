"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, PackagePlus, SlidersHorizontal, History, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Producto {
  id: string;
  nombre: string;
  categoria: "tienda" | "menu";
  precio_usd: string;
  stock: number;
  stock_min: number;
  activo: boolean;
}

interface Movimiento {
  id: string;
  tipo: "entrada" | "venta" | "ajuste";
  cantidad: number;
  motivo: string | null;
  created_at: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const productoSchema = z.object({
  nombre:    z.string().min(1, "Requerido"),
  categoria: z.enum(["tienda", "menu"]),
  precioUsd: z.number().positive("Debe ser mayor a 0"),
  stockMin:  z.number().int().min(0),
});

const entradaSchema = z.object({
  cantidad: z.number().int().min(1, "Mínimo 1"),
  motivo:   z.string().max(200).optional(),
});

const ajusteSchema = z.object({
  cantidad: z.number().int().refine((v) => v !== 0, "No puede ser 0"),
  motivo:   z.string().min(1, "El motivo es obligatorio").max(200),
});

type ProductoForm = z.infer<typeof productoSchema>;
type EntradaForm  = z.infer<typeof entradaSchema>;
type AjusteForm   = z.infer<typeof ajusteSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIA_LABEL: Record<string, string> = { tienda: "Tienda", menu: "Menú del día" };

const TIPO_MOVIMIENTO: Record<string, { label: string; color: string }> = {
  entrada: { label: "Entrada",  color: "text-green-600" },
  venta:   { label: "Venta",    color: "text-blue-600"  },
  ajuste:  { label: "Ajuste",   color: "text-orange-600" },
};

function formatUsd(val: string | number) {
  return `$${Number(val).toFixed(2)}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function InventarioClient() {
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filtro,     setFiltro]     = useState<"todos" | "tienda" | "menu" | "stock_bajo">("todos");

  const [modalCrear,      setModalCrear]      = useState(false);
  const [modalEditar,     setModalEditar]     = useState<Producto | null>(null);
  const [modalEntrada,    setModalEntrada]    = useState<Producto | null>(null);
  const [modalAjuste,     setModalAjuste]     = useState<Producto | null>(null);
  const [modalHistorial,  setModalHistorial]  = useState<Producto | null>(null);
  const [movimientos,     setMovimientos]     = useState<Movimiento[]>([]);

  const fetchProductos = useCallback(async () => {
    const res = await fetch("/api/admin/inventario");
    if (res.ok) setProductos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchProductos(); }, [fetchProductos]);

  const productosFiltrados = productos.filter((p) => {
    if (!p.activo && filtro !== "todos") return false;
    if (filtro === "tienda")     return p.categoria === "tienda";
    if (filtro === "menu")       return p.categoria === "menu";
    if (filtro === "stock_bajo") return p.stock <= p.stock_min;
    return true;
  });

  const stockBajoCount = productos.filter((p) => p.activo && p.stock <= p.stock_min).length;

  // ── Crear ──────────────────────────────────────────────────────────────────
  const crearForm = useForm<ProductoForm>({
    resolver: zodResolver(productoSchema),
    defaultValues: { categoria: "tienda", stockMin: 5 },
  });

  const onCrear = async (data: ProductoForm) => {
    const res = await fetch("/api/admin/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Producto creado");
      setModalCrear(false);
      crearForm.reset({ categoria: "tienda", stockMin: 5 });
      fetchProductos();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Error al crear");
    }
  };

  // ── Editar ─────────────────────────────────────────────────────────────────
  const editarForm = useForm<ProductoForm>({ resolver: zodResolver(productoSchema) });

  const abrirEditar = (p: Producto) => {
    editarForm.reset({
      nombre:    p.nombre,
      categoria: p.categoria,
      precioUsd: Number(p.precio_usd),
      stockMin:  p.stock_min,
    });
    setModalEditar(p);
  };

  const onEditar = async (data: ProductoForm) => {
    if (!modalEditar) return;
    const res = await fetch(`/api/admin/inventario/${modalEditar.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Producto actualizado");
      setModalEditar(null);
      fetchProductos();
    } else {
      toast.error("Error al actualizar");
    }
  };

  // ── Entrada de stock ───────────────────────────────────────────────────────
  const entradaForm = useForm<EntradaForm>({ resolver: zodResolver(entradaSchema) });

  const onEntrada = async (data: EntradaForm) => {
    if (!modalEntrada) return;
    const res = await fetch(`/api/admin/inventario/${modalEntrada.id}/entrada`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { stock } = await res.json();
      toast.success(`Stock actualizado: ${stock} unidades`);
      setModalEntrada(null);
      entradaForm.reset();
      fetchProductos();
    } else {
      toast.error("Error al registrar entrada");
    }
  };

  // ── Ajuste manual ──────────────────────────────────────────────────────────
  const ajusteForm = useForm<AjusteForm>({ resolver: zodResolver(ajusteSchema) });

  const onAjuste = async (data: AjusteForm) => {
    if (!modalAjuste) return;
    const res = await fetch(`/api/admin/inventario/${modalAjuste.id}/ajuste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { stock } = await res.json();
      toast.success(`Stock ajustado: ${stock} unidades`);
      setModalAjuste(null);
      ajusteForm.reset();
      fetchProductos();
    } else {
      toast.error("Error al registrar ajuste");
    }
  };

  // ── Historial ──────────────────────────────────────────────────────────────
  const abrirHistorial = async (p: Producto) => {
    setModalHistorial(p);
    setMovimientos([]);
    const res = await fetch(`/api/admin/inventario/${p.id}/movimientos`);
    if (res.ok) setMovimientos(await res.json());
  };

  // ── Desactivar ─────────────────────────────────────────────────────────────
  const onDesactivar = async (p: Producto) => {
    if (!confirm(`¿Desactivar "${p.nombre}"?`)) return;
    await fetch(`/api/admin/inventario/${p.id}`, { method: "DELETE" });
    toast.success("Producto desactivado");
    fetchProductos();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de productos, stock y movimientos
          </p>
        </div>
        <Button onClick={() => { crearForm.reset({ categoria: "tienda", stockMin: 5 }); setModalCrear(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo producto
        </Button>
      </div>

      {/* Alerta stock bajo */}
      {stockBajoCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{stockBajoCount}</strong> producto{stockBajoCount > 1 ? "s" : ""} con stock por debajo del mínimo.{" "}
            <button className="underline" onClick={() => setFiltro("stock_bajo")}>Ver</button>
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["todos", "tienda", "menu", "stock_bajo"] as const).map((f) => (
          <Button
            key={f}
            variant={filtro === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltro(f)}
          >
            {f === "todos" ? "Todos" : f === "tienda" ? "Tienda" : f === "menu" ? "Menú del día" : "⚠ Stock bajo"}
          </Button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio USD</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {productosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Sin productos
                  </TableCell>
                </TableRow>
              )}
              {productosFiltrados.map((p) => {
                const stockBajo = p.activo && p.stock <= p.stock_min;
                return (
                  <TableRow key={p.id} className={!p.activo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORIA_LABEL[p.categoria]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatUsd(p.precio_usd)}</TableCell>
                    <TableCell className="text-right">
                      <span className={stockBajo ? "text-orange-600 font-semibold" : ""}>
                        {p.stock}
                        {stockBajo && <AlertTriangle className="inline h-3.5 w-3.5 ml-1" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.stock_min}</TableCell>
                    <TableCell>
                      <Badge variant={p.activo ? "secondary" : "destructive"}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Acciones</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirEditar(p)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { entradaForm.reset(); setModalEntrada(p); }}>
                            <PackagePlus className="h-4 w-4 mr-2" /> Entrada de stock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { ajusteForm.reset(); setModalAjuste(p); }}>
                            <SlidersHorizontal className="h-4 w-4 mr-2" /> Ajuste manual
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => abrirHistorial(p)}>
                            <History className="h-4 w-4 mr-2" /> Historial
                          </DropdownMenuItem>
                          {p.activo && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDesactivar(p)}
                            >
                              Desactivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal: Crear producto */}
      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo producto</DialogTitle></DialogHeader>
          <form onSubmit={crearForm.handleSubmit(onCrear)} className="space-y-4">
            <Field label="Nombre" error={crearForm.formState.errors.nombre?.message}>
              <Input {...crearForm.register("nombre")} placeholder="Empanada de queso" />
            </Field>
            <Field label="Categoría" error={crearForm.formState.errors.categoria?.message}>
              <Select
                defaultValue="tienda"
                onValueChange={(v) => crearForm.setValue("categoria", v as "tienda" | "menu")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tienda">Tienda</SelectItem>
                  <SelectItem value="menu">Menú del día</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Precio USD" error={crearForm.formState.errors.precioUsd?.message}>
              <Input {...crearForm.register("precioUsd", { valueAsNumber: true })} type="number" step="0.01" placeholder="1.50" />
            </Field>
            <Field label="Stock mínimo (alerta)" error={crearForm.formState.errors.stockMin?.message}>
              <Input {...crearForm.register("stockMin", { valueAsNumber: true })} type="number" placeholder="5" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalCrear(false)}>Cancelar</Button>
              <Button type="submit" disabled={crearForm.formState.isSubmitting}>
                {crearForm.formState.isSubmitting ? "Creando..." : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar producto */}
      <Dialog open={!!modalEditar} onOpenChange={(o) => !o && setModalEditar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar — {modalEditar?.nombre}</DialogTitle></DialogHeader>
          <form onSubmit={editarForm.handleSubmit(onEditar)} className="space-y-4">
            <Field label="Nombre" error={editarForm.formState.errors.nombre?.message}>
              <Input {...editarForm.register("nombre")} />
            </Field>
            <Field label="Categoría" error={editarForm.formState.errors.categoria?.message}>
              <Select
                value={editarForm.watch("categoria")}
                onValueChange={(v) => editarForm.setValue("categoria", v as "tienda" | "menu")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tienda">Tienda</SelectItem>
                  <SelectItem value="menu">Menú del día</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Precio USD" error={editarForm.formState.errors.precioUsd?.message}>
              <Input {...editarForm.register("precioUsd", { valueAsNumber: true })} type="number" step="0.01" />
            </Field>
            <Field label="Stock mínimo" error={editarForm.formState.errors.stockMin?.message}>
              <Input {...editarForm.register("stockMin", { valueAsNumber: true })} type="number" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEditar(null)}>Cancelar</Button>
              <Button type="submit" disabled={editarForm.formState.isSubmitting}>
                {editarForm.formState.isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Entrada de stock */}
      <Dialog open={!!modalEntrada} onOpenChange={(o) => !o && setModalEntrada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrada de stock — {modalEntrada?.nombre}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Stock actual: <strong>{modalEntrada?.stock}</strong></p>
          <form onSubmit={entradaForm.handleSubmit(onEntrada)} className="space-y-4">
            <Field label="Cantidad a añadir" error={entradaForm.formState.errors.cantidad?.message}>
              <Input {...entradaForm.register("cantidad", { valueAsNumber: true })} type="number" min="1" placeholder="10" autoFocus />
            </Field>
            <Field label="Motivo (opcional)" error={undefined}>
              <Input {...entradaForm.register("motivo")} placeholder="Compra a proveedor" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEntrada(null)}>Cancelar</Button>
              <Button type="submit" disabled={entradaForm.formState.isSubmitting}>
                {entradaForm.formState.isSubmitting ? "Registrando..." : "Registrar entrada"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Ajuste manual */}
      <Dialog open={!!modalAjuste} onOpenChange={(o) => !o && setModalAjuste(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste manual — {modalAjuste?.nombre}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Stock actual: <strong>{modalAjuste?.stock}</strong></p>
          <form onSubmit={ajusteForm.handleSubmit(onAjuste)} className="space-y-4">
            <Field label="Cantidad (positivo suma, negativo resta)" error={ajusteForm.formState.errors.cantidad?.message}>
              <Input {...ajusteForm.register("cantidad", { valueAsNumber: true })} type="number" placeholder="-3 o +5" autoFocus />
            </Field>
            <Field label="Motivo (obligatorio)" error={ajusteForm.formState.errors.motivo?.message}>
              <Input {...ajusteForm.register("motivo")} placeholder="Merma por vencimiento" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAjuste(null)}>Cancelar</Button>
              <Button type="submit" disabled={ajusteForm.formState.isSubmitting}>
                {ajusteForm.formState.isSubmitting ? "Guardando..." : "Aplicar ajuste"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial de movimientos */}
      <Dialog open={!!modalHistorial} onOpenChange={(o) => !o && setModalHistorial(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Historial — {modalHistorial?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {movimientos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos registrados</p>
            ) : (
              <div className="space-y-1">
                {movimientos.map((m, i) => (
                  <div key={m.id}>
                    <div className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`font-medium ${TIPO_MOVIMIENTO[m.tipo]?.color}`}>
                          {TIPO_MOVIMIENTO[m.tipo]?.label}
                        </span>
                        <span className={m.cantidad > 0 ? "text-green-600" : "text-red-600"}>
                          {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                        </span>
                        {m.motivo && (
                          <span className="text-muted-foreground truncate max-w-[160px]">{m.motivo}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(m.created_at).toLocaleDateString("es-VE", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {i < movimientos.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
