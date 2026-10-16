import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "Demo2026!";

async function main() {
  // Import dinámico: db.ts y crypto.ts leen process.env al cargarse
  const { db } = await import("../src/lib/db");
  const { encrypt } = await import("../src/lib/crypto");

  const hashPwd = await bcrypt.hash(DEMO_PASSWORD, 12);

  const cantina =
    (await db.cantina.findFirst({ where: { escuela: "Unidad Educativa Demo" } })) ??
    (await db.cantina.create({
      data: {
        nombre: "Cantina Demo",
        escuela: "Unidad Educativa Demo",
        direccion: "Caracas, Venezuela",
        limiteFiadoUsd: 10,
        umbralDeudaUsd: 20,
      },
    }));

  const usuarios = [
    { email: "admin@demo.cantinapp.com", nombre: "Admin Demo", rol: "admin" },
    { email: "vendedor@demo.cantinapp.com", nombre: "Vendedor Demo", rol: "vendedor" },
    { email: "profesor@demo.cantinapp.com", nombre: "Profesor Demo", rol: "profesor" },
    { email: "representante@demo.cantinapp.com", nombre: "Representante Demo", rol: "representante" },
  ] as const;

  const creados: Record<string, string> = {};
  for (const u of usuarios) {
    const row = await db.usuario.upsert({
      where: { email: u.email },
      update: { hashPwd, cantinaId: cantina.id, rol: u.rol, activo: true },
      create: { ...u, hashPwd, cantinaId: cantina.id, activo: true, emailVerificado: true },
    });
    creados[u.rol] = row.id;
  }

  const alumnos = [
    { id: "demo-alumno-1", nombre: "María Pérez", cedula: "30111222", curso: "3er Grado", seccion: "A", saldo: 15 },
    { id: "demo-alumno-2", nombre: "José Pérez", cedula: "31222333", curso: "5to Grado", seccion: "B", saldo: 0 },
  ];
  for (const a of alumnos) {
    await db.alumno.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        cantinaId: cantina.id,
        representanteId: creados.representante,
        nombre: a.nombre,
        cedulaEncriptada: encrypt(a.cedula),
        curso: a.curso,
        seccion: a.seccion,
        fiadoHabilitado: true,
        qrCode: a.id,
      },
    });
    await db.cuentaAlumno.upsert({
      where: { alumnoId: a.id },
      update: {},
      create: { alumnoId: a.id, saldo: a.saldo },
    });
  }

  const productos = [
    { id: "demo-prod-1", nombre: "Empanada de queso", categoria: "menu", precioUsd: 1.5, stock: 40 },
    { id: "demo-prod-2", nombre: "Jugo de naranja", categoria: "menu", precioUsd: 1, stock: 30 },
    { id: "demo-prod-3", nombre: "Cachapa", categoria: "menu", precioUsd: 2.5, stock: 20 },
    { id: "demo-prod-4", nombre: "Galletas Oreo", categoria: "tienda", precioUsd: 0.75, stock: 60 },
    { id: "demo-prod-5", nombre: "Agua mineral 500ml", categoria: "tienda", precioUsd: 0.6, stock: 50 },
    { id: "demo-prod-6", nombre: "Chocolate Savoy", categoria: "tienda", precioUsd: 0.5, stock: 3 },
  ] as const;
  for (const p of productos) {
    await db.producto.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, cantinaId: cantina.id },
    });
  }

  console.log("Seed demo listo. Contraseña de todos los usuarios:", DEMO_PASSWORD);
  for (const u of usuarios) console.log(` - ${u.rol.padEnd(14)} ${u.email}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
