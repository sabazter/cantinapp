import { NextRequest, NextResponse } from "next/server";
import { withAuth, requireRole } from "@/lib/require-role";
import { db } from "@/lib/db";

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "superadmin");

  // Consultas en serie: comparten la conexión de la transacción del request
  const totalCantinas = await db.cantina.count();
  const totalAlumnos = await db.alumno.count({ where: { activo: true } });
  const totalUsuarios = await db.usuario.count({ where: { activo: true, rol: { not: "superadmin" } } });
  const totalVentas = await db.venta.count({ where: { deletedAt: null } });
  const cantinasConDetalle = await db.cantina.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id:       true,
      nombre:   true,
      escuela:  true,
      createdAt: true,
      _count: {
        select: {
          alumnos:  { where: { activo: true } },
          usuarios: { where: { activo: true } },
          ventas:   { where: { deletedAt: null } },
        },
      },
    },
  });

  return NextResponse.json({
    totalCantinas,
    totalAlumnos,
    totalUsuarios,
    totalVentas,
    cantinas: cantinasConDetalle,
  });
});
