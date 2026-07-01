import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

const editarUsuarioSchema = z.object({
  nombre:   z.string().min(2).max(100).optional(),
  telefono: z.string().max(20).nullable().optional(),
  rol:      z.enum(["admin", "vendedor", "representante", "directivo", "profesor"]).optional(),
  activo:   z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
});

export const PUT = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  const supabase = createServerSupabase();

  // Verificar que el usuario pertenece a la misma cantina
  const { data: target, error: fetchErr } = await supabase
    .from("usuarios")
    .select("id, cantina_id, email")
    .eq("id", id)
    .single();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  if (target.cantina_id !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await validateBody(req, editarUsuarioSchema);
  const updates: Record<string, unknown> = {};

  if (body.nombre   !== undefined) updates.nombre   = body.nombre;
  if (body.telefono !== undefined) updates.telefono = body.telefono;
  if (body.rol      !== undefined) updates.rol      = body.rol;
  if (body.activo   !== undefined) updates.activo   = body.activo;
  if (body.password !== undefined) updates.hash_pwd = await bcrypt.hash(body.password, 12);

  const { data, error } = await supabase
    .from("usuarios")
    .update(updates)
    .eq("id", id)
    .select("id, nombre, email, rol, activo")
    .single();

  if (error) throw error;

  if (body.password !== undefined) {
    await audit({
      usuarioId: session.user.id,
      cantinaId: session.user.cantinaId ?? undefined,
      evento:    AuditEvent.PASSWORD_CAMBIADO,
      entidad:   "usuario",
      entidadId: id,
    });
  }

  if (body.activo === false) {
    // Desactivar también al Alumno asociado
    await supabase.from("alumnos").update({ activo: false }).eq("representante_id", id);
    await audit({
      usuarioId: session.user.id,
      cantinaId: session.user.cantinaId ?? undefined,
      evento:    AuditEvent.USUARIO_DESACTIVADO,
      entidad:   "usuario",
      entidadId: id,
      datos:     { email: target.email },
    });
  } else if (body.activo === true) {
    // Activar también al Alumno asociado
    await supabase.from("alumnos").update({ activo: true }).eq("representante_id", id);
    await audit({
      usuarioId: session.user.id,
      cantinaId: session.user.cantinaId ?? undefined,
      evento:    "usuario_activado",
      entidad:   "usuario",
      entidadId: id,
      datos:     { email: target.email },
    });
  }

  return NextResponse.json(data);
});

export const DELETE = withAuth(async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  const { data: target } = await supabase
    .from("usuarios")
    .select("cantina_id, email")
    .eq("id", id)
    .single();

  if (!target || target.cantina_id !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  await supabase.from("usuarios").update({ activo: false }).eq("id", id);

  // Revocar todos los refresh tokens del usuario
  await supabase
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("usuario_id", id)
    .is("revoked_at", null);

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.USUARIO_DESACTIVADO,
    entidad:   "usuario",
    entidadId: id,
    datos:     { email: target.email },
  });

  return new NextResponse(null, { status: 204 });
});
