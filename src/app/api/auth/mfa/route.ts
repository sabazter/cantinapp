import { NextRequest, NextResponse } from "next/server";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { z } from "zod";
import { withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const ISSUER = "CantinApp";

// GET /api/auth/mfa — genera secreto + QR para el usuario autenticado
export const GET = withAuth(async (_req: NextRequest, session) => {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label:  session.user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const uri    = totp.toString();
  const qr     = await QRCode.toDataURL(uri);

  // Guardar secreto temporal (sin activar MFA todavía)
  await db.usuario.update({
    where: { id: session.user.id },
    data: { mfaSecret: secret },
  });

  return NextResponse.json({ secret, qr });
});

// POST /api/auth/mfa — verifica código y activa MFA
const verifySchema = z.object({ code: z.string().length(6) });

export const POST = withAuth(async (req: NextRequest, session) => {
  const { code } = await validateBody(req, verifySchema);

  const usuario = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { mfaSecret: true },
  });

  if (!usuario?.mfaSecret) {
    return NextResponse.json({ error: "Primero genera el código QR" }, { status: 400 });
  }

  const totp = new OTPAuth.TOTP({
    issuer:    ISSUER,
    label:     session.user.email,
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(usuario.mfaSecret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  await db.usuario.update({
    where: { id: session.user.id },
    data: { mfaHabilitado: true },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    "mfa_activado",
  });

  return NextResponse.json({ ok: true });
});

// DELETE /api/auth/mfa — desactiva MFA (requiere código de confirmación)
export const DELETE = withAuth(async (req: NextRequest, session) => {
  const { code } = await validateBody(req, verifySchema);

  const usuario = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { mfaSecret: true },
  });

  if (!usuario?.mfaSecret) {
    return NextResponse.json({ error: "MFA no está configurado" }, { status: 400 });
  }

  const totp = new OTPAuth.TOTP({
    issuer:    ISSUER,
    label:     session.user.email,
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(usuario.mfaSecret),
  });

  if (totp.validate({ token: code, window: 1 }) === null) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  await db.usuario.update({
    where: { id: session.user.id },
    data: { mfaHabilitado: false, mfaSecret: null },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId: session.user.cantinaId ?? undefined,
    evento:    "mfa_desactivado",
  });

  return NextResponse.json({ ok: true });
});
