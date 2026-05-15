import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// Instancias de rate limiter (lazy — solo se crean al usarse)
let loginLimiter: Ratelimit;
let globalLimiter: Ratelimit;

export function getLoginLimiter() {
  if (!loginLimiter) {
    loginLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "rl:login",
    });
  }
  return loginLimiter;
}

export function getGlobalLimiter() {
  if (!globalLimiter) {
    globalLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(300, "1 m"),
      prefix: "rl:global",
    });
  }
  return globalLimiter;
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Aplica rate limiting de login. Retorna NextResponse 429 si se excede.
 */
export async function checkLoginRateLimit(ip: string): Promise<NextResponse | null> {
  const { success, limit, remaining, reset } = await getLoginLimiter().limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta en 1 minuto." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }
  return null;
}

/**
 * Aplica rate limiting global. Retorna NextResponse 429 si se excede.
 */
export async function checkGlobalRateLimit(ip: string): Promise<NextResponse | null> {
  const { success } = await getGlobalLimiter().limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta más tarde." },
      { status: 429 }
    );
  }
  return null;
}
