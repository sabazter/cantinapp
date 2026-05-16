import twilio from "twilio";
import { createServerSupabase } from "./supabase-server";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

// Rate limiting: máx. 10 mensajes/día por usuario, cooldown 1h por tipo (§9.3)
const MAX_POR_DIA = 10;
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

// Tipos que coinciden con el enum TipoNotificacion del schema
type TipoNotif = "fiado_registrado" | "abono_confirmado" | "deuda_alta";

interface EnviarOptions {
  usuarioId:  string;
  telefono:   string;
  tipo:       TipoNotif;
  mensaje:    string;
}

/**
 * Envía un mensaje de WhatsApp. Respeta rate limits y registra en notificaciones.
 * No lanza — loguea errores sin interrumpir el flujo. (§9.3)
 */
export async function sendWhatsApp(opts: EnviarOptions): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[WhatsApp] Twilio no configurado — simulado: ${opts.tipo} → ${opts.telefono}`);
    return;
  }

  const supabase = createServerSupabase();
  const hoy      = new Date().toISOString().slice(0, 10);

  // Verificar rate limit diario (§9.3)
  const { count: mensajesHoy } = await supabase
    .from("notificaciones")
    .select("*", { count: "exact", head: true })
    .eq("usuario_id", opts.usuarioId)
    .eq("canal", "whatsapp")
    .gte("created_at", `${hoy}T00:00:00`);

  if ((mensajesHoy ?? 0) >= MAX_POR_DIA) {
    console.log(`[WhatsApp] Rate limit diario alcanzado para ${opts.usuarioId}`);
    return;
  }

  // Verificar cooldown por tipo (§9.3)
  const desde = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { count: reciente } = await supabase
    .from("notificaciones")
    .select("*", { count: "exact", head: true })
    .eq("usuario_id", opts.usuarioId)
    .eq("tipo", opts.tipo)
    .eq("canal", "whatsapp")
    .gte("created_at", desde);

  if ((reciente ?? 0) > 0) {
    console.log(`[WhatsApp] Cooldown activo para ${opts.usuarioId}/${opts.tipo}`);
    return;
  }

  // Registrar intento (estado: pendiente)
  const { data: notif } = await supabase
    .from("notificaciones")
    .insert({
      usuario_id: opts.usuarioId,
      tipo:       opts.tipo,
      canal:      "whatsapp",
      estado:     "pendiente",
    })
    .select("id")
    .single();

  try {
    const to = opts.telefono.startsWith("whatsapp:") ? opts.telefono : `whatsapp:${opts.telefono}`;

    await client.messages.create({ from: FROM, to, body: opts.mensaje });

    if (notif) {
      await supabase.from("notificaciones").update({
        estado:     "enviado",
        enviado_at: new Date().toISOString(),
      }).eq("id", notif.id);
    }
  } catch (err) {
    console.error("[WhatsApp] Error Twilio:", err);

    if (notif) {
      await supabase.from("notificaciones").update({ estado: "error" }).eq("id", notif.id);
    }

    // Si 3+ mensajes fallidos: alertar al admin (§9.3)
    const { count: errores } = await supabase
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", opts.usuarioId)
      .eq("canal", "whatsapp")
      .eq("estado", "error");

    if ((errores ?? 0) >= 3) {
      console.error(`[WhatsApp] ${errores} fallos para usuario ${opts.usuarioId} — posible teléfono inválido`);
    }
  }
}

// ── Helpers por evento (sin datos financieros en el cuerpo — §9.1) ─────────────

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://cantinapp.com";

interface BaseOpts { representanteId: string; telefono: string; alumnoNombre: string }

export async function wsNotificarFiado(opts: BaseOpts) {
  await sendWhatsApp({
    usuarioId: opts.representanteId,
    telefono:  opts.telefono,
    tipo:      "fiado_registrado",
    mensaje:   `CantinApp: Se registró una compra a crédito para ${opts.alumnoNombre}. Ver saldo: ${BASE_URL}/portal`,
  });
}

export async function wsNotificarAbonoConfirmado(opts: BaseOpts) {
  await sendWhatsApp({
    usuarioId: opts.representanteId,
    telefono:  opts.telefono,
    tipo:      "abono_confirmado",
    mensaje:   `CantinApp: El pago para ${opts.alumnoNombre} fue confirmado. Ver saldo: ${BASE_URL}/portal`,
  });
}

export async function wsNotificarDeudaAlta(opts: BaseOpts) {
  await sendWhatsApp({
    usuarioId: opts.representanteId,
    telefono:  opts.telefono,
    tipo:      "deuda_alta",
    mensaje:   `CantinApp: La deuda de ${opts.alumnoNombre} supera el umbral permitido. Ingresa al portal: ${BASE_URL}/portal`,
  });
}
