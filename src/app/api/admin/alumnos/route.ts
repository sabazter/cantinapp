import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import QRCode from "qrcode";

const alumnoSchema = z.object({
  nombre:        z.string().min(1).max(100),
  cedula:        z.string().min(1).max(20),
  curso:         z.string().min(1).max(20),
  seccion:       z.string().max(10).optional(),
  limiteFiadoUsd: z.number().min(0).optional(),
  representanteId: z.string().optional(),
  // Consentimiento: requerido para menores de edad
  consentimientoIp: z.string().optional(),
});

// GET /api/admin/alumnos — lista con búsqueda y filtros
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin", "vendedor");

  const cantinaId = session.user.cantinaId!;
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);

  const curso  = searchParams.get("curso");
  const activo = searchParams.get("activo");
  const q      = searchParams.get("q");

  let query = supabase
    .from("alumnos")
    .select(`
      id, nombre, cedula_encriptada, curso, seccion,
      foto_url, qr_code, limite_fiado_usd, activo,
      created_at,
      cuentas_alumnos ( saldo )
    `)
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .order("nombre", { ascending: true });

  if (curso)  query = query.eq("curso", curso);
  if (activo !== null) query = query.eq("activo", activo !== "false");
  if (q)      query = query.ilike("nombre", `%${q}%`);

  const { data, error } = await query;
  if (error) throw error;

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    datos:     { curso: curso ?? null, activo: activo ?? null, q: q ?? null },
  });

  // No devolver cédula descifrada en la lista — solo en GET individual
  return NextResponse.json(
    (data ?? []).map(({ cedula_encriptada: _ced, ...rest }) => rest)
  );
});

// POST /api/admin/alumnos — crear alumno
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const body = await validateBody(req, alumnoSchema);

  const supabase = createServerSupabase();

  const cedulaEncriptada = encrypt(body.cedula);

  // Insertar alumno
  const { data: alumno, error: alumnoErr } = await supabase
    .from("alumnos")
    .insert({
      cantina_id:        cantinaId,
      nombre:            body.nombre,
      cedula_encriptada: cedulaEncriptada,
      curso:             body.curso,
      seccion:           body.seccion ?? null,
      limite_fiado_usd:  body.limiteFiadoUsd ?? null,
      representante_id:  body.representanteId ?? null,
      consentimiento_ip: body.consentimientoIp ?? null,
      consentimiento_at: body.consentimientoIp ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (alumnoErr || !alumno) throw alumnoErr ?? new Error("Error al crear alumno");

  // Generar QR con el ID del alumno
  const qrData = await QRCode.toDataURL(`cantinapp:alumno:${alumno.id}`);

  // Crear cuenta corriente y guardar QR en paralelo
  await Promise.all([
    supabase.from("cuentas_alumnos").insert({ alumno_id: alumno.id, saldo: 0 }),
    supabase.from("alumnos").update({ qr_code: qrData }).eq("id", alumno.id),
  ]);

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ALUMNO_CREADO,
    entidad:   "alumnos",
    entidadId: alumno.id,
    datos:     { nombre: body.nombre, curso: body.curso },
  });

  return NextResponse.json({ id: alumno.id }, { status: 201 });
});
