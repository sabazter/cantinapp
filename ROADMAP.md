# CantinApp — Roadmap de Desarrollo

**Proyecto:** CantinApp v1.0 MVP  
**Stack:** Next.js 14 + Prisma 7 + Supabase + NextAuth  
**Refs:** `CantinApp_Especificacion_Tecnica (1).md` · `CantinApp_Seguridad_y_CRM.md`

> ⚠️ **El documento de Seguridad & CRM es OBLIGATORIO.** La app maneja datos de menores de edad e información financiera real desde el día 1. Ningún sprint de Fase 1 en adelante se considera terminado si viola una regla de seguridad del documento complementario.

---

## Estado Actual

> **Fase:** Fase 3 completada (2026-05-16). Iniciando Fase 4 (CRM).  
> **Completado hoy:** fiado_habilitado (campo + migración aplicada en Supabase), Sprints 3.2 (export PDF/Excel), 3.3 (superadmin), 3.4 (PWA offline + IndexedDB + Background Sync).  
> **Nota Supabase:** conexión PostgreSQL directa bloqueada — migrations se aplican vía Supabase dashboard SQL editor. `DATABASE_URL` = transaction pooler (6543), `DIRECT_URL` = session pooler (5432), ambos con `sslmode=require`.  
> **Deploy:** Docker en servidor privado. Imagen multi-stage con `output: standalone`.  
> **Next.js:** 16.2.6 (PP.23 ✅). RLS habilitado en todas las tablas (PP.20 ✅).

---

## Leyenda

| Símbolo | Significado |
|---------|------------|
| ✅ | Completado |
| 🔄 | En progreso |
| ⬜ | Pendiente |
| 🔴 | Bloqueante — no avanzar sin esto |
| ❌ | Cancelado |

---

## Fase 0 — Preparación del Entorno
**Duración:** 2–3 días | **Estado:** ✅ Completado (2026-05-15)

| # | Tarea | Estado |
|---|-------|--------|
| 0.1 | `git init` + `.gitignore` | ✅ |
| 0.2 | Next.js 14 con TypeScript + Tailwind | ✅ |
| 0.3 | shadcn/ui inicializado | ✅ |
| 0.4 | Prisma 7 + schema completo (12 modelos) | ✅ |
| 0.5 | NextAuth v4 con CredentialsProvider + JWT + 5 roles | ✅ |
| 0.6 | Middleware de protección de rutas por rol | ✅ |
| 0.7 | `.env.example` documentado | ✅ |
| 0.8 | Prisma generate sin errores TypeScript | ✅ |
| 0.9 | Conectar Supabase (DATABASE_URL + NEXT_PUBLIC_SUPABASE_URL) | ✅ |
| 0.10 | Tablas en Supabase + baseline migration en `_prisma_migrations` | ✅ |
| 0.11 | Dockerfile multi-stage + `.dockerignore` + `output: standalone` | ✅ |

---

## Fase 0.5 — Seguridad Fundacional
**Duración estimada:** 3–4 días | **Estado:** ✅ Completado (2026-05-15)  
**Referencia:** Secciones 2, 4 y 8 de `CantinApp_Seguridad_y_CRM.md`

> 🔴 **Bloqueante.** Esta fase debe completarse antes de escribir cualquier endpoint de negocio. Los patrones de seguridad establecidos aquí se aplican a todos los sprints posteriores.

### Autenticación segura
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 0.5.1 | Cambiar JWT a RS256: generar par de claves RSA, configurar en NextAuth | §2.2 | ✅ |
| 0.5.2 | Access token: 15 min. Refresh token: 7 días, cookie HttpOnly + Secure + SameSite=Strict | §2.2 | ✅ |
| 0.5.3 | Tabla `refresh_tokens` en Prisma (blacklist + rotación en cada uso) | §2.2 | ✅ |
| 0.5.4 | Auto-logout por inactividad: 10 min vendedor / 30 min admin (timer en cliente) | §2.3 | ✅ |
| 0.5.5 | Botón de cierre de sesión prominente + revocar refresh token en servidor | §2.3 | ✅ |
| 0.5.6 | Tabla `login_intentos` para bloqueo tras 5 intentos fallidos (15 min); bloqueo permanente a los 20 | §2.5 | ✅ |
| 0.5.7 | Rate limiting en `POST /api/auth/login`: 10 req/min por IP (Upstash Redis + `@upstash/ratelimit`) | §2.5 / §4.1 | ✅ |
| 0.5.8 | Notificar al admin por email cuando una cuenta es bloqueada | §2.5 | ✅ |

### API y validación
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 0.5.9 | Instalar Zod — crear helper `validateBody(schema)` para Route Handlers | §4.2 | ✅ |
| 0.5.10 | Helper `requireRole(...roles)` para verificar rol en server actions y Route Handlers | §3.2 | ✅ |
| 0.5.11 | Regla de aislamiento multi-tenant: `cantina_id` **siempre** del JWT, nunca del body | §3.3 | ✅ |
| 0.5.12 | Rate limiting global: 300 req/min por IP en cualquier endpoint autenticado | §4.1 | ✅ |
| 0.5.13 | Configurar headers de seguridad HTTP en `next.config.mjs` (CSP, HSTS, X-Frame, etc.) | §4.3 | ✅ |
| 0.5.14 | Manejo de errores centralizado: nunca exponer stack traces al cliente | §4.5 | ✅ |

### Auditoría
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 0.5.15 | Modelo `AuditLog` en Prisma (inmutable: sin UPDATE ni DELETE) | §8.1 | ✅ |
| 0.5.16 | Función `audit(event, data)` — registra userId, IP, timestamp, cantina_id | §8.2 | ✅ |
| 0.5.17 | Loguear login exitoso y login fallido (IP, timestamp, email — nunca contraseña) | §8.1 | ✅ |

### Schema — soft delete
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 0.5.18 | Añadir `deleted_at` + `deleted_by` a tablas financieras: `ventas`, `abonos`, `movimientos_inventario` | §7.2 | ✅ |
| 0.5.19 | Nunca usar `.delete()` en tablas financieras — solo `.update({ data: { deleted_at } })` | §7.2 | ✅ |

---

## Fase 1 — MVP Core
**Duración estimada:** 8–10 semanas | **Estado:** ✅ Completado (2026-05-15)

> Cada sprint asume que la Fase 0.5 está completada. Los helpers de seguridad (`validateBody`, `requireRole`, `audit`) se usan desde el primer endpoint.

### Sprint 1.1 — Autenticación y Gestión de Usuarios ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 1.1.1 | Página de login `/login` (email + contraseña) | — | ✅ |
| 1.1.2 | Lógica de login: verificar bloqueo, registrar intento, llamar NextAuth | §2.5 | ✅ |
| 1.1.3 | Página post-login: redirigir según rol al dashboard correspondiente | — | ✅ |
| 1.1.4 | Layout diferenciado por rol (sidebar con rutas permitidas) | — | ✅ |
| 1.1.5 | CRUD de usuarios — solo admin (`requireRole('admin')`) | §3.2 | ✅ |
| 1.1.6 | Hash bcrypt cost 12 al crear/editar usuario | §2.1 | ✅ |
| 1.1.7 | Flujo de reset de contraseña: token uso-único, expiración 15 min, email | §2.1 | ✅ |
| 1.1.8 | MFA TOTP obligatorio para rol `admin` (librería: `otpauth` + QR de setup) | §2.4 | ✅ |
| 1.1.9 | "Cerrar todas las sesiones activas" desde panel del admin | §2.3 | ✅ |

### Sprint 1.2 — Inventario (1.5 semanas) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 1.2.1 | CRUD de productos con Zod validation | §4.2 | ✅ |
| 1.2.2 | Categorías: tienda vs menú del día | — | ✅ |
| 1.2.3 | Control de stock y stock mínimo | — | ✅ |
| 1.2.4 | Alertas visuales de stock bajo | — | ✅ |
| 1.2.5 | Registro de entradas de mercancía (con audit log) | §8.1 | ✅ |
| 1.2.6 | Ajustes manuales de inventario con motivo (audit log) | §8.1 | ✅ |
| 1.2.7 | Historial de movimientos (`movimientos_inventario` con soft delete) | §7.2 | ✅ |
| 1.2.8 | Todos los endpoints: `cantina_id` del JWT | §3.3 | ✅ |

### Sprint 1.3 — Tasa BCV (3 días) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 1.3.1 | Scraping diario de `bcv.org.ve` con Cheerio | — | ✅ |
| 1.3.2 | Cron job (node-cron): ejecución 8:00 AM (UTC-4) via `instrumentation.ts` | — | ✅ |
| 1.3.3 | Endpoint `/internal/bcv/actualizar`: solo desde localhost, protegido con `INTERNAL_API_KEY` | §4.4 | ✅ |
| 1.3.4 | Si scraping falla 3 veces seguidas: mantener última tasa + alertar al admin | §4.4 | ✅ |
| 1.3.5 | Override manual de tasa por administrador (con audit log: tasa anterior, tasa nueva) | §8.1 | ✅ |
| 1.3.6 | Historial de tasas diarias | — | ✅ |
| 1.3.7 | Widget de tasa activa en barra de estado del POS | — | ⬜ (pendiente Sprint 1.5) |

### Sprint 1.4 — Alumnos y Cuentas (1.5 semanas) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 1.4.1 | CRUD de alumnos con Zod validation | §4.2 | ✅ |
| 1.4.2 | Foto del alumno: bucket privado Supabase Storage, URLs firmadas (exp. 1h) | §6.2 | ✅ |
| 1.4.3 | Cédula del alumno: cifrada con AES-256-GCM antes de guardar en DB | §5.2 | ✅ |
| 1.4.4 | Registro de consentimiento del representante: fecha, IP, timestamp en DB | §6.3 | ✅ |
| 1.4.5 | Al eliminar alumno: soft delete + eliminar foto del storage en la misma operación | §6.2 | ✅ |
| 1.4.6 | Cuenta corriente por alumno (saldo) | — | ✅ |
| 1.4.7 | Vista de deudas filtrable por curso, monto, antigüedad (solo admin/vendedor) | §3.2 | ⬜ (en POS) |
| 1.4.8 | Generación de código QR por alumno | — | ✅ |
| 1.4.9 | Audit log: acceso a datos de alumno (userId, alumnId, acción) | §8.1 | ✅ |

### Sprint 1.5 — Punto de Venta (2 semanas) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 1.5.1 | Búsqueda de producto por nombre/código | — | ✅ |
| 1.5.2 | Carrito de compra con cantidades editables | — | ✅ |
| 1.5.3 | Conversión USD → Bs en tiempo real (tasa BCV del día) | — | ✅ |
| 1.5.4 | Identificación de cliente por nombre o cédula | §5.2 | ✅ |
| 1.5.5 | Escaneo de código QR del alumno | — | ✅ (por ID) |
| 1.5.6 | Selección de método de pago (Efectivo USD, Efectivo Bs, Pago Móvil, Fiado) | — | ✅ |
| 1.5.7 | Validación Zod en `POST /api/ventas` (schema completo de venta) | §4.2 | ✅ |
| 1.5.8 | Verificar límite de fiado antes de otorgar | §3.2 | ✅ |
| 1.5.9 | Descuento automático de stock al confirmar venta | — | ✅ |
| 1.5.10 | Audit log completo de cada venta (vendedorId, alumnId, monto, tasa, IP) | §8.3 | ✅ |
| 1.5.11 | Anulación de venta: solo admin, soft delete, motivo obligatorio, audit log | §7.2 / §8.1 | ✅ |
| 1.5.12 | Generación de recibo digital (pantalla) | — | ✅ |

### Sprint 1.6 — Abonos y Cierre de Caja (1 semana) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 1.6.1 | Registro de abono presencial (vendedor/admin) con Zod | §4.2 | ✅ |
| 1.6.2 | Referencia bancaria: cifrada con AES-256-GCM en DB | §5.2 | ✅ |
| 1.6.3 | Confirmación de abono: solo admin, audit log | §3.2 / §8.1 | ✅ |
| 1.6.4 | Rechazo de abono: motivo obligatorio, audit log | §8.1 | ✅ |
| 1.6.5 | Cierre de caja diario (`GET /api/admin/caja`) | — | ✅ |
| 1.6.6 | Reporte básico: total vendido USD/Bs por método de pago | — | ✅ |

---

## Fase Pre-Producción — Checklist de Seguridad
**Duración estimada:** 1 semana | **Estado:** 🔄 En progreso (PP.20 y PP.23 completados)  
**Referencia:** Sección 12 de `CantinApp_Seguridad_y_CRM.md`

> 🔴 **Bloqueante absoluto.** Ningún usuario real accede al sistema sin completar esta fase.

| # | Ítem | Ref. |
|---|------|------|
| PP.1 | bcrypt cost ≥ 12 verificado en código | §2.1 |
| PP.2 | JWT RS256 con access token 15 min + refresh token HttpOnly | §2.2 |
| PP.3 | MFA TOTP funcionando para administradores | §2.4 |
| PP.4 | Auto-logout 10 min (vendedor) y 30 min (admin) probado | §2.3 |
| PP.5 | Bloqueo tras 5 intentos fallidos probado | §2.5 |
| PP.6 | Rate limiting `/auth/login` activo | §4.1 |
| PP.7 | Middleware `requireRole` en TODOS los endpoints protegidos | §3.2 |
| PP.8 | `cantina_id` del JWT (no del request) en cada query — revisión completa | §3.3 |
| PP.9 | Validación Zod en todos los endpoints de escritura | §4.2 |
| PP.10 | Rate limiting global configurado | §4.1 |
| PP.11 | Headers de seguridad HTTP verificados (CSP, HSTS, X-Frame) | §4.3 |
| PP.12 | CORS restringido a dominios autorizados en producción | §4.3 |
| PP.13 | Errores internos: sin stack traces al cliente | §4.5 |
| PP.14 | Columnas sensibles cifradas (cédulas, referencias bancarias) | §5.2 |
| PP.15 | Fotos de alumnos: bucket privado + URLs firmadas (expiración 1h) | §6.2 |
| PP.16 | `.env` y `.env.local` fuera del repositorio verificado | §5.3 |
| PP.17 | Soft delete en tablas financieras (no `.delete()` en ventas/abonos) | §7.2 |
| PP.18 | Backup automático Supabase configurado y probado | §5.4 |
| PP.19 | HTTPS forzado, HTTP redirige 301 | §5.1 |
| PP.20 | RLS habilitado en Supabase para todas las tablas | §7.1 | ✅ |
| PP.21 | Rol de DB con permisos mínimos (no usar rol público) | §7.1 |
| PP.22 | Entornos dev/staging/production separados, sin datos reales en dev | §7.3 |
| PP.23 | `npm audit` sin vulnerabilidades críticas (Next.js actualizado a 16.2.6) | §7.4 | ✅ |
| PP.24 | Tabla de auditoría funcionando (eventos financieros y de acceso) | §8.1 |
| PP.25 | Logs sin datos sensibles, servicio externo conectado (Logtail/Axiom) | §8.2 |
| PP.26 | Política de privacidad redactada y visible en la app | §6.5 |
| PP.27 | Consentimiento del representante registrado al crear alumno | §6.3 |
| PP.28 | Prueba de penetración básica con OWASP ZAP | §12 |
| PP.29 | Plan de respuesta a incidentes documentado y contactos definidos | §10.3 |
| PP.30 | Revisión de código de seguridad por segundo par de ojos | §12 |

---

## Fase 2 — Portal Representantes y Notificaciones
**Duración estimada:** 4–5 semanas | **Estado:** 🔄 En progreso (Sprints 2.1–2.3 completados)

### Sprint 2.1 — Portal del Representante (1.5 semanas) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 2.1.1 | Vista de saldo y deuda del alumno (solo sus propios hijos) | §3.4 | ✅ |
| 2.1.2 | Historial de compras: sin exponer datos de otros alumnos | §3.4 | ✅ |
| 2.1.3 | Formulario de reporte de abono (Zod, tamaño máx. comprobante: 5 MB, solo jpg/png/webp) | §4.2 | ✅ |
| 2.1.4 | Verificación de email del representante al registrarse (código de confirmación) | §9.2 | ⬜ |
| 2.1.5 | Soporte para representante con múltiples hijos | — | ✅ |
| 2.1.6 | Opt-out de notificaciones desde el portal | §9.1 | ⬜ |
| 2.1.7 | Mecanismo de solicitud de eliminación de datos desde el portal | §6.3 | ⬜ |

### Sprint 2.2 — Notificaciones Email (1 semana) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 2.2.1 | Integración Resend API | — | ✅ |
| 2.2.2 | Configurar SPF, DKIM y DMARC en el dominio | §9.2 | ⬜ (config DNS externa) |
| 2.2.3 | Email al registrar fiado (sin datos financieros en cuerpo — redirigir al portal) | §9.2 | ✅ |
| 2.2.4 | Email al confirmar abono | — | ✅ |
| 2.2.5 | Email de stock bajo al admin | — | ✅ |
| 2.2.6 | Resumen diario de ventas al admin | — | ✅ |
| 2.2.7 | Links de reset de contraseña: token uso-único, exp. 15 min, invalidar tras usar | §9.2 | ✅ |

### Sprint 2.3 — Notificaciones WhatsApp (1 semana) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 2.3.1 | Integración Twilio WhatsApp API (número verificado ante Meta) | §9.1 | ✅ |
| 2.3.2 | Mensaje al registrar fiado (sin saldo exacto en el mensaje) | §9.1 | ✅ |
| 2.3.3 | Mensaje al confirmar abono | — | ✅ |
| 2.3.4 | Alerta de deuda alta al representante | — | ✅ |
| 2.3.5 | Rate limit de notificaciones: máx. 10 mensajes/día por representante, cooldown 1h por tipo | §9.3 | ✅ |
| 2.3.6 | Si rebota 3 veces: marcar como inválido y alertar al admin | §9.3 | ✅ |
| 2.3.7 | Audit log de cada mensaje enviado (destinatario, tipo, timestamp — sin contenido) | §9.1 | ✅ |

### Sprint 2.4 — Mejoras POS (1 semana) ✅ Completado (2026-05-15)
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 2.4.1 | Generación de recibo PDF | — | ✅ |
| 2.4.2 | Menú del día con precio variable por jornada | — | ✅ |
| 2.4.3 | Límite de fiado configurable por alumno | — | ✅ |
| 2.4.4 | Campo `fiado_habilitado`: el fiado se habilita manualmente por admin, no es automático | — | ✅ |

---

## Fase 3 — Reportes Avanzados y Multi-sede
**Duración estimada:** 4–5 semanas | **Estado:** ✅ Completado (2026-05-16)

### Sprint 3.1 — Dashboard y Estadísticas (1.5 semanas) ✅ Completado (2026-05-15)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 3.1.1 | Gráficas de ventas con Recharts | — | ✅ |
| 3.1.2 | Ranking de productos más vendidos | — | ✅ |
| 3.1.3 | Rendimiento por vendedor (solo visible para admin) | §3.2 | ✅ |
| 3.1.4 | Vista de deudas por antigüedad | — | ✅ |

### Sprint 3.2 — Exportación (1 semana) ✅ Completado (2026-05-16)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 3.2.1 | Exportar reportes a PDF con marca de agua "Confidencial" + fecha | §11.9 | ✅ |
| 3.2.2 | Exportar reportes a Excel | — | ✅ |
| 3.2.3 | Los reportes exportados incluyen solo los datos del tenant del usuario | §3.3 | ✅ |

### Sprint 3.3 — Multi-tenant (1.5 semanas) ✅ Completado (2026-05-16)
| # | Tarea | Seg. | Estado |
|---|-------|------|--------|
| 3.3.1 | Panel superadmin para gestionar cantinas | — | ✅ |
| 3.3.2 | Subdominio o slug por cantina | — | ✅ |
| 3.3.3 | RLS en Supabase: cada fila visible solo para su cantina | §7.1 | ✅ |
| 3.3.4 | Aislamiento total: ninguna query cruza `cantina_id` | §3.3 | ✅ |

### Sprint 3.4 — PWA Offline (1 semana) ✅ Completado (2026-05-16)
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 3.4.1 | Service Worker con caché de catálogo | — | ✅ |
| 3.4.2 | Cola de ventas en IndexedDB sin internet | — | ✅ |
| 3.4.3 | Sincronización automática al restaurar conexión (Background Sync) | — | ✅ |
| 3.4.4 | Indicador visual de estado de conexión (pill flotante) | — | ✅ |

---

## Fase 4 — Módulo CRM
**Duración estimada:** 5–6 semanas | **Estado:** ✅ Completado (2026-05-16)  
**Referencia:** Sección 11 de `CantinApp_Seguridad_y_CRM.md`

> Acceso CRM restringido exclusivamente al rol **Administrador**. Los análisis de comportamiento se usan solo para operaciones de la cantina, nunca para publicidad ni se exportan a sistemas externos.

### Sprint 4.1 — Perfil 360° del Alumno (1.5 semanas) ✅ Completado (2026-05-16)
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 4.1.1 | Ficha completa: datos básicos, representante, saldo, límite de fiado | §11.2 | ✅ |
| 4.1.2 | Métricas de comportamiento: gasto promedio semanal, frecuencia, producto favorito, horario típico | §11.2 | ✅ |
| 4.1.3 | Estado financiero: historial de deudas, calificación de pagador | §11.2 | ✅ |
| 4.1.4 | Alertas activas del alumno en la ficha (deuda alta, inactividad, límite cercano) | §11.2 | ✅ |
| 4.1.5 | API `/api/admin/crm/alumno/[id]` + página `/admin/crm/[id]` | §11.9 | ✅ |

### Sprint 4.2 — Segmentación de Clientes (1 semana) ✅ Completado (2026-05-16)
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 4.2.1 | Motor de segmentación: 8 segmentos (buenos pagadores, deudores, frecuentes, en riesgo, alto valor, deuda antigua, inactivos, nuevos) | §11.3 | ✅ |
| 4.2.2 | API `/api/admin/crm/segmentos` con filtro por segmento | §11.3 | ✅ |
| 4.2.3 | Página `/admin/crm` con chips de segmento, tabla filtrable y acceso a perfil 360° | §11.3 | ✅ |

### Sprint 4.3 — Perfil del Representante (1 semana) ✅ Completado (2026-05-16)
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 4.3.1 | Historial de abonos: montos, métodos, confirmados vs rechazados | §11.4 | ✅ |
| 4.3.2 | Canal preferido (WhatsApp vs Email) + conteo de notificaciones | §11.4 | ✅ |
| 4.3.3 | Vista familiar: todos los hijos con saldo y link a perfil 360° | §11.4 | ✅ |
| 4.3.4 | Calificación de responsabilidad financiera (excelente/buena/regular/baja) | §11.4 | ✅ |
| 4.3.5 | Notas internas del admin (campo `notas_crm`, no visible al representante) | §11.4 | ✅ |
| 4.3.6 | API `/api/admin/crm/representante/[id]` + PUT `/notas` | §11.4 | ✅ |

### Sprint 4.4 — Dashboard CRM y Alertas Inteligentes (1 semana) ✅ Completado (2026-05-16)
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 4.4.1 | Dashboard CRM: ventas hoy, fiado hoy, abonos hoy, deuda total, alertas activas | §11.6 | ✅ |
| 4.4.2 | Tendencia semanal (gráfica Recharts) + top 5 productos del día | §11.6 | ✅ |
| 4.4.3 | Alertas: deuda crítica, inactividad, pico de fiado | §11.7 | ✅ |
| 4.4.4 | Análisis por producto / curso / vendedor con selector de período | §11.5 | ✅ |

### Sprint 4.5 — Reportes CRM PDF/Excel (1 semana) ✅ Completado (2026-05-16)
| # | Tarea | Ref. | Estado |
|---|-------|------|--------|
| 4.5.1 | Reporte de deudores CRM (PDF con marca de agua "Confidencial" + Excel) | §11.8 | ✅ |
| 4.5.2 | Reporte de clientes frecuentes (PDF + Excel) | §11.8 | ✅ |
| 4.5.3 | Estado de cuenta individual mensual (PDF por alumno) | §11.8 | ✅ |
| 4.5.4 | Funciones exportables en `src/lib/export.ts` | §11.9 | ✅ |

---

## Decisiones Pendientes

Antes de finalizar Fase 1, definir:

1. ¿Impresión de recibos físicos? ¿Con impresora térmica?
2. ¿Menú del día tiene precio fijo o varía por jornada?
3. ¿Cuenta por familia o por alumno para representantes?
4. ¿Resumen automático de deudas semanal/mensual a todos los representantes?
5. ¿Categorías de descuento (ej. niños becados)?
6. ¿Integración con sistema de matrículas o base de alumnos independiente?
7. ¿Quién cubre hosting y APIs (WhatsApp, email, Redis)?

---

## Resumen de Fases

| Fase | Descripción | Duración | Estado |
|------|-------------|----------|--------|
| 0 | Setup del entorno | 2–3 días | ✅ |
| 0.5 | Seguridad fundacional | 3–4 días | ✅ |
| 1 | MVP Core (POS, inventario, fiado, BCV) | 8–10 sem | ✅ |
| PP | Checklist pre-producción (30 ítems) | 1 sem | 🔄 (PP.20, PP.23 ✅) |
| 2 | Portal representantes + notificaciones | 4–5 sem | ✅ |
| 3 | Reportes avanzados + multi-sede + PWA offline | 4–5 sem | ✅ |
| 4 | CRM completo | 5–6 sem | ✅ |
