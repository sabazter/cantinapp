import { getSession } from "@/lib/auth";
import { Session } from "next-auth";
import { Rol } from "@/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError } from "@/lib/validate";
import { RollbackResponse, runWithTenant } from "@/lib/db";
import { aplicarLimites } from "@/lib/rate-limit";

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
 *
 * El handler corre dentro de UNA transacción de Postgres con el contexto de tenant fijado
 * (Row-Level Security): si lanza una excepción o responde con status >= 400, se revierte
 * todo lo escrito con `db`. Nunca expone stack traces al cliente.
 */
export function withAuth<C = unknown>(handler: AuthHandler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      const limitado = await aplicarLimites(req, "global");
      if (limitado) return limitado;

      const session = await getSession();
      if (!session) throw new UnauthorizedError();

      return await runWithTenant(
        { cantinaId: session.user.cantinaId, rol: session.user.rol, userId: session.user.id },
        async () => {
          const res = await handler(req, session, ctx);
          if (res.status >= 400) throw new RollbackResponse(res);
          return res;
        }
      );
    } catch (e) {
      if (e instanceof RollbackResponse) return e.response;
      if (e instanceof UnauthorizedError)
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      if (e instanceof ForbiddenError)
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      if (e instanceof ValidationError)
        return NextResponse.json({ error: "Input inválido", issues: e.issues }, { status: 400 });
      console.error("[withAuth] unhandled error:", e instanceof Error ? e.message : "desconocido");
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  };
}
