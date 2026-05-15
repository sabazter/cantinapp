import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { Rol } from "@/generated/prisma/enums";
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

async function getPrivateKey() {
  const pem = process.env.NEXTAUTH_PRIVATE_KEY!.replace(/\\n/g, "\n");
  return importPKCS8(pem, "RS256");
}

async function getPublicKey() {
  const pem = process.env.NEXTAUTH_PUBLIC_KEY!.replace(/\\n/g, "\n");
  return importSPKI(pem, "RS256");
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
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip =
          (req?.headers?.["x-forwarded-for"] as string)?.split(",")[0].trim() ??
          "unknown";

        // Verificar bloqueo por fuerza bruta
        const bloqueo = await verificarBloqueo(credentials.email);
        if (bloqueo.bloqueado) {
          const errorCode = bloqueo.permanente
            ? "bloqueado_permanente"
            : "bloqueado_temporal";
          throw new Error(errorCode);
        }

        const usuario = await db.usuario.findUnique({
          where: { email: credentials.email },
        });

        const ok =
          !!usuario &&
          usuario.activo &&
          (await bcrypt.compare(credentials.password, usuario.hashPwd));

        await registrarIntento(credentials.email, ip, ok);

        if (!ok) {
          await audit({
            evento: AuditEvent.LOGIN_FAIL,
            datos: { email: credentials.email },
          });
          return null;
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
