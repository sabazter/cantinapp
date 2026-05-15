import dns from "node:dns";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Force IPv4 DNS resolution so pg connects via IPv4 when both A and AAAA exist.
// Supabase direct DB is IPv6-only; the pooler has both.
dns.setDefaultResultOrder("ipv4first");

function makePool() {
  const url = new URL(process.env.DATABASE_URL!);
  const pool = new pg.Pool({
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false },
    max: 5,
    // Keep connections alive — Supavisor session mode will close idle clients
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: false,
  });

  pool.on("error", (err) => {
    console.error("[db] pool error (client will be destroyed and a new one created):", err.message);
  });

  return pool;
}

function createPrismaClient() {
  const adapter = new PrismaPg(makePool());
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
