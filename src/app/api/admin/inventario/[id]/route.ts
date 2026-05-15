import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";

const editarSchema = z.object({
  nombre:    z.string().min(1).max(120).optional(),
  categoria: z.enum(["tienda", "menu"]).optional(),
  precioUsd: z.number().positive().multipleOf(0.0001).optional(),
  stockMin:  z.number().int().min(0).optional(),
  activo:    z.boolean().optional(),
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
  if (body.nombre    !== undefined) updates.nombre     = body.nombre;
  if (body.categoria !== undefined) updates.categoria  = body.categoria;
  if (body.precioUsd !== undefined) updates.precio_usd = body.precioUsd;
  if (body.stockMin  !== undefined) updates.stock_min  = body.stockMin;
  if (body.activo    !== undefined) updates.activo     = body.activo;

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("productos")
    .update(updates)
    .eq("id", id)
    .select("id, nombre, categoria, precio_usd, stock, stock_min, activo")
    .single();

  if (error) throw error;
  return NextResponse.json(data);
});

export const DELETE = withAuth(async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  if (!(await getProductoPropio(id, session.user.cantinaId!))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const supabase = createServerSupabase();
  await supabase.from("productos").update({ activo: false }).eq("id", id);
  return new NextResponse(null, { status: 204 });
});
