import * as dotenv from "dotenv";
// Cargar .env primero, luego .env.local lo sobreescribe (igual que Next.js)
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
