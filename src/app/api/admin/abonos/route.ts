import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { tasaActivaBcv } from "@/lib/bcv";

const abonoSchema = z.object({
  alumnoId:   z.string().min(1),
  montoUsd:   z.number().positive(),
  metodo:     z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia: z.string().max(100).optional(),
  banco:      z.string().max(60).optional(),
});

// POST /api/admin/abonos — registrar abono
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const body      = await validateBody(req, abonoSchema);
  const supabase  = createServerSupabase();

  // Verificar alumno + cuenta
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, cantina_id, cuentas_alumnos(id)")
    .eq("id", body.alumnoId)
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .single();

  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const cuentaAlumnoId = Array.isArray(alumno.cuentas_alumnos)
    ? (alumno.cuentas_alumnos as { id: string }[])[0]?.id
    : (alumno.cuentas_alumnos as { id: string } | null)?.id;

  if (!cuentaAlumnoId) {
    return NextResponse.json({ error: "El alumno no tiene cuenta" }, { status: 400 });
  }

  const tasaInfo = await tasaActivaBcv(cantinaId);
  const esEfectivo = body.metodo === "efectivo_usd" || body.metodo === "efectivo_bs";
  const referenciaEncriptada = !esEfectivo && body.referencia ? encrypt(body.referencia) : null;
  const montoBs = tasaInfo ? body.montoUsd * tasaInfo.tasa : null;

  const { data: abono, error: abonoErr } = await supabase
    .from("abonos")
    .insert({
      cuenta_alumno_id:     cuentaAlumnoId,
      monto_usd:            body.montoUsd,
      monto_bs:             montoBs,
      tasa_bcv:             tasaInfo?.tasa ?? null,
      metodo:               body.metodo,
      referencia_encriptada: referenciaEncriptada,
      banco:                esEfectivo ? null : body.banco ?? null,
      estado:               "pendiente",
    })
    .select("id")
    .single();

  if (abonoErr || !abono) throw abonoErr ?? new Error("Error registrando abono");

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ABONO_CREADO,
    entidad:   "abonos",
    entidadId: abono.id,
    datos: {
      alumnoId: body.alumnoId,
      montoUsd: body.montoUsd,
      metodo:   body.metodo,
    },
  });

  return NextResponse.json({ id: abono.id }, { status: 201 });
});

// GET /api/admin/abonos — listar abonos
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") ?? "pendiente";

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("abonos")
    .select(`
      id, monto_usd, monto_bs, tasa_bcv, metodo, banco, comprobante_url,
      estado, motivo_rechazo, created_at, confirmado_at,
      cuentas_alumnos (
        id, saldo,
        alumnos (
          id, nombre, curso, seccion, cantina_id,
          representante:usuarios!alumnos_representante_id_fkey(nombre, telefono)
        )
      )
    `)
    .eq("estado", estado)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  // Filtrar por cantina
  const filtrados = (data ?? []).filter((a: any) => {
    const cuenta = Array.isArray(a.cuentas_alumnos) ? a.cuentas_alumnos[0] : a.cuentas_alumnos;
    const alumno = Array.isArray(cuenta?.alumnos) ? cuenta?.alumnos[0] : cuenta?.alumnos;
    return alumno?.cantina_id === cantinaId;
  });

  return NextResponse.json(filtrados);
});
