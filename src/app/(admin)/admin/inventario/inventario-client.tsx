"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Eye, EyeOff, Trash2, UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
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
  precio_jornada_usd: string | null;
  activo: boolean;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const productoSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es requerido")
    .max(120, "Máximo 120 caracteres")
    .refine((val) => !/<[^>]*>/i.test(val) && !/[<>]/.test(val), {
      message: "No se permiten etiquetas HTML ni caracteres < o >",
    }),
  categoria: z.enum(["tienda", "menu"]),
  precioUsd: z.number().positive("Debe ser mayor a 0"),
});

const jornadaSchema = z.object({
  precioJornada: z.number().positive("Debe ser mayor a 0").nullable().optional(),
});

type ProductoForm = z.infer<typeof productoSchema>;
type JornadaForm  = z.infer<typeof jornadaSchema>;

// ── Helper form field ─────────────────────────────────────────────────────────

function Field({
  label, error, children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function InventarioClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtro, setFiltro]       = useState<"todos" | "tienda" | "menu">("todos");

  // Modales
  const [modalCrear, setModalCrear]     = useState(false);
  const [modalEditar, setModalEditar]   = useState<Producto | null>(null);
  const [modalJornada, setModalJornada] = useState<Producto | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchProductos = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/inventario");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProductos(data);
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  // ── Form crear ──────────────────────────────────────────────────────────────
  const crearForm = useForm<ProductoForm>({
    resolver: zodResolver(productoSchema),
    defaultValues: { categoria: "tienda" },
  });

  const onCrear = async (data: ProductoForm) => {
    const res = await fetch("/api/admin/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, stockMin: 0 }),
    });
    if (res.ok) {
      toast.success("Producto creado exitosamente");
      setModalCrear(false);
      crearForm.reset();
      fetchProductos();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Error al crear producto");
    }
  };

  // ── Form editar ─────────────────────────────────────────────────────────────
  const editarForm = useForm<ProductoForm>({ resolver: zodResolver(productoSchema) });

  const abrirEditar = (p: Producto) => {
    editarForm.reset({
      nombre:    p.nombre,
      categoria: p.categoria,
      precioUsd: Number(p.precio_usd),
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
      toast.success("Producto actualizado exitosamente");
      setModalEditar(null);
      fetchProductos();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Error al actualizar producto");
    }
  };

  // ── Precio jornada (menú del día) ─────────────────────────────────────────
  const jornadaForm = useForm<JornadaForm>({ resolver: zodResolver(jornadaSchema) });

  const abrirJornada = (p: Producto) => {
    jornadaForm.reset({ precioJornada: p.precio_jornada_usd ? Number(p.precio_jornada_usd) : null });
    setModalJornada(p);
  };

  const onJornada = async (data: JornadaForm) => {
    if (!modalJornada) return;
    const res = await fetch(`/api/admin/inventario/${modalJornada.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precioJornada: data.precioJornada }),
    });
    if (res.ok) {
      toast.success(data.precioJornada ? "Precio del día actualizado" : "Precio del día eliminado");
      setModalJornada(null);
      jornadaForm.reset();
      fetchProductos();
    } else {
      toast.error("Error al actualizar precio");
    }
  };

  // ── Activar / Desactivar ───────────────────────────────────────────────────
  const onToggleActivo = async (p: Producto, nuevoEstado: boolean) => {
    const accion = nuevoEstado ? "activar" : "desactivar";
    if (!confirm(`¿Deseas ${accion} el producto "${p.nombre}"?`)) return;
    const res = await fetch(`/api/admin/inventario/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: nuevoEstado }),
    });
    if (res.ok) {
      toast.success(`Producto ${nuevoEstado ? "activado" : "desactivado"}`);
      fetchProductos();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? `Error al ${accion} producto`);
    }
  };

  // ── Eliminar definitivamente ────────────────────────────────────────────────
  const onEliminar = async (p: Producto) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar permanentemente "${p.nombre}"?\n\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/inventario/${p.id}?permanent=true`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Producto eliminado exitosamente");
      if (modalEditar?.id === p.id) setModalEditar(null);
      fetchProductos();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo eliminar el producto");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const prodsFiltrados = productos.filter((p) => {
    if (filtro === "todos") return true;
    return p.categoria === filtro;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de productos y precios de venta
          </p>
        </div>
        <Button onClick={() => { crearForm.reset({ categoria: "tienda" }); setModalCrear(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo producto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["todos", "tienda", "menu"] as const).map((f) => (
          <Button
            key={f}
            variant={filtro === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltro(f)}
          >
            {f === "todos" ? "Todos" : f === "tienda" ? "Tienda" : "Menú del día"}
          </Button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando catálogo...</p>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio base (USD)</TableHead>
                <TableHead className="text-right">Precio hoy</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prodsFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay productos en esta categoría
                  </TableCell>
                </TableRow>
              ) : (
                prodsFiltrados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {p.categoria === "menu" ? "Menú del día" : "Tienda"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ${Number(p.precio_usd).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {p.precio_jornada_usd ? (
                        <span className="text-primary font-semibold">
                          ${Number(p.precio_jornada_usd).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.activo ? "default" : "secondary"}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Acciones</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirEditar(p)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {p.categoria === "menu" && (
                            <DropdownMenuItem onClick={() => abrirJornada(p)}>
                              <UtensilsCrossed className="h-4 w-4 mr-2" /> Precio menú hoy
                            </DropdownMenuItem>
                          )}
                          <Separator className="my-1" />
                          {p.activo ? (
                            <DropdownMenuItem onClick={() => onToggleActivo(p, false)}>
                              <EyeOff className="h-4 w-4 mr-2" /> Desactivar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => onToggleActivo(p, true)}>
                              <Eye className="h-4 w-4 mr-2 text-green-600" /> Activar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => onEliminar(p)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar definitivamente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
              <Input
                {...crearForm.register("precioUsd", { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder="1.50"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalCrear(false)}>
                Cancelar
              </Button>
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
              <Input
                {...editarForm.register("precioUsd", { valueAsNumber: true })}
                type="number"
                step="0.01"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEditar(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editarForm.formState.isSubmitting}>
                {editarForm.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Precio Menú Jornada */}
      <Dialog open={!!modalJornada} onOpenChange={(o) => !o && setModalJornada(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Precio del día — {modalJornada?.nombre}</DialogTitle></DialogHeader>
          <form onSubmit={jornadaForm.handleSubmit(onJornada)} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Define un precio temporal para hoy. Si lo dejas vacío, se usará el precio base ($
              {Number(modalJornada?.precio_usd ?? 0).toFixed(2)}).
            </p>
            <Field label="Precio USD hoy" error={jornadaForm.formState.errors.precioJornada?.message}>
              <Input
                type="number"
                step="0.01"
                placeholder="Ej. 2.00"
                {...jornadaForm.register("precioJornada", {
                  setValueAs: (v) => (v === "" || isNaN(Number(v)) ? null : Number(v)),
                })}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalJornada(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={jornadaForm.formState.isSubmitting}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
