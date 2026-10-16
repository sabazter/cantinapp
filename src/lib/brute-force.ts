import { dbSystem } from "@/lib/db";
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
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000);

  // Los fallos "acumulados" cuentan desde el último login exitoso: un usuario legítimo
  // no queda bloqueado de por vida por errores antiguos.
  const ultimoExito = await dbSystem.loginIntento.findFirst({
    where: { email, exitoso: true },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const [recientes, total] = await Promise.all([
    dbSystem.loginIntento.count({
      where: {
        email,
        exitoso: false,
        createdAt: { gte: ultimoExito && ultimoExito.createdAt > desde ? ultimoExito.createdAt : desde },
      },
    }),
    dbSystem.loginIntento.count({
      where: {
        email,
        exitoso: false,
        ...(ultimoExito ? { createdAt: { gt: ultimoExito.createdAt } } : {}),
      },
    }),
  ]);

  if (total >= INTENTOS_BLOQUEO_PERMANENTE) {
    return { bloqueado: true, permanente: true, intentosRestantes: 0 };
  }

  // Notificar al admin cuando se alcanza el bloqueo temporal (primer disparo)
  if (recientes === INTENTOS_BLOQUEO_TEMPORAL) {
    const usuario = await dbSystem.usuario.findUnique({
      where: { email },
      select: { cantinaId: true },
    });
    notificarCuentaBloqueada(usuario?.cantinaId ?? null, email).catch(() => {});
  }

  if (recientes >= INTENTOS_BLOQUEO_TEMPORAL) {
    const ultimoIntento = await dbSystem.loginIntento.findFirst({
      where: { email, exitoso: false, createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const minutosParaDesbloqueo = ultimoIntento
      ? Math.ceil(
          (VENTANA_MINUTOS * 60 * 1000 - (Date.now() - ultimoIntento.createdAt.getTime())) / 60000
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
  await dbSystem.loginIntento.create({ data: { email, ip, exitoso } });
}
