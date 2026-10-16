import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";

// GET /api/admin/inventario/[id]/movimientos
export const GET = withAuth(async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  // Verificar propiedad a través del producto
  const producto = await db.producto.findUnique({ where: { id }, select: { cantinaId: true } });

  if (!producto || producto.cantinaId !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const data = await db.movimientoInventario.findMany({
    where: { productoId: id, deletedAt: null },
    select: { id: true, tipo: true, cantidad: true, motivo: true, usuarioId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(legacy(data));
});
