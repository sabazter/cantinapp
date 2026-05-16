import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const supabase  = createServerSupabase();
  const hoy       = new Date().toISOString().slice(0, 10);
  const hace6d    = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const [
    { data: ventasHoyData },
    { data: ventasSemanaData },
    { data: prodStock },
    { count: alumnosActivos },
    { data: fiadoPendienteData },
  ] = await Promise.all([
    supabase
      .from("ventas")
      .select("total_usd, metodo_pago")
      .eq("cantina_id", cantinaId)
      .is("deleted_at", null)
      .gte("created_at", `${hoy}T00:00:00`)
      .lte("created_at", `${hoy}T23:59:59`),

    supabase
      .from("ventas")
      .select("total_usd, metodo_pago, created_at")
      .eq("cantina_id", cantinaId)
      .is("deleted_at", null)
      .gte("created_at", `${hace6d}T00:00:00`),

    supabase
      .from("productos")
      .select("stock, stock_min")
      .eq("cantina_id", cantinaId)
      .eq("activo", true),

    supabase
      .from("alumnos")
      .select("*", { count: "exact", head: true })
      .eq("cantina_id", cantinaId)
      .eq("activo", true)
      .is("deleted_at", null),

    supabase
      .from("abonos")
      .select("monto_usd")
      .eq("cantina_id", cantinaId)
      .eq("estado", "pendiente")
      .is("deleted_at", null),
  ]);

  // KPIs del día
  const ventasHoy      = ventasHoyData ?? [];
  const ventasHoyUsd   = ventasHoy.reduce((s, v) => s + Number(v.total_usd), 0);

  // Por método de pago (hoy)
  const metodosMap: Record<string, number> = {};
  for (const v of ventasHoy) {
    metodosMap[v.metodo_pago] = (metodosMap[v.metodo_pago] ?? 0) + Number(v.total_usd);
  }
  const porMetodoPago = Object.entries(metodosMap).map(([metodo, totalUsd]) => ({ metodo, totalUsd }));

  // Fiado pendiente (abonos en revisión)
  const fiadoPendiente    = fiadoPendienteData ?? [];
  const fiadoPendienteUsd = fiadoPendiente.reduce((s, a) => s + Number(a.monto_usd), 0);

  // Stock bajo
  const stockBajoCount = (prodStock ?? []).filter(p => p.stock <= p.stock_min).length;

  // Ventas agrupadas por día (últimos 7 días)
  const ventasPorDia: Record<string, { count: number; totalUsd: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    ventasPorDia[d] = { count: 0, totalUsd: 0 };
  }
  for (const v of ventasSemanaData ?? []) {
    const d = (v.created_at as string).slice(0, 10);
    if (ventasPorDia[d]) {
      ventasPorDia[d].count    += 1;
      ventasPorDia[d].totalUsd  = +(ventasPorDia[d].totalUsd + Number(v.total_usd)).toFixed(2);
    }
  }
  const ventasSemana = Object.entries(ventasPorDia).map(([fecha, data]) => ({ fecha, ...data }));

  return NextResponse.json({
    ventasHoy:      { count: ventasHoy.length, totalUsd: +ventasHoyUsd.toFixed(2) },
    fiadoPendiente: { count: fiadoPendiente.length, totalUsd: +fiadoPendienteUsd.toFixed(2) },
    stockBajo:      stockBajoCount,
    alumnosActivos: alumnosActivos ?? 0,
    ventasSemana,
    porMetodoPago,
  });
});
