import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/admin/reportes/vendedores?dias=30
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const dias      = Math.min(Number(new URL(req.url).searchParams.get("dias") ?? "30"), 90);
  const desde     = new Date(Date.now() - dias * 86400000).toISOString();

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("ventas")
    .select(`
      total_usd, es_fiado, deleted_at,
      usuarios!ventas_vendedor_id_fkey ( id, nombre )
    `)
    .eq("cantina_id", cantinaId)
    .gte("created_at", desde);

  if (error) throw error;

  const map: Record<string, {
    nombre: string;
    ventas: number;
    totalUsd: number;
    fiados: number;
    anulaciones: number;
  }> = {};

  for (const row of data ?? []) {
    const vendedor = row.usuarios as unknown as { id: string; nombre: string } | null;
    if (!vendedor) continue;

    if (!map[vendedor.id]) {
      map[vendedor.id] = { nombre: vendedor.nombre, ventas: 0, totalUsd: 0, fiados: 0, anulaciones: 0 };
    }

    if (row.deleted_at) {
      map[vendedor.id].anulaciones += 1;
    } else {
      map[vendedor.id].ventas   += 1;
      map[vendedor.id].totalUsd += Number(row.total_usd);
      if (row.es_fiado) map[vendedor.id].fiados += 1;
    }
  }

  const resultado = Object.values(map)
    .map(r => ({ ...r, totalUsd: +r.totalUsd.toFixed(2) }))
    .sort((a, b) => b.totalUsd - a.totalUsd);

  return NextResponse.json(resultado);
});
