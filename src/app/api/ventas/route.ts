import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy, rangoDia } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";
import { tasaActivaBcv } from "@/lib/bcv";
import { notificarFiadoRegistrado } from "@/lib/notifications";

const itemSchema = z.object({
  productoId: z.string().min(1),
  cantidad:   z.number().int().min(1).max(1000),
});

const ventaSchema = z.object({
  alumnoId:   z.string().optional(),
  metodoPago: z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "fiado"]),
  referencia: z.string().max(100).optional(),
  items:      z.array(itemSchema).min(1, "El carrito está vacío"),
});

// Toda la venta corre en la transacción del request (withAuth)
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId  = session.user.cantinaId!;
  const vendedorId = session.user.id;
  const body       = await validateBody(req, ventaSchema);

  // Obtener tasa BCV activa
  const tasaInfo = await tasaActivaBcv(cantinaId);
  if (!tasaInfo) {
    return NextResponse.json({ error: "Sin tasa BCV disponible para hoy" }, { status: 400 });
  }
  const tasaBcv = new Prisma.Decimal(tasaInfo.tasa);

  // Cargar todos los productos del carrito
  const productoIds = [...new Set(body.items.map(i => i.productoId))];
  const productos = await db.producto.findMany({
    where: { id: { in: productoIds }, cantinaId },
    select: { id: true, nombre: true, precioUsd: true, precioJornadaUsd: true, activo: true },
  });

  const porId = new Map(productos.map(p => [p.id, p]));
  for (const item of body.items) {
    const prod = porId.get(item.productoId);
    if (!prod || !prod.activo) {
      return NextResponse.json({ error: `Producto no disponible` }, { status: 400 });
    }
  }

  // Calcular totales con aritmética decimal
  const precioEfectivo = (id: string) => {
    const p = porId.get(id)!;
    return p.precioJornadaUsd ?? p.precioUsd;
  };
  const totalUsd = body.items.reduce(
    (sum, item) => sum.plus(precioEfectivo(item.productoId).times(item.cantidad)),
    new Prisma.Decimal(0)
  );
  const totalBs = totalUsd.times(tasaBcv);

  // Validar alumno
  if (body.alumnoId) {
    const alumno = await db.alumno.findFirst({
      where: { id: body.alumnoId, cantinaId, deletedAt: null },
      select: { id: true },
    });
    if (!alumno) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 400 });
    }
  }

  // Validar fiado
  if (body.metodoPago === "fiado") {
    if (!body.alumnoId) {
      return NextResponse.json({ error: "Fiado requiere identificar al alumno" }, { status: 400 });
    }
    const alumno = await db.alumno.findFirst({
      where: { id: body.alumnoId, cantinaId, deletedAt: null },
      select: { fiadoHabilitado: true, limiteFiadoUsd: true },
    });

    if (!alumno) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 400 });
    }

    if (!alumno.fiadoHabilitado) {
      return NextResponse.json({ error: "Este alumno no tiene el fiado habilitado" }, { status: 403 });
    }

    // Bloquea la cuenta hasta el commit
    const filas = await db.$queryRaw<{ saldo: Prisma.Decimal }[]>`
      SELECT saldo FROM cuentas_alumnos WHERE alumno_id = ${body.alumnoId} FOR UPDATE`;
    const saldoActual = filas[0]?.saldo ?? new Prisma.Decimal(0);
    const deudaActual = saldoActual.lt(0) ? saldoActual.abs() : new Prisma.Decimal(0);

    if (alumno.limiteFiadoUsd && deudaActual.plus(totalUsd).gt(alumno.limiteFiadoUsd)) {
      return NextResponse.json({
        error: `Límite de fiado excedido. Deuda actual: $${deudaActual.toFixed(2)}, límite: $${alumno.limiteFiadoUsd.toFixed(2)}`,
      }, { status: 400 });
    }
  }

  // Registrar la venta con su detalle (sin control de stock físico)
  const venta = await db.venta.create({
    data: {
      cantinaId,
      vendedorId,
      alumnoId:   body.alumnoId ?? null,
      tasaBcv,
      totalUsd,
      totalBs,
      metodoPago: body.metodoPago,
      esFiado:    body.metodoPago === "fiado",
      referencia: body.referencia ?? null,
      detalles: {
        create: body.items.map(item => ({
          productoId:        item.productoId,
          cantidad:          item.cantidad,
          precioUsdUnitario: precioEfectivo(item.productoId),
        })),
      },
    },
    select: { id: true },
  });

  // Registrar el débito en la cuenta corriente del alumno si aplica
  if (body.alumnoId) {
    const res = await db.cuentaAlumno.updateMany({
      where: { alumnoId: body.alumnoId },
      data: { saldo: { decrement: totalUsd } },
    });
    if (res.count !== 1) throw new Error("El alumno no tiene cuenta corriente");
  }

  await audit({
    usuarioId: vendedorId,
    cantinaId,
    evento:    AuditEvent.VENTA_CREADA,
    entidad:   "ventas",
    entidadId: venta.id,
    datos: {
      alumnoId:   body.alumnoId ?? null,
      totalUsd:   totalUsd.toNumber(),
      tasaBcv:    tasaBcv.toNumber(),
      metodoPago: body.metodoPago,
      items:      body.items.length,
    },
  });

  // Notificar fiado al representante si aplica
  if (body.metodoPago === "fiado" && body.alumnoId) {
    const al = await db.alumno.findUnique({ where: { id: body.alumnoId }, select: { nombre: true } });
    if (al) notificarFiadoRegistrado(body.alumnoId, al.nombre).catch(() => {});
  }

  return NextResponse.json(
    { id: venta.id, totalUsd: totalUsd.toNumber(), totalBs: totalBs.toNumber(), tasaBcv: tasaBcv.toNumber() },
    { status: 201 }
  );
});

// GET /api/ventas — lista de ventas del día (vendedor/admin)
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);

  const fecha = searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const data = await db.venta.findMany({
    where: { cantinaId, deletedAt: null, createdAt: rangoDia(fecha) },
    select: {
      id: true, totalUsd: true, totalBs: true, metodoPago: true, esFiado: true, createdAt: true,
      alumno:   { select: { nombre: true } },
      vendedor: { select: { nombre: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(legacy(data));
});
