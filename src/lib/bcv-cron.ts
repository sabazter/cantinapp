import cron from "node-cron";

let started = false;

export function startBcvCron() {
  if (started) return;
  started = true;

  // Ejecutar a las 8:00 AM hora Venezuela (UTC-4) = 12:00 UTC
  // Formato cron: minuto hora día mes día-semana
  cron.schedule("0 12 * * 1-5", async () => {
    try {
      const res = await fetch(
        `http://localhost:${process.env.PORT ?? 3000}/api/internal/bcv/actualizar`,
        {
          method: "POST",
          headers: {
            "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "",
          },
        }
      );
      const data = await res.json();
      console.log("[BCV Cron] Actualización completada:", data);
    } catch (err) {
      console.error("[BCV Cron] Error en actualización automática:", err);
    }
  });

  console.log("[BCV Cron] Iniciado — actualización diaria a las 8:00 AM VET (L-V)");
}
