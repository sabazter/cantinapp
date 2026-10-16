import { sendEmail } from "./email/resend";
import {
  emailFiadoRegistrado,
  emailAbonoConfirmado,
  emailAbonoRechazado,
  emailStockBajo,
  emailResumenDiario,
  emailCuentaBloqueada,
} from "./email/templates";
import { wsNotificarFiado, wsNotificarAbonoConfirmado } from "./whatsapp";
import { dbSystem } from "./db";

interface RepresentanteInfo {
  id:            string;
  email:         string;
  telefono:      string | null;
  notif_email:   boolean;
  notif_whatsapp: boolean;
}

// Busca datos del representante de un alumno
async function getRepresentante(alumnoId: string): Promise<RepresentanteInfo | null> {
  const data = await dbSystem.alumno.findUnique({
    where: { id: alumnoId },
    select: {
      representante: {
        select: { id: true, email: true, telefono: true, notifEmail: true, notifWhatsapp: true },
      },
    },
  });

  const rep = data?.representante;
  if (!rep) return null;
  return {
    id: rep.id,
    email: rep.email,
    telefono: rep.telefono,
    notif_email: rep.notifEmail,
    notif_whatsapp: rep.notifWhatsapp,
  };
}

// Mantenemos el helper de email solo por compatibilidad con la firma original
async function getRepresentanteEmail(alumnoId: string): Promise<string | null> {
  const rep = await getRepresentante(alumnoId);
  if (!rep?.notif_email) return null;
  return rep.email;
}

// Busca el email del admin de la cantina
async function getAdminEmail(cantinaId: string): Promise<string | null> {
  const data = await dbSystem.usuario.findFirst({
    where: { cantinaId, rol: "admin", activo: true },
    select: { email: true },
  });

  return data?.email ?? null;
}

/**
 * Notificar fiado registrado al representante
 */
export async function notificarFiadoRegistrado(alumnoId: string, alumnoNombre: string) {
  const rep = await getRepresentante(alumnoId);
  if (!rep) return;

  if (rep.notif_email) {
    const tmpl = emailFiadoRegistrado(alumnoNombre);
    await sendEmail({ to: rep.email, ...tmpl });
  }
  if (rep.notif_whatsapp && rep.telefono) {
    await wsNotificarFiado({ representanteId: rep.id, telefono: rep.telefono, alumnoNombre });
  }
}

/**
 * Notificar abono confirmado al representante
 */
export async function notificarAbonoConfirmado(alumnoId: string, alumnoNombre: string) {
  const rep = await getRepresentante(alumnoId);
  if (!rep) return;

  if (rep.notif_email) {
    const tmpl = emailAbonoConfirmado(alumnoNombre);
    await sendEmail({ to: rep.email, ...tmpl });
  }
  if (rep.notif_whatsapp && rep.telefono) {
    await wsNotificarAbonoConfirmado({ representanteId: rep.id, telefono: rep.telefono, alumnoNombre });
  }
}

/**
 * Notificar abono rechazado al representante
 */
export async function notificarAbonoRechazado(alumnoId: string, alumnoNombre: string, motivo: string) {
  const email = await getRepresentanteEmail(alumnoId);
  if (!email) return;

  const tmpl = emailAbonoRechazado(alumnoNombre, motivo);
  await sendEmail({ to: email, ...tmpl });
}

/**
 * Notificar stock bajo al admin
 */
export async function notificarStockBajo(
  cantinaId: string,
  productos: { nombre: string; stock: number; stockMin: number }[]
) {
  if (productos.length === 0) return;
  const email = await getAdminEmail(cantinaId);
  if (!email) return;

  const tmpl = emailStockBajo(productos);
  await sendEmail({ to: email, ...tmpl });
}

/**
 * Resumen diario al admin (llamado por cron o manualmente)
 */
export async function notificarResumenDiario(
  cantinaId: string,
  cantinaName: string,
  fecha: string,
  totales: { count: number; totalUsd: number }
) {
  const email = await getAdminEmail(cantinaId);
  if (!email) return;

  const tmpl = emailResumenDiario(fecha, totales, cantinaName);
  await sendEmail({ to: email, ...tmpl });
}

/**
 * Notificar al admin cuando una cuenta queda bloqueada
 */
export async function notificarCuentaBloqueada(cantinaId: string | null, emailBloqueado: string) {
  if (!cantinaId) return;
  const emailAdmin = await getAdminEmail(cantinaId);
  if (!emailAdmin) return;

  const tmpl = emailCuentaBloqueada(emailAdmin, emailBloqueado);
  await sendEmail(tmpl);
}
