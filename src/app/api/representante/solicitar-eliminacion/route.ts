import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/resend";
import { emailSolicitudEliminacion } from "@/lib/email/templates";

// POST /api/representante/solicitar-eliminacion
export const POST = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");

  const supabase = createServerSupabase();

  // Obtener admin de la cantina del representante
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, email, cantina_id")
    .eq("id", session.user.id)
    .single();

  const cantinaId = usuario?.cantina_id as string | null;

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
    const { data: admins } = await supabase
      .from("usuarios")
      .select("email")
      .eq("cantina_id", cantinaId)
      .eq("rol", "admin")
      .eq("activo", true);

    const adminEmails = (admins ?? []).map(a => a.email as string);
    if (adminEmails.length > 0) {
      const tmpl = emailSolicitudEliminacion(
        usuario?.nombre as string ?? "Representante",
        usuario?.email as string ?? session.user.email,
      );
      await sendEmail({ to: adminEmails, ...tmpl });
    }
  }

  return NextResponse.json({ ok: true });
});
