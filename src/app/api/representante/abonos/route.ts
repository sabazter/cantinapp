import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { tasaActivaBcv } from "@/lib/bcv";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const abonoSchema = z.object({
  alumnoId:   z.string().min(1),
  montoUsd:   z.number().positive(),
  metodo:     z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia: z.string().max(100).optional(),
  banco:      z.string().max(60).optional(),
});

// POST /api/representante/abonos — representante reporta un abono
// Solo puede reportar para sus propios hijos (§3.4)
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const contentType     = req.headers.get("content-type") ?? "";

  let alumnoId: string, montoUsd: number, metodo: string, referencia: string | undefined, banco: string | undefined;
  let comprobanteFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const parsed = await validateBody(
      new Request(req.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alumnoId:   form.get("alumnoId"),
          montoUsd:   Number(form.get("montoUsd")),
          metodo:     form.get("metodo"),
          referencia: form.get("referencia") || undefined,
          banco:      form.get("banco") || undefined,
        }),
      }),
      abonoSchema
    );
    alumnoId   = parsed.alumnoId;
    montoUsd   = parsed.montoUsd;
    metodo     = parsed.metodo;
    referencia = parsed.referencia;
    banco      = parsed.banco;
    comprobanteFile = form.get("comprobante") as File | null;
  } else {
    const parsed = await validateBody(req, abonoSchema);
    alumnoId   = parsed.alumnoId;
    montoUsd   = parsed.montoUsd;
    metodo     = parsed.metodo;
    referencia = parsed.referencia;
    banco      = parsed.banco;
  }

  const supabase = createServerSupabase();

  // Verificar que el alumno es hijo del representante (§3.4)
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, representante_id, cantina_id, cuentas_alumnos(id)")
    .eq("id", alumnoId)
    .is("deleted_at", null)
    .single();

  if (!alumno || alumno.representante_id !== representanteId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const cuentaAlumnoId = Array.isArray(alumno.cuentas_alumnos)
    ? (alumno.cuentas_alumnos as { id: string }[])[0]?.id
    : (alumno.cuentas_alumnos as { id: string } | null)?.id;

  if (!cuentaAlumnoId) {
    return NextResponse.json({ error: "El alumno no tiene cuenta" }, { status: 400 });
  }

  // Subir comprobante si existe
  let comprobanteUrl: string | null = null;
  if (comprobanteFile) {
    if (!ALLOWED_TYPES.includes(comprobanteFile.type)) {
      return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
    }
    if (comprobanteFile.size > MAX_SIZE) {
      return NextResponse.json({ error: "El comprobante supera los 5 MB" }, { status: 400 });
    }

    const ext  = comprobanteFile.type.split("/")[1];
    const path = `${alumno.cantina_id}/${alumnoId}_${Date.now()}.${ext}`;
    const ab   = await comprobanteFile.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from("comprobantes-abonos")
      .upload(path, ab, { contentType: comprobanteFile.type, upsert: false });

    if (!uploadErr) comprobanteUrl = path;
  }

  const cantinaId = alumno.cantina_id;
  const tasaInfo  = await tasaActivaBcv(cantinaId);

  const referenciaEncriptada = referencia ? encrypt(referencia) : null;
  const montoBs = tasaInfo ? montoUsd * tasaInfo.tasa : null;

  const { data: abono, error: abonoErr } = await supabase
    .from("abonos")
    .insert({
      cuenta_alumno_id:      cuentaAlumnoId,
      monto_usd:             montoUsd,
      monto_bs:              montoBs,
      tasa_bcv:              tasaInfo?.tasa ?? null,
      metodo,
      referencia_encriptada: referenciaEncriptada,
      banco:                 banco ?? null,
      comprobante_url:       comprobanteUrl,
      estado:                "pendiente",
    })
    .select("id")
    .single();

  if (abonoErr || !abono) throw abonoErr ?? new Error("Error insertando abono");

  await audit({
    usuarioId: representanteId,
    cantinaId,
    evento:    AuditEvent.ABONO_CREADO,
    entidad:   "abonos",
    entidadId: abono.id,
    datos:     { alumnoId, montoUsd, metodo, tieneComprobante: !!comprobanteUrl },
  });

  return NextResponse.json({ id: abono.id }, { status: 201 });
});

// GET /api/representante/abonos?alumnoId=... — historial de abonos de un hijo
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get("alumnoId");

  if (!alumnoId) return NextResponse.json([], { status: 200 });

  const supabase = createServerSupabase();

  // Verificar propiedad
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("representante_id, cuentas_alumnos(id)")
    .eq("id", alumnoId)
    .is("deleted_at", null)
    .single();

  if (!alumno || alumno.representante_id !== representanteId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const cuentaAlumnoId = Array.isArray(alumno.cuentas_alumnos)
    ? (alumno.cuentas_alumnos as { id: string }[])[0]?.id
    : (alumno.cuentas_alumnos as { id: string } | null)?.id;

  if (!cuentaAlumnoId) return NextResponse.json([]);

  const { data } = await supabase
    .from("abonos")
    .select("id, monto_usd, monto_bs, metodo, banco, estado, created_at, confirmado_at, motivo_rechazo")
    .eq("cuenta_alumno_id", cuentaAlumnoId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json(data ?? []);
});
