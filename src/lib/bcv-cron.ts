import cron from "node-cron";
import { actualizarTasaBcv } from "./bcv";
import { createServerSupabase } from "./supabase-server";

let started = false;

// Realiza la comprobación y actualización si no se ha registrado tasa para el día de hoy (UTC)
async function verificarYActualizarTasaAlInicio() {
  try {
    const supabase = createServerSupabase();
    const { data: cantinas, error } = await supabase.from("cantinas").select("id");
    if (error || !cantinas) {
      console.error("[BCV Cron] Error al listar cantinas al inicio:", error);
      return;
    }

    const hoy = new Date().toISOString().slice(0, 10);

    for (const cantina of cantinas) {
      // Verificar si ya existe una tasa registrada para hoy en esta cantina
      const { data: tasaHoy, error: tasaError } = await supabase
        .from("tasas_bcv")
        .select("tasa_usd_bs")
        .eq("cantina_id", cantina.id)
        .eq("fecha", hoy)
        .maybeSingle();

      if (tasaError) {
        console.error(`[BCV Cron] Error consultando tasa de hoy para cantina ${cantina.id}:`, tasaError);
        continue;
      }

      if (!tasaHoy) {
        console.log(`[BCV Cron] No se detectó tasa de hoy (${hoy}) para cantina ${cantina.id}. Ejecutando comprobación inicial...`);
        try {
          const tasa = await actualizarTasaBcv(cantina.id);
          console.log(`[BCV Cron] Tasa de hoy establecida al inicio para cantina ${cantina.id}: ${tasa}`);
        } catch (updateErr) {
          console.error(`[BCV Cron] Error actualizando tasa al inicio para cantina ${cantina.id}:`, updateErr);
        }
      } else {
        console.log(`[BCV Cron] La tasa de hoy (${hoy}) ya se encuentra registrada para la cantina ${cantina.id}: ${tasaHoy.tasa_usd_bs}`);
      }
    }
  } catch (err) {
    console.error("[BCV Cron] Error general en verificación de inicio:", err);
  }
}

export function startBcvCron() {
  if (started) return;
  started = true;

  // Ejecutar verificación inicial de manera asíncrona
  verificarYActualizarTasaAlInicio();

  // Ejecutar a las 8:00 AM y 8:00 PM hora Venezuela (UTC-4) = 12:00 UTC y 00:00 UTC
  // Formato cron: minuto hora día mes día-semana
  cron.schedule("0 0,12 * * *", async () => {
    try {
      console.log("[BCV Cron] Ejecutando actualización programada (8:00 AM / 8:00 PM VET)...");
      const supabase = createServerSupabase();
      const { data: cantinas, error } = await supabase.from("cantinas").select("id");
      if (error || !cantinas) {
        console.error("[BCV Cron] Error al listar cantinas en actualización programada:", error);
        return;
      }
      for (const cantina of cantinas) {
        try {
          const tasa = await actualizarTasaBcv(cantina.id);
          console.log(`[BCV Cron] Tasa programada actualizada para cantina ${cantina.id}: ${tasa}`);
        } catch (err) {
          console.error(`[BCV Cron] Error en actualización programada para cantina ${cantina.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[BCV Cron] Error en cron programado:", err);
    }
  });

  console.log("[BCV Cron] Iniciado — actualización a las 8:00 AM y 8:00 PM VET");
}
