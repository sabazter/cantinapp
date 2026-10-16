import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";

// GET /api/admin/reportes/productos?dias=30
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const dias      = Math.min(Math.max(Number(new URL(req.url).searchParams.get("dias") ?? "30") || 30, 1), 90);
  const desde     = new Date(Date.now() - dias * 86400000);

  // Solo ventas de esta cantina, no anuladas
  const data = await db.detalleVenta.findMany({
    where: { venta: { cantinaId, deletedAt: null, createdAt: { gte: desde } } },
    select: {
      cantidad: true,
      precioUsdUnitario: true,
      producto: { select: { id: true, nombre: true, categoria: true } },
    },
  });

  // Agrupar por producto
  const map: Record<string, { nombre: string; categoria: string; cantidadVendida: number; ingresoUsd: number }> = {};

  for (const row of data) {
    const prod = row.producto;
    if (!prod) continue;

    if (!map[prod.id]) {
      map[prod.id] = { nombre: prod.nombre, categoria: prod.categoria, cantidadVendida: 0, ingresoUsd: 0 };
    }
    map[prod.id].cantidadVendida += row.cantidad;
    map[prod.id].ingresoUsd      += +(row.precioUsdUnitario.toNumber() * row.cantidad).toFixed(2);
  }

  const ranking = Object.values(map)
    .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
    .slice(0, 20)
    .map(r => ({ ...r, ingresoUsd: +r.ingresoUsd.toFixed(2) }));

  return NextResponse.json(ranking);
});
