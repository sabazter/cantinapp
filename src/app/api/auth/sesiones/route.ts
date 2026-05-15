import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

// DELETE /api/auth/sesiones — revoca todos los refresh tokens del usuario autenticado
export const DELETE = withAuth(async (_req: NextRequest, session) => {
  const supabase = createServerSupabase();

  await supabase
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("usuario_id", session.user.id)
    .is("revoked_at", null);

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.SESIONES_REVOCADAS,
  });

  return new NextResponse(null, { status: 204 });
});
