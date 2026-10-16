type HeaderGetter = (name: string) => string | null | undefined;

/**
 * IP del cliente. Las cabeceras x-forwarded-for / x-real-ip solo se aceptan si
 * TRUST_PROXY=true (la app está detrás de un proxy que las fija). En ese caso se toma la
 * entrada MÁS A LA DERECHA de x-forwarded-for: es la que añadió nuestro proxy; las anteriores
 * las controla el cliente. Sin proxy de confianza devuelve "unknown".
 */
export function clientIp(get: HeaderGetter): string {
  if (process.env.TRUST_PROXY !== "true") return "unknown";
  const xff = get("x-forwarded-for");
  if (xff) {
    const partes = xff.split(",").map((s) => s.trim()).filter(Boolean);
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
