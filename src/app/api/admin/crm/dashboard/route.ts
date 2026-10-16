import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";

// GET /api/admin/crm/dashboard
// Resumen CRM: ventas hoy, fiado hoy, abonos hoy, deuda total, alertas activas
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  const hace7  = new Date(Date.now() - 7 * 86_400_000);
  const hace14 = new Date(Date.now() - 14 * 86_400_000);

  // Ventas de hoy
  const ventasHoyArr = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: { gte: hoyInicio } },
    select: { id: true, totalUsd: true, esFiado: true },
  });
  const totalVentasHoy = ventasHoyArr.length;
  const montoVentasHoyUsd = ventasHoyArr.reduce((s, v) => s + v.totalUsd.toNumber(), 0);
  const fiadoHoyUsd = ventasHoyArr.filter(v => v.esFiado).reduce((s, v) => s + v.totalUsd.toNumber(), 0);

  // Abonos de hoy (de esta cantina, a través del alumno)
  const abonosHoyArr = await db.abono.findMany({
    where: { createdAt: { gte: hoyInicio }, cuentaAlumno: { alumno: { cantinaId } } },
    select: { montoUsd: true, estado: true },
  });
  const abonosHoyUsd = abonosHoyArr
    .filter(a => a.estado === "confirmado")
    .reduce((s, a) => s + a.montoUsd.toNumber(), 0);

  // Deuda total (saldo negativo en cuentas)
  const cuentas = await db.cuentaAlumno.findMany({
    where: { alumno: { cantinaId, activo: true, deletedAt: null } },
    select: { saldo: true },
  });

  let deudaTotalUsd = 0;
  let alumnosEnDeuda = 0;
  for (const c of cuentas) {
    const s = c.saldo.toNumber();
    if (s < 0) { deudaTotalUsd += Math.abs(s); alumnosEnDeuda++; }
  }

  // Umbral
  const cantina = await db.cantina.findUnique({
    where: { id: cantinaId },
    select: { umbralDeudaUsd: true },
  });
  const umbral = cantina?.umbralDeudaUsd.toNumber() ?? 20;

  // Tendencia semanal (últimos 7 días, agrupar por día)
  const ventasSemana = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: { gte: hace7 } },
    select: { totalUsd: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const tendencia: Record<string, number> = {};
  for (const v of ventasSemana) {
    const day = v.createdAt.toISOString().slice(0, 10);
    tendencia[day] = (tendencia[day] ?? 0) + v.totalUsd.toNumber();
  }
  const tendenciaArr = Object.entries(tendencia).map(([fecha, total]) => ({ fecha, total: Math.round(total * 100) / 100 }));

  // Top 5 productos del día
  let topProductosHoy: { nombre: string; cantidad: number }[] = [];
  if (ventasHoyArr.length > 0) {
    const detalles = await db.detalleVenta.findMany({
      where: { ventaId: { in: ventasHoyArr.map(v => v.id) } },
      select: { cantidad: true, producto: { select: { nombre: true } } },
    });

    const map = new Map<string, number>();
    for (const d of detalles) {
      const nombre = d.producto?.nombre ?? "?";
      map.set(nombre, (map.get(nombre) ?? 0) + d.cantidad);
    }
    topProductosHoy = Array.from(map.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }

  // Alertas activas
  const alertas: { tipo: string; mensaje: string; severidad: "alta" | "media" | "baja" }[] = [];

  // Alumnos con deuda alta
  const alumnosDeudaAlta = alumnosEnDeuda;
  if (alumnosDeudaAlta > 0) {
    alertas.push({
      tipo: "deuda_critica",
      mensaje: `${alumnosDeudaAlta} alumno${alumnosDeudaAlta !== 1 ? "s" : ""} con deuda ≥ $${umbral.toFixed(0)}`,
      severidad: "alta",
    });
  }

  // Alumnos inactivos (sin compras en 14 días)
  const ultimasVentas = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: { gte: hace14 }, alumnoId: { not: null } },
    select: { alumnoId: true },
  });
  const alumnosActivosReciente = new Set(ultimasVentas.map(v => v.alumnoId));

  const alumnosActivos = await db.alumno.findMany({
    where: { cantinaId, activo: true, deletedAt: null },
    select: { id: true },
  });

  const inactivos = alumnosActivos.filter(a => !alumnosActivosReciente.has(a.id)).length;
  if (inactivos > 0) {
    alertas.push({
      tipo: "inactividad",
      mensaje: `${inactivos} alumno${inactivos !== 1 ? "s" : ""} sin compras en 14+ días`,
      severidad: "media",
    });
  }

  // Pico de fiado hoy
  const pctFiado = montoVentasHoyUsd > 0 ? fiadoHoyUsd / montoVentasHoyUsd : 0;
  if (pctFiado > 0.5 && fiadoHoyUsd > 0) {
    alertas.push({
      tipo: "pico_fiado",
      mensaje: `Hoy el ${Math.round(pctFiado * 100)}% de las ventas fueron a fiado ($${fiadoHoyUsd.toFixed(2)})`,
      severidad: "media",
    });
  }

  return NextResponse.json({
    hoy: {
      totalVentas: totalVentasHoy,
      montoVentasUsd: Math.round(montoVentasHoyUsd * 100) / 100,
      fiadoUsd: Math.round(fiadoHoyUsd * 100) / 100,
      abonosUsd: Math.round(abonosHoyUsd * 100) / 100,
    },
    deuda: {
      totalUsd: Math.round(deudaTotalUsd * 100) / 100,
      alumnosEnDeuda,
      umbral,
    },
    tendenciaSemanal: tendenciaArr,
    topProductosHoy,
    alertas,
  });
});
