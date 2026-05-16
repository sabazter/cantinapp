import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/admin/caja?fecha=YYYY-MM-DD — resumen de cierre de caja
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

  const supabase = createServerSupabase();

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("total_usd, total_bs, metodo_pago, es_fiado")
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .gte("created_at", `${fecha}T00:00:00`)
    .lte("created_at", `${fecha}T23:59:59`);

  if (error) throw error;

  // Calcular totales por método de pago
  type Metodo = "efectivo_usd" | "efectivo_bs" | "pago_movil" | "fiado";
  const porMetodo: Record<Metodo, { usd: number; bs: number; count: number }> = {
    efectivo_usd: { usd: 0, bs: 0, count: 0 },
    efectivo_bs:  { usd: 0, bs: 0, count: 0 },
    pago_movil:   { usd: 0, bs: 0, count: 0 },
    fiado:        { usd: 0, bs: 0, count: 0 },
  };

  let totalUsd = 0;
  let totalBs  = 0;

  for (const v of ventas ?? []) {
    const m = v.metodo_pago as Metodo;
    const usd = Number(v.total_usd);
    const bs  = Number(v.total_bs);
    porMetodo[m].usd   += usd;
    porMetodo[m].bs    += bs;
    porMetodo[m].count += 1;
    totalUsd += usd;
    totalBs  += bs;
  }

  // Abonos confirmados del día
  const { data: abonos } = await supabase
    .from("abonos")
    .select(`
      monto_usd, metodo,
      cuentas_alumnos ( alumnos ( cantina_id ) )
    `)
    .eq("estado", "confirmado")
    .is("deleted_at", null)
    .gte("confirmado_at", `${fecha}T00:00:00`)
    .lte("confirmado_at", `${fecha}T23:59:59`);

  const abonosDelDia = (abonos ?? []).filter(a => {
    const ca = a.cuentas_alumnos as unknown as { alumnos: { cantina_id: string } | null } | null;
    return ca?.alumnos?.cantina_id === cantinaId;
  });

  const totalAbonosUsd = abonosDelDia.reduce((s, a) => s + Number(a.monto_usd), 0);

  return NextResponse.json({
    fecha,
    ventas: {
      count:    ventas?.length ?? 0,
      totalUsd,
      totalBs,
      porMetodo,
    },
    abonos: {
      count:    abonosDelDia.length,
      totalUsd: totalAbonosUsd,
    },
  });
});
