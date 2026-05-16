import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { notificarAbonoConfirmado, notificarAbonoRechazado } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const confirmarSchema = z.object({ accion: z.literal("confirmar") });
const rechazarSchema  = z.object({ accion: z.literal("rechazar"), motivo: z.string().min(3).max(300) });
const accionSchema    = z.discriminatedUnion("accion", [confirmarSchema, rechazarSchema]);

// POST /api/admin/abonos/[id] — confirmar o rechazar
export const POST = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const body     = await validateBody(req, accionSchema);
  const supabase = createServerSupabase();

  // Verificar propiedad del abono
  const { data: abono } = await supabase
    .from("abonos")
    .select(`
      id, estado, monto_usd,
      cuentas_alumnos ( id, saldo, alumno_id, alumnos(cantina_id) )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!abono) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  type CuentaData = {
    id: string;
    saldo: string;
    alumno_id: string;
    alumnos: { cantina_id: string } | null;
  };
  const cuentaData = (Array.isArray(abono.cuentas_alumnos)
    ? (abono.cuentas_alumnos as unknown as CuentaData[])[0]
    : abono.cuentas_alumnos as unknown as CuentaData) ?? null;

  if (cuentaData?.alumnos?.cantina_id !== cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (abono.estado !== "pendiente") {
    return NextResponse.json({ error: "El abono ya fue procesado" }, { status: 400 });
  }

  if (body.accion === "confirmar") {
    await Promise.all([
      supabase.from("abonos").update({
        estado:        "confirmado",
        confirmado_por: session.user.id,
        confirmado_at:  new Date().toISOString(),
      }).eq("id", id).then(() => {}),

      // Sumar al saldo de la cuenta
      cuentaData
        ? supabase.from("cuentas_alumnos").update({
            saldo: Number(cuentaData.saldo) + Number(abono.monto_usd),
          }).eq("id", cuentaData.id).then(() => {})
        : Promise.resolve(),
    ]);

    await audit({
      usuarioId: session.user.id,
      cantinaId,
      evento:    AuditEvent.ABONO_CONFIRMADO,
      entidad:   "abonos",
      entidadId: id,
      datos:     { montoUsd: Number(abono.monto_usd), alumnoId: cuentaData?.alumno_id ?? null },
    });

    // Notificar al representante (fire-and-forget, no bloquear la respuesta)
    if (cuentaData?.alumno_id) {
      const { data: alumno } = await supabase
        .from("alumnos").select("nombre").eq("id", cuentaData.alumno_id).single();
      if (alumno) notificarAbonoConfirmado(cuentaData.alumno_id, alumno.nombre).catch(() => {});
    }
  } else {
    await supabase.from("abonos").update({
      estado:         "rechazado",
      motivo_rechazo: body.motivo,
      confirmado_por: session.user.id,
      confirmado_at:  new Date().toISOString(),
    }).eq("id", id);

    await audit({
      usuarioId: session.user.id,
      cantinaId,
      evento:    AuditEvent.ABONO_RECHAZADO,
      entidad:   "abonos",
      entidadId: id,
      datos:     { motivo: body.motivo },
    });

    // Notificar rechazo al representante (fire-and-forget)
    if (cuentaData?.alumno_id) {
      const { data: alumno } = await supabase
        .from("alumnos").select("nombre").eq("id", cuentaData.alumno_id).single();
      if (alumno) notificarAbonoRechazado(cuentaData.alumno_id, alumno.nombre, body.motivo).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
});
