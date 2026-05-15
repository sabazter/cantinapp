import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

const ajusteSchema = z.object({
  cantidad: z.number().int(),   // positivo = suma, negativo = resta
  motivo:   z.string().min(1).max(200),
});

// POST /api/admin/inventario/[id]/ajuste
export const POST = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  const supabase = createServerSupabase();

  const { data: producto } = await supabase
    .from("productos")
    .select("id, cantina_id, stock")
    .eq("id", id)
    .single();

  if (!producto || producto.cantina_id !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { cantidad, motivo } = await validateBody(req, ajusteSchema);
  const nuevoStock = Math.max(0, producto.stock + cantidad);

  await Promise.all([
    supabase.from("productos").update({ stock: nuevoStock }).eq("id", id),
    supabase.from("movimientos_inventario").insert({
      producto_id: id,
      tipo:        "ajuste",
      cantidad,
      motivo,
      usuario_id:  session.user.id,
    }),
  ]);

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.INVENTARIO_AJUSTE,
    entidad:   "producto",
    entidadId: id,
    datos:     { tipo: "ajuste", cantidad, motivo, stockAnterior: producto.stock, stockNuevo: nuevoStock },
  });

  return NextResponse.json({ stock: nuevoStock });
});
