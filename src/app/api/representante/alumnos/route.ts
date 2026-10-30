import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody, safeText } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";

// GET /api/representante/alumnos — hijos del representante autenticado
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("alumnos")
    .select(`
      id, nombre, curso, seccion, activo, cantina_id, qr_code,
      cuentas_alumnos ( saldo )
    `)
    .eq("representante_id", representanteId)
    .is("deleted_at", null)
    .order("nombre");

  if (error) throw error;

  await audit({
    usuarioId: representanteId,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    datos:     { accion: "portal_representante_lista" },
  });

  return NextResponse.json(data ?? []);
});

const crearHijoSchema = z.object({
  accion:  z.literal("crear"),
  nombre:  safeText(2, 100),
  curso:   safeText(1, 20),
  seccion: z.string().max(10).optional(),
  cedula:  z.string().max(20).optional(),
});

const vincularHijoSchema = z.object({
  accion:          z.literal("vincular"),
  identificador:   z.string().min(2).max(100),
});

const postSchema = z.discriminatedUnion("accion", [crearHijoSchema, vincularHijoSchema]);

// POST /api/representante/alumnos — registrar o vincular hijo
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const cantinaId       = session.user.cantinaId!;
  const body            = await validateBody(req, postSchema);
  const supabase        = createServerSupabase();

  if (body.accion === "crear") {
    // Padre crea cuenta a hijo pequeño
    let cedulaEncriptada: string | null = null;
    if (body.cedula) {
      try {
        cedulaEncriptada = encrypt(body.cedula);
      } catch {
        cedulaEncriptada = body.cedula;
      }
    }

    const { data: alumno, error: alErr } = await supabase
      .from("alumnos")
      .insert({
        cantina_id:        cantinaId,
        representante_id:  representanteId,
        nombre:            body.nombre,
        curso:             body.curso,
        seccion:           body.seccion ?? null,
        cedula_encriptada: cedulaEncriptada,
        activo:            true,
        fiado_habilitado:  true,
      })
      .select("id, nombre, curso, seccion")
      .single();

    if (alErr || !alumno) {
      return NextResponse.json({ error: "Error al registrar hijo" }, { status: 500 });
    }

    // Generar QR y cuenta
    const qrData = await QRCode.toDataURL(`cantinapp:alumno:${alumno.id}`);
    await Promise.all([
      supabase.from("cuentas_alumnos").insert({ alumno_id: alumno.id, saldo: 0 }),
      supabase.from("alumnos").update({ qr_code: qrData }).eq("id", alumno.id),
    ]);

    return NextResponse.json({ ok: true, alumno }, { status: 201 });
  }

  if (body.accion === "vincular") {
    // Vincular alumno existente por ID o identificador
    const target = body.identificador.trim();

    const { data: alumno } = await supabase
      .from("alumnos")
      .select("id, nombre, representante_id")
      .eq("cantina_id", cantinaId)
      .eq("id", target)
      .is("deleted_at", null)
      .maybeSingle();

    if (!alumno) {
      return NextResponse.json({ error: "No se encontró ningún alumno con ese código o ID" }, { status: 404 });
    }

    if (alumno.representante_id && alumno.representante_id !== representanteId) {
      return NextResponse.json({ error: "Este alumno ya está vinculado a otro representante" }, { status: 400 });
    }

    await supabase
      .from("alumnos")
      .update({ representante_id: representanteId })
      .eq("id", alumno.id);

    return NextResponse.json({ ok: true, alumno });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
});
