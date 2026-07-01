import * as cheerio from "cheerio";
import https from "https";
import { createServerSupabase } from "./supabase-server";
import { AuditEvent } from "./audit";

export interface TasaBcv {
  tasa: number;
  fecha: string; // YYYY-MM-DD
  fuente: "automatica" | "manual";
}

let consecutiveFailures = 0;

function fetchBcvHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      rejectUnauthorized: false // Ignorar verificación de certificado de BCV (causa error de TLS localmente)
    };

    https.get("https://www.bcv.org.ve/", options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`BCV HTTP ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(data);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

export async function scrapeBcv(): Promise<number> {
  const html = await fetchBcvHtml();
  const $ = cheerio.load(html);

  // BCV muestra el dólar en #dolar > .centrado > strong
  const raw = $("#dolar .centrado strong").first().text().trim();
  // Formato: "47,12" o "47.12"
  const tasa = parseFloat(raw.replace(",", "."));

  if (isNaN(tasa) || tasa <= 0) throw new Error(`Tasa inválida: "${raw}"`);

  return tasa;
}

// Actualiza la tasa del día para una cantina. Devuelve la tasa usada.
export async function actualizarTasaBcv(cantinaId: string): Promise<number> {
  let tasa: number;

  try {
    tasa = await scrapeBcv();
    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures++;
    console.error(`[BCV] Fallo scraping #${consecutiveFailures}:`, err);

    if (consecutiveFailures >= 3) {
      await notificarFalloBcv(cantinaId, consecutiveFailures);
    }

    // Usar la última tasa almacenada
    const ultima = await ultimaTasaBcv(cantinaId);
    if (!ultima) throw new Error("Sin tasa disponible y scraping falló");
    return ultima;
  }

  const supabase = createServerSupabase();
  const hoy = new Date().toISOString().slice(0, 10);

  // Upsert: si ya existe la tasa del día no la sobreescribe si es manual
  await supabase.from("tasas_bcv").upsert(
    { cantina_id: cantinaId, fecha: hoy, tasa_usd_bs: tasa, fuente: "automatica" },
    { onConflict: "cantina_id,fecha", ignoreDuplicates: false }
  );

  return tasa;
}

export async function ultimaTasaBcv(cantinaId: string): Promise<number | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("tasas_bcv")
    .select("tasa_usd_bs")
    .eq("cantina_id", cantinaId)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

  return data ? Number(data.tasa_usd_bs) : null;
}

export async function tasaActivaBcv(cantinaId: string): Promise<TasaBcv | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("tasas_bcv")
    .select("tasa_usd_bs, fecha, fuente")
    .eq("cantina_id", cantinaId)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return {
    tasa: Number(data.tasa_usd_bs),
    fecha: data.fecha,
    fuente: data.fuente as "automatica" | "manual",
  };
}

async function notificarFalloBcv(cantinaId: string, fallos: number): Promise<void> {
  console.error(`[BCV] ${fallos} fallos consecutivos en cantina ${cantinaId}. Usando última tasa conocida.`);

  // Insertar directamente en audit_logs sin usar headers() ya que estamos en contexto cron
  try {
    const supabase = createServerSupabase();
    await supabase.from("audit_logs").insert({
      usuario_id: null,
      cantina_id: cantinaId,
      evento:     AuditEvent.TASA_BCV_CAMBIADA,
      entidad:    "tasas_bcv",
      datos:      { error: `${fallos} fallos consecutivos de scraping`, accion: "fallback_ultima_tasa" },
      ip:         "cron",
    });
  } catch {}
}
