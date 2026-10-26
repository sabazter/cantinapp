import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody, safeText } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";

const editarSchema = z.object({
  nombre:        safeText(1, 120).optional(),
  categoria:     z.enum(["tienda", "menu"]).optional(),
  precioUsd:     z.number().positive().multipleOf(0.0001).optional(),
  precioJornada: z.number().positive().multipleOf(0.0001).nullable().optional(),
  stockMin:      z.number().int().min(0).optional(),
  activo:        z.boolean().optional(),
});

async function getProductoPropio(id: string, cantinaId: string) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("productos")
    .select("id, cantina_id")
    .eq("id", id)
    .single();
  if (!data || data.cantina_id !== cantinaId) return null;
  return data;
}

export const PUT = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  if (!(await getProductoPropio(id, session.user.cantinaId!))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await validateBody(req, editarSchema);
  const updates: Record<string, unknown> = {};
  if (body.nombre        !== undefined) updates.nombre              = body.nombre;
  if (body.categoria     !== undefined) updates.categoria           = body.categoria;
  if (body.precioUsd     !== undefined) updates.precio_usd          = body.precioUsd;
  if ("precioJornada"    in  body)      updates.precio_jornada_usd  = body.precioJornada ?? null;
  if (body.stockMin      !== undefined) updates.stock_min           = body.stockMin;
  if (body.activo        !== undefined) updates.activo              = body.activo;

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("productos")
    .update(updates)
    .eq("id", id)
    .select("id, nombre, categoria, precio_usd, precio_jornada_usd, stock, stock_min, activo")
    .single();

  if (error) throw error;
  return NextResponse.json(data);
});

export const DELETE = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  if (!(await getProductoPropio(id, session.user.cantinaId!))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get("permanent") === "true";

  const supabase = createServerSupabase();

  if (permanent) {
    // Comprobar si tiene ventas registradas en detalle_ventas
    const { count: ventasCount } = await supabase
      .from("detalle_ventas")
      .select("id", { count: "exact", head: true })
      .eq("producto_id", id);

    if (ventasCount && ventasCount > 0) {
      return NextResponse.json(
        {
          error: "No se puede eliminar permanentemente porque tiene ventas registradas en el historial. Puedes desactivarlo para que no aparezca en el catálogo.",
          hasSales: true,
        },
        { status: 400 }
      );
    }

    // Eliminar movimientos de inventario asociados para evitar restricción de clave foránea
    await supabase.from("movimientos_inventario").delete().eq("producto_id", id);

    // Eliminar el producto definitivamente
    const { error: delError } = await supabase.from("productos").delete().eq("id", id);
    if (delError) throw delError;

    return NextResponse.json({ success: true, message: "Producto eliminado definitivamente" });
  }

  // Desactivación lógica (soft-delete)
  await supabase.from("productos").update({ activo: false }).eq("id", id);
  return NextResponse.json({ success: true, message: "Producto desactivado" });
});
