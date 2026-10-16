import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { decrypt } from "@/lib/crypto";

const SELECT_BASE = {
  id: true, nombre: true, curso: true, seccion: true, fiadoHabilitado: true, limiteFiadoUsd: true,
  cuenta: { select: { saldo: true } },
} as const;

// GET /api/admin/alumnos/buscar?q=<nombre o cedula>&id=<alumnoId>
// Usado por el POS para identificar al alumno
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const q  = searchParams.get("q")?.trim() ?? "";
  const id = searchParams.get("id")?.trim();

  // Búsqueda por ID (QR scan)
  if (id) {
    const data = await db.alumno.findFirst({
      where: { id, cantinaId, activo: true, deletedAt: null },
      select: SELECT_BASE,
    });

    if (!data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    return NextResponse.json(legacy([data]));
  }

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Buscar por nombre (ilike)
  const porNombre = await db.alumno.findMany({
    where: { cantinaId, activo: true, deletedAt: null, nombre: { contains: q, mode: "insensitive" } },
    select: SELECT_BASE,
    take: 10,
  });

  // Si q parece una cédula (solo dígitos o con prefijo V/E), buscar por cédula también
  const esCedula = /^[VEve]?[-]?\d{5,}$/.test(q);
  let porCedula: typeof porNombre = [];

  if (esCedula && porNombre.length === 0) {
    // Cargar todos y comparar descifrado (costoso pero alumnos son pocos)
    const todos = await db.alumno.findMany({
      where: { cantinaId, activo: true, deletedAt: null },
      select: { ...SELECT_BASE, cedulaEncriptada: true },
    });

    const qNorm = q.toUpperCase().replace("-", "");
    porCedula = todos
      .filter(a => {
        if (!a.cedulaEncriptada) return false;
        try {
          return decrypt(a.cedulaEncriptada).toUpperCase().replace("-", "").includes(qNorm);
        } catch {
          return false;
        }
      })
      // Quitar cedulaEncriptada del response
      .map(({ cedulaEncriptada: _ced, ...rest }) => rest);
  }

  return NextResponse.json(legacy([...porNombre, ...porCedula]));
});
