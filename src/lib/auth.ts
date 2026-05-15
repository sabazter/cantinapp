import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { Rol } from "@/generated/prisma/enums";

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

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await db.usuario.findUnique({
          where: { email: credentials.email },
        });

        if (!usuario || !usuario.activo) return null;

        const passwordOk = await bcrypt.compare(
          credentials.password,
          usuario.hashPwd
        );
        if (!passwordOk) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
          cantinaId: usuario.cantinaId,
        };
      },
    }),
  ],
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
