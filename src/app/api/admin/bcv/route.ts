import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { tasaActivaBcv } from "@/lib/bcv";

// GET /api/admin/bcv — tasa activa + historial reciente
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin", "vendedor", "directivo");

  const cantinaId = session.user.cantinaId!;
  const supabase = createServerSupabase();

  const [activa, { data: historial }] = await Promise.all([
    tasaActivaBcv(cantinaId),
    supabase
      .from("tasas_bcv")
      .select("id, fecha, tasa_usd_bs, fuente, created_at")
      .eq("cantina_id", cantinaId)
      .order("fecha", { ascending: false })
      .limit(30),
  ]);

  return NextResponse.json({ activa, historial: historial ?? [] });
});

const overrideSchema = z.object({
  tasa:  z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// POST /api/admin/bcv — override manual de tasa
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { tasa, fecha } = await validateBody(req, overrideSchema);
  const diaObjetivo = fecha ?? new Date().toISOString().slice(0, 10);

  const supabase = createServerSupabase();

  // Leer tasa anterior para el audit log
  const { data: anterior } = await supabase
    .from("tasas_bcv")
    .select("tasa_usd_bs")
    .eq("cantina_id", cantinaId)
    .eq("fecha", diaObjetivo)
    .single();

  await supabase.from("tasas_bcv").upsert(
    { cantina_id: cantinaId, fecha: diaObjetivo, tasa_usd_bs: tasa, fuente: "manual" },
    { onConflict: "cantina_id,fecha" }
  );

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.TASA_BCV_CAMBIADA,
    entidad:   "tasas_bcv",
    datos: {
      fecha:         diaObjetivo,
      tasaAnterior:  anterior ? Number(anterior.tasa_usd_bs) : null,
      tasaNueva:     tasa,
      fuente:        "manual",
    },
  });

  return NextResponse.json({ ok: true, fecha: diaObjetivo, tasa });
});
