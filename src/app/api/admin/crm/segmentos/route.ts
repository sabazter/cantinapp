import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";

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

  // Alumnos activos con cuenta
  const alumnos = await db.alumno.findMany({
    where: { cantinaId, activo: true, deletedAt: null },
    select: {
      id: true, nombre: true, curso: true, seccion: true, fiadoHabilitado: true,
      limiteFiadoUsd: true, createdAt: true,
      cuenta: { select: { saldo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  // Ventas por alumno (últimos 90 días)
  const hace90 = new Date(Date.now() - 90 * 86_400_000);
  const ventas = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: { gte: hace90 }, alumnoId: { not: null } },
    select: { alumnoId: true, totalUsd: true, createdAt: true },
  });

  // Agrupar ventas por alumno
  const ventasPorAlumno = new Map<string, { total: number; count: number; ultima: Date | null }>();
  for (const v of ventas) {
    const id = v.alumnoId!;
    const prev = ventasPorAlumno.get(id) ?? { total: 0, count: 0, ultima: null };
    ventasPorAlumno.set(id, {
      total: prev.total + v.totalUsd.toNumber(),
      count: prev.count + 1,
      ultima: !prev.ultima || v.createdAt > prev.ultima ? v.createdAt : prev.ultima,
    });
  }

  const cantina = await db.cantina.findUnique({
    where: { id: cantinaId },
    select: { umbralDeudaUsd: true },
  });
  const umbral = cantina?.umbralDeudaUsd.toNumber() ?? 20;

  const hoy = Date.now();
  const resultado: AlumnoSegmentado[] = [];

  for (const a of alumnos) {
    const saldo = a.cuenta?.saldo.toNumber() ?? 0;
    const deuda = saldo < 0 ? Math.abs(saldo) : 0;

    const stats = ventasPorAlumno.get(a.id) ?? { total: 0, count: 0, ultima: null };
    const diasSinComprar = stats.ultima
      ? Math.floor((hoy - stats.ultima.getTime()) / 86_400_000)
      : 999;

    // Calcular segmento según reglas de negocio
    const diasDesdeCreacion = Math.floor((hoy - a.createdAt.getTime()) / 86_400_000);
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
      fiadoHabilitado: a.fiadoHabilitado,
      limiteFiadoUsd: a.limiteFiadoUsd?.toNumber() ?? 0,
      segmento,
      totalVentas: stats.count,
      gastoTotalUsd: Math.round(stats.total * 100) / 100,
      diasSinComprar,
      ultimaCompraAt: stats.ultima?.toISOString() ?? null,
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
