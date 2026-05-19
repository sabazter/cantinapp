// Logging estructurado — envía a Logtail si LOGTAIL_TOKEN está configurado,
// sino cae en console. Nunca loguea contraseñas, tokens, ni datos cifrados.

type Level = "info" | "warn" | "error";

type LogPayload = Record<string, string | number | boolean | null | undefined>;

const LOGTAIL_TOKEN = process.env.LOGTAIL_TOKEN;
const APP_ENV       = process.env.NODE_ENV ?? "development";

async function sendToLogtail(level: Level, message: string, data: LogPayload) {
  if (!LOGTAIL_TOKEN) return;
  try {
    await fetch("https://in.logtail.com", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${LOGTAIL_TOKEN}`,
      },
      body: JSON.stringify([{
        dt:      new Date().toISOString(),
        level,
        message,
        env:     APP_ENV,
        ...data,
      }]),
    });
  } catch {
    // Fallo silencioso — los logs nunca deben interrumpir el flujo
  }
}

function consoleLog(level: Level, message: string, data: LogPayload) {
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  const extra  = Object.keys(data).length ? JSON.stringify(data) : "";
  if (level === "error")      console.error(prefix, message, extra);
  else if (level === "warn")  console.warn(prefix, message, extra);
  else                        console.log(prefix, message, extra);
}

async function log(level: Level, message: string, data: LogPayload = {}) {
  consoleLog(level, message, data);
  if (APP_ENV === "production") {
    await sendToLogtail(level, message, data);
  }
}

export const logger = {
  info:  (msg: string, data?: LogPayload) => log("info",  msg, data),
  warn:  (msg: string, data?: LogPayload) => log("warn",  msg, data),
  error: (msg: string, data?: LogPayload) => log("error", msg, data),
};
