import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { tasaActivaBcv } from "@/lib/bcv";
import { notificarFiadoRegistrado } from "@/lib/notifications";

const itemSchema = z.object({
  productoId: z.string().min(1),
  cantidad:   z.number().int().min(1),
});

const ventaSchema = z.object({
  alumnoId:   z.string().optional(),
  metodoPago: z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "fiado"]),
  referencia: z.string().max(100).optional(),
  items:      z.array(itemSchema).min(1, "El carrito está vacío"),
});

export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId  = session.user.cantinaId!;
  const vendedorId = session.user.id;
  const body       = await validateBody(req, ventaSchema);

  const supabase = createServerSupabase();

  // Obtener tasa BCV activa
  const tasaInfo = await tasaActivaBcv(cantinaId);
  if (!tasaInfo) {
    return NextResponse.json({ error: "Sin tasa BCV disponible para hoy" }, { status: 400 });
  }
  const tasaBcv = tasaInfo.tasa;

  // Cargar todos los productos del carrito
  const productoIds = body.items.map(i => i.productoId);
  const { data: productos, error: prodErr } = await supabase
    .from("productos")
    .select("id, nombre, precio_usd, precio_jornada_usd, stock, activo, cantina_id")
    .in("id", productoIds);

  if (prodErr || !productos) throw prodErr ?? new Error("Error cargando productos");

  // Validaciones de productos (activo y cantina_id)
  for (const item of body.items) {
    const prod = productos.find(p => p.id === item.productoId);
    if (!prod || !prod.activo || prod.cantina_id !== cantinaId) {
      return NextResponse.json({ error: `Producto no disponible` }, { status: 400 });
    }
  }

  // Calcular totales
  const precioEfectivo = (prod: { precio_usd: string; precio_jornada_usd?: string | null }) =>
    prod.precio_jornada_usd ? Number(prod.precio_jornada_usd) : Number(prod.precio_usd);

  const totalUsd = body.items.reduce((sum, item) => {
    const prod = productos.find(p => p.id === item.productoId)!;
    return sum + precioEfectivo(prod) * item.cantidad;
  }, 0);
  const totalBs = totalUsd * tasaBcv;

  // Validar fiado
  if (body.metodoPago === "fiado") {
    if (!body.alumnoId) {
      return NextResponse.json({ error: "Fiado requiere identificar al alumno" }, { status: 400 });
    }
    const { data: alumno } = await supabase
      .from("alumnos")
      .select("fiado_habilitado, limite_fiado_usd, cuentas_alumnos(saldo)")
      .eq("id", body.alumnoId)
      .eq("cantina_id", cantinaId)
      .is("deleted_at", null)
      .single();

    if (!alumno) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 400 });
    }

    if (!alumno.fiado_habilitado) {
      return NextResponse.json({ error: "Este alumno no tiene el fiado habilitado" }, { status: 403 });
    }

    const cuenta = Array.isArray(alumno.cuentas_alumnos)
      ? (alumno.cuentas_alumnos as { saldo: string }[])[0]
      : (alumno.cuentas_alumnos as { saldo: string } | null);
    const saldoActual = Number(cuenta?.saldo ?? 0);
    const deudaActual = saldoActual < 0 ? Math.abs(saldoActual) : 0;
    const limiteUsd   = alumno.limite_fiado_usd
      ? Number(alumno.limite_fiado_usd)
      : null;

    if (limiteUsd !== null && deudaActual + totalUsd > limiteUsd) {
      return NextResponse.json({
        error: `Límite de fiado excedido. Deuda actual: $${deudaActual.toFixed(2)}, límite: $${limiteUsd.toFixed(2)}`,
      }, { status: 400 });
    }
  }

  // Insertar venta
  const { data: venta, error: ventaErr } = await supabase
    .from("ventas")
    .insert({
      cantina_id:  cantinaId,
      vendedor_id: vendedorId,
      alumno_id:   body.alumnoId ?? null,
      tasa_bcv:    tasaBcv,
      total_usd:   totalUsd,
      total_bs:    totalBs,
      metodo_pago: body.metodoPago,
      es_fiado:    body.metodoPago === "fiado",
      referencia:  body.referencia ?? null,
    })
    .select("id")
    .single();

  if (ventaErr || !venta) throw ventaErr ?? new Error("Error insertando venta");

  const detalles = body.items.map(item => {
    const prod = productos.find(p => p.id === item.productoId)!;
    return {
      venta_id:             venta.id,
      producto_id:          item.productoId,
      cantidad:             item.cantidad,
      precio_usd_unitario:  precioEfectivo(prod),
    };
  });

  // Insertar detalles de la venta (sin control ni descuento de stock)
  await supabase.from("detalle_ventas").insert(detalles);

  // Actualizar saldo del alumno si aplica
  if (body.alumnoId) {
    const { data: cuenta } = await supabase
      .from("cuentas_alumnos")
      .select("id, saldo")
      .eq("alumno_id", body.alumnoId)
      .single();

    if (cuenta) {
      await supabase
        .from("cuentas_alumnos")
        .update({ saldo: Number(cuenta.saldo) - totalUsd })
        .eq("id", cuenta.id);
    }
  }

  await audit({
    usuarioId: vendedorId,
    cantinaId,
    evento:    AuditEvent.VENTA_CREADA,
    entidad:   "ventas",
    entidadId: venta.id,
    datos: {
      alumnoId:   body.alumnoId ?? null,
      totalUsd,
      tasaBcv,
      metodoPago: body.metodoPago,
      items:      body.items.length,
    },
  });

  // Notificar fiado al representante (fire-and-forget)
  if (body.metodoPago === "fiado" && body.alumnoId) {
    const { data: al } = await supabase.from("alumnos").select("nombre").eq("id", body.alumnoId).single();
    if (al) notificarFiadoRegistrado(body.alumnoId, al.nombre).catch(() => {});
  }

  return NextResponse.json({ id: venta.id, totalUsd, totalBs, tasaBcv }, { status: 201 });
});

// GET /api/ventas — lista de ventas del día (vendedor/admin)
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const supabase  = createServerSupabase();
  const { searchParams } = new URL(req.url);

  const fecha = searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("ventas")
    .select(`
      id, total_usd, total_bs, metodo_pago, es_fiado, created_at,
      alumnos ( nombre ),
      usuarios!ventas_vendedor_id_fkey ( nombre )
    `)
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .gte("created_at", `${fecha}T00:00:00`)
    .lte("created_at", `${fecha}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return NextResponse.json(data ?? []);
});
