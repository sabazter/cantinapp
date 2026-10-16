import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";

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

  // Cuentas con saldo negativo de alumnos activos de la cantina
  const cuentas = await db.cuentaAlumno.findMany({
    where: { saldo: { lt: 0 }, alumno: { cantinaId, activo: true, deletedAt: null } },
    select: { saldo: true, alumno: { select: { id: true, nombre: true, curso: true } } },
  });

  if (cuentas.length === 0) {
    return NextResponse.json({ deudores: [], porRango: [] });
  }

  // Última venta fiada por alumno
  const ultimasVentas = await db.venta.findMany({
    where: { alumnoId: { in: cuentas.map(c => c.alumno.id) }, esFiado: true, deletedAt: null },
    select: { alumnoId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const ultimaPorAlumno: Record<string, Date> = {};
  for (const v of ultimasVentas) {
    if (v.alumnoId && !ultimaPorAlumno[v.alumnoId]) {
      ultimaPorAlumno[v.alumnoId] = v.createdAt;
    }
  }

  const ahora = Date.now();
  const deudores: DeudorRow[] = cuentas
    .map(c => {
      const ultima = ultimaPorAlumno[c.alumno.id] ?? null;
      const dias   = ultima ? Math.floor((ahora - ultima.getTime()) / 86400000) : 999;
      return {
        nombre:           c.alumno.nombre,
        curso:            c.alumno.curso,
        saldo:            +c.saldo.toNumber().toFixed(2),
        ultimaVentaFecha: ultima?.toISOString() ?? null,
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
