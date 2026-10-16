import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { Rol } from "@/generated/prisma/enums";
import { dbSystem } from "@/lib/db";
import { clientIpFromRecord } from "@/lib/ip";
import { verificarBloqueo, registrarIntento } from "@/lib/brute-force";
import { audit, AuditEvent } from "@/lib/audit";

// ── Type augmentation ────────────────────────────────────────────────────────

declare module "next-auth" {
  interface User {
    id: string;
    rol: Rol;
    cantinaId: string | null;
  }
  interface Session {
    user: {
      id: string;
      nombre: string;
      email: string;
      rol: Rol;
      cantinaId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    cantinaId: string | null;
    nombre: string;
  }
}

// ── RS256 helpers ─────────────────────────────────────────────────────────────

let _privateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;
let _publicKey:  Awaited<ReturnType<typeof importSPKI>>  | null = null;

async function getPrivateKey() {
  if (!_privateKey) {
    const pem = process.env.NEXTAUTH_PRIVATE_KEY!.replace(/\\n/g, "\n");
    _privateKey = await importPKCS8(pem, "RS256");
  }
  return _privateKey;
}

async function getPublicKey() {
  if (!_publicKey) {
    const pem = process.env.NEXTAUTH_PUBLIC_KEY!.replace(/\\n/g, "\n");
    _publicKey = await importSPKI(pem, "RS256");
  }
  return _publicKey;
}

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutos

// ── NextAuth options ──────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: ACCESS_TOKEN_TTL },
  pages: { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Contraseña", type: "password" },
        totp:     { label: "Código MFA", type: "text"     },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = clientIpFromRecord(
          req?.headers as Record<string, string | string[] | undefined> | undefined
        );

        try {
          // Verificar bloqueo por fuerza bruta
          const bloqueo = await verificarBloqueo(credentials.email);
          if (bloqueo.bloqueado) {
            const errorCode = bloqueo.permanente
              ? "bloqueado_permanente"
              : "bloqueado_temporal";
            throw new Error(errorCode);
          }
        } catch (err) {
          const msg = (err as Error).message;
          if (msg === "bloqueado_permanente" || msg === "bloqueado_temporal") throw err;
          console.error("[auth] verificarBloqueo error:", err);
          // Continuar si el error es de BD (no bloquear al usuario por fallo de tabla)
        }

        let usuario: {
          id: string; cantinaId: string | null; nombre: string; email: string;
          hashPwd: string; rol: Rol; activo: boolean; mfaHabilitado: boolean; mfaSecret: string | null;
        } | null = null;
        try {
          usuario = await dbSystem.usuario.findUnique({
            where: { email: credentials.email },
            select: {
              id: true, cantinaId: true, nombre: true, email: true, hashPwd: true,
              rol: true, activo: true, mfaHabilitado: true, mfaSecret: true,
            },
          });
        } catch (err) {
          console.error("[auth] findUnique error:", err instanceof Error ? err.message : err);
          return null;
        }

        const ok =
          !!usuario &&
          usuario.activo &&
          (await bcrypt.compare(credentials.password, usuario.hashPwd));

        try {
          await registrarIntento(credentials.email, ip, ok);
        } catch (err) {
          console.error("[auth] registrarIntento error:", err);
        }

        if (!ok) {
          await audit({
            evento: AuditEvent.LOGIN_FAIL,
            datos: { email: credentials.email },
          });
          return null;
        }

        // Verificar MFA si está habilitado
        if (usuario!.mfaHabilitado && usuario!.mfaSecret) {
          if (!credentials.totp) throw new Error("mfa_required");

          const totp = new OTPAuth.TOTP({
            issuer:    "CantinApp",
            label:     usuario!.email,
            algorithm: "SHA1",
            digits:    6,
            period:    30,
            secret:    OTPAuth.Secret.fromBase32(usuario!.mfaSecret),
          });

          if (totp.validate({ token: credentials.totp, window: 1 }) === null) {
            await audit({
              usuarioId: usuario!.id,
              cantinaId: usuario!.cantinaId ?? undefined,
              evento:    AuditEvent.LOGIN_FAIL,
              datos:     { email: credentials.email, razon: "totp_invalido" },
            });
            throw new Error("mfa_invalid");
          }
        }

        await audit({
          usuarioId: usuario!.id,
          cantinaId: usuario!.cantinaId ?? undefined,
          evento: AuditEvent.LOGIN_OK,
        });

        return {
          id: usuario!.id,
          email: usuario!.email,
          name: usuario!.nombre,
          rol: usuario!.rol,
          cantinaId: usuario!.cantinaId,
        };
      },
    }),
  ],

  jwt: {
    maxAge: ACCESS_TOKEN_TTL,

    async encode({ token }) {
      if (!token) return "";
      const privateKey = await getPrivateKey();
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
        .sign(privateKey);
    },

    async decode({ token }) {
      if (!token) return null;
      try {
        const publicKey = await getPublicKey();
        const { payload } = await jwtVerify(token, publicKey, {
          algorithms: ["RS256"],
        });
        return payload as JWT;
      } catch {
        return null;
      }
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.cantinaId = user.cantinaId;
        token.nombre = user.name ?? "";
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id,
        nombre: token.nombre,
        email: token.email ?? "",
        rol: token.rol,
        cantinaId: token.cantinaId,
      };
      return session;
    },
  },
};

export const getSession = () => getServerSession(authOptions);
