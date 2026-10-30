import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";
import { tasaActivaBcv } from "@/lib/bcv";

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const supabase  = createServerSupabase();
  const hoy       = new Date().toISOString().slice(0, 10);

  const [
    { data: ventasHoyData },
    { count: alumnosActivos },
    { data: abonosPendientesData },
    { data: deudoresData },
    tasaInfo,
  ] = await Promise.all([
    supabase
      .from("ventas")
      .select("total_usd, metodo_pago")
      .eq("cantina_id", cantinaId)
      .is("deleted_at", null)
      .gte("created_at", `${hoy}T00:00:00`)
      .lte("created_at", `${hoy}T23:59:59`),

    supabase
      .from("alumnos")
      .select("*", { count: "exact", head: true })
      .eq("cantina_id", cantinaId)
      .eq("activo", true)
      .is("deleted_at", null),

    supabase
      .from("abonos")
      .select("monto_usd")
      .eq("cantina_id", cantinaId)
      .eq("estado", "pendiente")
      .is("deleted_at", null),

    supabase
      .from("cuentas_alumnos")
      .select(`
        saldo,
        alumno:alumnos!inner (
          id,
          nombre,
          curso,
          seccion,
          cantina_id,
          activo,
          deleted_at,
          fiado_habilitado,
          limite_fiado_usd,
          representante:usuarios!alumnos_representante_id_fkey (
            nombre,
            telefono
          )
        )
      `)
      .eq("alumno.cantina_id", cantinaId)
      .eq("alumno.activo", true)
      .is("alumno.deleted_at", null)
      .lt("saldo", 0)
      .order("saldo", { ascending: true })
      .limit(10),

    tasaActivaBcv(cantinaId),
  ]);

  const tasaBcv = tasaInfo?.tasa ?? 1;

  // Ventas de hoy ($ por cobrar)
  const ventasHoy    = ventasHoyData ?? [];
  const ventasHoyUsd = ventasHoy.reduce((s, v) => s + Number(v.total_usd), 0);

  // Abonos pendientes por verificar
  const abonosPendientes    = abonosPendientesData ?? [];
  const abonosPendientesUsd = abonosPendientes.reduce((s, a) => s + Number(a.monto_usd), 0);

  // Mapear Top 10 Clientes que más deben
  const topDeudores = (deudoresData ?? []).map((row: any) => {
    const al = Array.isArray(row.alumno) ? row.alumno[0] : row.alumno;
    const rep = Array.isArray(al?.representante) ? al.representante[0] : al?.representante;
    const deudaUsd = Math.abs(Number(row.saldo));
    const deudaBs  = deudaUsd * tasaBcv;

    return {
      alumnoId:            al?.id ?? "",
      nombre:              al?.nombre ?? "Sin nombre",
      curso:               al?.curso ?? "",
      seccion:             al?.seccion ?? "",
      deudaUsd:            +deudaUsd.toFixed(2),
      deudaBs:             +deudaBs.toFixed(2),
      representanteNombre: rep?.nombre ?? "Sin representante",
      representanteTel:    rep?.telefono ?? null,
      limiteFiadoUsd:      al?.limite_fiado_usd ? Number(al.limite_fiado_usd) : null,
      fiadoHabilitado:     Boolean(al?.fiado_habilitado),
    };
  });

  // Total deuda de los top o general
  const totalDeudaUsd = topDeudores.reduce((sum, d) => sum + d.deudaUsd, 0);

  return NextResponse.json({
    ventasHoy: {
      count:    ventasHoy.length,
      totalUsd: +ventasHoyUsd.toFixed(2),
    },
    abonosPendientes: {
      count:    abonosPendientes.length,
      totalUsd: +abonosPendientesUsd.toFixed(2),
    },
    alumnosActivos: alumnosActivos ?? 0,
    totalDeudaUsd:  +totalDeudaUsd.toFixed(2),
    tasaBcv,
    topDeudores,
  });
});
