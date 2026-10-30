import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/alumno — portal exclusivo del estudiante
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "alumno");

  const supabase = createServerSupabase();
  const userId = session.user.id;

  // Buscar el registro de alumno asociado al usuario
  let { data: alumno } = await supabase
    .from("alumnos")
    .select(`
      id, nombre, curso, seccion, qr_code, fiado_habilitado, limite_fiado_usd,
      cuentas_alumnos (
        saldo
      ),
      representante:usuarios!alumnos_representante_id_fkey (
        nombre,
        telefono
      )
    `)
    .eq("usuario_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  // Si no tiene usuario_id directo, intentar por email o id
  if (!alumno) {
    const { data: porId } = await supabase
      .from("alumnos")
      .select(`
        id, nombre, curso, seccion, qr_code, fiado_habilitado, limite_fiado_usd,
        cuentas_alumnos (
          saldo
        ),
        representante:usuarios!alumnos_representante_id_fkey (
          nombre,
          telefono
        )
      `)
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    alumno = porId;
  }

  if (!alumno) {
    return NextResponse.json({ error: "Perfil de alumno no encontrado" }, { status: 404 });
  }

  // Cargar sus compras detalladas con productos y vendedor
  const { data: ventas } = await supabase
    .from("ventas")
    .select(`
      id, total_usd, total_bs, tasa_bcv, metodo_pago, es_fiado, created_at,
      vendedor:usuarios!ventas_vendedor_id_fkey (
        nombre
      ),
      detalle_ventas (
        id,
        cantidad,
        precio_usd_unitario,
        productos (
          nombre
        )
      )
    `)
    .eq("alumno_id", alumno.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);

  const cuenta = Array.isArray(alumno.cuentas_alumnos)
    ? alumno.cuentas_alumnos[0]
    : alumno.cuentas_alumnos;

  const rep = Array.isArray(alumno.representante)
    ? alumno.representante[0]
    : alumno.representante;

  return NextResponse.json({
    alumno: {
      id:       alumno.id,
      nombre:   alumno.nombre,
      curso:    alumno.curso,
      seccion:  alumno.seccion,
      saldo:    Number(cuenta?.saldo ?? 0),
      telefono: rep?.telefono ?? session.user.email,
    },
    ventas: ventas ?? [],
  });
});
