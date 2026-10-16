import { Prisma } from "@/generated/prisma/client";

// Nombre con el que PostgREST exponía cada relación embebida (= nombre de tabla).
// Mantiene intacto el formato JSON que consumen los componentes cliente.
const RELACIONES: Record<string, string> = {
  cuenta: "cuentas_alumnos",
  cuentaAlumno: "cuentas_alumnos",
  detalles: "detalle_ventas",
  alumno: "alumnos",
  producto: "productos",
  vendedor: "usuarios",
  representante: "usuarios",
  admin: "usuarios",
  usuario: "usuarios",
  cantina: "cantinas",
  venta: "ventas",
  movimientos: "movimientos_inventario",
};

const aSnake = (k: string) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());

/**
 * Convierte resultados de Prisma al formato histórico de la API:
 * claves en snake_case, relaciones con nombre de tabla, Decimal → number, Date → ISO.
 */
export function legacy<T = unknown>(valor: unknown): T {
  if (valor === null || valor === undefined) return valor as T;
  if (valor instanceof Prisma.Decimal) return valor.toNumber() as T;
  if (valor instanceof Date) return valor.toISOString() as T;
  if (Array.isArray(valor)) return valor.map((v) => legacy(v)) as T;
  if (typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[RELACIONES[k] ?? aSnake(k)] = legacy(v);
    }
    return salida as T;
  }
  return valor as T;
}

/** Rango [00:00:00, 23:59:59.999] UTC de un día YYYY-MM-DD (mismo criterio que las consultas previas) */
export function rangoDia(fecha: string): { gte: Date; lte: Date } {
  return { gte: new Date(`${fecha}T00:00:00.000Z`), lte: new Date(`${fecha}T23:59:59.999Z`) };
}

/** YYYY-MM-DD de una columna @db.Date */
export const fechaISO = (d: Date) => d.toISOString().slice(0, 10);
