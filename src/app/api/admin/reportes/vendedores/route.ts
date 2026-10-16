import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";

// GET /api/admin/reportes/vendedores?dias=30
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const dias      = Math.min(Math.max(Number(new URL(req.url).searchParams.get("dias") ?? "30") || 30, 1), 90);
  const desde     = new Date(Date.now() - dias * 86400000);

  const data = await db.venta.findMany({
    where: { cantinaId, createdAt: { gte: desde } },
    select: {
      totalUsd: true, esFiado: true, deletedAt: true,
      vendedor: { select: { id: true, nombre: true } },
    },
  });

  const map: Record<string, {
    nombre: string;
    ventas: number;
    totalUsd: number;
    fiados: number;
    anulaciones: number;
  }> = {};

  for (const row of data) {
    const vendedor = row.vendedor;
    if (!vendedor) continue;

    if (!map[vendedor.id]) {
      map[vendedor.id] = { nombre: vendedor.nombre, ventas: 0, totalUsd: 0, fiados: 0, anulaciones: 0 };
    }

    if (row.deletedAt) {
      map[vendedor.id].anulaciones += 1;
    } else {
      map[vendedor.id].ventas   += 1;
      map[vendedor.id].totalUsd += row.totalUsd.toNumber();
      if (row.esFiado) map[vendedor.id].fiados += 1;
    }
  }

  const resultado = Object.values(map)
    .map(r => ({ ...r, totalUsd: +r.totalUsd.toFixed(2) }))
    .sort((a, b) => b.totalUsd - a.totalUsd);

  return NextResponse.json(resultado);
});
