import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { rangoDia } from "@/lib/legacy";
import { tasaActivaBcv } from "@/lib/bcv";

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const hoy       = new Date().toISOString().slice(0, 10);

  // Consultas en serie (comparten la conexión de la transacción del request bajo RLS)
  const ventasHoyData = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: rangoDia(hoy) },
    select: { totalUsd: true, metodoPago: true },
  });

  const alumnosActivos = await db.alumno.count({
    where: { cantinaId, activo: true, deletedAt: null },
  });

  const abonosPendientesData = await db.abono.findMany({
    where: {
      estado: "pendiente",
      deletedAt: null,
      cuentaAlumno: { alumno: { cantinaId } },
    },
    select: { montoUsd: true },
  });

  const deudoresData = await db.cuentaAlumno.findMany({
    where: {
      saldo: { lt: 0 },
      alumno: { cantinaId, activo: true, deletedAt: null },
    },
    include: {
      alumno: {
        select: {
          id: true,
          nombre: true,
          curso: true,
          seccion: true,
          fiadoHabilitado: true,
          limiteFiadoUsd: true,
          representante: {
            select: { nombre: true, telefono: true },
          },
        },
      },
    },
    orderBy: { saldo: "asc" },
    take: 10,
  });

  const tasaInfo = await tasaActivaBcv(cantinaId);
  const tasaBcv  = tasaInfo?.tasa ?? 1;

  // Ventas de hoy ($ por cobrar)
  const ventasHoyUsd = ventasHoyData.reduce((s, v) => s + v.totalUsd.toNumber(), 0);

  // Abonos pendientes por verificar
  const abonosPendientesUsd = abonosPendientesData.reduce((s, a) => s + a.montoUsd.toNumber(), 0);

  // Mapear Top 10 Clientes que más deben
  const topDeudores = deudoresData.map((row) => {
    const al = row.alumno;
    const rep = al?.representante;
    const deudaUsd = Math.abs(row.saldo.toNumber());
    const deudaBs  = deudaUsd * tasaBcv;

    return {
      alumnoId:            al.id,
      nombre:              al.nombre,
      curso:               al.curso,
      seccion:             al.seccion ?? "",
      deudaUsd:            +deudaUsd.toFixed(2),
      deudaBs:             +deudaBs.toFixed(2),
      representanteNombre: rep?.nombre ?? "Sin representante",
      representanteTel:    rep?.telefono ?? null,
      limiteFiadoUsd:      al.limiteFiadoUsd ? al.limiteFiadoUsd.toNumber() : null,
      fiadoHabilitado:     al.fiadoHabilitado,
    };
  });

  const totalDeudaUsd = topDeudores.reduce((sum, d) => sum + d.deudaUsd, 0);

  return NextResponse.json({
    ventasHoy: {
      count:    ventasHoyData.length,
      totalUsd: +ventasHoyUsd.toFixed(2),
    },
    abonosPendientes: {
      count:    abonosPendientesData.length,
      totalUsd: +abonosPendientesUsd.toFixed(2),
    },
    alumnosActivos,
    totalDeudaUsd: +totalDeudaUsd.toFixed(2),
    tasaBcv,
    topDeudores,
  });
});
