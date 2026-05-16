import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/crypto";

const editSchema = z.object({
  nombre:           z.string().min(1).max(100).optional(),
  cedula:           z.string().min(1).max(20).optional(),
  curso:            z.string().min(1).max(20).optional(),
  seccion:          z.string().max(10).optional(),
  fiadoHabilitado:  z.boolean().optional(),
  limiteFiadoUsd:   z.number().min(0).optional(),
  representanteId:  z.string().optional(),
  activo:           z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function verificarPropiedad(cantinaId: string, alumnoId: string) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("alumnos")
    .select("cantina_id, cedula_encriptada, deleted_at")
    .eq("id", alumnoId)
    .single();

  if (!data || data.cantina_id !== cantinaId || data.deleted_at) return null;
  return data;
}

// GET /api/admin/alumnos/[id] — detalle con cédula descifrada
export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin", "vendedor");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await verificarPropiedad(cantinaId, id);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("alumnos")
    .select(`
      id, nombre, cedula_encriptada, curso, seccion,
      foto_url, qr_code, fiado_habilitado, limite_fiado_usd, activo,
      consentimiento_ip, consentimiento_at, created_at,
      cuentas_alumnos ( saldo )
    `)
    .eq("id", id)
    .single();

  if (!data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    entidadId: id,
    datos:     { accion: "detalle" },
  });

  const { cedula_encriptada, ...rest } = data;
  return NextResponse.json({ ...rest, cedula: decrypt(cedula_encriptada) });
});

// PUT /api/admin/alumnos/[id]
export const PUT = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await verificarPropiedad(cantinaId, id);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await validateBody(req, editSchema);

  const updates: Record<string, unknown> = {};
  if (body.nombre           !== undefined) updates.nombre            = body.nombre;
  if (body.cedula           !== undefined) updates.cedula_encriptada = encrypt(body.cedula);
  if (body.curso            !== undefined) updates.curso             = body.curso;
  if (body.seccion          !== undefined) updates.seccion           = body.seccion;
  if (body.fiadoHabilitado  !== undefined) updates.fiado_habilitado  = body.fiadoHabilitado;
  if (body.limiteFiadoUsd   !== undefined) updates.limite_fiado_usd  = body.limiteFiadoUsd;
  if (body.representanteId  !== undefined) updates.representante_id  = body.representanteId;
  if (body.activo           !== undefined) updates.activo            = body.activo;

  const supabase = createServerSupabase();
  const { error } = await supabase.from("alumnos").update(updates).eq("id", id);
  if (error) throw error;

  return NextResponse.json({ ok: true });
});

// DELETE /api/admin/alumnos/[id] — soft delete
export const DELETE = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await verificarPropiedad(cantinaId, id);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const supabase = createServerSupabase();

  // Soft delete alumno
  await supabase.from("alumnos").update({
    deleted_at: new Date().toISOString(),
    deleted_by: session.user.id,
    activo: false,
  }).eq("id", id);

  // Intentar eliminar foto del storage si existe
  const { data: alumnoData } = await supabase
    .from("alumnos")
    .select("foto_url")
    .eq("id", id)
    .single();

  if (alumnoData?.foto_url) {
    const fileName = alumnoData.foto_url.split("/").pop();
    if (fileName) {
      await supabase.storage.from("fotos-alumnos").remove([`${cantinaId}/${fileName}`]).catch(() => {});
    }
  }

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ALUMNO_ELIMINADO,
    entidad:   "alumnos",
    entidadId: id,
    datos:     { accion: "soft_delete" },
  });

  return NextResponse.json({ ok: true });
});
