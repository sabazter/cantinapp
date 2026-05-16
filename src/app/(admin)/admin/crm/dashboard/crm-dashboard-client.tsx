"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  AlertTriangle, Clock, TrendingUp, DollarSign, CreditCard, ShoppingBag,
  Users, BarChart3, ArrowRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
  hoy: { totalVentas: number; montoVentasUsd: number; fiadoUsd: number; abonosUsd: number };
  deuda: { totalUsd: number; alumnosEnDeuda: number; umbral: number };
  tendenciaSemanal: { fecha: string; total: number }[];
  topProductosHoy: { nombre: string; cantidad: number }[];
  alertas: { tipo: string; mensaje: string; severidad: "alta" | "media" | "baja" }[];
}
interface AnalisisItem {
  nombre?: string; curso?: string; categoria?: string;
  volumen?: number; ingresos?: number; totalUsd?: number;
  count?: number; promUsd?: number; deudaUsd?: number;
  totalVentas?: number; montoUsd?: number; fiadoUsd?: number; anulaciones?: number; tasaAnulacion?: number;
}

const SEVERIDAD_STYLE: Record<string, string> = {
  alta:  "bg-red-50 border-red-200 text-red-700",
  media: "bg-amber-50 border-amber-200 text-amber-700",
  baja:  "bg-blue-50 border-blue-200 text-blue-700",
};
const TIPO_ICON: Record<string, React.ReactNode> = {
  deuda_critica: <AlertTriangle className="w-4 h-4" />,
  inactividad:   <Clock className="w-4 h-4" />,
  pico_fiado:    <CreditCard className="w-4 h-4" />,
};

export default function CrmDashboardClient() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisItem[]>([]);
  const [tipoAnalisis, setTipoAnalisis] = useState("productos");
  const [diasAnalisis, setDiasAnalisis] = useState("30");
  const [loadingDash, setLoadingDash] = useState(true);
  const [loadingAnalisis, setLoadingAnalisis] = useState(true);

  useEffect(() => {
    fetch("/api/admin/crm/dashboard")
      .then(r => r.json())
      .then(setDash)
      .finally(() => setLoadingDash(false));
  }, []);

  const cargarAnalisis = (tipo: string, dias: string) => {
    setLoadingAnalisis(true);
    fetch(`/api/admin/crm/analisis?tipo=${tipo}&dias=${dias}`)
      .then(r => r.json())
      .then(d => setAnalisis(d.items ?? []))
      .finally(() => setLoadingAnalisis(false));
  };

  useEffect(() => { cargarAnalisis(tipoAnalisis, diasAnalisis); }, [tipoAnalisis, diasAnalisis]);

  const handleTipo = (v: string | null) => { if (v) setTipoAnalisis(v); };
  const handleDias = (v: string | null) => { if (v) setDiasAnalisis(v); };

  if (loadingDash) return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando dashboard CRM…</div>;
  if (!dash)       return <div className="flex items-center justify-center h-64 text-destructive">Error cargando datos</div>;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard CRM</h1>
          <p className="text-muted-foreground text-sm">Análisis de comportamiento y finanzas de la cantina</p>
        </div>
        <Link href="/admin/crm">
          <Button variant="outline" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Segmentación <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Alertas activas */}
      {dash.alertas.length > 0 && (
        <div className="space-y-2">
          {dash.alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 border rounded-lg px-4 py-2 text-sm font-medium ${SEVERIDAD_STYLE[a.severidad]}`}>
              {TIPO_ICON[a.tipo] ?? <AlertTriangle className="w-4 h-4" />}
              {a.mensaje}
            </div>
          ))}
        </div>
      )}

      {/* KPIs hoy */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<ShoppingBag />}  label="Ventas hoy"      value={dash.hoy.totalVentas.toString()} />
        <KpiCard icon={<DollarSign />}   label="Monto hoy"       value={`$${dash.hoy.montoVentasUsd.toFixed(2)}`} />
        <KpiCard icon={<CreditCard />}   label="Fiado hoy"       value={`$${dash.hoy.fiadoUsd.toFixed(2)}`}
          valueClass={dash.hoy.fiadoUsd > 0 ? "text-amber-600" : ""} />
        <KpiCard icon={<TrendingUp />}   label="Abonos cobrados" value={`$${dash.hoy.abonosUsd.toFixed(2)}`}
          valueClass={dash.hoy.abonosUsd > 0 ? "text-emerald-600" : ""} />
      </div>

      {/* Deuda total */}
      <Card className={dash.deuda.alumnosEnDeuda > 0 ? "border-red-200" : ""}>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Deuda total pendiente</p>
            <p className={`text-3xl font-bold ${dash.deuda.alumnosEnDeuda > 0 ? "text-destructive" : "text-emerald-600"}`}>
              ${dash.deuda.totalUsd.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {dash.deuda.alumnosEnDeuda} alumno{dash.deuda.alumnosEnDeuda !== 1 ? "s" : ""} en deuda · Umbral: ${dash.deuda.umbral.toFixed(0)}
            </p>
          </div>
          <Link href="/admin/crm?segmento=en_riesgo">
            <Button variant="outline" size="sm">Ver alumnos en riesgo</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Tendencia semanal */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="w-4 h-4" /> Ventas últimos 7 días</CardTitle></CardHeader>
        <CardContent>
          {dash.tendenciaSemanal.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin ventas en este período</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dash.tendenciaSemanal}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "Ventas"]} labelFormatter={v => `Fecha: ${v}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top productos del día */}
      {dash.topProductosHoy.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Top productos del día</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dash.topProductosHoy.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-5 text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{p.nombre}</span>
                      <span className="text-muted-foreground">×{p.cantidad}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(p.cantidad / dash.topProductosHoy[0].cantidad) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análisis de comportamiento */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Análisis de comportamiento</CardTitle>
            <div className="flex gap-2">
              <Select value={tipoAnalisis} onValueChange={handleTipo}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="productos">Productos</SelectItem>
                  <SelectItem value="cursos">Por curso</SelectItem>
                  <SelectItem value="vendedores">Vendedores</SelectItem>
                </SelectContent>
              </Select>
              <Select value={diasAnalisis} onValueChange={handleDias}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="90">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAnalisis ? (
            <div className="text-center text-muted-foreground text-sm py-8">Calculando…</div>
          ) : analisis.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">Sin datos para este período</div>
          ) : tipoAnalisis === "productos" ? (
            <TablaProductos items={analisis} />
          ) : tipoAnalisis === "cursos" ? (
            <TablaCursos items={analisis} />
          ) : (
            <TablaVendedores items={analisis} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-tablas ───────────────────────────────────────────────────────────────
function TablaProductos({ items }: { items: AnalisisItem[] }) {
  return (
    <div className="divide-y">
      <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground pb-2">
        <span>Producto</span><span className="text-center">Categoría</span>
        <span className="text-right">Unidades</span><span className="text-right">Ingresos</span>
      </div>
      {items.map((p, i) => (
        <div key={i} className="grid grid-cols-4 py-2 text-sm">
          <span className="font-medium">{p.nombre}</span>
          <span className="text-center">
            <Badge variant="outline" className="text-xs">{p.categoria === "menu" ? "Menú" : "Tienda"}</Badge>
          </span>
          <span className="text-right font-mono">{p.volumen}</span>
          <span className="text-right font-mono">${p.ingresos?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function TablaCursos({ items }: { items: AnalisisItem[] }) {
  return (
    <div className="divide-y">
      <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground pb-2">
        <span>Curso</span><span className="text-right">Compras</span>
        <span className="text-right">Total gastado</span><span className="text-right">Deuda actual</span>
      </div>
      {items.map((c, i) => (
        <div key={i} className="grid grid-cols-4 py-2 text-sm">
          <span className="font-medium">{c.curso}</span>
          <span className="text-right">{c.count}</span>
          <span className="text-right font-mono">${c.totalUsd?.toFixed(2)}</span>
          <span className={`text-right font-mono ${(c.deudaUsd ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            ${c.deudaUsd?.toFixed(2) ?? "0.00"}
          </span>
        </div>
      ))}
    </div>
  );
}

function TablaVendedores({ items }: { items: AnalisisItem[] }) {
  return (
    <div className="divide-y">
      <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground pb-2">
        <span>Vendedor</span><span className="text-right">Ventas</span>
        <span className="text-right">Monto</span><span className="text-right">Fiado</span>
        <span className="text-right">Anulaciones</span>
      </div>
      {items.map((v, i) => (
        <div key={i} className="grid grid-cols-5 py-2 text-sm">
          <span className="font-medium">{v.nombre}</span>
          <span className="text-right">{v.totalVentas}</span>
          <span className="text-right font-mono">${v.montoUsd?.toFixed(2)}</span>
          <span className="text-right font-mono text-amber-600">${v.fiadoUsd?.toFixed(2)}</span>
          <span className={`text-right ${(v.anulaciones ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {v.anulaciones} ({Math.round((v.tasaAnulacion ?? 0) * 100)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon, label, value, valueClass = "" }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <span className="w-4 h-4">{icon}</span>
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
