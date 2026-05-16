import { NextRequest, NextResponse } from "next/server";
import { withAuth, requireRole } from "@/lib/require-role";
import { db } from "@/lib/db";
import { z } from "zod";
import { audit } from "@/lib/audit";

const editarSchema = z.object({
  nombre:        z.string().min(2).max(100).optional(),
  escuela:       z.string().min(2).max(150).optional(),
  direccion:     z.string().max(200).optional(),
  notifEmail:    z.boolean().optional(),
  notifWhatsapp: z.boolean().optional(),
  limiteFiadoUsd: z.number().positive().optional().nullable(),
  umbralDeudaUsd: z.number().positive().optional(),
});

export const PATCH = withAuth(async (req: NextRequest, session, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(session, "superadmin");

  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = editarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input inválido", issues: parsed.error.issues }, { status: 400 });
  }

  const cantina = await db.cantina.findUnique({ where: { id } });
  if (!cantina) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const updated = await db.cantina.update({
    where: { id },
    data:  parsed.data,
  });

  await audit({
    evento:    "cantina_editada",
    usuarioId: session.user.id,
    cantinaId: id,
    entidad:   "cantina",
    entidadId: id,
    datos:     { cambios: JSON.stringify(parsed.data) },
  });

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (_req, session, ctx: { params: Promise<{ id: string }> }) => {
  requireRole(session, "superadmin");

  const { id } = await ctx.params;

  const cantina = await db.cantina.findUnique({
    where: { id },
    include: {
      _count: { select: { alumnos: true, ventas: true } },
    },
  });
  if (!cantina) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (cantina._count.alumnos > 0 || cantina._count.ventas > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar una cantina con alumnos o ventas registradas" },
      { status: 409 }
    );
  }

  await db.cantina.delete({ where: { id } });

  await audit({
    evento:    "cantina_eliminada",
    usuarioId: session.user.id,
    entidad:   "cantina",
    entidadId: id,
    datos:     { nombre: cantina.nombre },
  });

  return new NextResponse(null, { status: 204 });
});
