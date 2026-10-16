import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";

// GET /api/representante/alumnos — hijos del representante autenticado
// Solo devuelve alumnos donde representanteId === usuario autenticado (§3.4)
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;

  const data = await db.alumno.findMany({
    where: { representanteId, deletedAt: null },
    select: {
      id: true, nombre: true, curso: true, seccion: true, activo: true,
      cuenta: { select: { saldo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  await audit({
    usuarioId: representanteId,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    datos:     { accion: "portal_representante_lista" },
  });

  return NextResponse.json(legacy(data));
});
