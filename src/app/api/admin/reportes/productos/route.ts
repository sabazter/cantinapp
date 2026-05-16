import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/admin/reportes/productos?dias=30
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const dias      = Math.min(Number(new URL(req.url).searchParams.get("dias") ?? "30"), 90);
  const desde     = new Date(Date.now() - dias * 86400000).toISOString();

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("detalle_ventas")
    .select(`
      cantidad,
      precio_usd_unitario,
      productos!detalle_ventas_producto_id_fkey ( id, nombre, categoria ),
      ventas!detalle_ventas_venta_id_fkey ( cantina_id, deleted_at, created_at )
    `)
    .gte("ventas.created_at", desde);

  if (error) throw error;

  // Filtrar por cantina y ventas no anuladas, luego agrupar por producto
  const map: Record<string, { nombre: string; categoria: string; cantidadVendida: number; ingresoUsd: number }> = {};

  for (const row of data ?? []) {
    const ventaRaw = row.ventas as unknown as { cantina_id: string; deleted_at: string | null } | null;
    if (!ventaRaw || ventaRaw.cantina_id !== cantinaId || ventaRaw.deleted_at) continue;

    const prodRaw = row.productos as unknown as { id: string; nombre: string; categoria: string } | null;
    const prod = prodRaw;
    if (!prod) continue;

    if (!map[prod.id]) {
      map[prod.id] = { nombre: prod.nombre, categoria: prod.categoria, cantidadVendida: 0, ingresoUsd: 0 };
    }
    map[prod.id].cantidadVendida += Number(row.cantidad);
    map[prod.id].ingresoUsd      += +(Number(row.precio_usd_unitario) * Number(row.cantidad)).toFixed(2);
  }

  const ranking = Object.values(map)
    .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
    .slice(0, 20)
    .map(r => ({ ...r, ingresoUsd: +r.ingresoUsd.toFixed(2) }));

  return NextResponse.json(ranking);
});
