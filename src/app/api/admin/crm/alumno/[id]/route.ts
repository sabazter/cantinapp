import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;
  const supabase = createServerSupabase();

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, nombre, curso, seccion, foto_url, activo, fiado_habilitado, limite_fiado_usd, created_at, cuentas_alumnos(id, saldo)")
    .eq("id", id)
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .single();

  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cuentaRaw = alumno.cuentas_alumnos as any;
  const cuentaId: string | null = Array.isArray(cuentaRaw) ? cuentaRaw[0]?.id : cuentaRaw?.id ?? null;
  const saldo = Number(Array.isArray(cuentaRaw) ? cuentaRaw[0]?.saldo : cuentaRaw?.saldo ?? 0);

  // Todas las ventas del alumno
  const { data: ventas } = await supabase
    .from("ventas")
    .select("id, total_usd, metodo_pago, es_fiado, created_at")
    .eq("alumno_id", id)
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const ventasArr = ventas ?? [];
  const ventaIds = ventasArr.map(v => v.id);

  // Producto favorito
  let productoFavorito: { nombre: string; cantidadTotal: number } | null = null;
  if (ventaIds.length > 0) {
    const { data: detalles } = await supabase
      .from("detalle_ventas")
      .select("producto_id, cantidad, productos(nombre)")
      .in("venta_id", ventaIds);

    if (detalles && detalles.length > 0) {
      const map = new Map<string, { nombre: string; total: number }>();
      for (const d of detalles) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nombre = (d.productos as any)?.nombre ?? "Desconocido";
        const prev = map.get(d.producto_id);
        map.set(d.producto_id, { nombre, total: (prev?.total ?? 0) + d.cantidad });
      }
      let maxQty = 0;
      for (const val of Array.from(map.values())) {
        if (val.total > maxQty) { maxQty = val.total; productoFavorito = { nombre: val.nombre, cantidadTotal: val.total }; }
      }
    }
  }

  // Métricas temporales
  const totalVentas = ventasArr.length;
  const gastoTotalUsd = ventasArr.reduce((s, v) => s + Number(v.total_usd), 0);

  let gastoPromedioSemanalUsd = 0;
  let frecuenciaDiasConCompra = 0;
  let horarioTipico: number | null = null;
  let ultimaCompraAt: string | null = null;
  let diasSinComprar = 0;

  if (totalVentas > 0) {
    ultimaCompraAt = ventasArr[ventasArr.length - 1].created_at;
    diasSinComprar = Math.floor((Date.now() - new Date(ultimaCompraAt!).getTime()) / 86_400_000);

    const semanasSet = new Set<string>();
    const diasSet = new Set<string>();
    const horaCounts = new Array(24).fill(0) as number[];

    for (const v of ventasArr) {
      const d = new Date(v.created_at);
      const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
      semanasSet.add(`${d.getFullYear()}-W${Math.floor(dayOfYear / 7)}`);
      diasSet.add(d.toISOString().slice(0, 10));
      horaCounts[d.getHours()]++;
    }

    const numSemanas = Math.max(semanasSet.size, 1);
    gastoPromedioSemanalUsd = Math.round((gastoTotalUsd / numSemanas) * 100) / 100;
    frecuenciaDiasConCompra = Math.round((diasSet.size / numSemanas) * 10) / 10;

    const maxH = Math.max(...horaCounts);
    if (maxH > 0) horarioTipico = horaCounts.indexOf(maxH);
  }

  // Abonos (a través de la cuenta)
  const { data: abonos } = cuentaId
    ? await supabase
        .from("abonos")
        .select("id, monto_usd, metodo, estado, created_at")
        .eq("cuenta_alumno_id", cuentaId)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };

  const abonosArr = abonos ?? [];
  const totalAbonadoUsd = abonosArr
    .filter(a => a.estado === "confirmado")
    .reduce((s, a) => s + Number(a.monto_usd), 0);

  const totalFiadoUsd = ventasArr
    .filter(v => v.es_fiado)
    .reduce((s, v) => s + Number(v.total_usd), 0);

  // Calificación de pagador
  const deudaActual = saldo < 0 ? Math.abs(saldo) : 0;
  const limite = Number(alumno.limite_fiado_usd ?? 50);
  const calificacion =
    deudaActual === 0            ? "excelente"
    : deudaActual < limite * 0.3 ? "bueno"
    : deudaActual < limite * 0.7 ? "regular"
    :                               "riesgo";

  // Umbral de deuda de la cantina
  const { data: cantina } = await supabase
    .from("cantinas")
    .select("umbral_deuda_usd")
    .eq("id", cantinaId)
    .single();
  const umbral = Number(cantina?.umbral_deuda_usd ?? 20);

  // Alertas activas
  const alertas: { tipo: string; mensaje: string }[] = [];
  if (deudaActual >= umbral)
    alertas.push({ tipo: "deuda_alta", mensaje: `Deuda de $${deudaActual.toFixed(2)} supera el umbral de $${umbral.toFixed(2)}` });
  if (diasSinComprar >= 14 && totalVentas > 0)
    alertas.push({ tipo: "inactividad", mensaje: `Sin compras hace ${diasSinComprar} días` });
  if (alumno.fiado_habilitado && alumno.limite_fiado_usd && deudaActual > 0) {
    const pct = deudaActual / Number(alumno.limite_fiado_usd);
    if (pct >= 0.8)
      alertas.push({ tipo: "limite_cercano", mensaje: `Deuda al ${Math.round(pct * 100)}% del límite de fiado` });
  }

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento: AuditEvent.ALUMNO_CONSULTADO,
    entidad: "alumnos",
    entidadId: id,
    datos: { accion: "crm_perfil_360" },
  });

  return NextResponse.json({
    alumno: {
      id: alumno.id,
      nombre: alumno.nombre,
      curso: alumno.curso,
      seccion: alumno.seccion,
      fotoUrl: alumno.foto_url,
      activo: alumno.activo,
      fiadoHabilitado: alumno.fiado_habilitado,
      limiteFiadoUsd: Number(alumno.limite_fiado_usd ?? 0),
      createdAt: alumno.created_at,
    },
    cuenta: { saldo },
    metricas: {
      totalVentas,
      gastoTotalUsd: Math.round(gastoTotalUsd * 100) / 100,
      gastoPromedioSemanalUsd,
      frecuenciaDiasConCompra,
      productoFavorito,
      horarioTipico,
      ultimaCompraAt,
      diasSinComprar,
    },
    financiero: {
      saldoActual: saldo,
      totalFiadoUsd: Math.round(totalFiadoUsd * 100) / 100,
      totalAbonadoUsd: Math.round(totalAbonadoUsd * 100) / 100,
      calificacion,
      historialAbonos: abonosArr.map(a => ({
        id: a.id,
        montoUsd: Number(a.monto_usd),
        metodo: a.metodo,
        estado: a.estado,
        createdAt: a.created_at,
      })),
    },
    alertas,
  });
});
