import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody, safeText } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";

const productoSchema = z.object({
  nombre:         safeText(1, 120),
  categoria:      z.enum(["tienda", "menu"]),
  precioUsd:      z.number().positive().multipleOf(0.0001),
  stockMin:       z.number().int().min(0).default(5),
  precioJornada:  z.number().positive().multipleOf(0.0001).nullable().optional(),
});

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin", "vendedor");

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, categoria, precio_usd, precio_jornada_usd, stock, stock_min, activo, created_at")
    .eq("cantina_id", session.user.cantinaId!)
    .order("nombre");

  if (error) throw error;
  return NextResponse.json(data);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const body = await validateBody(req, productoSchema);
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("productos")
    .insert({
      cantina_id:         session.user.cantinaId,
      nombre:             body.nombre,
      categoria:          body.categoria,
      precio_usd:         body.precioUsd,
      precio_jornada_usd: body.precioJornada ?? null,
      stock:              0,
      stock_min:          body.stockMin,
      activo:             true,
    })
    .select("id, nombre, categoria, precio_usd, precio_jornada_usd, stock, stock_min, activo")
    .single();

  if (error) throw error;
  return NextResponse.json(data, { status: 201 });
});
