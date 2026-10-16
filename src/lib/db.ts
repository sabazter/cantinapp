import dns from "node:dns";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

// Force IPv4 DNS resolution so pg connects via IPv4 when both A and AAAA exist.
dns.setDefaultResultOrder("ipv4first");

/**
 * Dos clientes Prisma con roles de Postgres distintos (ver prisma/migrations/*_rls_permisos):
 *
 *  - `db`        → rol `cantinapp_app`, sujeto a Row-Level Security. Solo existe DENTRO de un
 *                  request autenticado (`withAuth`): cada request corre en una transacción con
 *                  app.cantina_id / app.rol / app.user_id fijados. Fuera de ese contexto lanza.
 *  - `dbSystem`  → rol `cantinapp_system` (BYPASSRLS). Para login, registro, recuperación de
 *                  contraseña, cron, auditoría y notificaciones, donde no hay sesión.
 */

type TenantContext = { cantinaId: string | null; rol: string; userId: string };
type Store = { tx: Prisma.TransactionClient };

const g = globalThis as unknown as {
  __cantinapp?: {
    app?: PrismaClient;
    system?: PrismaClient;
    als: AsyncLocalStorage<Store>;
  };
};
const state = (g.__cantinapp ??= { als: new AsyncLocalStorage<Store>() });

function makeClient(envVar: "DATABASE_URL" | "DATABASE_SYSTEM_URL", max: number): PrismaClient {
  const connectionString = process.env[envVar];
  if (!connectionString) throw new Error(`${envVar} no está definida`);
  const pool = new pg.Pool({
    connectionString,
    max,
    keepAlive: true,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err) => {
    console.error(`[db:${envVar}] pool error:`, err.message);
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

function appClient(): PrismaClient {
  return (state.app ??= makeClient("DATABASE_URL", 15));
}

function systemClient(): PrismaClient {
  return (state.system ??= makeClient("DATABASE_SYSTEM_URL", 8));
}

export const dbSystem: PrismaClient = new Proxy({} as PrismaClient, {
  get: (_t, prop) => Reflect.get(systemClient(), prop),
});

export const db: Prisma.TransactionClient = new Proxy({} as Prisma.TransactionClient, {
  get: (_t, prop) => {
    const store = state.als.getStore();
    if (!store) {
      throw new Error(
        "db usado fuera de un request autenticado. Usa withAuth, o dbSystem si no hay sesión."
      );
    }
    return Reflect.get(store.tx, prop);
  },
});

/** Respuesta que fuerza el rollback de la transacción del request (status >= 400). */
export class RollbackResponse extends Error {
  constructor(public response: Response) {
    super("rollback");
  }
}

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de tenant fijado para RLS.
 * Todo lo que `fn` haga con `db` es atómico: si lanza, se revierte todo.
 */
export async function runWithTenant<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  return appClient().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT
        set_config('app.cantina_id', ${ctx.cantinaId ?? ""}, true),
        set_config('app.rol', ${ctx.rol}, true),
        set_config('app.user_id', ${ctx.userId}, true)`;
      return state.als.run({ tx }, fn);
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}
