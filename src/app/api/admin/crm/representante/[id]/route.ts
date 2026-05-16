import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;
  const supabase = createServerSupabase();

  // Representante debe pertenecer a la misma cantina
  const { data: rep } = await supabase
    .from("usuarios")
    .select("id, nombre, email, telefono, activo, email_verificado, notas_crm, created_at")
    .eq("id", id)
    .eq("cantina_id", cantinaId)
    .eq("rol", "representante")
    .single();

  if (!rep) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  // Hijos (alumnos)
  const { data: alumnos } = await supabase
    .from("alumnos")
    .select("id, nombre, curso, seccion, activo, fiado_habilitado, cuentas_alumnos(saldo)")
    .eq("representante_id", id)
    .eq("cantina_id", cantinaId)
    .is("deleted_at", null)
    .order("nombre");

  const alumnosArr = alumnos ?? [];
  const cuentaIds: string[] = [];
  for (const a of alumnosArr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = a.cuentas_alumnos as any;
    const cid = Array.isArray(c) ? c[0]?.id : c?.id;
    if (cid) cuentaIds.push(cid);
  }

  // Historial de abonos de todos sus hijos
  const { data: abonos } = cuentaIds.length > 0
    ? await supabase
        .from("abonos")
        .select("id, cuenta_alumno_id, monto_usd, metodo, estado, created_at")
        .in("cuenta_alumno_id", cuentaIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const abonosArr = abonos ?? [];
  const confirmados = abonosArr.filter(a => a.estado === "confirmado");
  const rechazados  = abonosArr.filter(a => a.estado === "rechazado");
  const totalAbonadoUsd = confirmados.reduce((s, a) => s + Number(a.monto_usd), 0);

  // Canal preferido: cuál canal usó más en notificaciones
  const { data: notifs } = await supabase
    .from("notificaciones")
    .select("canal, estado")
    .eq("usuario_id", id)
    .eq("estado", "enviado");

  const canalCount = { email: 0, whatsapp: 0 };
  for (const n of notifs ?? []) {
    if (n.canal === "email") canalCount.email++;
    else canalCount.whatsapp++;
  }
  const canalPreferido = canalCount.whatsapp >= canalCount.email ? "whatsapp" : "email";
  const totalNotificaciones = (notifs ?? []).length;

  // Calificación de responsabilidad financiera
  const totalAbonos = abonosArr.length;
  const tasaRechazo = totalAbonos > 0 ? rechazados.length / totalAbonos : 0;
  const deudaTotalHijos = alumnosArr.reduce((s, a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = a.cuentas_alumnos as any;
    const saldo = Number(Array.isArray(c) ? c[0]?.saldo ?? 0 : c?.saldo ?? 0);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = a.cuentas_alumnos as any;
    const cid = Array.isArray(c) ? c[0]?.id : c?.id;
    if (cid) cuentaToAlumno.set(cid, a.nombre);
  }

  return NextResponse.json({
    representante: {
      id: rep.id,
      nombre: rep.nombre,
      email: rep.email,
      telefono: rep.telefono,
      activo: rep.activo,
      emailVerificado: rep.email_verificado,
      notasCrm: rep.notas_crm ?? "",
      createdAt: rep.created_at,
    },
    hijos: alumnosArr.map(a => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = a.cuentas_alumnos as any;
      const saldo = Number(Array.isArray(c) ? c[0]?.saldo ?? 0 : c?.saldo ?? 0);
      return {
        id: a.id, nombre: a.nombre, curso: a.curso, seccion: a.seccion,
        activo: a.activo, fiadoHabilitado: a.fiado_habilitado, saldo,
      };
    }),
    abonos: {
      historial: abonosArr.map(a => ({
        id: a.id,
        alumnoNombre: cuentaToAlumno.get(a.cuenta_alumno_id) ?? "—",
        montoUsd: Number(a.monto_usd),
        metodo: a.metodo,
        estado: a.estado,
        createdAt: a.created_at,
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
