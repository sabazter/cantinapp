import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import QRCode from "qrcode";
import { createServerSupabase } from "@/lib/supabase-server";
import { encrypt } from "@/lib/crypto";
import { sendEmail } from "@/lib/email/resend";
import { emailBienvenidaRepresentante, emailNuevoRegistroAdmin, emailBienvenidaProfesor, emailNuevoRegistroProfesorAdmin } from "@/lib/email/templates";
import { audit } from "@/lib/audit";

const registroSchema = z.object({
  // Datos del titular / usuario
  nombre:    z.string().min(2).max(100),
  email:     z.string().email(),
  password:  z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  telefono:  z.string().max(20).optional(),
  cantinaId: z.string().optional(),
  rol:       z.enum(["representante", "profesor", "alumno"]).default("representante"),

  // Datos del alumno
  alumno: z.object({
    nombre:  z.string().min(2).max(100),
    curso:   z.string().min(1).max(20),
    seccion: z.string().max(10).optional(),
    cedula:  z.string().max(20).optional(),
  }),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof registroSchema>;
  try {
    const raw = await req.json();
    const parsed = registroSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const supabase = createServerSupabase();

  // Resolver cantina
  let cantinaId = body.cantinaId ?? null;
  if (!cantinaId) {
    const { data: cantinas } = await supabase
      .from("cantinas")
      .select("id")
      .limit(1)
      .single();
    cantinaId = cantinas?.id ?? null;
  }

  if (!cantinaId) {
    return NextResponse.json({ error: "Cantina no encontrada" }, { status: 400 });
  }

  // Verificar que el email no existe
  const { data: existing } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", body.email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
  }

  // Hash de contraseña
  const hashPwd = await bcrypt.hash(body.password, 12);

  // Crear representante/profesor
  const { data: usuario, error: userErr } = await supabase
    .from("usuarios")
    .insert({
      cantina_id:      cantinaId,
      nombre:          body.nombre,
      email:           body.email,
      hash_pwd:        hashPwd,
      rol:             body.rol,
      telefono:        body.telefono ?? null,
      activo:          body.rol === "profesor" ? false : true,
      email_verificado: false,
    })
    .select("id")
    .single();

  if (userErr || !usuario) {
    console.error("[registro] Error al crear usuario:", userErr);
    return NextResponse.json({ error: "Error al crear la cuenta" }, { status: 500 });
  }

  // Cifrar cédula si se proporcionó
  let cedulaEncriptada: string | null = null;
  try {
    if (body.alumno.cedula) cedulaEncriptada = encrypt(body.alumno.cedula);
  } catch {
    // Si falta ENCRYPTION_KEY en dev, continuar sin cifrar
    cedulaEncriptada = body.alumno.cedula ?? null;
  }

  // Crear alumno
  const esAlumno = body.rol === "alumno";
  const { data: alumno, error: alumnoErr } = await supabase
    .from("alumnos")
    .insert({
      cantina_id:        cantinaId,
      representante_id:  esAlumno ? null : usuario.id,
      usuario_id:        esAlumno ? usuario.id : null,
      nombre:            esAlumno ? body.nombre : body.alumno.nombre,
      cedula_encriptada: cedulaEncriptada,
      curso:             body.alumno.curso,
      seccion:           body.alumno.seccion ?? null,
      activo:            body.rol === "profesor" ? false : true,
      fiado_habilitado:  false,
      consentimiento_ip: ip,
      consentimiento_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (alumnoErr || !alumno) {
    // Rollback usuario
    await supabase.from("usuarios").delete().eq("id", usuario.id);
    console.error("[registro] Error al crear alumno:", alumnoErr);
    return NextResponse.json({ error: "Error al registrar el alumno" }, { status: 500 });
  }

  // Crear cuenta corriente + QR en paralelo
  const qrData = await QRCode.toDataURL(`cantinapp:alumno:${alumno.id}`);
  await Promise.all([
    supabase.from("cuentas_alumnos").insert({ alumno_id: alumno.id, saldo: 0 }),
    supabase.from("alumnos").update({ qr_code: qrData }).eq("id", alumno.id),
  ]);

  // Token de verificación de email (JWT, 24h)
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const verToken = await new SignJWT({ sub: usuario.id, type: "email_verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  // Notificaciones en paralelo
  const [adminData] = await Promise.all([
    supabase
      .from("usuarios")
      .select("email")
      .eq("cantina_id", cantinaId)
      .eq("rol", "admin")
      .eq("activo", true)
      .limit(1)
      .single(),
  ]);

  const esProfesor = body.rol === "profesor";

  await Promise.all([
    sendEmail({
      to: body.email,
      ...(esProfesor
        ? emailBienvenidaProfesor(body.nombre, verToken)
        : emailBienvenidaRepresentante(body.nombre, verToken)),
    }),
    adminData.data?.email
      ? sendEmail({
          to: adminData.data.email as string,
          ...(esProfesor
            ? emailNuevoRegistroProfesorAdmin(body.nombre, body.email, cantinaId)
            : emailNuevoRegistroAdmin(body.nombre, body.email, body.alumno.nombre, cantinaId)),
        })
      : Promise.resolve(),
    audit({
      usuarioId: usuario.id,
      cantinaId,
      evento: esProfesor ? "registro_profesor" : "registro_representante",
      entidad: "usuarios",
      entidadId: usuario.id,
      datos: { ip, alumno: body.alumno.nombre },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
