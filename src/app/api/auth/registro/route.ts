import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import QRCode from "qrcode";
import { dbSystem } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { sendEmail } from "@/lib/email/resend";
import { emailBienvenidaRepresentante, emailNuevoRegistroAdmin, emailBienvenidaProfesor, emailNuevoRegistroProfesorAdmin } from "@/lib/email/templates";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ip";
import { aplicarLimites } from "@/lib/rate-limit";

const registroSchema = z.object({
  // Datos del usuario titular
  nombre:    z.string().min(2).max(100),
  email:     z.string().email(),
  password:  z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
  telefono:  z.string().max(20).optional(),
  cantinaId: z.string().max(50).optional(),
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
  const limitado = await aplicarLimites(req, "registro");
  if (limitado) return limitado;

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

  const ip = clientIp((n) => req.headers.get(n));

  // Resolver cantina
  const cantina = body.cantinaId
    ? await dbSystem.cantina.findUnique({ where: { id: body.cantinaId }, select: { id: true } })
    : await dbSystem.cantina.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });

  if (!cantina) {
    return NextResponse.json({ error: "Cantina no encontrada" }, { status: 400 });
  }
  const cantinaId = cantina.id;

  // Verificar que el email no existe
  const existing = await dbSystem.usuario.findUnique({
    where: { email: body.email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
  }

  // Cifrar cédula si se proporcionó
  let cedulaEncriptada: string | null = null;
  try {
    if (body.alumno.cedula) cedulaEncriptada = encrypt(body.alumno.cedula);
  } catch {
    cedulaEncriptada = body.alumno.cedula ?? null;
  }

  const hashPwd = await bcrypt.hash(body.password, 12);
  const esProfesor = body.rol === "profesor";
  const esAlumno   = body.rol === "alumno";

  // Usuario + alumno + cuenta + QR en una sola transacción
  let usuarioId: string;
  try {
    usuarioId = await dbSystem.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          cantinaId,
          nombre:          body.nombre,
          email:           body.email,
          hashPwd,
          rol:             body.rol as any,
          telefono:        body.telefono ?? null,
          activo:          !esProfesor,
          emailVerificado: false,
        },
        select: { id: true },
      });

      const alumno = await tx.alumno.create({
        data: {
          cantinaId,
          representanteId:  esAlumno ? null : usuario.id,
          nombre:           esAlumno ? body.nombre : body.alumno.nombre,
          cedulaEncriptada,
          curso:            body.alumno.curso,
          seccion:          body.alumno.seccion ?? null,
          activo:           !esProfesor,
          fiadoHabilitado:  false,
          consentimientoIp: ip,
          consentimientoAt: new Date(),
          cuenta:           { create: { saldo: 0 } },
        },
        select: { id: true },
      });

      await tx.alumno.update({
        where: { id: alumno.id },
        data: { qrCode: await QRCode.toDataURL(`cantinapp:alumno:${alumno.id}`) },
      });

      return usuario.id;
    });
  } catch (err) {
    console.error("[registro] Error al crear la cuenta:", err instanceof Error ? err.message : "error");
    return NextResponse.json({ error: "Error al crear la cuenta" }, { status: 500 });
  }

  // Token de verificación de email (JWT, 24h)
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const verToken = await new SignJWT({ sub: usuarioId, type: "email_verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  const admin = await dbSystem.usuario.findFirst({
    where: { cantinaId, rol: "admin", activo: true },
    select: { email: true },
  });

  await Promise.all([
    sendEmail({
      to: body.email,
      ...(esProfesor
        ? emailBienvenidaProfesor(body.nombre, verToken)
        : emailBienvenidaRepresentante(body.nombre, verToken)),
    }),
    admin?.email
      ? sendEmail({
          to: admin.email,
          ...(esProfesor
            ? emailNuevoRegistroProfesorAdmin(body.nombre, body.email, cantinaId)
            : emailNuevoRegistroAdmin(body.nombre, body.email, body.alumno.nombre, cantinaId)),
        })
      : Promise.resolve(),
    audit({
      usuarioId,
      cantinaId,
      evento: esProfesor ? "registro_profesor" : esAlumno ? "registro_alumno" : "registro_representante",
      entidad: "usuarios",
      entidadId: usuarioId,
      datos: { ip, alumno: body.alumno.nombre },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
