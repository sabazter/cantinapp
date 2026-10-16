import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db, dbSystem } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";

const crearUsuarioSchema = z.object({
  nombre:   z.string().min(2).max(100),
  email:    z.email(),
  password: z.string().min(8).max(72),
  rol:      z.enum(["admin", "vendedor", "representante", "directivo", "profesor"]),
  telefono: z.string().max(20).optional(),
});

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const data = await db.usuario.findMany({
    where: { cantinaId: session.user.cantinaId! },
    select: {
      id: true, nombre: true, email: true, rol: true, telefono: true, activo: true,
      mfaHabilitado: true, createdAt: true,
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(legacy(data));
});

export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const body = await validateBody(req, crearUsuarioSchema);

  // El email es único en toda la plataforma, no solo en la cantina: se comprueba con el rol de
  // sistema (RLS solo deja ver los usuarios de la propia cantina).
  const existe = await dbSystem.usuario.findUnique({ where: { email: body.email }, select: { id: true } });

  if (existe) {
    return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
  }

  const hashPwd = await bcrypt.hash(body.password, 12);

  const data = await db.usuario.create({
    data: {
      cantinaId: session.user.cantinaId,
      nombre:    body.nombre,
      email:     body.email,
      hashPwd,
      rol:       body.rol,
      telefono:  body.telefono ?? null,
      activo:    true,
    },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  await audit({
    usuarioId:  session.user.id,
    cantinaId:  session.user.cantinaId ?? undefined,
    evento:     AuditEvent.USUARIO_CREADO,
    entidad:    "usuario",
    entidadId:  data.id,
    datos:      { email: body.email, rol: body.rol },
  });

  return NextResponse.json(legacy(data), { status: 201 });
});
