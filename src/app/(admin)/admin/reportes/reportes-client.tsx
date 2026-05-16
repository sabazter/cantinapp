"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Producto {
  nombre: string;
  categoria: string;
  cantidadVendida: number;
  ingresoUsd: number;
}

interface Vendedor {
  nombre: string;
  ventas: number;
  totalUsd: number;
  fiados: number;
  anulaciones: number;
}

interface DeudorRow {
  nombre: string;
  curso: string;
  saldo: number;
  ultimaVentaFecha: string | null;
  diasDeuda: number;
}

interface DeudasData {
  deudores: DeudorRow[];
  porRango: { rango: string; count: number; totalUsd: number }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtUsd  = (n: number) => `$${n.toFixed(2)}`;
const COLORES  = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function Spinner() {
  return (
    <div className="flex justify-center items-center py-16 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Cargando...</span>
    </div>
  );
}

function PeriodoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "30")}>
      <SelectTrigger className="w-36 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Últimos 7 días</SelectItem>
        <SelectItem value="30">Últimos 30 días</SelectItem>
        <SelectItem value="90">Últimos 90 días</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ── Pestaña Productos ──────────────────────────────────────────────────────────

function TabProductos() {
  const [dias,     setDias]     = useState("30");
  const [data,     setData]     = useState<Producto[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/reportes/productos?dias=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(dias); }, [dias, load]);

  const top10 = data.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Ranking de productos</h2>
        <PeriodoSelect value={dias} onChange={v => { setDias(v); }} />
      </div>

      {loading ? <Spinner /> : data.length === 0 ? (
        <p className="text-center text-muted-foreground py-16 text-sm">Sin datos para el período</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfica */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Top 10 por cantidad vendida</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                    tickFormatter={v => v.length > 16 ? v.slice(0, 15) + "…" : v}
                  />
                  <Tooltip
                    formatter={(v, _n, props) => [
                      `${Number(v ?? 0)} uds · ${fmtUsd((props?.payload as Producto)?.ingresoUsd ?? 0)}`,
                      "Vendido",
                    ]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="cantidadVendida" radius={[0, 4, 4, 0]}>
                    {top10.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabla */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Detalle completo</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[340px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cat.</TableHead>
                      <TableHead className="text-right">Uds</TableHead>
                      <TableHead className="text-right">Ingreso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((p, i) => (
                      <TableRow key={p.nombre}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{p.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {p.categoria === "menu" ? "Menú" : "Tienda"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.cantidadVendida}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{fmtUsd(p.ingresoUsd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Pestaña Vendedores ─────────────────────────────────────────────────────────

function TabVendedores() {
  const [dias,    setDias]    = useState("30");
  const [data,    setData]    = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/reportes/vendedores?dias=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(dias); }, [dias, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Rendimiento por vendedor</h2>
        <PeriodoSelect value={dias} onChange={setDias} />
      </div>

      {loading ? <Spinner /> : data.length === 0 ? (
        <p className="text-center text-muted-foreground py-16 text-sm">Sin datos para el período</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfica */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Total USD por vendedor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="nombre"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v.split(" ")[0]}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `$${v}`}
                    width={44}
                  />
                  <Tooltip
                    formatter={(v) => [fmtUsd(Number(v ?? 0)), "Total USD"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="totalUsd" radius={[4, 4, 0, 0]}>
                    {data.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabla */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Detalle</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Total USD</TableHead>
                    <TableHead className="text-right">Fiados</TableHead>
                    <TableHead className="text-right">Anuladas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(v => (
                    <TableRow key={v.nombre}>
                      <TableCell className="font-medium text-sm">{v.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.ventas}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtUsd(v.totalUsd)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {v.fiados > 0
                          ? <Badge variant="secondary" className="text-[10px]">{v.fiados}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {v.anulaciones > 0
                          ? <Badge variant="destructive" className="text-[10px]">{v.anulaciones}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Pestaña Deudas ─────────────────────────────────────────────────────────────

function TabDeudas() {
  const [data,    setData]    = useState<DeudasData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reportes/deudas")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <Spinner />;
  if (!data)   return null;

  const RANGO_COLOR: Record<string, string> = {
    "0–7 días":   "#10b981",
    "8–30 días":  "#f59e0b",
    "31–90 días": "#ef4444",
    "+90 días":   "#7f1d1d",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Deudas por antigüedad</h2>

      {data.deudores.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
          <p className="text-sm font-medium text-green-600">Sin deudas pendientes</p>
          <p className="text-xs">Todos los alumnos están al día</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Resumen por rango */}
          <div className="space-y-3">
            {data.porRango.filter(r => r.count > 0).map(r => (
              <Card key={r.rango}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{r.rango}</p>
                    <p className="text-lg font-bold" style={{ color: RANGO_COLOR[r.rango] }}>
                      {r.count} alumno{r.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmtUsd(r.totalUsd)}</p>
                    <p className="text-xs text-muted-foreground">adeudado</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {data.porRango.every(r => r.count === 0) && (
              <p className="text-sm text-muted-foreground">Sin deudas clasificadas</p>
            )}
          </div>

          {/* Lista de deudores */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">
                Deudores ({data.deudores.length}) — Total: {fmtUsd(data.deudores.reduce((s, d) => s + Math.abs(d.saldo), 0))}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Antigüedad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.deudores.map(d => {
                      const rango = d.diasDeuda <= 7  ? "0–7 días"
                                  : d.diasDeuda <= 30 ? "8–30 días"
                                  : d.diasDeuda <= 90 ? "31–90 días"
                                  : "+90 días";
                      return (
                        <TableRow key={d.nombre + d.curso}>
                          <TableCell className="font-medium text-sm">{d.nombre}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{d.curso}</TableCell>
                          <TableCell className="text-right tabular-nums text-red-600 font-semibold">
                            {fmtUsd(d.saldo)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{ color: RANGO_COLOR[rango], borderColor: RANGO_COLOR[rango] }}
                            >
                              {d.diasDeuda >= 999 ? "+90d" : `${d.diasDeuda}d`}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export function ReportesClient() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Análisis de ventas, productos y deudas
        </p>
      </div>

      <Tabs defaultValue="productos">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="deudas">Deudas</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="productos"><TabProductos /></TabsContent>
          <TabsContent value="vendedores"><TabVendedores /></TabsContent>
          <TabsContent value="deudas"><TabDeudas /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
