import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";

// GET /api/alumno — portal exclusivo del estudiante
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "alumno");

  const userId = session.user.id;

  // Buscar alumno por id
  const alumno = await db.alumno.findFirst({
    where: {
      OR: [{ id: userId }, { representanteId: userId }],
      deletedAt: null,
    },
    select: {
      id: true,
      nombre: true,
      curso: true,
      seccion: true,
      qrCode: true,
      fiadoHabilitado: true,
      limiteFiadoUsd: true,
      cuenta: {
        select: { saldo: true },
      },
      representante: {
        select: { nombre: true, telefono: true },
      },
    },
  });

  if (!alumno) {
    return NextResponse.json({ error: "Perfil de alumno no encontrado" }, { status: 404 });
  }

  // Cargar sus compras detalladas con productos y vendedor
  const ventas = await db.venta.findMany({
    where: { alumnoId: alumno.id, deletedAt: null },
    select: {
      id: true,
      totalUsd: true,
      totalBs: true,
      tasaBcv: true,
      metodoPago: true,
      esFiado: true,
      createdAt: true,
      vendedor: { select: { nombre: true } },
      detalles: {
        select: {
          id: true,
          cantidad: true,
          precioUsdUnitario: true,
          producto: { select: { nombre: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({
    alumno: {
      id:       alumno.id,
      nombre:   alumno.nombre,
      curso:    alumno.curso,
      seccion:  alumno.seccion,
      saldo:    alumno.cuenta ? alumno.cuenta.saldo.toNumber() : 0,
      telefono: alumno.representante?.telefono ?? session.user.email,
    },
    ventas: legacy(ventas),
  });
});
