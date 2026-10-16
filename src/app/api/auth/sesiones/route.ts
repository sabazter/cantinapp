import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { audit, AuditEvent } from "@/lib/audit";

// DELETE /api/auth/sesiones — revoca todos los refresh tokens del usuario autenticado
export const DELETE = withAuth(async (_req: NextRequest, session) => {
  await db.refreshToken.updateMany({
    where: { usuarioId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.SESIONES_REVOCADAS,
  });

  return new NextResponse(null, { status: 204 });
});
