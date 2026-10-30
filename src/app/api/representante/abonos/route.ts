import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { tasaActivaBcv } from "@/lib/bcv";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const abonoSchema = z.object({
  tipoDistribucion: z.enum(["equitativa", "individual"]).default("equitativa"),
  alumnoId:         z.string().optional(),
  montoUsd:         z.number().positive("El monto debe ser mayor a 0"),
  metodo:           z.enum(["efectivo_usd", "efectivo_bs", "pago_movil", "transferencia"]),
  referencia:       z.string().max(100).optional(),
  banco:            z.string().max(60).optional(),
}).refine((data) => {
  // Referencia obligatoria solo si es pago móvil o transferencia
  if (data.metodo === "pago_movil" || data.metodo === "transferencia") {
    return Boolean(data.referencia && data.referencia.trim().length >= 4);
  }
  return true;
}, {
  message: "La referencia de pago es requerida para Pago Móvil o Transferencia",
  path: ["referencia"],
});

// POST /api/representante/abonos — representante reporta un abono
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const contentType     = req.headers.get("content-type") ?? "";

  let body: z.infer<typeof abonoSchema>;
  let comprobanteFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const rawData = {
      tipoDistribucion: form.get("tipoDistribucion") || "equitativa",
      alumnoId:         form.get("alumnoId") || undefined,
      montoUsd:         Number(form.get("montoUsd")),
      metodo:           form.get("metodo"),
      referencia:       form.get("referencia") || undefined,
      banco:            form.get("banco") || undefined,
    };
    body = await validateBody(
      new Request(req.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rawData),
      }),
      abonoSchema
    );
    comprobanteFile = form.get("comprobante") as File | null;
  } else {
    body = await validateBody(req, abonoSchema);
  }

  const supabase = createServerSupabase();

  // Obtener los hijos del representante
  const { data: hijos } = await supabase
    .from("alumnos")
    .select("id, nombre, cantina_id, cuentas_alumnos(id)")
    .eq("representante_id", representanteId)
    .is("deleted_at", null);

  if (!hijos || hijos.length === 0) {
    return NextResponse.json({ error: "No tienes alumnos registrados a tu cargo" }, { status: 400 });
  }

  // Determinar cuentas de destino
  let alumnosDestino: typeof hijos = [];
  if (body.tipoDistribucion === "individual" && body.alumnoId) {
    const found = hijos.find((h) => h.id === body.alumnoId);
    if (!found) {
      return NextResponse.json({ error: "El alumno seleccionado no pertenece a tu cuenta" }, { status: 403 });
    }
    alumnosDestino = [found];
  } else {
    // Por defecto: distribución equitativa entre todos los hijos
    alumnosDestino = hijos;
  }

  const cantinaId = hijos[0].cantina_id;
  const tasaInfo  = await tasaActivaBcv(cantinaId);
  const tasa      = tasaInfo?.tasa ?? 1;

  // Subir comprobante si aplica
  let comprobanteUrl: string | null = null;
  if (comprobanteFile && (body.metodo === "pago_movil" || body.metodo === "transferencia")) {
    if (!ALLOWED_TYPES.includes(comprobanteFile.type)) {
      return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
    }
    if (comprobanteFile.size > MAX_SIZE) {
      return NextResponse.json({ error: "El comprobante supera los 5 MB" }, { status: 400 });
    }

    const ext  = comprobanteFile.type.split("/")[1];
    const path = `${cantinaId}/${representanteId}_${Date.now()}.${ext}`;
    const ab   = await comprobanteFile.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from("comprobantes-abonos")
      .upload(path, ab, { contentType: comprobanteFile.type, upsert: false });

    if (!uploadErr) comprobanteUrl = path;
  }

  const montoPorAlumno = +(body.montoUsd / alumnosDestino.length).toFixed(4);
  const montoBsPorAlumno = +(montoPorAlumno * tasa).toFixed(4);
  const esEfectivo = body.metodo === "efectivo_usd" || body.metodo === "efectivo_bs";
  const refFinal = esEfectivo ? null : body.referencia ? encrypt(body.referencia) : null;

  const abonosCreadosIds: string[] = [];

  for (const hijo of alumnosDestino) {
    const cuentaId = Array.isArray(hijo.cuentas_alumnos)
      ? hijo.cuentas_alumnos[0]?.id
      : (hijo.cuentas_alumnos as any)?.id;

    if (!cuentaId) continue;

    const { data: abono, error: abonoErr } = await supabase
      .from("abonos")
      .insert({
        cuenta_alumno_id:      cuentaId,
        monto_usd:             montoPorAlumno,
        monto_bs:              montoBsPorAlumno,
        tasa_bcv:              tasa,
        metodo:                body.metodo,
        referencia_encriptada: refFinal,
        banco:                 esEfectivo ? null : body.banco ?? null,
        comprobante_url:       comprobanteUrl,
        estado:                "pendiente",
      })
      .select("id")
      .single();

    if (abono && !abonoErr) {
      abonosCreadosIds.push(abono.id);
    }
  }

  await audit({
    usuarioId: representanteId,
    cantinaId,
    evento:    AuditEvent.ABONO_CREADO,
    entidad:   "abonos",
    entidadId: abonosCreadosIds[0] ?? "familiar",
    datos: {
      montoTotalUsd:    body.montoUsd,
      distribucion:     body.tipoDistribucion,
      alumnosCantidad:  alumnosDestino.length,
      metodo:           body.metodo,
    },
  });

  return NextResponse.json({
    ok: true,
    abonosCount: abonosCreadosIds.length,
    montoPorHijo: montoPorAlumno,
  }, { status: 201 });
});

// GET /api/representante/abonos — historial consolidado de abonos del representante
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");

  const representanteId = session.user.id;
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get("alumnoId");

  const supabase = createServerSupabase();

  // Obtener los hijos del representante
  let query = supabase
    .from("alumnos")
    .select("id, nombre, cuentas_alumnos(id)")
    .eq("representante_id", representanteId)
    .is("deleted_at", null);

  if (alumnoId) {
    query = query.eq("id", alumnoId);
  }

  const { data: hijos } = await query;
  if (!hijos || hijos.length === 0) return NextResponse.json([]);

  const cuentaIds = hijos
    .map((h) => {
      const c = Array.isArray(h.cuentas_alumnos) ? h.cuentas_alumnos[0] : (h.cuentas_alumnos as any);
      return c?.id;
    })
    .filter(Boolean);

  if (cuentaIds.length === 0) return NextResponse.json([]);

  const { data: abonos } = await supabase
    .from("abonos")
    .select(`
      id, monto_usd, monto_bs, metodo, banco, estado, created_at, confirmado_at, motivo_rechazo,
      cuentas_alumnos (
        alumno:alumnos (
          id, nombre
        )
      )
    `)
    .in("cuenta_alumno_id", cuentaIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json(abonos ?? []);
});
