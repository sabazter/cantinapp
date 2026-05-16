"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Eye, Users, AlertTriangle, TrendingUp, Star } from "lucide-react";
import type { Segmento } from "@/app/api/admin/crm/segmentos/route";

// ─── Config de segmentos ──────────────────────────────────────────────────────
const SEGMENTO_CONFIG: Record<Segmento, { label: string; color: string; desc: string }> = {
  buenos_pagadores:   { label: "Buenos pagadores",    color: "bg-emerald-100 text-emerald-800", desc: "Sin deuda, compran regularmente" },
  clientes_frecuentes:{ label: "Clientes frecuentes", color: "bg-blue-100 text-blue-800",       desc: "8+ compras en 90 días, sin deuda" },
  alto_valor:         { label: "Alto valor",           color: "bg-purple-100 text-purple-800",   desc: "Gasto >$50 en 90 días" },
  deudores_frecuentes:{ label: "Deudores frecuentes", color: "bg-amber-100 text-amber-800",     desc: "Compran mucho pero tienen deuda" },
  en_riesgo:          { label: "En riesgo",            color: "bg-orange-100 text-orange-800",   desc: "Deuda igual o mayor al umbral" },
  deuda_antigua:      { label: "Deuda antigua",        color: "bg-red-100 text-red-800",         desc: "Deuda crítica (>1.5× umbral)" },
  inactivos:          { label: "Inactivos",            color: "bg-gray-100 text-gray-600",       desc: "Sin compras en 30+ días" },
  nuevos:             { label: "Nuevos",               color: "bg-sky-100 text-sky-800",         desc: "Registrados hace ≤30 días" },
};

interface AlumnoRow {
  id: string; nombre: string; curso: string; seccion: string | null;
  saldo: number; segmento: Segmento; totalVentas: number;
  gastoTotalUsd: number; diasSinComprar: number;
}

export default function CrmClient() {
  const router = useRouter();
  const [alumnos, setAlumnos] = useState<AlumnoRow[]>([]);
  const [resumen, setResumen] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filtroSegmento, setFiltroSegmento] = useState<string>("todos");
  const [q, setQ] = useState("");

  const cargar = (seg: string) => {
    setLoading(true);
    const params = seg !== "todos" ? `?segmento=${seg}` : "";
    fetch(`/api/admin/crm/segmentos${params}`)
      .then(r => r.json())
      .then(d => { setAlumnos(d.alumnos ?? []); if (d.resumen) setResumen(d.resumen); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar("todos"); }, []);

  const handleSegmento = (v: string) => { setFiltroSegmento(v); cargar(v); };

  const filtrados = q
    ? alumnos.filter(a =>
        a.nombre.toLowerCase().includes(q.toLowerCase()) ||
        a.curso.toLowerCase().includes(q.toLowerCase())
      )
    : alumnos;

  const totalAlumnos = Object.values(resumen).reduce((s, n) => s + n, 0);
  const totalEnRiesgo = (resumen["en_riesgo"] ?? 0) + (resumen["deuda_antigua"] ?? 0);
  const totalAltoValor = resumen["alto_valor"] ?? 0;
  const totalInactivos = resumen["inactivos"] ?? 0;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">CRM — Segmentación de Clientes</h1>
        <p className="text-muted-foreground text-sm">Análisis de comportamiento y estado financiero por alumno</p>
      </div>

      {/* KPIs de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="w-4 h-4" /><span className="text-xs">Total alumnos</span></div>
            <p className="text-2xl font-bold">{totalAlumnos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs">En riesgo</span></div>
            <p className="text-2xl font-bold text-red-600">{totalEnRiesgo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Star className="w-4 h-4 text-purple-500" /><span className="text-xs">Alto valor</span></div>
            <p className="text-2xl font-bold text-purple-600">{totalAltoValor}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><TrendingUp className="w-4 h-4 text-gray-400" /><span className="text-xs">Inactivos</span></div>
            <p className="text-2xl font-bold text-gray-500">{totalInactivos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chips de segmentos */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSegmento("todos")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filtroSegmento === "todos" ? "bg-foreground text-background" : "border-border hover:bg-muted"}`}
        >
          Todos ({totalAlumnos})
        </button>
        {(Object.entries(SEGMENTO_CONFIG) as [Segmento, typeof SEGMENTO_CONFIG[Segmento]][]).map(([key, conf]) => (
          <button
            key={key}
            onClick={() => handleSegmento(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filtroSegmento === key ? "ring-2 ring-offset-1 ring-foreground " + conf.color : "border-border hover:bg-muted"}`}
          >
            {conf.label} {resumen[key] !== undefined ? `(${resumen[key]})` : ""}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar alumno o curso…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {SEGMENTO_CONFIG[filtroSegmento as Segmento]?.label ?? "Todos los alumnos"} — {filtrados.length} alumno{filtrados.length !== 1 ? "s" : ""}
          </CardTitle>
          {filtroSegmento !== "todos" && SEGMENTO_CONFIG[filtroSegmento as Segmento] && (
            <p className="text-sm text-muted-foreground">{SEGMENTO_CONFIG[filtroSegmento as Segmento].desc}</p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Cargando…</div>
          ) : filtrados.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Sin resultados</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Compras (90d)</TableHead>
                  <TableHead className="text-right">Gasto (90d)</TableHead>
                  <TableHead className="text-right">Días sin comprar</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map(a => {
                  const segConf = SEGMENTO_CONFIG[a.segmento];
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{a.nombre}</p>
                          <p className="text-xs text-muted-foreground">{a.curso}{a.seccion ? ` · ${a.seccion}` : ""}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${segConf.color}`}>
                          {segConf.label}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${a.saldo < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        ${a.saldo.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{a.totalVentas}</TableCell>
                      <TableCell className="text-right font-mono text-sm">${a.gastoTotalUsd.toFixed(2)}</TableCell>
                      <TableCell className={`text-right text-sm ${a.diasSinComprar >= 14 ? "text-amber-600 font-semibold" : ""}`}>
                        {a.diasSinComprar >= 999 ? "Nunca" : `${a.diasSinComprar}d`}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/crm/${a.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
