import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const anularSchema = z.object({
  motivo: z.string().min(3).max(300),
});

// DELETE /api/ventas/[id] — anular venta (solo admin)
export const DELETE = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const { motivo } = await validateBody(req, anularSchema);

  const supabase = createServerSupabase();

  // Verificar propiedad
  const { data: venta } = await supabase
    .from("ventas")
    .select(`
      id, cantina_id, es_fiado, alumno_id, total_usd,
      detalle_ventas ( producto_id, cantidad )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!venta || venta.cantina_id !== cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Soft delete
  await supabase.from("ventas").update({
    deleted_at:     new Date().toISOString(),
    deleted_by:     session.user.id,
    deleted_motivo: motivo,
  }).eq("id", id);

  // Revertir stock
  const detalles = venta.detalle_ventas as { producto_id: string; cantidad: number }[];
  if (detalles?.length) {
    const { data: productos } = await supabase
      .from("productos")
      .select("id, stock")
      .in("id", detalles.map(d => d.producto_id));

    if (productos) {
      await Promise.all(
        detalles.map(d => {
          const prod = productos.find(p => p.id === d.producto_id);
          if (!prod) return Promise.resolve();
          return supabase
            .from("productos")
            .update({ stock: prod.stock + d.cantidad })
            .eq("id", d.producto_id);
        })
      );
    }
  }

  // Revertir saldo si era fiado
  if (venta.es_fiado && venta.alumno_id) {
    const { data: cuenta } = await supabase
      .from("cuentas_alumnos")
      .select("id, saldo")
      .eq("alumno_id", venta.alumno_id)
      .single();

    if (cuenta) {
      await supabase
        .from("cuentas_alumnos")
        .update({ saldo: Number(cuenta.saldo) + Number(venta.total_usd) })
        .eq("id", cuenta.id);
    }
  }

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.VENTA_ANULADA,
    entidad:   "ventas",
    entidadId: id,
    datos:     { motivo },
  });

  return NextResponse.json({ ok: true });
});

// GET /api/ventas/[id] — detalle de una venta
export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "vendedor", "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("ventas")
    .select(`
      id, total_usd, total_bs, tasa_bcv, metodo_pago, es_fiado,
      referencia, created_at, cantina_id,
      alumnos ( id, nombre ),
      usuarios!ventas_vendedor_id_fkey ( nombre ),
      detalle_ventas (
        cantidad, precio_usd_unitario,
        productos ( nombre )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (data.cantina_id !== cantinaId) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  return NextResponse.json(data);
});
