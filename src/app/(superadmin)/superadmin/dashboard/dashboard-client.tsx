"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Users, GraduationCap, ShoppingCart } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CantinaRow {
  id: string;
  nombre: string;
  escuela: string;
  createdAt: string;
  _count: { alumnos: number; usuarios: number; ventas: number };
}

interface DashData {
  totalCantinas:  number;
  totalAlumnos:   number;
  totalUsuarios:  number;
  totalVentas:    number;
  cantinas:       CantinaRow[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SuperadminDashboardClient() {
  const [data,    setData]    = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/superadmin/dashboard")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando métricas...</span>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      title: "Cantinas activas",
      value: data.totalCantinas,
      icon:  Building2,
      color: "text-blue-600",
    },
    {
      title: "Usuarios totales",
      value: data.totalUsuarios,
      icon:  Users,
      color: "text-emerald-600",
    },
    {
      title: "Alumnos activos",
      value: data.totalAlumnos,
      icon:  GraduationCap,
      color: "text-violet-600",
    },
    {
      title: "Ventas en sistema",
      value: data.totalVentas,
      icon:  ShoppingCart,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel Superadmin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Vista global de todas las cantinas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Listado de cantinas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cantinas registradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cantina</TableHead>
                <TableHead>Escuela</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead className="text-right">Alumnos</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cantinas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                    Sin cantinas registradas
                  </TableCell>
                </TableRow>
              ) : (
                data.cantinas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.escuela}</TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.usuarios}</TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.alumnos}</TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.ventas}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px]">
                        {new Date(c.createdAt).toLocaleDateString("es-VE", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Acceso rápido a gestión */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/superadmin/cantinas",          label: "Gestionar cantinas"      },
          { href: "/superadmin/usuarios-globales", label: "Usuarios globales"       },
          { href: "/superadmin/audit-log",         label: "Registro de auditoría"   },
        ].map(link => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-md border px-4 py-3 text-sm font-medium text-center hover:bg-accent transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>

    </div>
  );
}
