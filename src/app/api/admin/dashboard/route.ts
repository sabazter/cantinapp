import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { rangoDia } from "@/lib/legacy";

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const hoy       = new Date().toISOString().slice(0, 10);
  const hace6d    = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  // Consultas en serie: comparten la conexión de la transacción del request
  const ventasHoy = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: rangoDia(hoy) },
    select: { totalUsd: true, metodoPago: true },
  });

  const ventasSemanaData = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: { gte: rangoDia(hace6d).gte } },
    select: { totalUsd: true, metodoPago: true, createdAt: true },
  });

  const prodStock = await db.producto.findMany({
    where: { cantinaId, activo: true },
    select: { stock: true, stockMin: true },
  });

  const alumnosActivos = await db.alumno.count({ where: { cantinaId, activo: true, deletedAt: null } });

  // Los abonos no tienen cantina_id propio: se resuelve a través del alumno
  const fiadoPendiente = await db.abono.findMany({
    where: { estado: "pendiente", deletedAt: null, cuentaAlumno: { alumno: { cantinaId } } },
    select: { montoUsd: true },
  });

  // KPIs del día
  const ventasHoyUsd = ventasHoy.reduce((s, v) => s + v.totalUsd.toNumber(), 0);

  // Por método de pago (hoy)
  const metodosMap: Record<string, number> = {};
  for (const v of ventasHoy) {
    metodosMap[v.metodoPago] = (metodosMap[v.metodoPago] ?? 0) + v.totalUsd.toNumber();
  }
  const porMetodoPago = Object.entries(metodosMap).map(([metodo, totalUsd]) => ({ metodo, totalUsd }));

  // Fiado pendiente (abonos en revisión)
  const fiadoPendienteUsd = fiadoPendiente.reduce((s, a) => s + a.montoUsd.toNumber(), 0);

  // Stock bajo
  const stockBajoCount = prodStock.filter(p => p.stock <= p.stockMin).length;

  // Ventas agrupadas por día (últimos 7 días)
  const ventasPorDia: Record<string, { count: number; totalUsd: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    ventasPorDia[d] = { count: 0, totalUsd: 0 };
  }
  for (const v of ventasSemanaData) {
    const d = v.createdAt.toISOString().slice(0, 10);
    if (ventasPorDia[d]) {
      ventasPorDia[d].count    += 1;
      ventasPorDia[d].totalUsd  = +(ventasPorDia[d].totalUsd + v.totalUsd.toNumber()).toFixed(2);
    }
  }
  const ventasSemana = Object.entries(ventasPorDia).map(([fecha, data]) => ({ fecha, ...data }));

  return NextResponse.json({
    ventasHoy:      { count: ventasHoy.length, totalUsd: +ventasHoyUsd.toFixed(2) },
    fiadoPendiente: { count: fiadoPendiente.length, totalUsd: +fiadoPendienteUsd.toFixed(2) },
    stockBajo:      stockBajoCount,
    alumnosActivos,
    ventasSemana,
    porMetodoPago,
  });
});
