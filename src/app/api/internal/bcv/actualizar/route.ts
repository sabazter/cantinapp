import { NextRequest, NextResponse } from "next/server";
import { actualizarTasaBcv } from "@/lib/bcv";
import { createServerSupabase } from "@/lib/supabase-server";

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

  const apiKey = req.headers.get("x-internal-api-key");
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Actualizar para todas las cantinas activas
  const supabase = createServerSupabase();
  const { data: cantinas, error } = await supabase
    .from("cantinas")
    .select("id");

  if (error) {
    console.error("[BCV] Error listando cantinas:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const resultados: Record<string, number | string> = {};

  for (const cantina of cantinas ?? []) {
    try {
      const tasa = await actualizarTasaBcv(cantina.id);
      resultados[cantina.id] = tasa;
    } catch (err) {
      resultados[cantina.id] = String(err);
    }
  }

  return NextResponse.json({ ok: true, resultados });
}
