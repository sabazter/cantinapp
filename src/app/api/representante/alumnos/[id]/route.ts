import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// Verifica que el alumno pertenece al representante autenticado (§3.4)
async function verificarHijo(representanteId: string, alumnoId: string) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("alumnos")
    .select("id, representante_id")
    .eq("id", alumnoId)
    .is("deleted_at", null)
    .single();

  if (!data || data.representante_id !== representanteId) return null;
  return data;
}

// GET /api/representante/alumnos/[id] — detalle + historial detallado de compras
export const GET = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "representante");
  const { id } = await params;

  const hijo = await verificarHijo(session.user.id, id);
  if (!hijo) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const pagina = parseInt(searchParams.get("pagina") ?? "1");
  const porPagina = 25;
  const offset = (pagina - 1) * porPagina;

  const [alumnoRes, ventasRes] = await Promise.all([
    supabase
      .from("alumnos")
      .select("id, nombre, curso, seccion, activo, cantina_id, qr_code, fiado_habilitado, limite_fiado_usd, cuentas_alumnos(saldo)")
      .eq("id", id)
      .single(),

    supabase
      .from("ventas")
      .select(`
        id, total_usd, total_bs, tasa_bcv, metodo_pago, es_fiado, created_at,
        vendedor:usuarios!ventas_vendedor_id_fkey (
          id,
          nombre
        ),
        detalle_ventas (
          id,
          cantidad,
          precio_usd_unitario,
          productos (
            id,
            nombre
          )
        )
      `)
      .eq("alumno_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + porPagina - 1),
  ]);

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    AuditEvent.ALUMNO_CONSULTADO,
    entidad:   "alumnos",
    entidadId: id,
    datos:     { accion: "portal_representante_detalle" },
  });

  return NextResponse.json({
    alumno: alumnoRes.data,
    ventas: ventasRes.data ?? [],
    pagina,
    porPagina,
  });
});
