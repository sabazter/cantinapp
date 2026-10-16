import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";

const editarSchema = z.object({
  nombre:        z.string().min(1).max(120).optional(),
  categoria:     z.enum(["tienda", "menu"]).optional(),
  precioUsd:     z.number().positive().multipleOf(0.0001).optional(),
  precioJornada: z.number().positive().multipleOf(0.0001).nullable().optional(),
  stockMin:      z.number().int().min(0).optional(),
  activo:        z.boolean().optional(),
});

async function getProductoPropio(id: string, cantinaId: string) {
  const data = await db.producto.findUnique({ where: { id }, select: { id: true, cantinaId: true } });
  if (!data || data.cantinaId !== cantinaId) return null;
  return data;
}

export const PUT = withAuth(async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  if (!(await getProductoPropio(id, session.user.cantinaId!))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await validateBody(req, editarSchema);

  const data = await db.producto.update({
    where: { id },
    data: {
      ...(body.nombre    !== undefined && { nombre: body.nombre }),
      ...(body.categoria !== undefined && { categoria: body.categoria }),
      ...(body.precioUsd !== undefined && { precioUsd: body.precioUsd }),
      ...("precioJornada" in body       && { precioJornadaUsd: body.precioJornada ?? null }),
      ...(body.stockMin  !== undefined && { stockMin: body.stockMin }),
      ...(body.activo    !== undefined && { activo: body.activo }),
    },
    select: {
      id: true, nombre: true, categoria: true, precioUsd: true, precioJornadaUsd: true,
      stock: true, stockMin: true, activo: true,
    },
  });

  return NextResponse.json(legacy(data));
});

export const DELETE = withAuth(async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;

  if (!(await getProductoPropio(id, session.user.cantinaId!))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  await db.producto.update({ where: { id }, data: { activo: false } });
  return new NextResponse(null, { status: 204 });
});
