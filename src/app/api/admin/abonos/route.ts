import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { tasaActivaBcv } from "@/lib/bcv";

const abonoSchema = z.object({
  alumnoId:   z.string().min(1),
  montoUsd:   z.number().positive(),
  metodo:     z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia: z.string().max(100).optional(),
  banco:      z.string().max(60).optional(),
});

// POST /api/admin/abonos — registrar abono (pendiente de confirmación)
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const body      = await validateBody(req, abonoSchema);

  // Verificar alumno + cuenta
  const alumno = await db.alumno.findFirst({
    where: { id: body.alumnoId, cantinaId, deletedAt: null },
    select: { id: true, cuenta: { select: { id: true } } },
  });

  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!alumno.cuenta) {
    return NextResponse.json({ error: "El alumno no tiene cuenta" }, { status: 400 });
  }

  const tasaInfo = await tasaActivaBcv(cantinaId);

  const referenciaEncriptada = body.referencia ? encrypt(body.referencia) : null;
  const monto = new Prisma.Decimal(body.montoUsd);

  const abono = await db.abono.create({
    data: {
      cuentaAlumnoId:       alumno.cuenta.id,
      montoUsd:             monto,
      montoBs:              tasaInfo ? monto.times(tasaInfo.tasa) : null,
      tasaBcv:              tasaInfo?.tasa ?? null,
      metodo:               body.metodo,
      referenciaEncriptada,
      banco:                body.banco ?? null,
      estado:               "pendiente",
    },
    select: { id: true },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.ABONO_CREADO,
    entidad:   "abonos",
    entidadId: abono.id,
    datos:     { alumnoId: body.alumnoId, montoUsd: body.montoUsd, metodo: body.metodo },
  });

  return NextResponse.json({ id: abono.id }, { status: 201 });
});

const ESTADOS = ["pendiente", "confirmado", "rechazado"] as const;

// GET /api/admin/abonos — lista de abonos pendientes
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const estadoParam = searchParams.get("estado") ?? "pendiente";
  const estado = ESTADOS.find(e => e === estadoParam);
  if (!estado) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  // Se filtra por cantina a través del alumno
  const data = await db.abono.findMany({
    where: { estado, deletedAt: null, cuentaAlumno: { alumno: { cantinaId } } },
    select: {
      id: true, montoUsd: true, montoBs: true, metodo: true, banco: true, estado: true,
      createdAt: true, confirmadoAt: true,
      cuentaAlumno: {
        select: {
          alumnoId: true,
          alumno: { select: { id: true, nombre: true, curso: true, cantinaId: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(legacy(data));
});
