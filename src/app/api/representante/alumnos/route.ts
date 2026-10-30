import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";

// GET /api/representante/alumnos — hijos del representante autenticado
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;

  const data = await db.alumno.findMany({
    where: { representanteId, deletedAt: null },
    select: {
      id: true, nombre: true, curso: true, seccion: true, activo: true,
      cuenta: { select: { saldo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  await audit({
    usuarioId: representanteId,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    datos:     { accion: "portal_representante_lista" },
  });

  return NextResponse.json(legacy(data));
});

const crearHijoSchema = z.object({
  accion:  z.literal("crear"),
  nombre:  z.string().trim().min(2).max(100),
  curso:   z.string().trim().min(1).max(20),
  seccion: z.string().max(10).optional(),
  cedula:  z.string().max(20).optional(),
});

const vincularHijoSchema = z.object({
  accion:        z.literal("vincular"),
  identificador: z.string().min(2).max(100),
});

const postSchema = z.discriminatedUnion("accion", [crearHijoSchema, vincularHijoSchema]);

// POST /api/representante/alumnos — registrar o vincular hijo
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const cantinaId       = session.user.cantinaId!;
  const body            = await validateBody(req, postSchema);

  if (body.accion === "crear") {
    let cedulaEncriptada: string | null = null;
    if (body.cedula) {
      try {
        cedulaEncriptada = encrypt(body.cedula);
      } catch {
        cedulaEncriptada = body.cedula;
      }
    }

    const alumno = await db.alumno.create({
      data: {
        cantinaId,
        representanteId,
        nombre:           body.nombre,
        curso:            body.curso,
        seccion:          body.seccion ?? null,
        cedulaEncriptada,
        activo:           true,
        fiadoHabilitado:  true,
        cuenta: {
          create: { saldo: 0 },
        },
      },
      select: { id: true, nombre: true, curso: true, seccion: true },
    });

    const qrData = await QRCode.toDataURL(`cantinapp:alumno:${alumno.id}`);
    await db.alumno.update({
      where: { id: alumno.id },
      data:  { qrCode: qrData },
    });

    return NextResponse.json({ ok: true, alumno }, { status: 201 });
  }

  if (body.accion === "vincular") {
    const target = body.identificador.trim();

    const alumno = await db.alumno.findFirst({
      where: { id: target, cantinaId, deletedAt: null },
      select: { id: true, nombre: true, representanteId: true },
    });

    if (!alumno) {
      return NextResponse.json({ error: "No se encontró ningún alumno con ese código o ID" }, { status: 404 });
    }

    if (alumno.representanteId && alumno.representanteId !== representanteId) {
      return NextResponse.json({ error: "Este alumno ya está vinculado a otro representante" }, { status: 400 });
    }

    await db.alumno.update({
      where: { id: alumno.id },
      data:  { representanteId },
    });

    return NextResponse.json({ ok: true, alumno });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
});
