import { NextRequest, NextResponse } from "next/server";
import { withAuth, requireRole } from "@/lib/require-role";
import { db } from "@/lib/db";

export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "superadmin");

  const { searchParams } = new URL(req.url);
  const cantinaId = searchParams.get("cantinaId");
  const rol       = searchParams.get("rol");
  const q         = searchParams.get("q");

  const usuarios = await db.usuario.findMany({
    where: {
      ...(cantinaId ? { cantinaId } : {}),
      ...(rol ? { rol: rol as never } : { rol: { not: "superadmin" } }),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" } },
              { email:  { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id:           true,
      nombre:       true,
      email:        true,
      rol:          true,
      activo:       true,
      mfaHabilitado: true,
      createdAt:    true,
      cantina: {
        select: { id: true, nombre: true, escuela: true },
      },
    },
    take: 200,
  });

  return NextResponse.json(usuarios);
});
