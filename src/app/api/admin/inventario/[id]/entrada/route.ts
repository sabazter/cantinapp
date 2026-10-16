import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { audit, AuditEvent } from "@/lib/audit";

const entradaSchema = z.object({
  cantidad: z.number().int().min(1),
  motivo:   z.string().max(200).optional(),
});

// POST /api/admin/inventario/[id]/entrada
export const POST = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  // Verificar propiedad
  const producto = await db.producto.findUnique({ where: { id }, select: { cantinaId: true } });

  if (!producto || producto.cantinaId !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { cantidad, motivo } = await validateBody(req, entradaSchema);

  // Incremento atómico; devuelve el stock resultante
  const actualizado = await db.producto.update({
    where: { id },
    data: { stock: { increment: cantidad } },
    select: { stock: true },
  });
  const nuevoStock = actualizado.stock;

  await db.movimientoInventario.create({
    data: { productoId: id, tipo: "entrada", cantidad, motivo: motivo ?? null, usuarioId: session.user.id },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.INVENTARIO_AJUSTE,
    entidad:   "producto",
    entidadId: id,
    datos:     { tipo: "entrada", cantidad, stockAnterior: nuevoStock - cantidad, stockNuevo: nuevoStock },
  });

  return NextResponse.json({ stock: nuevoStock });
});
