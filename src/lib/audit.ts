import { dbSystem } from "@/lib/db";
import { headers } from "next/headers";
import { clientIp } from "@/lib/ip";
import type { Prisma } from "@/generated/prisma/client";

interface AuditParams {
  usuarioId?: string;
  cantinaId?: string;
  evento: string;
  entidad?: string;
  entidadId?: string;
  datos?: Record<string, string | number | boolean | null>;
}

/**
 * Registra un evento en la tabla audit_logs (conexión de sistema, independiente de la
 * transacción del request: el rastro se conserva aunque el request se revierta).
 * Nunca debe lanzar — los errores de auditoría no deben interrumpir el flujo de negocio.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    const h = await headers();
    await dbSystem.auditLog.create({
      data: {
        usuarioId: params.usuarioId ?? null,
        cantinaId: params.cantinaId ?? null,
        evento: params.evento,
        entidad: params.entidad ?? null,
        entidadId: params.entidadId ?? null,
        datos: (params.datos ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: clientIp((n) => h.get(n)),
        userAgent: h.get("user-agent") ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Error al registrar evento:", err instanceof Error ? err.message : err);
  }
}

// Eventos predefinidos para consistencia
export const AuditEvent = {
  LOGIN_OK: "login_exitoso",
  LOGIN_FAIL: "login_fallido",
  LOGOUT: "logout",
  VENTA_CREADA: "venta_creada",
  VENTA_ANULADA: "venta_anulada",
  FIADO_REGISTRADO: "fiado_registrado",
  ABONO_CREADO: "abono_creado",
  ABONO_CONFIRMADO: "abono_confirmado",
  ABONO_RECHAZADO: "abono_rechazado",
  ALUMNO_CREADO: "alumno_creado",
  ALUMNO_CONSULTADO: "alumno_consultado",
  ALUMNO_ELIMINADO: "alumno_eliminado",
  INVENTARIO_AJUSTE: "inventario_ajuste",
  TASA_BCV_CAMBIADA: "tasa_bcv_cambiada",
  USUARIO_CREADO: "usuario_creado",
  USUARIO_DESACTIVADO: "usuario_desactivado",
  PASSWORD_CAMBIADO: "password_cambiado",
  SESIONES_REVOCADAS: "sesiones_revocadas",
} as const;
