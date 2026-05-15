import { getSession } from "@/lib/auth";
import { Rol } from "@/generated/prisma/enums";
import { NextResponse } from "next/server";

export class ForbiddenError extends Error {
  status = 403;
  constructor() { super("Sin permisos"); }
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor() { super("No autenticado"); }
}

/**
 * Verifica que la sesión activa tenga uno de los roles permitidos.
 * Lanza UnauthorizedError o ForbiddenError si no cumple.
 */
export async function requireRole(...roles: Rol[]) {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  if (!roles.includes(session.user.rol as Rol)) throw new ForbiddenError();
  return session;
}

/**
 * Wrapper para Route Handlers que convierte errores de auth en respuestas HTTP.
 */
export function withAuth(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
) {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof UnauthorizedError)
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      if (e instanceof ForbiddenError)
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      throw e;
    }
  };
}
