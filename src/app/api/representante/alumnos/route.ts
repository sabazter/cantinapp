import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

// GET /api/representante/alumnos — hijos del representante autenticado
// Solo devuelve alumnos donde representante_id === usuario autenticado (§3.4)
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("alumnos")
    .select(`
      id, nombre, curso, seccion, activo,
      cuentas_alumnos ( saldo )
    `)
    .eq("representante_id", representanteId)
    .is("deleted_at", null)
    .order("nombre");

  if (error) throw error;

  await audit({
    usuarioId: representanteId,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    datos:     { accion: "portal_representante_lista" },
  });

  return NextResponse.json(data ?? []);
});
