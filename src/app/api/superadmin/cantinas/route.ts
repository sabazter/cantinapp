import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/require-role";
import { requireRole } from "@/lib/require-role";
import { db } from "@/lib/db";
import { z } from "zod";
import { audit } from "@/lib/audit";

const crearSchema = z.object({
  nombre:       z.string().min(2).max(100),
  escuela:      z.string().min(2).max(150),
  direccion:    z.string().max(200).optional(),
  notifEmail:   z.boolean().optional(),
  notifWhatsapp: z.boolean().optional(),
});

export const GET = withAuth(async (_req, session) => {
  requireRole(session, "superadmin");

  const cantinas = await db.cantina.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nombre: true,
      escuela: true,
      direccion: true,
      notifEmail: true,
      notifWhatsapp: true,
      createdAt: true,
      _count: {
        select: {
          usuarios: { where: { activo: true } },
          alumnos:  { where: { activo: true } },
        },
      },
    },
  });

  return NextResponse.json(cantinas);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "superadmin");

  const body = await req.json();
  const parsed = crearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input inválido", issues: parsed.error.issues }, { status: 400 });
  }

  const cantina = await db.cantina.create({
    data: {
      nombre:        parsed.data.nombre,
      escuela:       parsed.data.escuela,
      direccion:     parsed.data.direccion,
      notifEmail:    parsed.data.notifEmail  ?? true,
      notifWhatsapp: parsed.data.notifWhatsapp ?? true,
    },
  });

  await audit({
    evento:    "cantina_creada",
    usuarioId: session.user.id,
    cantinaId: cantina.id,
    entidad:   "cantina",
    entidadId: cantina.id,
    datos:     { nombre: cantina.nombre, escuela: cantina.escuela },
  });

  return NextResponse.json(cantina, { status: 201 });
});
