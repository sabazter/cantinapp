import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/admin/crm/dashboard
// Resumen CRM: ventas hoy, fiado hoy, abonos hoy, deuda total, alertas activas
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;
  const supabase = createServerSupabase();

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const hoyIso = hoyInicio.toISOString();

  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Ventas de hoy
  const { data: ventasHoy } = await supabase
    .from("ventas")
    .select("id, total_usd, es_fiado")
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .gte("created_at", hoyIso);

  const ventasHoyArr = ventasHoy ?? [];
  const totalVentasHoy = ventasHoyArr.length;
  const montoVentasHoyUsd = ventasHoyArr.reduce((s, v) => s + Number(v.total_usd), 0);
  const fiadoHoyUsd = ventasHoyArr.filter(v => v.es_fiado).reduce((s, v) => s + Number(v.total_usd), 0);

  // Abonos de hoy
  const { data: abonosHoy } = await supabase
    .from("abonos")
    .select("id, monto_usd, estado")
    .gte("created_at", hoyIso);

  const abonosHoyArr = abonosHoy ?? [];
  const abonosHoyUsd = abonosHoyArr
    .filter(a => a.estado === "confirmado")
    .reduce((s, a) => s + Number(a.monto_usd), 0);

  // Deuda total (saldo negativo en cuentas)
  const { data: cuentas } = await supabase
    .from("cuentas_alumnos")
    .select("saldo, alumnos!inner(cantina_id, activo, deleted_at)")
    .eq("alumnos.cantina_id", cantinaId)
    .eq("alumnos.activo", true)
    .is("alumnos.deleted_at", null);

  let deudaTotalUsd = 0;
  let alumnosEnDeuda = 0;
  for (const c of cuentas ?? []) {
    const s = Number(c.saldo);
    if (s < 0) { deudaTotalUsd += Math.abs(s); alumnosEnDeuda++; }
  }

  // Umbral
  const { data: cantina } = await supabase
    .from("cantinas")
    .select("umbral_deuda_usd")
    .eq("id", cantinaId)
    .single();
  const umbral = Number(cantina?.umbral_deuda_usd ?? 20);

  // Tendencia semanal (últimos 7 días, agrupar por día)
  const { data: ventasSemana } = await supabase
    .from("ventas")
    .select("total_usd, created_at")
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .gte("created_at", hace7)
    .order("created_at");

  // Agrupar por fecha
  const tendencia: Record<string, number> = {};
  for (const v of ventasSemana ?? []) {
    const day = v.created_at.slice(0, 10);
    tendencia[day] = (tendencia[day] ?? 0) + Number(v.total_usd);
  }
  const tendenciaArr = Object.entries(tendencia).map(([fecha, total]) => ({ fecha, total: Math.round(total * 100) / 100 }));

  // Top 5 productos del día
  const ventaIdsHoy = ventasHoyArr.map(v => v.id);
  let topProductosHoy: { nombre: string; cantidad: number }[] = [];
  if (ventaIdsHoy.length > 0) {
    const { data: detalles } = await supabase
      .from("detalle_ventas")
      .select("cantidad, productos(nombre)")
      .in("venta_id", ventaIdsHoy);

    const map = new Map<string, number>();
    for (const d of detalles ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nombre = (d.productos as any)?.nombre ?? "?";
      map.set(nombre, (map.get(nombre) ?? 0) + d.cantidad);
    }
    topProductosHoy = Array.from(map.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }

  // Alertas activas
  const alertas: { tipo: string; mensaje: string; severidad: "alta" | "media" | "baja" }[] = [];

  // Alumnos con deuda alta
  const alumnosDeudaAlta = alumnosEnDeuda;
  if (alumnosDeudaAlta > 0) {
    alertas.push({
      tipo: "deuda_critica",
      mensaje: `${alumnosDeudaAlta} alumno${alumnosDeudaAlta !== 1 ? "s" : ""} con deuda ≥ $${umbral.toFixed(0)}`,
      severidad: "alta",
    });
  }

  // Alumnos inactivos (sin compras en 14 días)
  const hace14 = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: ultimasVentas } = await supabase
    .from("ventas")
    .select("alumno_id")
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .gte("created_at", hace14)
    .not("alumno_id", "is", null);

  const alumnosActivosReciente = new Set((ultimasVentas ?? []).map(v => v.alumno_id));
  const { data: alumnosActivos } = await supabase
    .from("alumnos")
    .select("id")
    .eq("cantina_id", cantinaId)
    .eq("activo", true)
    .is("deleted_at", null);

  const inactivos = (alumnosActivos ?? []).filter(a => !alumnosActivosReciente.has(a.id)).length;
  if (inactivos > 0) {
    alertas.push({
      tipo: "inactividad",
      mensaje: `${inactivos} alumno${inactivos !== 1 ? "s" : ""} sin compras en 14+ días`,
      severidad: "media",
    });
  }

  // Pico de fiado hoy
  const pctFiado = montoVentasHoyUsd > 0 ? fiadoHoyUsd / montoVentasHoyUsd : 0;
  if (pctFiado > 0.5 && fiadoHoyUsd > 0) {
    alertas.push({
      tipo: "pico_fiado",
      mensaje: `Hoy el ${Math.round(pctFiado * 100)}% de las ventas fueron a fiado ($${fiadoHoyUsd.toFixed(2)})`,
      severidad: "media",
    });
  }

  return NextResponse.json({
    hoy: {
      totalVentas: totalVentasHoy,
      montoVentasUsd: Math.round(montoVentasHoyUsd * 100) / 100,
      fiadoUsd: Math.round(fiadoHoyUsd * 100) / 100,
      abonosUsd: Math.round(abonosHoyUsd * 100) / 100,
    },
    deuda: {
      totalUsd: Math.round(deudaTotalUsd * 100) / 100,
      alumnosEnDeuda,
      umbral,
    },
    tendenciaSemanal: tendenciaArr,
    topProductosHoy,
    alertas,
  });
});
