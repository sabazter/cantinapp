import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { audit, AuditEvent } from "@/lib/audit";

const ajusteSchema = z.object({
  cantidad: z.number().int(),   // positivo = suma, negativo = resta
  motivo:   z.string().min(1).max(200),
});

// POST /api/admin/inventario/[id]/ajuste
export const POST = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  // Bloquea la fila hasta el commit: dos ajustes simultáneos se aplican en serie
  const filas = await db.$queryRaw<{ stock: number; cantina_id: string }[]>`
    SELECT stock, cantina_id FROM productos WHERE id = ${id} FOR UPDATE`;
  const producto = filas[0];

  if (!producto || producto.cantina_id !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { cantidad, motivo } = await validateBody(req, ajusteSchema);
  const nuevoStock = Math.max(0, producto.stock + cantidad);

  await db.producto.update({ where: { id }, data: { stock: nuevoStock } });
  await db.movimientoInventario.create({
    data: { productoId: id, tipo: "ajuste", cantidad, motivo, usuarioId: session.user.id },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.INVENTARIO_AJUSTE,
    entidad:   "producto",
    entidadId: id,
    datos:     { tipo: "ajuste", cantidad, motivo, stockAnterior: producto.stock, stockNuevo: nuevoStock },
  });

  return NextResponse.json({ stock: nuevoStock });
});
