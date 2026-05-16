"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Users } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UsuarioGlobal {
  id:            string;
  nombre:        string;
  email:         string;
  rol:           string;
  activo:        boolean;
  mfaHabilitado: boolean;
  createdAt:     string;
  cantina:       { id: string; nombre: string; escuela: string } | null;
}

// ── Labels ─────────────────────────────────────────────────────────────────────

const ROL_LABEL: Record<string, string> = {
  admin:         "Administrador",
  vendedor:      "Vendedor",
  representante: "Representante",
  directivo:     "Directivo",
};

const ROL_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  admin:         "default",
  vendedor:      "secondary",
  representante: "outline",
  directivo:     "outline",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function UsuariosGlobalesClient() {
  const [usuarios, setUsuarios]   = useState<UsuarioGlobal[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [q,        setQ]          = useState("");
  const [rolFilter, setRolFilter] = useState("todos");

  const load = useCallback(async (query: string, rol: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (rol !== "todos") params.set("rol", rol);
    const res = await fetch(`/api/superadmin/usuarios?${params}`);
    if (res.ok) setUsuarios(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(q, rolFilter), 300);
    return () => clearTimeout(timer);
  }, [q, rolFilter, load]);

  const total = usuarios.length;
  const activos = usuarios.filter(u => u.activo).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios globales</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Todos los usuarios del sistema en todas las cantinas
        </p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",       value: total,         color: "text-foreground"    },
          { label: "Activos",     value: activos,       color: "text-green-600"     },
          { label: "Inactivos",   value: total - activos, color: "text-muted-foreground" },
          { label: "Con MFA",     value: usuarios.filter(u => u.mfaHabilitado).length, color: "text-blue-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar por nombre o email..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <Select value={rolFilter} onValueChange={v => setRolFilter(v ?? "todos")}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="vendedor">Vendedor</SelectItem>
            <SelectItem value="representante">Representante</SelectItem>
            <SelectItem value="directivo">Directivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {loading ? "Cargando..." : `${total} usuario${total !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando usuarios...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Cantina</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">MFA</TableHead>
                    <TableHead className="text-right">Alta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                        Sin usuarios que coincidan
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuarios.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-sm">{u.nombre}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={ROL_VARIANT[u.rol] ?? "outline"} className="text-[10px]">
                            {ROL_LABEL[u.rol] ?? u.rol}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {u.cantina ? (
                            <div>
                              <p className="font-medium leading-none">{u.cantina.nombre}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{u.cantina.escuela}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={u.activo ? "outline" : "destructive"}
                            className="text-[10px]"
                          >
                            {u.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {u.mfaHabilitado ? (
                            <Badge variant="secondary" className="text-[10px]">Activo</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {new Date(u.createdAt).toLocaleDateString("es-VE", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
