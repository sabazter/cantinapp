import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
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
  const { searchParams } = new URL(req.url);

  const curso  = searchParams.get("curso");
  const activo = searchParams.get("activo");
  const q      = searchParams.get("q");

  // cedulaEncriptada no se selecciona: la lista nunca devuelve la cédula
  const data = await db.alumno.findMany({
    where: {
      cantinaId,
      deletedAt: null,
      ...(curso ? { curso } : {}),
      ...(activo !== null ? { activo: activo !== "false" } : {}),
      ...(q ? { nombre: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true, nombre: true, curso: true, seccion: true,
      fotoUrl: true, qrCode: true, fiadoHabilitado: true, limiteFiadoUsd: true, activo: true,
      createdAt: true,
      cuenta: { select: { saldo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    datos:     { curso: curso ?? null, activo: activo ?? null, q: q ?? null },
  });

  return NextResponse.json(legacy(data));
});

// POST /api/admin/alumnos — crear alumno
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const body = await validateBody(req, alumnoSchema);

  // El representante, si viene, debe ser de esta misma cantina (evita vincular usuarios ajenos)
  if (body.representanteId) {
    const rep = await db.usuario.findFirst({
      where: { id: body.representanteId, cantinaId, rol: { in: ["representante", "profesor"] } },
      select: { id: true },
    });
    if (!rep) return NextResponse.json({ error: "Representante no válido" }, { status: 400 });
  }

  const cedulaEncriptada = encrypt(body.cedula);

  // Alumno + cuenta corriente en una sola operación; el QR usa el ID generado
  const alumno = await db.alumno.create({
    data: {
      cantinaId,
      nombre:           body.nombre,
      cedulaEncriptada,
      curso:            body.curso,
      seccion:          body.seccion ?? null,
      limiteFiadoUsd:   body.limiteFiadoUsd ?? null,
      representanteId:  body.representanteId ?? null,
      consentimientoIp: body.consentimientoIp ?? null,
      consentimientoAt: body.consentimientoIp ? new Date() : null,
      cuenta:           { create: { saldo: 0 } },
    },
    select: { id: true },
  });

  await db.alumno.update({
    where: { id: alumno.id },
    data: { qrCode: await QRCode.toDataURL(`cantinapp:alumno:${alumno.id}`) },
  });

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
