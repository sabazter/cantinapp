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
    // Las migraciones corren con el dueño del esquema, nunca con los roles de la app
    url: process.env["DATABASE_ADMIN_URL"] ?? process.env["DATABASE_URL"],
  },
});
