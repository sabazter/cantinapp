import { db } from "@/lib/db";
import { headers } from "next/headers";

interface AuditParams {
  usuarioId?: string;
  cantinaId?: string;
  evento: string;
  entidad?: string;
  entidadId?: string;
  datos?: Record<string, string | number | boolean | null>;
}

/**
 * Registra un evento en la tabla audit_logs.
 * Nunca debe lanzar — los errores de auditoría no deben interrumpir el flujo de negocio.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
      headersList.get("x-real-ip") ??
      "unknown";
    const userAgent = headersList.get("user-agent") ?? undefined;

    await db.auditLog.create({
      data: {
        usuarioId: params.usuarioId,
        cantinaId: params.cantinaId,
        evento: params.evento,
        entidad: params.entidad,
        entidadId: params.entidadId,
        datos: params.datos ?? undefined,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[audit] Error al registrar evento:", err);
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
