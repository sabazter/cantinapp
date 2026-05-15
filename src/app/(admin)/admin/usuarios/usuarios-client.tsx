"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Ban, KeyRound } from "lucide-react";

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

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  telefono: string | null;
  activo: boolean;
  mfa_habilitado: boolean;
  created_at: string;
}

// ── Schemas Zod ───────────────────────────────────────────────────────────────

const crearSchema = z.object({
  nombre:   z.string().min(2, "Mínimo 2 caracteres"),
  email:    z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  rol:      z.enum(["admin", "vendedor", "representante", "directivo"]),
  telefono: z.string().max(20).optional(),
});

const editarSchema = z.object({
  nombre:   z.string().min(2, "Mínimo 2 caracteres"),
  telefono: z.string().max(20).optional(),
  rol:      z.enum(["admin", "vendedor", "representante", "directivo"]),
});

const pwdSchema = z.object({
  password:  z.string().min(8, "Mínimo 8 caracteres"),
  confirmar: z.string(),
}).refine((d) => d.password === d.confirmar, {
  message: "Las contraseñas no coinciden",
  path: ["confirmar"],
});

type CrearForm  = z.infer<typeof crearSchema>;
type EditarForm = z.infer<typeof editarSchema>;
type PwdForm    = z.infer<typeof pwdSchema>;

// ── ROL labels ────────────────────────────────────────────────────────────────

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador", vendedor: "Vendedor",
  representante: "Representante", directivo: "Directivo", superadmin: "Super Admin",
};

const ROL_COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "default", vendedor: "secondary", representante: "outline",
  directivo: "outline", superadmin: "destructive",
};

// ── Componente principal ──────────────────────────────────────────────────────

export function UsuariosClient() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [modalCrear,  setModalCrear]  = useState(false);
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null);
  const [modalPwd,    setModalPwd]    = useState<Usuario | null>(null);

  const fetchUsuarios = async () => {
    const res = await fetch("/api/admin/usuarios");
    if (res.ok) setUsuarios(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchUsuarios(); }, []);

  // ── Crear ──────────────────────────────────────────────────────────────────
  const crearForm = useForm<CrearForm>({ resolver: zodResolver(crearSchema) });

  const onCrear = async (data: CrearForm) => {
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Usuario creado");
      setModalCrear(false);
      crearForm.reset();
      fetchUsuarios();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Error al crear usuario");
    }
  };

  // ── Editar ─────────────────────────────────────────────────────────────────
  const editarForm = useForm<EditarForm>({ resolver: zodResolver(editarSchema) });

  const abrirEditar = (u: Usuario) => {
    editarForm.reset({ nombre: u.nombre, telefono: u.telefono ?? "", rol: u.rol as EditarForm["rol"] });
    setModalEditar(u);
  };

  const onEditar = async (data: EditarForm) => {
    if (!modalEditar) return;
    const res = await fetch(`/api/admin/usuarios/${modalEditar.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Usuario actualizado");
      setModalEditar(null);
      fetchUsuarios();
    } else {
      toast.error("Error al actualizar");
    }
  };

  // ── Cambiar contraseña ─────────────────────────────────────────────────────
  const pwdForm = useForm<PwdForm>({ resolver: zodResolver(pwdSchema) });

  const onCambiarPwd = async (data: PwdForm) => {
    if (!modalPwd) return;
    const res = await fetch(`/api/admin/usuarios/${modalPwd.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: data.password }),
    });
    if (res.ok) {
      toast.success("Contraseña actualizada");
      setModalPwd(null);
      pwdForm.reset();
    } else {
      toast.error("Error al actualizar contraseña");
    }
  };

  // ── Desactivar ─────────────────────────────────────────────────────────────
  const onDesactivar = async (u: Usuario) => {
    if (!confirm(`¿Desactivar la cuenta de ${u.nombre}?`)) return;
    const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      toast.success("Usuario desactivado");
      fetchUsuarios();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Error al desactivar");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de cuentas de acceso a CantinApp
          </p>
        </div>
        <Button onClick={() => { crearForm.reset(); setModalCrear(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo usuario
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin usuarios registrados
                  </TableCell>
                </TableRow>
              )}
              {usuarios.map((u) => (
                <TableRow key={u.id} className={!u.activo ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROL_COLOR[u.rol] ?? "outline"}>
                      {ROL_LABEL[u.rol] ?? u.rol}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.mfa_habilitado
                      ? <Badge variant="default">Activo</Badge>
                      : <Badge variant="outline">No</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.activo ? "secondary" : "destructive"}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                        <span className="sr-only">Acciones</span>
                        <Pencil className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => abrirEditar(u)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { pwdForm.reset(); setModalPwd(u); }}>
                          <KeyRound className="h-4 w-4 mr-2" /> Cambiar contraseña
                        </DropdownMenuItem>
                        {u.activo && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDesactivar(u)}
                          >
                            <Ban className="h-4 w-4 mr-2" /> Desactivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal: Crear usuario */}
      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={crearForm.handleSubmit(onCrear)} className="space-y-4">
            <FormField label="Nombre completo" error={crearForm.formState.errors.nombre?.message}>
              <Input {...crearForm.register("nombre")} placeholder="Ana García" />
            </FormField>
            <FormField label="Email" error={crearForm.formState.errors.email?.message}>
              <Input {...crearForm.register("email")} type="email" placeholder="ana@cantinapp.com" />
            </FormField>
            <FormField label="Contraseña" error={crearForm.formState.errors.password?.message}>
              <Input {...crearForm.register("password")} type="password" />
            </FormField>
            <FormField label="Rol" error={crearForm.formState.errors.rol?.message}>
              <Select onValueChange={(v) => crearForm.setValue("rol", v as CrearForm["rol"])}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="representante">Representante</SelectItem>
                  <SelectItem value="directivo">Directivo</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Teléfono (opcional)" error={undefined}>
              <Input {...crearForm.register("telefono")} placeholder="+58 412 000 0000" />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalCrear(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crearForm.formState.isSubmitting}>
                {crearForm.formState.isSubmitting ? "Creando..." : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar usuario */}
      <Dialog open={!!modalEditar} onOpenChange={(o) => !o && setModalEditar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={editarForm.handleSubmit(onEditar)} className="space-y-4">
            <FormField label="Nombre completo" error={editarForm.formState.errors.nombre?.message}>
              <Input {...editarForm.register("nombre")} />
            </FormField>
            <FormField label="Teléfono" error={undefined}>
              <Input {...editarForm.register("telefono")} />
            </FormField>
            <FormField label="Rol" error={editarForm.formState.errors.rol?.message}>
              <Select
                value={editarForm.watch("rol")}
                onValueChange={(v) => editarForm.setValue("rol", v as EditarForm["rol"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="representante">Representante</SelectItem>
                  <SelectItem value="directivo">Directivo</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
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

      {/* Modal: Cambiar contraseña */}
      <Dialog open={!!modalPwd} onOpenChange={(o) => !o && setModalPwd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña — {modalPwd?.nombre}</DialogTitle>
          </DialogHeader>
          <form onSubmit={pwdForm.handleSubmit(onCambiarPwd)} className="space-y-4">
            <FormField label="Nueva contraseña" error={pwdForm.formState.errors.password?.message}>
              <Input {...pwdForm.register("password")} type="password" />
            </FormField>
            <FormField label="Confirmar contraseña" error={pwdForm.formState.errors.confirmar?.message}>
              <Input {...pwdForm.register("confirmar")} type="password" />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalPwd(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pwdForm.formState.isSubmitting}>
                {pwdForm.formState.isSubmitting ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper FormField ──────────────────────────────────────────────────────────

function FormField({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
