import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

interface DeudorRow {
  nombre: string;
  curso: string;
  saldo: number;
  ultimaVentaFecha: string | null;
  diasDeuda: number;
}

// GET /api/admin/reportes/deudas
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const supabase  = createServerSupabase();

  // Traer cuentas con saldo negativo
  const { data: cuentas, error: cErr } = await supabase
    .from("cuentas_alumnos")
    .select(`
      saldo,
      alumnos!cuentas_alumnos_alumno_id_fkey ( id, nombre, curso, activo, deleted_at, cantina_id )
    `)
    .lt("saldo", 0);

  if (cErr) throw cErr;

  // Filtrar por cantina y alumno activo
  const alumnoIds = (cuentas ?? [])
    .filter(c => {
      const a = c.alumnos as unknown as { cantina_id: string; activo: boolean; deleted_at: string | null } | null;
      return a && a.cantina_id === cantinaId && a.activo && !a.deleted_at;
    })
    .map(c => (c.alumnos as unknown as { id: string }).id);

  if (alumnoIds.length === 0) {
    return NextResponse.json({ deudores: [], porRango: [] });
  }

  // Última venta fiada por alumno
  const { data: ultimasVentas } = await supabase
    .from("ventas")
    .select("alumno_id, created_at")
    .in("alumno_id", alumnoIds)
    .eq("es_fiado", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const ultimaPorAlumno: Record<string, string> = {};
  for (const v of ultimasVentas ?? []) {
    if (v.alumno_id && !ultimaPorAlumno[v.alumno_id]) {
      ultimaPorAlumno[v.alumno_id] = v.created_at as string;
    }
  }

  const ahora = Date.now();
  const deudores: DeudorRow[] = (cuentas ?? [])
    .filter(c => {
      const a = c.alumnos as unknown as { cantina_id: string; activo: boolean; deleted_at: string | null } | null;
      return a && a.cantina_id === cantinaId && a.activo && !a.deleted_at;
    })
    .map(c => {
      const a = c.alumnos as unknown as { id: string; nombre: string; curso: string };
      const ultima = ultimaPorAlumno[a.id] ?? null;
      const dias   = ultima
        ? Math.floor((ahora - new Date(ultima).getTime()) / 86400000)
        : 999;
      return {
        nombre:           a.nombre,
        curso:            a.curso,
        saldo:            +Number(c.saldo).toFixed(2),
        ultimaVentaFecha: ultima,
        diasDeuda:        dias,
      };
    })
    .sort((a, b) => a.saldo - b.saldo);  // más negativo primero

  // Agrupar por rango de antigüedad
  const rangos = [
    { label: "0–7 días",   min: 0,   max: 7   },
    { label: "8–30 días",  min: 8,   max: 30  },
    { label: "31–90 días", min: 31,  max: 90  },
    { label: "+90 días",   min: 91,  max: Infinity },
  ];
  const porRango = rangos.map(r => {
    const grupo = deudores.filter(d => d.diasDeuda >= r.min && d.diasDeuda <= r.max);
    return {
      rango:    r.label,
      count:    grupo.length,
      totalUsd: +grupo.reduce((s, d) => s + Math.abs(d.saldo), 0).toFixed(2),
    };
  });

  return NextResponse.json({ deudores, porRango });
});
