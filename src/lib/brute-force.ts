import { createServerSupabase } from "@/lib/supabase-server";
import { notificarCuentaBloqueada } from "@/lib/notifications";

const INTENTOS_BLOQUEO_TEMPORAL = 5;
const INTENTOS_BLOQUEO_PERMANENTE = 20;
const VENTANA_MINUTOS = 15;

interface EstadoBloqueo {
  bloqueado: boolean;
  permanente: boolean;
  intentosRestantes: number;
  minutosParaDesbloqueo?: number;
}

export async function verificarBloqueo(email: string): Promise<EstadoBloqueo> {
  const supabase = createServerSupabase();
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000).toISOString();

  const [{ count: intentosRecientes }, { count: totalFallidos }] = await Promise.all([
    supabase
      .from("login_intentos")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("exitoso", false)
      .gte("created_at", desde),
    supabase
      .from("login_intentos")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("exitoso", false),
  ]);

  const recientes = intentosRecientes ?? 0;
  const total = totalFallidos ?? 0;

  if (total >= INTENTOS_BLOQUEO_PERMANENTE) {
    return { bloqueado: true, permanente: true, intentosRestantes: 0 };
  }

  // Notificar al admin cuando se alcanza el bloqueo temporal (primer disparo)
  if (recientes === INTENTOS_BLOQUEO_TEMPORAL) {
    const supabase2 = createServerSupabase();
    const { data: usuario } = await supabase2
      .from("usuarios")
      .select("cantina_id")
      .eq("email", email)
      .single();
    notificarCuentaBloqueada(usuario?.cantina_id ?? null, email).catch(() => {});
  }

  if (recientes >= INTENTOS_BLOQUEO_TEMPORAL) {
    const { data: ultimoIntento } = await supabase
      .from("login_intentos")
      .select("created_at")
      .eq("email", email)
      .eq("exitoso", false)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const minutosParaDesbloqueo = ultimoIntento
      ? Math.ceil(
          (VENTANA_MINUTOS * 60 * 1000 -
            (Date.now() - new Date(ultimoIntento.created_at).getTime())) /
            60000
        )
      : VENTANA_MINUTOS;

    return {
      bloqueado: true,
      permanente: false,
      intentosRestantes: 0,
      minutosParaDesbloqueo,
    };
  }

  return {
    bloqueado: false,
    permanente: false,
    intentosRestantes: INTENTOS_BLOQUEO_TEMPORAL - recientes,
  };
}

export async function registrarIntento(
  email: string,
  ip: string,
  exitoso: boolean
): Promise<void> {
  const supabase = createServerSupabase();
  await supabase.from("login_intentos").insert({ email, ip, exitoso });
}
