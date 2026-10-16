import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";

const productoSchema = z.object({
  nombre:         z.string().min(1).max(120),
  categoria:      z.enum(["tienda", "menu"]),
  precioUsd:      z.number().positive().multipleOf(0.0001),
  stockMin:       z.number().int().min(0).default(5),
  precioJornada:  z.number().positive().multipleOf(0.0001).nullable().optional(),
});

const SELECT_PRODUCTO = {
  id: true, nombre: true, categoria: true, precioUsd: true, precioJornadaUsd: true,
  stock: true, stockMin: true, activo: true,
} as const;

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin", "vendedor");

  const data = await db.producto.findMany({
    where: { cantinaId: session.user.cantinaId! },
    select: { ...SELECT_PRODUCTO, createdAt: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(legacy(data));
});

export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const body = await validateBody(req, productoSchema);

  const data = await db.producto.create({
    data: {
      cantinaId:        session.user.cantinaId!,
      nombre:           body.nombre,
      categoria:        body.categoria,
      precioUsd:        body.precioUsd,
      precioJornadaUsd: body.precioJornada ?? null,
      stock:            0,
      stockMin:         body.stockMin,
      activo:           true,
    },
    select: SELECT_PRODUCTO,
  });

  return NextResponse.json(legacy(data), { status: 201 });
});
