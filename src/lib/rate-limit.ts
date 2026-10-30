import Redis from "ioredis";
import { RateLimiterRedis, RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/ip";

/**
 * Rate limiting contra el Redis del compose (rate-limiter-flexible).
 *
 *   login       10 intentos / min por IP   (+ 10 / min por email, para no depender solo de la IP)
 *   registro     5 solicitudes / hora por IP
 *   recuperar    5 solicitudes / hora por IP  (+ 3 / hora por email)
 *   global     300 solicitudes / min por IP
 *
 * Si Redis no responde se cae a un limitador en memoria del proceso (fail-safe, no fail-open).
 */

type Tipo = "login" | "registro" | "recuperar" | "global" | "login_email" | "recuperar_email";

const CONFIG: Record<Tipo, { points: number; duration: number }> = {
  login:           { points: 10,  duration: 60 },
  login_email:     { points: 10,  duration: 60 },
  registro:        { points: 5,   duration: 60 * 60 },
  recuperar:       { points: 5,   duration: 60 * 60 },
  recuperar_email: { points: 3,   duration: 60 * 60 },
  global:          { points: 300, duration: 60 },
};

const g = globalThis as unknown as {
  __cantinappRedis?: Redis;
  __cantinappLimiters?: Partial<Record<Tipo, RateLimiterRedis>>;
  __cantinappMem?: Partial<Record<Tipo, RateLimiterMemory>>;
};

function redis(): Redis {
  if (!g.__cantinappRedis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL no está definida");
    const cliente = new Redis(url, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    cliente.on("error", (e: Error) => console.error("[redis]", e.message));
    g.__cantinappRedis = cliente;
  }
  return g.__cantinappRedis;
}

function memoria(tipo: Tipo): RateLimiterMemory {
  g.__cantinappMem ??= {};
  return (g.__cantinappMem[tipo] ??= new RateLimiterMemory({ keyPrefix: `mem:${tipo}`, ...CONFIG[tipo] }));
}

function limitador(tipo: Tipo): RateLimiterRedis {
  g.__cantinappLimiters ??= {};
  return (g.__cantinappLimiters[tipo] ??= new RateLimiterRedis({
    storeClient: redis(),
    keyPrefix: `rl:${tipo}`,
    ...CONFIG[tipo],
    insuranceLimiter: memoria(tipo),
  }));
}

function respuesta429(res: RateLimiterRes, mensaje: string): NextResponse {
  const reintentar = Math.max(1, Math.ceil(res.msBeforeNext / 1000));
  return NextResponse.json(
    { error: mensaje },
    { status: 429, headers: { "Retry-After": String(reintentar) } }
  );
}

const MENSAJES: Record<Tipo, string> = {
  login: "Demasiados intentos. Intenta en 1 minuto.",
  login_email: "Demasiados intentos. Intenta en 1 minuto.",
  registro: "Demasiados registros desde esta red. Intenta más tarde.",
  recuperar: "Demasiadas solicitudes. Intenta más tarde.",
  recuperar_email: "Demasiadas solicitudes. Intenta más tarde.",
  global: "Demasiadas solicitudes. Intenta más tarde.",
};

/** Consume 1 punto de `tipo` para `clave`. Devuelve una respuesta 429 si se excedió, o null. */
export async function limitar(tipo: Tipo, clave: string): Promise<NextResponse | null> {
  try {
    await limitador(tipo).consume(clave);
    return null;
  } catch (e) {
    if (e && typeof e === "object" && "msBeforeNext" in e) {
      return respuesta429(e as RateLimiterRes, MENSAJES[tipo]);
    }
    // Error inesperado del store (el insuranceLimiter ya cubre caídas de Redis)
    console.error("[rate-limit]", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Límite global por IP + límite específico (`tipo`) por IP y, opcionalmente, por identificador. */
export async function aplicarLimites(
  req: Request,
  tipo: "login" | "registro" | "recuperar" | "global",
  identificador?: string
): Promise<NextResponse | null> {
  const ip = clientIp((n) => req.headers.get(n));

  const global = await limitar("global", ip);
  if (global) return global;
  if (tipo === "global") return null;

  const porIp = await limitar(tipo, ip);
  if (porIp) return porIp;

  if (identificador) {
    const clave = identificador.toLowerCase();
    if (tipo === "login") return limitar("login_email", clave);
    if (tipo === "recuperar") return limitar("recuperar_email", clave);
  }
  return null;
}
