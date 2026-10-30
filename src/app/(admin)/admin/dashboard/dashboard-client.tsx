"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, DollarSign, ClipboardCheck, Users,
  MessageCircle, ExternalLink, ArrowUpRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Deudor {
  alumnoId: string;
  nombre: string;
  curso: string;
  seccion: string;
  deudaUsd: number;
  deudaBs: number;
  representanteNombre: string;
  representanteTel: string | null;
  limiteFiadoUsd: number | null;
  fiadoHabilitado: boolean;
}

interface DashboardData {
  ventasHoy: { count: number; totalUsd: number };
  abonosPendientes: { count: number; totalUsd: number };
  alumnosActivos: number;
  totalDeudaUsd: number;
  tasaBcv: number;
  topDeudores: Deudor[];
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtBs(n: number) {
  return `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DashboardClient({ nombreAdmin }: { nombreAdmin: string }) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando métricas de fiado...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No se pudieron cargar los datos del panel.
      </div>
    );
  }

  const kpis = [
    {
      title: "Ventas hoy ($ por cobrar)",
      value: fmtUsd(data.ventasHoy.totalUsd),
      sub: `${data.ventasHoy.count} transacciones registradas`,
      icon: DollarSign,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      title: "Abonos por verificar",
      value: String(data.abonosPendientes.count),
      sub: `${fmtUsd(data.abonosPendientes.totalUsd)} pendientes de confirmación`,
      icon: ClipboardCheck,
      color: data.abonosPendientes.count > 0 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-slate-600 bg-slate-50 border-slate-200",
      action: data.abonosPendientes.count > 0 ? { href: "/admin/abonos", label: "Ver abonos" } : undefined,
    },
    {
      title: "Cuentas activas",
      value: String(data.alumnosActivos),
      sub: `Tasa BCV del día: ${data.tasaBcv.toFixed(2)} Bs/$`,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Saludo */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Control de Fiados</h1>
          <p className="text-sm text-muted-foreground">
            Hola, <span className="font-semibold text-foreground">{nombreAdmin}</span>. Resumen de cuentas por cobrar y abonos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/abonos" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            Revisar Abonos ({data.abonosPendientes.count})
          </Link>
          <Link href="/caja" className={buttonVariants({ size: "sm" })}>
            <DollarSign className="h-4 w-4 mr-1.5" />
            Ir a Caja (POS)
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={i} className="relative overflow-hidden shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {k.title}
                </CardTitle>
                <div className={`p-2 rounded-lg border ${k.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{k.value}</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{k.sub}</p>
                  {k.action && (
                    <Link
                      href={k.action.href}
                      className="text-xs font-medium text-amber-700 hover:underline flex items-center gap-0.5"
                    >
                      {k.action.label} <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top 10 Clientes que más deben */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Top 10 Clientes que más deben
              </CardTitle>
              <CardDescription>
                Cuentas de fiado con mayor saldo deudor acumulado
              </CardDescription>
            </div>
            <Link href="/admin/alumnos" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Ver todos los alumnos <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead>Representante / Contacto</TableHead>
                <TableHead className="text-right">Deuda (USD)</TableHead>
                <TableHead className="text-right">Deuda (Bs)</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topDeudores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    🎉 ¡Excelente! No hay clientes con deuda pendiente en este momento.
                  </TableCell>
                </TableRow>
              ) : (
                data.topDeudores.map((d, index) => {
                  const rank = index + 1;
                  const rankColor =
                    rank === 1
                      ? "bg-red-500 text-white"
                      : rank === 2
                      ? "bg-orange-500 text-white"
                      : rank === 3
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground";

                  const telLimpio = d.representanteTel ? d.representanteTel.replace(/\D/g, "") : null;
                  const wsUrl = telLimpio
                    ? `https://wa.me/${telLimpio}?text=${encodeURIComponent(
                        `Hola, le escribimos de la cantina escolar respecto al saldo pendiente de ${d.nombre} por un monto de $${d.deudaUsd.toFixed(2)}.`
                      )}`
                    : null;

                  return (
                    <TableRow key={d.alumnoId}>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rankColor}`}>
                          {rank}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{d.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.curso} {d.seccion ? `• Sec. ${d.seccion}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{d.representanteNombre}</div>
                        {d.representanteTel ? (
                          <div className="text-xs text-muted-foreground">{d.representanteTel}</div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin teléfono registrado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono font-bold text-red-600 text-sm">
                          {fmtUsd(d.deudaUsd)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {fmtBs(d.deudaBs)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {wsUrl && (
                            <a
                              href={wsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonVariants({ variant: "ghost", size: "icon" }) + " text-emerald-600 hover:bg-emerald-50"}
                              title="Contactar por WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          )}
                          <Link
                            href={`/admin/abonos?alumnoId=${d.alumnoId}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Abonar
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
