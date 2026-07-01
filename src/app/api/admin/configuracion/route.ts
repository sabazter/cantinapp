import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";

const cantinSchema = z.object({
  nombre:           z.string().min(1).max(100),
  escuela:          z.string().min(1).max(200),
  direccion:        z.string().max(300).optional().nullable(),
  limite_fiado_usd: z.number().min(0),
  umbral_deuda_usd: z.number().min(0),
  notif_email:      z.boolean(),
  notif_whatsapp:   z.boolean(),
  tasa_manual:      z.number().positive().nullable().optional(),
});

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("cantinas")
    .select("id, nombre, escuela, direccion, limite_fiado_usd, umbral_deuda_usd, notif_email, notif_whatsapp, tasa_manual")
    .eq("id", cantinaId)
    .single();

  if (error) return NextResponse.json({ error: "Error al cargar configuración" }, { status: 500 });
  return NextResponse.json(data);
});

export const PUT = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;

  const body = await validateBody(req, cantinSchema);

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("cantinas")
    .update({
      nombre:           body.nombre,
      escuela:          body.escuela,
      direccion:        body.direccion ?? null,
      limite_fiado_usd: body.limite_fiado_usd,
      umbral_deuda_usd: body.umbral_deuda_usd,
      notif_email:      body.notif_email,
      notif_whatsapp:   body.notif_whatsapp,
      tasa_manual:      body.tasa_manual ? Math.round(body.tasa_manual * 100) / 100 : null,
      updated_at:       new Date().toISOString(),
    })
    .eq("id", cantinaId);

  if (error) return NextResponse.json({ error: "Error al guardar" }, { status: 500 });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento: "configuracion_actualizada",
    entidad: "cantina",
    entidadId: cantinaId,
  });

  return NextResponse.json({ ok: true });
});
