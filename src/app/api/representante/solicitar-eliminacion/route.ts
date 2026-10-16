import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/resend";
import { emailSolicitudEliminacion } from "@/lib/email/templates";

// POST /api/representante/solicitar-eliminacion
export const POST = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");

  // Obtener admin de la cantina del representante
  const usuario = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { nombre: true, email: true, cantinaId: true },
  });

  const cantinaId = usuario?.cantinaId ?? null;

  // Registrar en audit log
  await audit({
    usuarioId: session.user.id,
    cantinaId: cantinaId ?? undefined,
    evento: "solicitud_eliminacion_datos",
    entidad: "usuario",
    entidadId: session.user.id,
  });

  // Notificar al admin
  if (cantinaId) {
    const admins = await db.usuario.findMany({
      where: { cantinaId, rol: "admin", activo: true },
      select: { email: true },
    });

    const adminEmails = admins.map(a => a.email);
    if (adminEmails.length > 0) {
      const tmpl = emailSolicitudEliminacion(
        usuario?.nombre ?? "Representante",
        usuario?.email ?? session.user.email,
      );
      await sendEmail({ to: adminEmails, ...tmpl });
    }
  }

  return NextResponse.json({ ok: true });
});
