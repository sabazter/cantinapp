"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, Users, ClipboardList } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardData {
  ventasHoy:      { count: number; totalUsd: number };
  fiadoPendiente: { count: number; totalUsd: number };
  stockBajo:      number;
  alumnosActivos: number;
  ventasSemana:   { fecha: string; count: number; totalUsd: number }[];
  porMetodoPago:  { metodo: string; totalUsd: number }[];
}

const METODO_LABEL: Record<string, string> = {
  efectivo_usd: "Efectivo USD",
  efectivo_bs:  "Efectivo Bs",
  pago_movil:   "Pago Móvil",
  fiado:        "Fiado",
};

const COLORES_METODO = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtFecha(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DashboardClient({ nombreAdmin }: { nombreAdmin: string }) {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
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
      title: "Ventas hoy",
      value: fmtUsd(data.ventasHoy.totalUsd),
      sub:   `${data.ventasHoy.count} transacciones`,
      icon:  TrendingUp,
      color: "text-green-600",
    },
    {
      title: "Abonos pendientes",
      value: String(data.fiadoPendiente.count),
      sub:   `${fmtUsd(data.fiadoPendiente.totalUsd)} por confirmar`,
      icon:  ClipboardList,
      color: data.fiadoPendiente.count > 0 ? "text-amber-600" : "text-muted-foreground",
    },
    {
      title: "Productos stock bajo",
      value: String(data.stockBajo),
      sub:   data.stockBajo > 0 ? "Requieren reposición" : "Todo en orden",
      icon:  AlertTriangle,
      color: data.stockBajo > 0 ? "text-red-600" : "text-muted-foreground",
    },
    {
      title: "Alumnos activos",
      value: String(data.alumnosActivos),
      sub:   "En la cantina",
      icon:  Users,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Bienvenido, {nombreAdmin}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Panel de administración — CantinApp</p>
      </div>

      {/* KPI Cards */}
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
                <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ventas últimos 7 días */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ventas últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.ventasSemana} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={fmtFecha}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                  width={48}
                />
                <Tooltip
                  formatter={(v) => [fmtUsd(Number(v ?? 0)), "Total USD"]}
                  labelFormatter={(l) => fmtFecha(String(l))}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="totalUsd"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorVentas)"
                  dot={{ r: 3, fill: "#3b82f6" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Por método de pago (hoy) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métodos de pago hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {data.porMetodoPago.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sin ventas hoy</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.porMetodoPago} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="metodo"
                      tickFormatter={m => METODO_LABEL[m]?.split(" ")[0] ?? m}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v) => [fmtUsd(Number(v ?? 0)), "Total"]}
                      labelFormatter={(m) => METODO_LABEL[String(m)] ?? String(m)}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                    />
                    <Bar dataKey="totalUsd" radius={[4, 4, 0, 0]}>
                      {data.porMetodoPago.map((_, i) => (
                        <Cell key={i} fill={COLORES_METODO[i % COLORES_METODO.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {data.porMetodoPago.map((m, i) => (
                    <div key={m.metodo} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: COLORES_METODO[i % COLORES_METODO.length] }}
                        />
                        <span className="text-muted-foreground">{METODO_LABEL[m.metodo] ?? m.metodo}</span>
                      </div>
                      <span className="font-medium tabular-nums">{fmtUsd(m.totalUsd)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerta stock bajo si hay */}
      {data.stockBajo > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{data.stockBajo}</strong> producto{data.stockBajo > 1 ? "s" : ""} con stock por debajo del mínimo.{" "}
            <a href="/admin/inventario" className="underline font-medium">Ver inventario</a>
          </span>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/admin/inventario",   label: "Inventario"    },
          { href: "/admin/alumnos",      label: "Alumnos"       },
          { href: "/admin/reportes",     label: "Reportes"      },
          { href: "/admin/configuracion/mfa", label: "Configuración" },
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
