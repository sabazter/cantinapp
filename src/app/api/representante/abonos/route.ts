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
import { guardarArchivo, tipoImagen } from "@/lib/storage";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const abonoSchema = z.object({
  alumnoId:   z.string().min(1),
  montoUsd:   z.number().positive(),
  metodo:     z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia: z.string().max(100).optional(),
  banco:      z.string().max(60).optional(),
});

// POST /api/representante/abonos — representante reporta un abono
// Solo puede reportar para sus propios hijos (§3.4)
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const contentType     = req.headers.get("content-type") ?? "";

  let alumnoId: string, montoUsd: number, metodo: z.infer<typeof abonoSchema>["metodo"];
  let referencia: string | undefined, banco: string | undefined;
  let comprobanteFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const parsed = await validateBody(
      new Request(req.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alumnoId:   form.get("alumnoId"),
          montoUsd:   Number(form.get("montoUsd")),
          metodo:     form.get("metodo"),
          referencia: form.get("referencia") || undefined,
          banco:      form.get("banco") || undefined,
        }),
      }),
      abonoSchema
    );
    alumnoId   = parsed.alumnoId;
    montoUsd   = parsed.montoUsd;
    metodo     = parsed.metodo;
    referencia = parsed.referencia;
    banco      = parsed.banco;
    const archivo = form.get("comprobante");
    comprobanteFile = archivo instanceof File && archivo.size > 0 ? archivo : null;
  } else {
    const parsed = await validateBody(req, abonoSchema);
    alumnoId   = parsed.alumnoId;
    montoUsd   = parsed.montoUsd;
    metodo     = parsed.metodo;
    referencia = parsed.referencia;
    banco      = parsed.banco;
  }

  // Verificar que el alumno es hijo del representante (§3.4)
  const alumno = await db.alumno.findFirst({
    where: { id: alumnoId, representanteId, deletedAt: null },
    select: { id: true, cantinaId: true, cuenta: { select: { id: true } } },
  });

  if (!alumno) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (!alumno.cuenta) {
    return NextResponse.json({ error: "El alumno no tiene cuenta" }, { status: 400 });
  }

  // Subir comprobante si existe (el tipo se valida por los bytes, no por el MIME declarado)
  let comprobanteUrl: string | null = null;
  if (comprobanteFile) {
    if (comprobanteFile.size > MAX_SIZE) {
      return NextResponse.json({ error: "El comprobante supera los 5 MB" }, { status: 400 });
    }
    const bytes = Buffer.from(await comprobanteFile.arrayBuffer());
    const tipo = tipoImagen(bytes);
    if (!tipo) {
      return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
    }

    const clave = `${alumno.cantinaId}/${alumnoId}_${Date.now()}.${tipo.ext}`;
    try {
      await guardarArchivo("comprobantes-abonos", clave, bytes);
      comprobanteUrl = clave;
    } catch (err) {
      console.error("[abonos] comprobante:", err instanceof Error ? err.message : "error");
    }
  }

  const cantinaId = alumno.cantinaId;
  const tasaInfo  = await tasaActivaBcv(cantinaId);

  const referenciaEncriptada = referencia ? encrypt(referencia) : null;
  const monto = new Prisma.Decimal(montoUsd);

  const abono = await db.abono.create({
    data: {
      cuentaAlumnoId:       alumno.cuenta.id,
      montoUsd:             monto,
      montoBs:              tasaInfo ? monto.times(tasaInfo.tasa) : null,
      tasaBcv:              tasaInfo?.tasa ?? null,
      metodo,
      referenciaEncriptada,
      banco:                banco ?? null,
      comprobanteUrl,
      estado:               "pendiente",
    },
    select: { id: true },
  });

  await audit({
    usuarioId: representanteId,
    cantinaId,
    evento:    AuditEvent.ABONO_CREADO,
    entidad:   "abonos",
    entidadId: abono.id,
    datos:     { alumnoId, montoUsd, metodo, tieneComprobante: !!comprobanteUrl },
  });

  return NextResponse.json({ id: abono.id }, { status: 201 });
});

// GET /api/representante/abonos?alumnoId=... — historial de abonos de un hijo
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get("alumnoId");

  if (!alumnoId) return NextResponse.json([], { status: 200 });

  // Verificar propiedad
  const alumno = await db.alumno.findFirst({
    where: { id: alumnoId, representanteId, deletedAt: null },
    select: { cuenta: { select: { id: true } } },
  });

  if (!alumno) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (!alumno.cuenta) return NextResponse.json([]);

  const data = await db.abono.findMany({
    where: { cuentaAlumnoId: alumno.cuenta.id, deletedAt: null },
    select: {
      id: true, montoUsd: true, montoBs: true, metodo: true, banco: true, estado: true,
      createdAt: true, confirmadoAt: true, motivoRechazo: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(legacy(data));
});
