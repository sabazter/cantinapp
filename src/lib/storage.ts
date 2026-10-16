import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Almacenamiento privado en disco (volumen `cantinapp_uploads`). Nada se sirve de forma
 * estática: la lectura pasa siempre por una ruta API autenticada.
 */

export type Bucket = "fotos-alumnos" | "comprobantes-abonos";

const SEGMENTO = /^[A-Za-z0-9_-]+(\.[a-z0-9]+)?$/;

function resolver(bucket: Bucket, clave: string): string {
  const partes = clave.split("/");
  if (partes.length === 0 || !partes.every((p) => SEGMENTO.test(p))) {
    throw new Error("Clave de archivo inválida");
  }
  const raiz = path.resolve(process.env.UPLOADS_DIR ?? "./uploads", bucket);
  const destino = path.resolve(raiz, ...partes);
  if (!destino.startsWith(raiz + path.sep)) throw new Error("Clave de archivo inválida");
  return destino;
}

export async function guardarArchivo(bucket: Bucket, clave: string, datos: Buffer): Promise<void> {
  const destino = resolver(bucket, clave);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, datos, { mode: 0o640 });
}

export async function leerArchivo(bucket: Bucket, clave: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolver(bucket, clave));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function eliminarArchivo(bucket: Bucket, clave: string): Promise<void> {
  try {
    await fs.unlink(resolver(bucket, clave));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

/** Detecta el tipo real por los bytes iniciales (no confía en el MIME que declara el cliente). */
export function tipoImagen(b: Buffer): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", mime: "image/png" };
  }
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}
