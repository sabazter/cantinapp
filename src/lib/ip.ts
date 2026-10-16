type HeaderGetter = (name: string) => string | null | undefined;

function esPrivada(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (v === "::1" || v === "localhost" || v === "unknown") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true; // IPv6 ULA / link-local
  const m = v.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) // CGNAT / Tailscale
  );
}

/**
 * IP del cliente. Las cabeceras de proxy solo se aceptan si TRUST_PROXY=true (la app corre detrás
 * de Cloudflare/nginx, que las fijan); si no, son falsificables y se devuelve "unknown".
 *
 * Con proxy de confianza:
 *  1. `CF-Connecting-IP` (lo escribe Cloudflare; el cliente no puede fijarlo a través del túnel).
 *  2. `X-Forwarded-For` recorrido de derecha a izquierda, saltando las IP privadas/loopback de
 *     nuestros propios saltos (nginx añade 127.0.0.1 al final): la primera IP pública es la que
 *     vio el primer proxy de confianza. Lo que el cliente antepone queda a la izquierda y se ignora.
 *  3. `X-Real-IP`.
 */
export function clientIp(get: HeaderGetter): string {
  if (process.env.TRUST_PROXY !== "true") return "unknown";

  const cf = get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const xff = get("x-forwarded-for");
  if (xff) {
    const partes = xff.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = partes.length - 1; i >= 0; i--) {
      if (!esPrivada(partes[i])) return partes[i];
    }
    if (partes.length) return partes[partes.length - 1];
  }
  return get("x-real-ip")?.trim() || "unknown";
}

/** Para objetos de cabeceras planos (NextAuth `req.headers`). */
export function clientIpFromRecord(headers: Record<string, string | string[] | undefined> | undefined): string {
  return clientIp((n) => {
    const v = headers?.[n];
    return Array.isArray(v) ? v[0] : v;
  });
}
