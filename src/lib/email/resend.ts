import { Resend } from "resend";

// Instancia única de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM = process.env.RESEND_FROM ?? "CantinApp <noreply@cantinapp.com>";

interface SendOptions {
  to:      string | string[];
  subject: string;
  html:    string;
  text?:   string;
}

/**
 * Envía un email via Resend. Nunca lanza — loguea el error si falla.
 * No incluir datos sensibles en el cuerpo del email (§9.2).
 */
export async function sendEmail(opts: SendOptions): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY no configurado — email simulado:", opts.subject, "→", opts.to);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text,
    });

    if (error) {
      console.error("[Email] Error Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Error inesperado:", err);
    return false;
  }
}
