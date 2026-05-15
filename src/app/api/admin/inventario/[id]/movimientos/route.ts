import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/admin/inventario/[id]/movimientos
export const GET = withAuth(async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  const supabase = createServerSupabase();

  // Verificar propiedad a través del producto
  const { data: producto } = await supabase
    .from("productos")
    .select("cantina_id")
    .eq("id", id)
    .single();

  if (!producto || producto.cantina_id !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("movimientos_inventario")
    .select("id, tipo, cantidad, motivo, usuario_id, created_at")
    .eq("producto_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return NextResponse.json(data);
});
