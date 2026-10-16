import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  // Representante debe pertenecer a la misma cantina
  const rep = await db.usuario.findFirst({
    where: { id, cantinaId, rol: "representante" },
    select: {
      id: true, nombre: true, email: true, telefono: true, activo: true,
      emailVerificado: true, notasCrm: true, createdAt: true,
    },
  });

  if (!rep) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  // Hijos (alumnos)
  const alumnosArr = await db.alumno.findMany({
    where: { representanteId: id, cantinaId, deletedAt: null },
    select: {
      id: true, nombre: true, curso: true, seccion: true, activo: true, fiadoHabilitado: true,
      cuenta: { select: { id: true, saldo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const cuentaIds = alumnosArr.flatMap(a => (a.cuenta ? [a.cuenta.id] : []));

  // Historial de abonos de todos sus hijos
  const abonosArr = cuentaIds.length > 0
    ? await db.abono.findMany({
        where: { cuentaAlumnoId: { in: cuentaIds } },
        select: { id: true, cuentaAlumnoId: true, montoUsd: true, metodo: true, estado: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const confirmados = abonosArr.filter(a => a.estado === "confirmado");
  const rechazados  = abonosArr.filter(a => a.estado === "rechazado");
  const totalAbonadoUsd = confirmados.reduce((s, a) => s + a.montoUsd.toNumber(), 0);

  // Canal preferido: cuál canal usó más en notificaciones
  const notifs = await db.notificacion.findMany({
    where: { usuarioId: id, estado: "enviado" },
    select: { canal: true },
  });

  const canalCount = { email: 0, whatsapp: 0 };
  for (const n of notifs) {
    if (n.canal === "email") canalCount.email++;
    else canalCount.whatsapp++;
  }
  const canalPreferido = canalCount.whatsapp >= canalCount.email ? "whatsapp" : "email";
  const totalNotificaciones = notifs.length;

  // Calificación de responsabilidad financiera
  const totalAbonos = abonosArr.length;
  const tasaRechazo = totalAbonos > 0 ? rechazados.length / totalAbonos : 0;
  const saldoDe = (a: (typeof alumnosArr)[number]) => a.cuenta?.saldo.toNumber() ?? 0;
  const deudaTotalHijos = alumnosArr.reduce((s, a) => {
    const saldo = saldoDe(a);
    return s + (saldo < 0 ? Math.abs(saldo) : 0);
  }, 0);

  let calificacion: "excelente" | "buena" | "regular" | "baja";
  if (deudaTotalHijos === 0 && tasaRechazo === 0) {
    calificacion = "excelente";
  } else if (deudaTotalHijos < 20 && tasaRechazo < 0.2) {
    calificacion = "buena";
  } else if (deudaTotalHijos < 50 && tasaRechazo < 0.4) {
    calificacion = "regular";
  } else {
    calificacion = "baja";
  }

  // Mapeo cuentaId → nombre de alumno para el historial
  const cuentaToAlumno = new Map<string, string>();
  for (const a of alumnosArr) {
    if (a.cuenta) cuentaToAlumno.set(a.cuenta.id, a.nombre);
  }

  return NextResponse.json({
    representante: {
      id: rep.id,
      nombre: rep.nombre,
      email: rep.email,
      telefono: rep.telefono,
      activo: rep.activo,
      emailVerificado: rep.emailVerificado,
      notasCrm: rep.notasCrm ?? "",
      createdAt: rep.createdAt.toISOString(),
    },
    hijos: alumnosArr.map(a => ({
      id: a.id, nombre: a.nombre, curso: a.curso, seccion: a.seccion,
      activo: a.activo, fiadoHabilitado: a.fiadoHabilitado, saldo: saldoDe(a),
    })),
    abonos: {
      historial: abonosArr.map(a => ({
        id: a.id,
        alumnoNombre: cuentaToAlumno.get(a.cuentaAlumnoId) ?? "—",
        montoUsd: a.montoUsd.toNumber(),
        metodo: a.metodo,
        estado: a.estado,
        createdAt: a.createdAt.toISOString(),
      })),
      totalAbonadoUsd: Math.round(totalAbonadoUsd * 100) / 100,
      totalConfirmados: confirmados.length,
      totalRechazados: rechazados.length,
    },
    comunicacion: {
      canalPreferido,
      totalNotificaciones,
      emailCount: canalCount.email,
      whatsappCount: canalCount.whatsapp,
    },
    financiero: {
      deudaTotalHijos: Math.round(deudaTotalHijos * 100) / 100,
      calificacion,
    },
  });
});
