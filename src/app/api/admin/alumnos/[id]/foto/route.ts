import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { eliminarArchivo, guardarArchivo, leerArchivo, tipoImagen } from "@/lib/storage";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

type Ctx = { params: Promise<{ id: string }> };

async function alumnoPropio(id: string, cantinaId: string) {
  const alumno = await db.alumno.findFirst({
    where: { id, cantinaId, deletedAt: null },
    select: { id: true, fotoUrl: true },
  });
  return alumno;
}

// POST /api/admin/alumnos/[id]/foto — subir foto
export const POST = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  // Rechazar antes de leer el body si el cliente ya declara un tamaño excesivo
  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > MAX_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "El archivo supera los 5 MB" }, { status: 413 });
  }

  const alumno = await alumnoPropio(id, cantinaId);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("foto");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "El archivo supera los 5 MB" }, { status: 400 });
  }

  // El tipo se determina por los bytes del archivo, no por el MIME que declara el cliente
  const bytes = Buffer.from(await file.arrayBuffer());
  const tipo = tipoImagen(bytes);
  if (!tipo) {
    return NextResponse.json({ error: "Tipo de archivo no permitido. Use JPG, PNG o WebP." }, { status: 400 });
  }

  const clave = `${cantinaId}/${id}.${tipo.ext}`;
  try {
    await guardarArchivo("fotos-alumnos", clave, bytes);
  } catch (err) {
    console.error("[Foto upload]", err instanceof Error ? err.message : "error");
    return NextResponse.json({ error: "Error al subir foto" }, { status: 500 });
  }

  // Si antes había una foto con otra extensión, se elimina
  if (alumno.fotoUrl && alumno.fotoUrl !== clave) {
    await eliminarArchivo("fotos-alumnos", alumno.fotoUrl).catch(() => {});
  }

  await db.alumno.update({ where: { id }, data: { fotoUrl: clave } });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    "alumno_foto_actualizada",
    entidad:   "alumnos",
    entidadId: id,
  });

  return NextResponse.json({ ok: true, path: clave });
});

// GET /api/admin/alumnos/[id]/foto — URL de la foto (autenticada); ?raw=1 devuelve los bytes
export const GET = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin", "vendedor");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await alumnoPropio(id, cantinaId);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!alumno.fotoUrl) {
    return NextResponse.json({ url: null });
  }

  if (new URL(req.url).searchParams.get("raw") === "1") {
    const bytes = await leerArchivo("fotos-alumnos", alumno.fotoUrl);
    if (!bytes) return NextResponse.json({ url: null });
    const tipo = tipoImagen(bytes);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": tipo?.mime ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // La URL apunta a esta misma ruta: exige sesión válida y pertenencia a la cantina en cada lectura
  return NextResponse.json({ url: `/api/admin/alumnos/${id}/foto?raw=1` });
});

// DELETE /api/admin/alumnos/[id]/foto — eliminar foto
export const DELETE = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const alumno = await alumnoPropio(id, cantinaId);
  if (!alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!alumno.fotoUrl) {
    return NextResponse.json({ ok: true });
  }

  await eliminarArchivo("fotos-alumnos", alumno.fotoUrl);
  await db.alumno.update({ where: { id }, data: { fotoUrl: null } });

  return NextResponse.json({ ok: true });
});
