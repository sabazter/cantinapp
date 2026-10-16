import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
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

  // Verificar que el usuario pertenece a la misma cantina
  const target = await db.usuario.findUnique({
    where: { id },
    select: { id: true, cantinaId: true, email: true },
  });

  if (!target || target.cantinaId !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await validateBody(req, editarUsuarioSchema);

  const data = await db.usuario.update({
    where: { id },
    data: {
      ...(body.nombre   !== undefined && { nombre: body.nombre }),
      ...(body.telefono !== undefined && { telefono: body.telefono }),
      ...(body.rol      !== undefined && { rol: body.rol }),
      ...(body.activo   !== undefined && { activo: body.activo }),
      ...(body.password !== undefined && { hashPwd: await bcrypt.hash(body.password, 12) }),
    },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

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
    await db.alumno.updateMany({ where: { representanteId: id }, data: { activo: false } });
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
    await db.alumno.updateMany({ where: { representanteId: id }, data: { activo: true } });
    await audit({
      usuarioId: session.user.id,
      cantinaId: session.user.cantinaId ?? undefined,
      evento:    "usuario_activado",
      entidad:   "usuario",
      entidadId: id,
      datos:     { email: target.email },
    });
  }

  return NextResponse.json(legacy(data));
});

export const DELETE = withAuth(async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  const target = await db.usuario.findUnique({
    where: { id },
    select: { cantinaId: true, email: true },
  });

  if (!target || target.cantinaId !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  await db.usuario.update({ where: { id }, data: { activo: false } });

  // Revocar todos los refresh tokens del usuario
  await db.refreshToken.updateMany({
    where: { usuarioId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

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
