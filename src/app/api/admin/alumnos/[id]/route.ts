import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/crypto";
import { eliminarArchivo } from "@/lib/storage";

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
  const data = await db.alumno.findUnique({
    where: { id: alumnoId },
    select: { cantinaId: true, deletedAt: true },
  });

  if (!data || data.cantinaId !== cantinaId || data.deletedAt) return null;
  return data;
}

// GET /api/admin/alumnos/[id] — detalle con cédula descifrada
export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin", "vendedor");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await verificarPropiedad(cantinaId, id);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const data = await db.alumno.findUnique({
    where: { id },
    select: {
      id: true, nombre: true, cedulaEncriptada: true, curso: true, seccion: true,
      fotoUrl: true, qrCode: true, fiadoHabilitado: true, limiteFiadoUsd: true, activo: true,
      consentimientoIp: true, consentimientoAt: true, createdAt: true,
      cuenta: { select: { saldo: true } },
    },
  });

  if (!data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    entidadId: id,
    datos:     { accion: "detalle" },
  });

  const { cedulaEncriptada, ...rest } = data;
  return NextResponse.json({
    ...legacy<Record<string, unknown>>(rest),
    cedula: cedulaEncriptada ? decrypt(cedulaEncriptada) : null,
  });
});

// PUT /api/admin/alumnos/[id]
export const PUT = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await verificarPropiedad(cantinaId, id);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await validateBody(req, editSchema);

  // El representante, si viene, debe ser de esta misma cantina
  if (body.representanteId) {
    const rep = await db.usuario.findFirst({
      where: { id: body.representanteId, cantinaId, rol: { in: ["representante", "profesor"] } },
      select: { id: true },
    });
    if (!rep) return NextResponse.json({ error: "Representante no válido" }, { status: 400 });
  }

  await db.alumno.update({
    where: { id },
    data: {
      ...(body.nombre          !== undefined && { nombre: body.nombre }),
      ...(body.cedula          !== undefined && { cedulaEncriptada: encrypt(body.cedula) }),
      ...(body.curso           !== undefined && { curso: body.curso }),
      ...(body.seccion         !== undefined && { seccion: body.seccion }),
      ...(body.fiadoHabilitado !== undefined && { fiadoHabilitado: body.fiadoHabilitado }),
      ...(body.limiteFiadoUsd  !== undefined && { limiteFiadoUsd: body.limiteFiadoUsd }),
      ...(body.representanteId !== undefined && { representanteId: body.representanteId }),
      ...(body.activo          !== undefined && { activo: body.activo }),
    },
  });

  return NextResponse.json({ ok: true });
});

// DELETE /api/admin/alumnos/[id] — soft delete
export const DELETE = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await verificarPropiedad(cantinaId, id);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const previo = await db.alumno.findUnique({ where: { id }, select: { fotoUrl: true } });

  // Soft delete alumno (la foto se retira también del almacenamiento: menores de edad)
  await db.alumno.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: session.user.id, activo: false, fotoUrl: null },
  });

  if (previo?.fotoUrl) {
    await eliminarArchivo("fotos-alumnos", previo.fotoUrl).catch(() => {});
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
