import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/resend";
import { emailSolicitudEliminacion } from "@/lib/email/templates";

// GET /api/representante/config — devuelve preferencias del representante
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("usuarios")
    .select("email_verificado, notif_email, notif_whatsapp")
    .eq("id", session.user.id)
    .single();

  if (error) return NextResponse.json({ error: "Error al cargar" }, { status: 500 });

  return NextResponse.json({
    emailVerificado: data?.email_verificado ?? false,
    notifEmail:      data?.notif_email      ?? true,
    notifWhatsapp:   data?.notif_whatsapp   ?? true,
  });
});

// PUT /api/representante/config — actualiza preferencias de notificación
const prefsSchema = z.object({
  notifEmail:    z.boolean(),
  notifWhatsapp: z.boolean(),
});

export const PUT = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");
  const body = await validateBody(req, prefsSchema);

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("usuarios")
    .update({
      notif_email:    body.notifEmail,
      notif_whatsapp: body.notifWhatsapp,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", session.user.id);

  if (error) return NextResponse.json({ error: "Error al guardar" }, { status: 500 });

  return NextResponse.json({ ok: true });
});

// POST /api/representante/config/eliminar — solicitud de eliminación de datos
