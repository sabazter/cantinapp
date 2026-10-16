import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await db.alumno.findFirst({
    where: { id, cantinaId, deletedAt: null },
    select: {
      id: true, nombre: true, curso: true, seccion: true, fotoUrl: true, activo: true,
      fiadoHabilitado: true, limiteFiadoUsd: true, createdAt: true,
      cuenta: { select: { id: true, saldo: true } },
    },
  });

  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const cuentaId = alumno.cuenta?.id ?? null;
  const saldo = alumno.cuenta?.saldo.toNumber() ?? 0;

  // Todas las ventas del alumno (con su detalle, para el producto favorito)
  const ventasArr = await db.venta.findMany({
    where: { alumnoId: id, cantinaId, deletedAt: null },
    select: {
      id: true, totalUsd: true, metodoPago: true, esFiado: true, createdAt: true,
      detalles: { select: { productoId: true, cantidad: true, producto: { select: { nombre: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Producto favorito
  let productoFavorito: { nombre: string; cantidadTotal: number } | null = null;
  const map = new Map<string, { nombre: string; total: number }>();
  for (const v of ventasArr) {
    for (const d of v.detalles) {
      const prev = map.get(d.productoId);
      map.set(d.productoId, { nombre: d.producto?.nombre ?? "Desconocido", total: (prev?.total ?? 0) + d.cantidad });
    }
  }
  let maxQty = 0;
  for (const val of Array.from(map.values())) {
    if (val.total > maxQty) { maxQty = val.total; productoFavorito = { nombre: val.nombre, cantidadTotal: val.total }; }
  }

  // Métricas temporales
  const totalVentas = ventasArr.length;
  const gastoTotalUsd = ventasArr.reduce((s, v) => s + v.totalUsd.toNumber(), 0);

  let gastoPromedioSemanalUsd = 0;
  let frecuenciaDiasConCompra = 0;
  let horarioTipico: number | null = null;
  let ultimaCompraAt: string | null = null;
  let diasSinComprar = 0;

  if (totalVentas > 0) {
    const ultima = ventasArr[ventasArr.length - 1].createdAt;
    ultimaCompraAt = ultima.toISOString();
    diasSinComprar = Math.floor((Date.now() - ultima.getTime()) / 86_400_000);

    const semanasSet = new Set<string>();
    const diasSet = new Set<string>();
    const horaCounts = new Array(24).fill(0) as number[];

    for (const v of ventasArr) {
      const d = v.createdAt;
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
  const abonosArr = cuentaId
    ? await db.abono.findMany({
        where: { cuentaAlumnoId: cuentaId },
        select: { id: true, montoUsd: true, metodo: true, estado: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const totalAbonadoUsd = abonosArr
    .filter(a => a.estado === "confirmado")
    .reduce((s, a) => s + a.montoUsd.toNumber(), 0);

  const totalFiadoUsd = ventasArr
    .filter(v => v.esFiado)
    .reduce((s, v) => s + v.totalUsd.toNumber(), 0);

  // Calificación de pagador
  const deudaActual = saldo < 0 ? Math.abs(saldo) : 0;
  const limite = alumno.limiteFiadoUsd?.toNumber() ?? 50;
  const calificacion =
    deudaActual === 0            ? "excelente"
    : deudaActual < limite * 0.3 ? "bueno"
    : deudaActual < limite * 0.7 ? "regular"
    :                               "riesgo";

  // Umbral de deuda de la cantina
  const cantina = await db.cantina.findUnique({
    where: { id: cantinaId },
    select: { umbralDeudaUsd: true },
  });
  const umbral = cantina?.umbralDeudaUsd.toNumber() ?? 20;

  // Alertas activas
  const alertas: { tipo: string; mensaje: string }[] = [];
  if (deudaActual >= umbral)
    alertas.push({ tipo: "deuda_alta", mensaje: `Deuda de $${deudaActual.toFixed(2)} supera el umbral de $${umbral.toFixed(2)}` });
  if (diasSinComprar >= 14 && totalVentas > 0)
    alertas.push({ tipo: "inactividad", mensaje: `Sin compras hace ${diasSinComprar} días` });
  if (alumno.fiadoHabilitado && alumno.limiteFiadoUsd && deudaActual > 0) {
    const pct = deudaActual / alumno.limiteFiadoUsd.toNumber();
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
      fotoUrl: alumno.fotoUrl,
      activo: alumno.activo,
      fiadoHabilitado: alumno.fiadoHabilitado,
      limiteFiadoUsd: alumno.limiteFiadoUsd?.toNumber() ?? 0,
      createdAt: alumno.createdAt.toISOString(),
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
        montoUsd: a.montoUsd.toNumber(),
        metodo: a.metodo,
        estado: a.estado,
        createdAt: a.createdAt.toISOString(),
      })),
    },
    alertas,
  });
});
