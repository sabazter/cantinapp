import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const anularSchema = z.object({
  motivo: z.string().min(3).max(300),
});

// DELETE /api/ventas/[id] — anular venta (solo admin)
// Soft delete idempotente: el UPDATE condicional (deleted_at IS NULL) garantiza que el stock y el
// saldo se reviertan una sola vez aunque lleguen dos anulaciones simultáneas.
export const DELETE = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const { motivo } = await validateBody(req, anularSchema);

  const marcada = await db.venta.updateMany({
    where: { id, cantinaId, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy: session.user.id, deletedMotivo: motivo },
  });

  if (marcada.count !== 1) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const venta = await db.venta.findUniqueOrThrow({
    where: { id },
    select: {
      esFiado: true, alumnoId: true, totalUsd: true,
      detalles: { select: { productoId: true, cantidad: true } },
    },
  });

  // Revertir stock (incremento atómico por producto)
  for (const d of venta.detalles) {
    await db.producto.update({
      where: { id: d.productoId },
      data: { stock: { increment: d.cantidad } },
    });
  }

  // Revertir saldo si era fiado
  if (venta.esFiado && venta.alumnoId) {
    const res = await db.cuentaAlumno.updateMany({
      where: { alumnoId: venta.alumnoId },
      data: { saldo: { increment: venta.totalUsd } },
    });
    if (res.count !== 1) throw new Error("El alumno no tiene cuenta corriente");
  }

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.VENTA_ANULADA,
    entidad:   "ventas",
    entidadId: id,
    datos:     { motivo },
  });

  return NextResponse.json({ ok: true });
});

// GET /api/ventas/[id] — detalle de una venta
export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "vendedor", "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const data = await db.venta.findFirst({
    where: { id, cantinaId },
    select: {
      id: true, totalUsd: true, totalBs: true, tasaBcv: true, metodoPago: true, esFiado: true,
      referencia: true, createdAt: true, cantinaId: true,
      alumno:   { select: { id: true, nombre: true } },
      vendedor: { select: { nombre: true } },
      detalles: {
        select: {
          cantidad: true, precioUsdUnitario: true,
          producto: { select: { nombre: true } },
        },
      },
    },
  });

  if (!data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  return NextResponse.json(legacy(data));
});
