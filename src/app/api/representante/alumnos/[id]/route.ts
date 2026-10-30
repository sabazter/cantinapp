import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/representante/alumnos/[id] — detalle + historial de compras
// Verifica que el alumno pertenece al representante autenticado (§3.4)
export const GET = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "representante");
  const { id } = await params;

  const alumno = await db.alumno.findFirst({
    where: { id, representanteId: session.user.id, deletedAt: null },
    select: {
      id: true, nombre: true, curso: true, seccion: true, activo: true,
      cuenta: { select: { saldo: true } },
    },
  });
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const pagina = Math.max(1, parseInt(searchParams.get("pagina") ?? "1") || 1);
  const porPagina = 25;

  const ventas = await db.venta.findMany({
    where: { alumnoId: id, deletedAt: null },
    select: {
      id: true, totalUsd: true, totalBs: true, tasaBcv: true, metodoPago: true, esFiado: true, createdAt: true,
      vendedor: { select: { nombre: true } },
      detalles: {
        select: {
          id: true,
          cantidad: true, precioUsdUnitario: true,
          producto: { select: { nombre: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (pagina - 1) * porPagina,
    take: porPagina,
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    entidadId: id,
    datos:     { accion: "portal_representante_detalle" },
  });

  return NextResponse.json({
    alumno: legacy(alumno),
    ventas: legacy(ventas),
    pagina,
    porPagina,
  });
});
