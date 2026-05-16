"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types & schemas ────────────────────────────────────────────────────────────

interface Cantina {
  id: string;
  nombre: string;
  escuela: string;
  direccion: string | null;
  notifEmail: boolean;
  notifWhatsapp: boolean;
  createdAt: string;
  _count: { usuarios: number; alumnos: number };
}

const schema = z.object({
  nombre:    z.string().min(2, "Mínimo 2 caracteres").max(100),
  escuela:   z.string().min(2, "Mínimo 2 caracteres").max(150),
  direccion: z.string().max(200).optional(),
});

type FormData = z.infer<typeof schema>;

// ── Componente ─────────────────────────────────────────────────────────────────

export function CantinasClient() {
  const [cantinas, setCantinas]   = useState<Cantina[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dialogOpen, setDialog]   = useState(false);
  const [editTarget, setEdit]     = useState<Cantina | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/superadmin/cantinas");
    if (res.ok) setCantinas(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEdit(null);
    reset({ nombre: "", escuela: "", direccion: "" });
    setDialog(true);
  }

  function openEdit(c: Cantina) {
    setEdit(c);
    reset({ nombre: c.nombre, escuela: c.escuela, direccion: c.direccion ?? "" });
    setDialog(true);
  }

  async function onSubmit(data: FormData) {
    const url    = editTarget ? `/api/superadmin/cantinas/${editTarget.id}` : "/api/superadmin/cantinas";
    const method = editTarget ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Error al guardar");
      return;
    }

    toast.success(editTarget ? "Cantina actualizada" : "Cantina creada");
    setDialog(false);
    load();
  }

  async function handleDelete(c: Cantina) {
    if (!confirm(`¿Eliminar "${c.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(c.id);

    const res = await fetch(`/api/superadmin/cantinas/${c.id}`, { method: "DELETE" });
    setDeleting(null);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "No se pudo eliminar");
      return;
    }

    toast.success("Cantina eliminada");
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cantinas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de cantinas en el sistema</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva cantina
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {loading ? "Cargando..." : `${cantinas.length} cantina${cantinas.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cantina</TableHead>
                <TableHead>Escuela</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead className="text-right">Alumnos</TableHead>
                <TableHead className="text-right">Notif.</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cantinas.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                    Sin cantinas registradas
                  </TableCell>
                </TableRow>
              ) : (
                cantinas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.escuela}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      {c.direccion ?? <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.usuarios}</TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.alumnos}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.notifEmail     && <Badge variant="outline" className="text-[9px]">Email</Badge>}
                        {c.notifWhatsapp  && <Badge variant="outline" className="text-[9px]">WA</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(c)}
                          disabled={deleting === c.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar cantina" : "Nueva cantina"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre de la cantina *</Label>
              <Input {...register("nombre")} placeholder="Cantina Escolar" />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Escuela / Institución *</Label>
              <Input {...register("escuela")} placeholder="U.E. La República" />
              {errors.escuela && <p className="text-xs text-destructive">{errors.escuela.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input {...register("direccion")} placeholder="Av. Principal, Caracas" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : editTarget ? "Guardar cambios" : "Crear cantina"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
