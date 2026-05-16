import { NextResponse } from "next/server";
import { withAuth, requireRole } from "@/lib/require-role";
import { db } from "@/lib/db";

export const GET = withAuth(async (_req, session) => {
  requireRole(session, "superadmin");

  const [
    totalCantinas,
    totalAlumnos,
    totalUsuarios,
    totalVentas,
    cantinasConDetalle,
  ] = await Promise.all([
    db.cantina.count(),
    db.alumno.count({ where: { activo: true } }),
    db.usuario.count({ where: { activo: true, rol: { not: "superadmin" } } }),
    db.venta.count({ where: { deletedAt: null } }),
    db.cantina.findMany({
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
    }),
  ]);

  return NextResponse.json({
    totalCantinas,
    totalAlumnos,
    totalUsuarios,
    totalVentas,
    cantinas: cantinasConDetalle,
  });
});
