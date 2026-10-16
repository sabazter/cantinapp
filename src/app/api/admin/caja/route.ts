import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { rangoDia } from "@/lib/legacy";

// GET /api/admin/caja?fecha=YYYY-MM-DD — resumen de cierre de caja
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const rango = rangoDia(fecha);

  const ventas = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: rango },
    select: { totalUsd: true, totalBs: true, metodoPago: true },
  });

  // Calcular totales por método de pago
  type Metodo = "efectivo_usd" | "efectivo_bs" | "pago_movil" | "fiado";
  const porMetodo: Record<Metodo, { usd: number; bs: number; count: number }> = {
    efectivo_usd: { usd: 0, bs: 0, count: 0 },
    efectivo_bs:  { usd: 0, bs: 0, count: 0 },
    pago_movil:   { usd: 0, bs: 0, count: 0 },
    fiado:        { usd: 0, bs: 0, count: 0 },
  };

  let totalUsd = 0;
  let totalBs  = 0;

  for (const v of ventas) {
    const usd = v.totalUsd.toNumber();
    const bs  = v.totalBs.toNumber();
    const m = porMetodo[v.metodoPago];
    m.usd   += usd;
    m.bs    += bs;
    m.count += 1;
    totalUsd += usd;
    totalBs  += bs;
  }

  // Abonos confirmados del día (RLS limita a alumnos de la cantina)
  const abonosDelDia = await db.abono.findMany({
    where: {
      estado: "confirmado",
      deletedAt: null,
      confirmadoAt: rango,
      cuentaAlumno: { alumno: { cantinaId } },
    },
    select: { montoUsd: true },
  });

  const totalAbonosUsd = abonosDelDia.reduce((s, a) => s + a.montoUsd.toNumber(), 0);

  return NextResponse.json({
    fecha,
    ventas: {
      count:    ventas.length,
      totalUsd,
      totalBs,
      porMetodo,
    },
    abonos: {
      count:    abonosDelDia.length,
      totalUsd: totalAbonosUsd,
    },
  });
});
