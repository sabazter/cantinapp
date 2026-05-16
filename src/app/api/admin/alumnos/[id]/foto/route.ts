import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/alumnos/[id]/foto — subir foto
export const POST = withAuth(async (req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const supabase = createServerSupabase();

  // Verificar propiedad
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, cantina_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!alumno || alumno.cantina_id !== cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("foto") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido. Use JPG, PNG o WebP." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "El archivo supera los 5 MB" }, { status: 400 });
  }

  const ext = file.type.split("/")[1];
  const fileName = `${cantinaId}/${id}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("fotos-alumnos")
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[Foto upload]", uploadError);
    return NextResponse.json({ error: "Error al subir foto" }, { status: 500 });
  }

  // Guardar la path relativa (no URL pública — URLs firmadas se generan al pedir)
  await supabase.from("alumnos").update({ foto_url: fileName }).eq("id", id);

  return NextResponse.json({ ok: true, path: fileName });
});

// GET /api/admin/alumnos/[id]/foto — URL firmada (1h)
export const GET = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin", "vendedor");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const supabase = createServerSupabase();

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("cantina_id, foto_url")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!alumno || alumno.cantina_id !== cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (!alumno.foto_url) {
    return NextResponse.json({ url: null });
  }

  const { data: signed } = await supabase.storage
    .from("fotos-alumnos")
    .createSignedUrl(alumno.foto_url, 3600); // 1 hora

  return NextResponse.json({ url: signed?.signedUrl ?? null });
});

// DELETE /api/admin/alumnos/[id]/foto — eliminar foto
export const DELETE = withAuth(async (_req: NextRequest, session, { params }: Ctx) => {
  requireRole(session, "admin", "superadmin");
  const { id } = await params;
  const cantinaId = session.user.cantinaId!;

  const supabase = createServerSupabase();

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("cantina_id, foto_url")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!alumno || alumno.cantina_id !== cantinaId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (!alumno.foto_url) {
    return NextResponse.json({ ok: true });
  }

  await supabase.storage.from("fotos-alumnos").remove([alumno.foto_url]);
  await supabase.from("alumnos").update({ foto_url: null }).eq("id", id);

  return NextResponse.json({ ok: true });
});
