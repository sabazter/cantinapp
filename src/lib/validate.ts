import { z, ZodSchema } from "zod";
import { NextResponse } from "next/server";

export class ValidationError extends Error {
  status = 400;
  issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super("Input inválido");
    this.issues = issues;
  }
}

/**
 * Parsea y valida el body JSON de un Request contra un schema Zod.
 * Lanza ValidationError con los detalles si falla.
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError([
      { code: "custom", message: "Body JSON inválido", path: [] },
    ]);
  }

  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError(result.error.issues);
  return result.data;
}

/**
 * Wrapper de error para Route Handlers — responde 400 con detalle de Zod.
 */
export function withValidation(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
) {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ValidationError)
        return NextResponse.json(
          { error: "Input inválido", issues: e.issues },
          { status: 400 }
        );
      throw e;
    }
  };
}
