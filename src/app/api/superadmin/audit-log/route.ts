import { NextRequest, NextResponse } from "next/server";
import { withAuth, requireRole } from "@/lib/require-role";
import { db } from "@/lib/db";

export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "superadmin");

  const { searchParams } = new URL(req.url);
  const cantinaId = searchParams.get("cantinaId");
  const evento    = searchParams.get("evento");
  const page      = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit     = 50;

  const [total, logs] = await Promise.all([
    db.auditLog.count({
      where: {
        ...(cantinaId ? { cantinaId } : {}),
        ...(evento    ? { evento: { contains: evento, mode: "insensitive" } } : {}),
      },
    }),
    db.auditLog.findMany({
      where: {
        ...(cantinaId ? { cantinaId } : {}),
        ...(evento    ? { evento: { contains: evento, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
      select: {
        id:        true,
        evento:    true,
        entidad:   true,
        entidadId: true,
        ip:        true,
        createdAt: true,
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
        cantinaId: true,
      },
    }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
});
