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
  tipoDistribucion: z.enum(["equitativa", "individual"]).default("equitativa"),
  alumnoId:         z.string().optional(),
  montoUsd:         z.number().positive("El monto debe ser mayor a 0"),
  metodo:           z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia:       z.string().max(100).optional(),
  banco:            z.string().max(60).optional(),
}).refine((data) => {
  if (data.metodo === "pago_movil" || data.metodo === "transferencia") {
    return Boolean(data.referencia && data.referencia.trim().length >= 4);
  }
  return true;
}, {
  message: "La referencia de pago es requerida para Pago Móvil o Transferencia",
  path: ["referencia"],
});

// POST /api/representante/abonos — representante reporta un abono
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const contentType     = req.headers.get("content-type") ?? "";

  let body: z.infer<typeof abonoSchema>;
  let comprobanteFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const rawData = {
      tipoDistribucion: form.get("tipoDistribucion") || "equitativa",
      alumnoId:         form.get("alumnoId") || undefined,
      montoUsd:         Number(form.get("montoUsd")),
      metodo:           form.get("metodo"),
      referencia:       form.get("referencia") || undefined,
      banco:            form.get("banco") || undefined,
    };
    body = await validateBody(
      new Request(req.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rawData),
      }),
      abonoSchema
    );
    const archivo = form.get("comprobante");
    comprobanteFile = archivo instanceof File && archivo.size > 0 ? archivo : null;
  } else {
    body = await validateBody(req, abonoSchema);
  }

  // Obtener los hijos del representante
  const hijos = await db.alumno.findMany({
    where: { representanteId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      cantinaId: true,
      cuenta: { select: { id: true } },
    },
  });

  if (!hijos || hijos.length === 0) {
    return NextResponse.json({ error: "No tienes alumnos registrados a tu cargo" }, { status: 400 });
  }

  let alumnosDestino: typeof hijos = [];
  if (body.tipoDistribucion === "individual" && body.alumnoId) {
    const found = hijos.find((h) => h.id === body.alumnoId);
    if (!found) {
      return NextResponse.json({ error: "El alumno seleccionado no pertenece a tu cuenta" }, { status: 403 });
    }
    alumnosDestino = [found];
  } else {
    alumnosDestino = hijos;
  }

  const cantinaId = hijos[0].cantinaId;
  const tasaInfo  = await tasaActivaBcv(cantinaId);
  const tasa      = tasaInfo?.tasa ?? 1;

  // Subir comprobante si aplica
  let comprobanteUrl: string | null = null;
  if (comprobanteFile && (body.metodo === "pago_movil" || body.metodo === "transferencia")) {
    if (comprobanteFile.size > MAX_SIZE) {
      return NextResponse.json({ error: "El comprobante supera los 5 MB" }, { status: 400 });
    }
    const bytes = Buffer.from(await comprobanteFile.arrayBuffer());
    const tipo = tipoImagen(bytes);
    if (!tipo) {
      return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
    }

    const clave = `${cantinaId}/${representanteId}_${Date.now()}.${tipo.ext}`;
    try {
      await guardarArchivo("comprobantes-abonos", clave, bytes);
      comprobanteUrl = clave;
    } catch (err) {
      console.error("[abonos] error guardando archivo:", err);
    }
  }

  const montoPorAlumno = +(body.montoUsd / alumnosDestino.length).toFixed(4);
  const esEfectivo = body.metodo === "efectivo_usd" || body.metodo === "efectivo_bs";
  const refFinal = esEfectivo ? null : body.referencia ? encrypt(body.referencia) : null;
  const montoDec = new Prisma.Decimal(montoPorAlumno);

  const abonosCreadosIds: string[] = [];

  for (const hijo of alumnosDestino) {
    if (!hijo.cuenta) continue;

    const abono = await db.abono.create({
      data: {
        cuentaAlumnoId:       hijo.cuenta.id,
        montoUsd:             montoDec,
        montoBs:              tasaInfo ? montoDec.times(tasa) : null,
        tasaBcv:              tasa,
        metodo:               body.metodo,
        referenciaEncriptada: refFinal,
        banco:                esEfectivo ? null : body.banco ?? null,
        comprobanteUrl,
        estado:               "pendiente",
      },
      select: { id: true },
    });

    abonosCreadosIds.push(abono.id);
  }

  await audit({
    usuarioId: representanteId,
    cantinaId,
    evento:    AuditEvent.ABONO_CREADO,
    entidad:   "abonos",
    entidadId: abonosCreadosIds[0] ?? "familiar",
    datos: {
      montoTotalUsd:    body.montoUsd,
      distribucion:     body.tipoDistribucion,
      alumnosCantidad:  alumnosDestino.length,
      metodo:           body.metodo,
    },
  });

  return NextResponse.json({
    ok: true,
    abonosCount: abonosCreadosIds.length,
    montoPorHijo: montoPorAlumno,
  }, { status: 201 });
});

// GET /api/representante/abonos — historial de abonos
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get("alumnoId");

  const hijos = await db.alumno.findMany({
    where: {
      representanteId,
      ...(alumnoId ? { id: alumnoId } : {}),
      deletedAt: null,
    },
    select: { cuenta: { select: { id: true } } },
  });

  const cuentaIds = hijos.map((h) => h.cuenta?.id).filter((id): id is string => Boolean(id));

  if (cuentaIds.length === 0) return NextResponse.json([]);

  const data = await db.abono.findMany({
    where: { cuentaAlumnoId: { in: cuentaIds }, deletedAt: null },
    select: {
      id: true, montoUsd: true, montoBs: true, metodo: true, banco: true, estado: true,
      createdAt: true, confirmadoAt: true, motivoRechazo: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(legacy(data));
});
