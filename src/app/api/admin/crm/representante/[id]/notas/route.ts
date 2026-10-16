import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const notasSchema = z.object({ notas: z.string().max(2000) });

// PUT /api/admin/crm/representante/[id]/notas
export const PUT = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  // Verificar que pertenece a la cantina
  const data = await db.usuario.findFirst({
    where: { id, cantinaId, rol: "representante" },
    select: { id: true },
  });

  if (!data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await validateBody(req, notasSchema);

  await db.usuario.update({ where: { id }, data: { notasCrm: body.notas } });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento: AuditEvent.ALUMNO_CONSULTADO,
    entidad: "usuarios",
    entidadId: id,
    datos: { accion: "notas_crm_actualizado" },
  });

  return NextResponse.json({ ok: true });
});
