import { getSession } from "@/lib/auth";
import { Session } from "next-auth";
import { Rol } from "@/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "@/lib/validate";

export class ForbiddenError extends Error {
  status = 403;
  constructor() { super("Sin permisos"); }
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor() { super("No autenticado"); }
}

/**
 * Verifica que la sesión tenga uno de los roles permitidos.
 * Acepta la sesión como primer argumento para evitar múltiples llamadas a getSession().
 */
export function requireRole(session: Session, ...roles: Rol[]): void {
  if (!roles.includes(session.user.rol as Rol)) throw new ForbiddenError();
}

type AuthHandler<C = unknown> = (
  req: NextRequest,
  session: Session,
  ctx: C
) => Promise<Response>;

/**
 * Wrapper para Route Handlers: obtiene la sesión, la valida y la inyecta al handler.
 * Convierte UnauthorizedError / ForbiddenError en respuestas HTTP.
 * Nunca expone stack traces al cliente.
 */
export function withAuth<C = unknown>(handler: AuthHandler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      const session = await getSession();
      if (!session) throw new UnauthorizedError();
      return await handler(req, session, ctx);
    } catch (e) {
      if (e instanceof UnauthorizedError)
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      if (e instanceof ForbiddenError)
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      if (e instanceof ValidationError)
        return NextResponse.json({ error: "Input inválido", issues: e.issues }, { status: 400 });
      console.error("[withAuth] unhandled error:", e);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  };
}
