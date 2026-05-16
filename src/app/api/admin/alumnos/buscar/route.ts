import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";

// GET /api/admin/alumnos/buscar?q=<nombre o cedula>&id=<alumnoId>
// Usado por el POS para identificar al alumno
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "vendedor", "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const q  = searchParams.get("q")?.trim() ?? "";
  const id = searchParams.get("id")?.trim();

  const supabase = createServerSupabase();

  // Búsqueda por ID (QR scan)
  if (id) {
    const { data } = await supabase
      .from("alumnos")
      .select("id, nombre, curso, seccion, fiado_habilitado, limite_fiado_usd, cuentas_alumnos(saldo)")
      .eq("id", id)
      .eq("cantina_id", cantinaId)
      .eq("activo", true)
      .is("deleted_at", null)
      .single();

    if (!data) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    return NextResponse.json([data]);
  }

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Buscar por nombre (ilike)
  const { data: porNombre } = await supabase
    .from("alumnos")
    .select("id, nombre, curso, seccion, limite_fiado_usd, cedula_encriptada, cuentas_alumnos(saldo)")
    .eq("cantina_id", cantinaId)
    .eq("activo", true)
    .is("deleted_at", null)
    .ilike("nombre", `%${q}%`)
    .limit(10);

  // Si q parece una cédula (solo dígitos o con prefijo V/E), buscar por cédula también
  const esCedula = /^[VEve]?[-]?\d{5,}$/.test(q);
  let porCedula: typeof porNombre = [];

  if (esCedula && porNombre && porNombre.length === 0) {
    // Cargar todos y comparar descifrado (costoso pero alumnos son pocos)
    const { data: todos } = await supabase
      .from("alumnos")
      .select("id, nombre, curso, seccion, fiado_habilitado, limite_fiado_usd, cedula_encriptada, cuentas_alumnos(saldo)")
      .eq("cantina_id", cantinaId)
      .eq("activo", true)
      .is("deleted_at", null);

    if (todos) {
      const qNorm = q.toUpperCase().replace("-", "");
      porCedula = todos.filter(a => {
        try {
          const ced = decrypt(a.cedula_encriptada).toUpperCase().replace("-", "");
          return ced.includes(qNorm);
        } catch {
          return false;
        }
      });
    }
  }

  const resultados = [...(porNombre ?? []), ...porCedula];

  // Quitar cedula_encriptada del response
  return NextResponse.json(
    resultados.map(({ cedula_encriptada: _ced, ...rest }) => rest)
  );
});
