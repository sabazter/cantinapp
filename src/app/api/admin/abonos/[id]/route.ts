import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { audit, AuditEvent } from "@/lib/audit";
import { notificarAbonoConfirmado, notificarAbonoRechazado } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const confirmarSchema = z.object({ accion: z.literal("confirmar") });
const rechazarSchema  = z.object({ accion: z.literal("rechazar"), motivo: z.string().min(3).max(300) });
const accionSchema    = z.discriminatedUnion("accion", [confirmarSchema, rechazarSchema]);

// POST /api/admin/abonos/[id] — confirmar o rechazar
export const POST = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const body = await validateBody(req, accionSchema);

  // Verificar propiedad del abono
  const abono = await db.abono.findFirst({
    where: { id, deletedAt: null, cuentaAlumno: { alumno: { cantinaId } } },
    select: {
      estado: true, montoUsd: true,
      cuentaAlumno: { select: { id: true, alumnoId: true, alumno: { select: { nombre: true } } } },
    },
  });

  if (!abono) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (abono.estado !== "pendiente") {
    return NextResponse.json({ error: "El abono ya fue procesado" }, { status: 400 });
  }

  const { id: cuentaId, alumnoId, alumno } = abono.cuentaAlumno;
  const ahora = new Date();

  if (body.accion === "confirmar") {
    // Transición condicional (solo si sigue pendiente): evita doble acreditación en confirmaciones simultáneas
    const res = await db.abono.updateMany({
      where: { id, estado: "pendiente" },
      data: { estado: "confirmado", confirmadoPor: session.user.id, confirmadoAt: ahora },
    });
    if (res.count !== 1) {
      return NextResponse.json({ error: "El abono ya fue procesado" }, { status: 400 });
    }

    // Sumar al saldo de la cuenta (incremento atómico)
    await db.cuentaAlumno.update({
      where: { id: cuentaId },
      data: { saldo: { increment: abono.montoUsd } },
    });

    await audit({
      usuarioId: session.user.id,
      cantinaId,
      evento:    AuditEvent.ABONO_CONFIRMADO,
      entidad:   "abonos",
      entidadId: id,
      datos:     { montoUsd: abono.montoUsd.toNumber(), alumnoId },
    });

    // Notificar al representante (fire-and-forget, no bloquear la respuesta)
    notificarAbonoConfirmado(alumnoId, alumno.nombre).catch(() => {});
  } else {
    const res = await db.abono.updateMany({
      where: { id, estado: "pendiente" },
      data: { estado: "rechazado", motivoRechazo: body.motivo, confirmadoPor: session.user.id, confirmadoAt: ahora },
    });
    if (res.count !== 1) {
      return NextResponse.json({ error: "El abono ya fue procesado" }, { status: 400 });
    }

    await audit({
      usuarioId: session.user.id,
      cantinaId,
      evento:    AuditEvent.ABONO_RECHAZADO,
      entidad:   "abonos",
      entidadId: id,
      datos:     { motivo: body.motivo },
    });

    // Notificar rechazo al representante (fire-and-forget)
    notificarAbonoRechazado(alumnoId, alumno.nombre, body.motivo).catch(() => {});
  }

  return NextResponse.json({ ok: true });
});
