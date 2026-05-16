import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const notasSchema = z.object({ notas: z.string().max(2000) });

// PUT /api/admin/crm/representante/[id]/notas
export const PUT = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;
  const supabase = createServerSupabase();

  // Verificar que pertenece a la cantina
  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", id)
    .eq("cantina_id", cantinaId)
    .eq("rol", "representante")
    .single();

  if (!data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await validateBody(req, notasSchema);

  const { error } = await supabase
    .from("usuarios")
    .update({ notas_crm: body.notas })
    .eq("id", id);

  if (error) throw error;

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
