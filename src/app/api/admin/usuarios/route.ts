import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole, withAuth, ForbiddenError } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

const crearUsuarioSchema = z.object({
  nombre:   z.string().min(2).max(100),
  email:    z.email(),
  password: z.string().min(8).max(72),
  rol:      z.enum(["admin", "vendedor", "representante", "directivo"]),
  telefono: z.string().max(20).optional(),
});

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, telefono, activo, mfa_habilitado, created_at")
    .eq("cantina_id", session.user.cantinaId!)
    .order("nombre");

  if (error) throw error;
  return NextResponse.json(data);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const body = await validateBody(req, crearUsuarioSchema);
  const supabase = createServerSupabase();

  const { data: existe } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", body.email)
    .single();

  if (existe) {
    return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
  }

  const hashPwd = await bcrypt.hash(body.password, 12);

  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      cantina_id: session.user.cantinaId,
      nombre:     body.nombre,
      email:      body.email,
      hash_pwd:   hashPwd,
      rol:        body.rol,
      telefono:   body.telefono ?? null,
      activo:     true,
    })
    .select("id, nombre, email, rol, activo")
    .single();

  if (error) throw error;

  await audit({
    usuarioId:  session.user.id,
    cantinaId:  session.user.cantinaId ?? undefined,
    evento:     AuditEvent.USUARIO_CREADO,
    entidad:    "usuario",
    entidadId:  data.id,
    datos:      { email: body.email, rol: body.rol },
  });

  return NextResponse.json(data, { status: 201 });
});
