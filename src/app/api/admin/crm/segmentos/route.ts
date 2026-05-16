import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// Segmentos de clientes según §11.3 del spec de CRM
export type Segmento =
  | "buenos_pagadores"
  | "deudores_frecuentes"
  | "clientes_frecuentes"
  | "en_riesgo"
  | "alto_valor"
  | "deuda_antigua"
  | "inactivos"
  | "nuevos";

interface AlumnoSegmentado {
  id: string;
  nombre: string;
  curso: string;
  seccion: string | null;
  saldo: number;
  fiadoHabilitado: boolean;
  limiteFiadoUsd: number;
  segmento: Segmento;
  totalVentas: number;
  gastoTotalUsd: number;
  diasSinComprar: number;
  ultimaCompraAt: string | null;
}

// GET /api/admin/crm/segmentos?segmento=<tipo>
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const filtroSegmento = searchParams.get("segmento");

  const supabase = createServerSupabase();

  // Alumnos activos con cuenta
  const { data: alumnos, error } = await supabase
    .from("alumnos")
    .select("id, nombre, curso, seccion, fiado_habilitado, limite_fiado_usd, created_at, cuentas_alumnos(saldo)")
    .eq("cantina_id", cantinaId)
    .eq("activo", true)
    .is("deleted_at", null)
    .order("nombre");

  if (error) throw error;

  // Ventas por alumno (últimos 90 días)
  const hace90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: ventas } = await supabase
    .from("ventas")
    .select("alumno_id, total_usd, created_at")
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .gte("created_at", hace90)
    .not("alumno_id", "is", null);

  // Agrupar ventas por alumno
  const ventasPorAlumno = new Map<string, { total: number; count: number; ultima: string | null }>();
  for (const v of ventas ?? []) {
    const id = v.alumno_id!;
    const prev = ventasPorAlumno.get(id) ?? { total: 0, count: 0, ultima: null };
    const nueva = v.created_at;
    ventasPorAlumno.set(id, {
      total: prev.total + Number(v.total_usd),
      count: prev.count + 1,
      ultima: !prev.ultima || nueva > prev.ultima ? nueva : prev.ultima,
    });
  }

  const { data: cantina } = await supabase
    .from("cantinas")
    .select("umbral_deuda_usd")
    .eq("id", cantinaId)
    .single();
  const umbral = Number(cantina?.umbral_deuda_usd ?? 20);

  const hoy = Date.now();
  const resultado: AlumnoSegmentado[] = [];

  for (const a of alumnos ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cuentaRaw = a.cuentas_alumnos as any;
    const saldo = Number(Array.isArray(cuentaRaw) ? cuentaRaw[0]?.saldo ?? 0 : cuentaRaw?.saldo ?? 0);
    const deuda = saldo < 0 ? Math.abs(saldo) : 0;

    const stats = ventasPorAlumno.get(a.id) ?? { total: 0, count: 0, ultima: null };
    const diasSinComprar = stats.ultima
      ? Math.floor((hoy - new Date(stats.ultima).getTime()) / 86_400_000)
      : 999;

    // Calcular segmento según reglas de negocio
    const diasDesdeCreacion = Math.floor((hoy - new Date(a.created_at).getTime()) / 86_400_000);
    let segmento: Segmento;

    if (diasDesdeCreacion <= 30 && stats.count === 0) {
      segmento = "nuevos";
    } else if (diasSinComprar >= 30) {
      segmento = "inactivos";
    } else if (deuda >= umbral * 1.5) {
      segmento = "deuda_antigua";
    } else if (deuda >= umbral) {
      segmento = "en_riesgo";
    } else if (stats.total >= 50) {
      segmento = "alto_valor";
    } else if (deuda > 0 && stats.count >= 8) {
      segmento = "deudores_frecuentes";
    } else if (stats.count >= 8 && deuda === 0) {
      segmento = "clientes_frecuentes";
    } else {
      segmento = "buenos_pagadores";
    }

    if (filtroSegmento && segmento !== filtroSegmento) continue;

    resultado.push({
      id: a.id,
      nombre: a.nombre,
      curso: a.curso,
      seccion: a.seccion,
      saldo,
      fiadoHabilitado: a.fiado_habilitado,
      limiteFiadoUsd: Number(a.limite_fiado_usd ?? 0),
      segmento,
      totalVentas: stats.count,
      gastoTotalUsd: Math.round(stats.total * 100) / 100,
      diasSinComprar,
      ultimaCompraAt: stats.ultima,
    });
  }

  // Resumen por segmento (solo si no se filtra)
  const resumen: Record<string, number> = {};
  if (!filtroSegmento) {
    for (const a of resultado) {
      resumen[a.segmento] = (resumen[a.segmento] ?? 0) + 1;
    }
  }

  return NextResponse.json({ alumnos: resultado, resumen });
});
