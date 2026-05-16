export async function register() {
  // Solo ejecutar en el proceso de Node.js del servidor, no en Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBcvCron } = await import("./lib/bcv-cron");
    startBcvCron();
  }
}
