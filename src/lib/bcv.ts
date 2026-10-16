import * as cheerio from "cheerio";
import https from "https";
import { dbSystem } from "./db";
import { fechaISO } from "./legacy";
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

  return Math.round(tasa * 100) / 100;
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

  const hoy = new Date(new Date().toISOString().slice(0, 10));

  await dbSystem.tasaBcv.upsert({
    where: { cantinaId_fecha: { cantinaId, fecha: hoy } },
    create: { cantinaId, fecha: hoy, tasaUsdBs: tasa, fuente: "automatica" },
    update: { tasaUsdBs: tasa, fuente: "automatica" },
  });

  return tasa;
}

export async function ultimaTasaBcv(cantinaId: string): Promise<number | null> {
  const data = await dbSystem.tasaBcv.findFirst({
    where: { cantinaId },
    orderBy: { fecha: "desc" },
    select: { tasaUsdBs: true },
  });

  return data ? data.tasaUsdBs.toNumber() : null;
}

export async function tasaActivaBcv(cantinaId: string): Promise<TasaBcv | null> {
  const data = await dbSystem.tasaBcv.findFirst({
    where: { cantinaId },
    orderBy: { fecha: "desc" },
    select: { tasaUsdBs: true, fecha: true, fuente: true },
  });

  if (!data) return null;
  return {
    tasa: data.tasaUsdBs.toNumber(),
    fecha: fechaISO(data.fecha),
    fuente: data.fuente,
  };
}

async function notificarFalloBcv(cantinaId: string, fallos: number): Promise<void> {
  console.error(`[BCV] ${fallos} fallos consecutivos en cantina ${cantinaId}. Usando última tasa conocida.`);

  // Insertar directamente en audit_logs sin usar headers() ya que estamos en contexto cron
  try {
    await dbSystem.auditLog.create({
      data: {
        cantinaId,
        evento: AuditEvent.TASA_BCV_CAMBIADA,
        entidad: "tasas_bcv",
        datos:  { error: `${fallos} fallos consecutivos de scraping`, accion: "fallback_ultima_tasa" },
        ip:     "cron",
      },
    });
  } catch {}
}
