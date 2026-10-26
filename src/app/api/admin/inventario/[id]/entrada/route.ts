import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody, safeText } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

const entradaSchema = z.object({
  cantidad: z.number().int().min(1),
  motivo:   safeText(1, 200).optional(),
});

// POST /api/admin/inventario/[id]/entrada
export const POST = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  const supabase = createServerSupabase();

  // Verificar propiedad
  const { data: producto } = await supabase
    .from("productos")
    .select("id, cantina_id, nombre, stock")
    .eq("id", id)
    .single();

  if (!producto || producto.cantina_id !== session.user.cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { cantidad, motivo } = await validateBody(req, entradaSchema);

  const nuevoStock = producto.stock + cantidad;

  await Promise.all([
    supabase.from("productos").update({ stock: nuevoStock }).eq("id", id),
    supabase.from("movimientos_inventario").insert({
      producto_id: id,
      tipo:        "entrada",
      cantidad,
      motivo:      motivo ?? null,
      usuario_id:  session.user.id,
    }),
  ]);

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.INVENTARIO_AJUSTE,
    entidad:   "producto",
    entidadId: id,
    datos:     { tipo: "entrada", cantidad, stockAnterior: producto.stock, stockNuevo: nuevoStock },
  });

  return NextResponse.json({ stock: nuevoStock });
});
