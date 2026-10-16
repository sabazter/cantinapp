import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { actualizarTasaBcv } from "@/lib/bcv";
import { dbSystem } from "@/lib/db";

function claveValida(recibida: string | null): boolean {
  const esperada = process.env.INTERNAL_API_KEY;
  if (!recibida || !esperada) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/internal/bcv/actualizar
// Solo desde localhost con INTERNAL_API_KEY
export async function POST(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const isLocalhost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("::1");

  if (!isLocalhost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!claveValida(req.headers.get("x-internal-api-key"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Actualizar para todas las cantinas activas
  const cantinas = await dbSystem.cantina.findMany({ select: { id: true } });

  const resultados: Record<string, number | string> = {};

  for (const cantina of cantinas) {
    try {
      const tasa = await actualizarTasaBcv(cantina.id);
      resultados[cantina.id] = tasa;
    } catch (err) {
      resultados[cantina.id] = String(err);
    }
  }

  return NextResponse.json({ ok: true, resultados });
}
