import { db } from "@/lib/db";

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
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000);

  const [intentosRecientes, totalFallidos] = await Promise.all([
    db.loginIntento.count({
      where: { email, exitoso: false, createdAt: { gte: desde } },
    }),
    db.loginIntento.count({
      where: { email, exitoso: false },
    }),
  ]);

  if (totalFallidos >= INTENTOS_BLOQUEO_PERMANENTE) {
    return { bloqueado: true, permanente: true, intentosRestantes: 0 };
  }

  if (intentosRecientes >= INTENTOS_BLOQUEO_TEMPORAL) {
    const ultimoIntento = await db.loginIntento.findFirst({
      where: { email, exitoso: false, createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
    });

    const minutosParaDesbloqueo = ultimoIntento
      ? Math.ceil(
          (VENTANA_MINUTOS * 60 * 1000 -
            (Date.now() - ultimoIntento.createdAt.getTime())) /
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
    intentosRestantes: INTENTOS_BLOQUEO_TEMPORAL - intentosRecientes,
  };
}

export async function registrarIntento(
  email: string,
  ip: string,
  exitoso: boolean
): Promise<void> {
  await db.loginIntento.create({
    data: { email, ip, exitoso },
  });
}
