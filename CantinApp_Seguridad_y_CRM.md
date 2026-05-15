# 🔐 CantinApp — Seguridad & CRM
## Especificación Técnica Complementaria
**República Bolivariana de Venezuela | Versión 1.0 | Mayo 2025**
**CONFIDENCIAL — Documento de uso interno del equipo de desarrollo**

---

> ⚠️ **Este documento es obligatorio para el desarrollo.** La app maneja datos de menores de edad, información financiera y credenciales de múltiples usuarios reales desde el día 1 de producción. Cada sección debe implementarse antes del primer despliegue público.

---

## Tabla de Contenidos

1. [Modelo de Amenazas](#1-modelo-de-amenazas)
2. [Autenticación y Gestión de Sesiones](#2-autenticación-y-gestión-de-sesiones)
3. [Autorización y Control de Acceso (RBAC)](#3-autorización-y-control-de-acceso-rbac)
4. [Protección de Endpoints (API Security)](#4-protección-de-endpoints-api-security)
5. [Seguridad de Datos](#5-seguridad-de-datos)
6. [Protección de Datos de Menores](#6-protección-de-datos-de-menores)
7. [Seguridad en la Capa de Infraestructura](#7-seguridad-en-la-capa-de-infraestructura)
8. [Auditoría y Logging](#8-auditoría-y-logging)
9. [Seguridad en Notificaciones](#9-seguridad-en-notificaciones)
10. [Plan de Respuesta a Incidentes](#10-plan-de-respuesta-a-incidentes)
11. [Módulo CRM](#11-módulo-crm-completo)
12. [Checklist de Seguridad Pre-Producción](#12-checklist-de-seguridad-pre-producción)

---

## 1. Modelo de Amenazas

Antes de definir controles, se identifican los vectores de ataque más relevantes para este sistema:

### 1.1 Actores de Amenaza

| Actor | Motivación | Riesgo |
|-------|-----------|--------|
| Vendedor deshonesto | Ocultar ventas, manipular fiado | Alto |
| Representante malintencionado | Ver datos de otros alumnos, disputar cobros | Medio |
| Atacante externo | Robo de datos personales de menores | Alto |
| Empleado ex-cantina | Acceso con credenciales vencidas | Medio |
| Script automatizado (bot) | Fuerza bruta, scraping de datos | Medio |

### 1.2 Superficie de Ataque

- API REST pública (endpoints de ventas, abonos, alumnos)
- Portal de representantes (acceso externo sin VPN)
- Scraping BCV (dependencia externa no controlada)
- Notificaciones WhatsApp/Email (posible intercepción o spoofing)
- Dispositivos compartidos en la cantina (sesiones abiertas)

### 1.3 Clasificación de Datos

| Categoría | Ejemplos | Nivel de Protección |
|-----------|---------|-------------------|
| **Crítico** | Contraseñas, tokens, datos bancarios de abonos | Cifrado en reposo + tránsito, acceso mínimo |
| **Sensible** | Nombre/cédula/foto del alumno, historial de compras | Cifrado en tránsito, acceso por rol |
| **Interno** | Inventario, reportes de ventas, tasas BCV | Acceso autenticado, logs de consulta |
| **Público** | Nombre de la cantina, menú del día | Sin restricción |

---

## 2. Autenticación y Gestión de Sesiones

### 2.1 Contraseñas

```
- Hashing: bcrypt con cost factor mínimo 12 (nunca MD5, SHA1 o SHA256 directo)
- Longitud mínima: 8 caracteres
- Requisitos: al menos 1 mayúscula, 1 número
- No almacenar contraseñas en texto plano en ningún log, error o variable de entorno visible
- Política de reset: token de un solo uso con expiración de 15 minutos, enviado al email registrado
```

### 2.2 Tokens JWT

```
- Access token: expiración 15 minutos
- Refresh token: expiración 7 días, rotación en cada uso
- Almacenamiento: access token en memoria (nunca localStorage); refresh token en cookie HttpOnly + Secure + SameSite=Strict
- Payload mínimo: { sub: userId, role, cantina_id, iat, exp } — nunca incluir datos sensibles
- Firma: algoritmo RS256 (asimétrico) — no HS256 en producción
- Invalidación: tabla de refresh tokens revocados en base de datos (blacklist)
```

### 2.3 Sesiones en Dispositivos Compartidos

La cantina usa dispositivos compartidos entre vendedores. Reglas obligatorias:

- Auto-logout por inactividad: **10 minutos** para el rol Vendedor
- Auto-logout por inactividad: **30 minutos** para el rol Administrador
- Botón de cierre de sesión visible y prominente en la UI
- Al cerrar sesión, limpiar todos los tokens en memoria y revocar el refresh token en el servidor
- Opción de "cerrar todas las sesiones activas" desde el panel del administrador

### 2.4 Autenticación Multi-Factor (MFA)

| Rol | MFA |
|-----|-----|
| Administrador / Dueño | **Obligatorio** — TOTP (Google Authenticator / Authy) |
| Vendedor | Opcional (recomendado) |
| Representante | Opcional — verificación por email en primer login |
| Directivo | Opcional |

### 2.5 Bloqueo por Intentos Fallidos

```
- Bloqueo temporal tras 5 intentos fallidos consecutivos: 15 minutos
- Bloqueo permanente tras 20 intentos fallidos: requiere desbloqueo manual por admin
- Rate limiting por IP en el endpoint /auth/login: máximo 10 requests/minuto
- Notificar al administrador por email si una cuenta es bloqueada
```

---

## 3. Autorización y Control de Acceso (RBAC)

### 3.1 Principio de Mínimo Privilegio

Cada rol accede **únicamente** a los recursos que necesita para operar. Ningún rol hereda permisos de otro por defecto.

### 3.2 Matriz de Permisos por Endpoint

| Recurso / Acción | Admin | Vendedor | Representante | Directivo |
|-----------------|-------|---------|--------------|----------|
| Ver inventario completo | ✅ | ✅ | ❌ | ❌ |
| Modificar inventario | ✅ | ❌ | ❌ | ❌ |
| Registrar venta | ✅ | ✅ | ❌ | ❌ |
| Anular venta | ✅ | ❌ | ❌ | ❌ |
| Ver cuenta de cualquier alumno | ✅ | ✅ (solo lectura) | ❌ | ✅ (solo deuda) |
| Ver cuenta de su propio hijo | ✅ | ❌ | ✅ | ❌ |
| Registrar fiado | ✅ | ✅ | ❌ | ❌ |
| Confirmar abonos | ✅ | ❌ | ❌ | ❌ |
| Reportar abono | ✅ | ✅ | ✅ (solo sus hijos) | ❌ |
| Ver reportes de ventas | ✅ | ❌ | ❌ | ❌ |
| Ver rendimiento de vendedores | ✅ | ❌ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ | ❌ |
| Ajustar tasa BCV | ✅ | ❌ | ❌ | ❌ |
| Acceder a datos de otra cantina | ❌ | ❌ | ❌ | ❌ |

### 3.3 Aislamiento Multi-Tenant

**Regla crítica:** Toda consulta a la base de datos que involucre datos operativos DEBE incluir `WHERE cantina_id = :cantina_id` obtenido del token JWT del usuario autenticado, nunca del request del cliente.

```typescript
// ❌ NUNCA así — el cliente controla el cantina_id
const ventas = await db.ventas.findMany({
  where: { cantina_id: req.body.cantina_id }
});

// ✅ SIEMPRE así — el cantina_id viene del token verificado
const { cantina_id } = req.user; // extraído del JWT en middleware
const ventas = await db.ventas.findMany({
  where: { cantina_id }
});
```

### 3.4 Validación de Propiedad de Recursos

Antes de cualquier operación sobre un recurso, verificar que pertenece al tenant del usuario:

```typescript
// Ejemplo: un representante solo puede ver a sus propios hijos
const alumno = await db.alumnos.findFirst({
  where: {
    id: req.params.alumno_id,
    representante_id: req.user.id,  // ← validación de propiedad
    cantina_id: req.user.cantina_id // ← validación de tenant
  }
});
if (!alumno) throw new ForbiddenError();
```

---

## 4. Protección de Endpoints (API Security)

### 4.1 Rate Limiting

Implementar rate limiting por IP y por usuario autenticado:

| Endpoint | Límite por IP | Límite por usuario |
|----------|-------------|-------------------|
| `POST /auth/login` | 10 req/min | — |
| `POST /auth/reset-password` | 3 req/15min | — |
| `GET /api/ventas` | 100 req/min | 200 req/min |
| `POST /api/ventas` | 60 req/min | 120 req/min |
| `POST /api/abonos` | 20 req/min | 30 req/min |
| `GET /api/bcv/tasa` | 5 req/min | 10 req/min |
| Cualquier endpoint autenticado | 300 req/min | 500 req/min |

**Librería recomendada:** `express-rate-limit` + `rate-limit-redis` (para persistencia entre instancias)

### 4.2 Validación y Sanitización de Input

**Regla:** Nunca confiar en datos del cliente. Validar y sanitizar todo antes de procesar.

```typescript
// Usar Zod para validación de esquemas en cada endpoint
import { z } from 'zod';

const VentaSchema = z.object({
  alumno_id: z.string().uuid(),
  productos: z.array(z.object({
    producto_id: z.string().uuid(),
    cantidad: z.number().int().positive().max(100),
  })).min(1).max(50),
  metodo_pago: z.enum(['efectivo_usd', 'efectivo_bs', 'pago_movil']),
  es_fiado: z.boolean(),
});

// Validar antes de cualquier lógica de negocio
const result = VentaSchema.safeParse(req.body);
if (!result.success) return res.status(400).json({ errors: result.error.issues });
```

Reglas adicionales:
- Sanitizar HTML en cualquier campo de texto libre (usar `DOMPurify` en frontend, `sanitize-html` en backend)
- Rechazar requests con `Content-Type` inesperado
- Limitar tamaño máximo del body: `1mb` por request (excepto upload de fotos: `5mb`)
- Validar formato y extensión de archivos subidos (fotos de alumnos): solo `jpg`, `png`, `webp`

### 4.3 Protección contra Ataques Comunes

**SQL Injection:**
- Usar ORM (Prisma o Drizzle) con queries parametrizadas — nunca concatenar strings SQL
- Nunca exponer errores de base de datos al cliente

**XSS (Cross-Site Scripting):**
- Escapar todo output en templates
- Content Security Policy (CSP) estricta en headers HTTP
- Cookies con `HttpOnly` — inaccesibles desde JavaScript

**CSRF (Cross-Site Request Forgery):**
- Tokens CSRF para formularios de mutación
- Validar header `Origin` en requests de API
- `SameSite=Strict` en cookies de sesión

**CORS:**
```typescript
// Solo permitir orígenes autorizados — nunca wildcard en producción
const corsOptions = {
  origin: [
    'https://cantinapp.vercel.app',
    'https://admin.cantinapp.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

**Headers de Seguridad HTTP** (usar `helmet` en Express):
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; ...
```

### 4.4 Protección de Endpoints de Scraping BCV

El scraper del BCV es un proceso interno — nunca debe ser invocable desde el exterior:

- El endpoint `/internal/bcv/actualizar` solo acepta requests desde `localhost` o IP interna
- Protegido con un `INTERNAL_API_KEY` en variable de entorno, nunca hardcodeado
- Ejecutado por un cron job del servidor, no por acción del usuario
- Si el scraping falla 3 veces consecutivas, alertar al admin y mantener la última tasa conocida

### 4.5 Manejo de Errores

```typescript
// ❌ NUNCA exponer detalles internos al cliente
res.status(500).json({ error: err.message, stack: err.stack }); // PELIGROSO

// ✅ Respuesta genérica al cliente, detalle solo en logs internos
logger.error('DB query failed', { error: err, userId: req.user?.id });
res.status(500).json({ error: 'Error interno del servidor. Intenta nuevamente.' });
```

Códigos de error estandarizados:
- `400` — Input inválido (con detalle de qué campo falló)
- `401` — No autenticado
- `403` — Sin permisos (sin revelar si el recurso existe)
- `404` — Recurso no encontrado
- `429` — Rate limit excedido
- `500` — Error interno (sin detalle)

---

## 5. Seguridad de Datos

### 5.1 Cifrado en Tránsito

- **TLS 1.2 mínimo, TLS 1.3 recomendado** en todos los endpoints
- Certificados SSL/TLS gestionados por Vercel/Railway (automáticos)
- Redirigir todo tráfico HTTP a HTTPS con código 301
- No usar HTTP en ningún entorno — ni siquiera en desarrollo local para pruebas de integración

### 5.2 Cifrado en Reposo

| Dato | Mecanismo |
|------|----------|
| Contraseñas | bcrypt (cost 12) |
| Números de referencia bancaria | AES-256-GCM cifrado en columna |
| Cédulas de alumnos | AES-256-GCM cifrado en columna |
| Fotos de alumnos | Almacenadas en Supabase Storage con URLs firmadas (tiempo de expiración) |
| Tokens de refresh | SHA-256 hash antes de almacenar en DB |
| Resto de datos | Cifrado a nivel de volumen del proveedor de hosting (Supabase/Railway) |

### 5.3 Variables de Entorno y Secretos

```bash
# ✅ Correcto — variables de entorno en el servidor
DATABASE_URL=postgresql://...
JWT_SECRET_PRIVATE_KEY=...
INTERNAL_API_KEY=...
TWILIO_AUTH_TOKEN=...

# ❌ NUNCA hacer esto
const secret = "mi_secreto_hardcodeado"; // en código fuente
console.log(process.env.JWT_SECRET); // en logs
```

- Usar `.env.local` para desarrollo (en `.gitignore`)
- En producción: variables de entorno en el dashboard de Vercel/Railway
- Rotar todos los secretos cada 90 días
- Nunca versionar archivos `.env` — ni en repositorios privados
- Escanear el repo con `git-secrets` o `truffleHog` antes de cada deploy

### 5.4 Backup y Recuperación

- Backup automático diario de la base de datos (Supabase lo incluye)
- Retención de backups: 30 días
- Prueba de restauración: una vez al mes en entorno de staging
- RTO (Recovery Time Objective): máximo 4 horas
- RPO (Recovery Point Objective): máximo 24 horas (pérdida aceptable de datos)

---

## 6. Protección de Datos de Menores

Este es el aspecto más crítico desde el punto de vista legal y ético. La app almacena nombres, cédulas, fotos y comportamiento de compra de menores de edad.

### 6.1 Principios Fundamentales

- **Minimización de datos:** recopilar únicamente lo estrictamente necesario para operar
- **Finalidad específica:** los datos del alumno solo se usan para gestionar su cuenta en la cantina
- **No comercialización:** los datos de alumnos y representantes nunca se comparten con terceros ni se usan para publicidad
- **Acceso restringido:** solo Admin y Vendedor (con limitaciones) acceden a datos de alumnos

### 6.2 Foto del Alumno

- La foto es **opcional**, nunca obligatoria
- Se almacena en Supabase Storage con bucket privado — no accesible públicamente
- Las URLs de acceso son firmadas y expiran en 1 hora
- Al eliminar un alumno del sistema, su foto se elimina del storage en la misma operación
- No se aplica reconocimiento facial ni procesamiento de imagen

### 6.3 Consentimiento del Representante

- Al registrar un alumno, el representante (o el admin en su nombre) debe aceptar explícitamente los términos de uso y la política de privacidad
- Registrar fecha, hora e IP del consentimiento en la base de datos
- El representante puede solicitar en cualquier momento: ver todos los datos almacenados de su hijo, corregir datos incorrectos, o eliminar la cuenta del alumno

### 6.4 Retención de Datos

| Dato | Retención |
|------|----------|
| Cuenta activa del alumno | Mientras esté matriculado |
| Historial de ventas/fiado | 2 años después de egreso |
| Fotos del alumno | Se eliminan al dar de baja al alumno |
| Logs de auditoría | 1 año |
| Datos de acceso de representantes | Hasta que soliciten eliminación |

### 6.5 Política de Privacidad

El sistema debe incluir una política de privacidad redactada en lenguaje claro que explique:
- Qué datos se recopilan y por qué
- Quién tiene acceso
- Cómo se protegen
- Cómo solicitar eliminación o corrección
- Que los datos nunca se venden ni comparten con terceros

---

## 7. Seguridad en la Capa de Infraestructura

### 7.1 Base de Datos (Supabase/PostgreSQL)

```sql
-- Nunca usar el rol público de Supabase para operaciones de la app
-- Crear un rol de aplicación con permisos mínimos

CREATE ROLE cantinapp_app LOGIN PASSWORD '...fuerte...';
GRANT SELECT, INSERT, UPDATE ON ventas, alumnos, productos TO cantinapp_app;
GRANT SELECT ON tasas_bcv TO cantinapp_app;
-- No GRANT DELETE en tablas críticas — usar soft delete (campo deleted_at)
-- No GRANT DROP, ALTER, TRUNCATE
```

- Row Level Security (RLS) habilitado en Supabase para todas las tablas
- Conexiones a DB solo desde el backend — nunca exponer la URL de DB al frontend
- Connection pooling con PgBouncer (incluido en Supabase)
- Queries lentas (>2s) monitoreadas y alertadas

### 7.2 Soft Delete — Nunca Eliminar Datos Financieros

```typescript
// ❌ NUNCA eliminar físicamente registros financieros
await db.ventas.delete({ where: { id } });

// ✅ Soft delete — marcar como eliminado, conservar el registro
await db.ventas.update({
  where: { id },
  data: { deleted_at: new Date(), deleted_by: req.user.id }
});
```

Todo registro de venta, fiado, abono y movimiento de inventario debe usar soft delete. Solo los datos no financieros (fotos, sesiones expiradas) se eliminan físicamente.

### 7.3 Entornos Separados

| Entorno | Propósito | Base de datos |
|---------|----------|--------------|
| `development` | Desarrollo local | DB local con datos ficticios |
| `staging` | Pruebas antes de deploy | DB separada, datos anonimizados |
| `production` | Usuarios reales | DB de producción, acceso restringido |

- **Nunca usar datos reales de alumnos en desarrollo o staging**
- Las variables de entorno de producción no deben ser accesibles al equipo de desarrollo
- El deploy a producción requiere aprobación explícita (no auto-deploy en cada push)

### 7.4 Dependencias y Supply Chain

- Auditar dependencias npm semanalmente: `npm audit`
- Usar `npm ci` (no `npm install`) en CI/CD para reproducibilidad
- Actualizar dependencias con vulnerabilidades críticas en máximo 48 horas
- Fijar versiones exactas en `package.json` (no usar `^` ni `~` en producción)
- Escanear con Snyk o Dependabot en el repositorio

---

## 8. Auditoría y Logging

### 8.1 Qué se Registra

Todo evento sensible debe quedar registrado en una tabla de auditoría inmutable:

| Evento | Datos registrados |
|--------|-----------------|
| Login exitoso | userId, IP, timestamp, user-agent |
| Login fallido | IP, timestamp, email intentado (nunca contraseña) |
| Venta registrada | vendedorId, alumnId, monto, método, tasa_bcv |
| Fiado otorgado | vendedorId, alumnId, monto, saldo anterior/nuevo |
| Abono confirmado | adminId, alumnId, monto, referencia |
| Abono rechazado | adminId, alumnId, motivo |
| Anulación de venta | adminId, ventaId, motivo |
| Cambio de contraseña | userId, IP, timestamp |
| Cambio de tasa BCV | adminId, tasa anterior, tasa nueva |
| Alta/baja de usuario | adminId, usuarioAfectado, rol |
| Acceso a datos de alumno | userId, alumnId, acción |

### 8.2 Reglas de Logging

```typescript
// ✅ Loguear así — estructurado, sin datos sensibles
logger.info('venta_registrada', {
  vendedor_id: '123',
  alumno_id: '456',
  monto_usd: 2.50,
  metodo: 'efectivo_usd',
  cantina_id: '789',
  timestamp: new Date().toISOString(),
});

// ❌ NUNCA loguear
logger.info(`Login: ${email} / ${password}`); // contraseña en log
logger.info(JSON.stringify(req.body)); // puede contener datos sensibles
```

- Los logs son de solo escritura para la aplicación — nunca modificables
- Retención de logs: 1 año
- Logs almacenados fuera de la aplicación (servicio externo: Logtail, Axiom o similar)
- Alertas automáticas en eventos críticos: múltiples logins fallidos, anulaciones masivas, cambios de tasa fuera de rango

### 8.3 Trazabilidad Financiera

Cada transacción monetaria debe poder auditarse completamente:

```
Venta #1234
├── Vendedor: Juan Pérez (ID: 456)
├── Alumno: Carlos López (ID: 789)
├── Productos: [Sandwich $1.50, Jugo $0.75]
├── Total: $2.25 USD / Bs 82.35
├── Tasa BCV aplicada: 36.60 (ID tasa: 99, fuente: automática)
├── Método: efectivo_usd
├── Timestamp: 2025-05-15T10:23:41Z
└── IP del vendedor: 192.168.1.5
```

---

## 9. Seguridad en Notificaciones

### 9.1 WhatsApp (Twilio / Meta Cloud API)

- El número de WhatsApp Business debe estar verificado ante Meta
- Nunca incluir datos bancarios completos en mensajes de WhatsApp
- Los mensajes de notificación no deben contener el saldo exacto de la deuda (solo "tiene deuda pendiente") — evitar ingeniería social
- Implementar opt-out: el representante puede desactivar notificaciones desde su portal
- Registrar en auditoría cada mensaje enviado (destinatario, tipo, timestamp) — sin el contenido completo

### 9.2 Email

- Usar dominio propio con registros SPF, DKIM y DMARC configurados — evitar que los emails caigan en spam o sean falsificables
- Links en emails de reset de contraseña: token de un solo uso, expiración 15 minutos, invalidar después de usar
- No incluir datos financieros sensibles en el cuerpo del email — redirigir al portal
- Verificar el email del representante al registrarse (código de confirmación)

### 9.3 Prevención de Abuso de Notificaciones

```
- Límite de notificaciones por representante: máximo 10 mensajes/día (WhatsApp)
- Cooldown entre el mismo tipo de notificación: mínimo 1 hora
- Si una dirección de email o número de WhatsApp rebota 3 veces, marcar como inválido y alertar al admin
```

---

## 10. Plan de Respuesta a Incidentes

### 10.1 Clasificación de Incidentes

| Nivel | Descripción | Tiempo de respuesta |
|-------|-------------|-------------------|
| 🔴 Crítico | Brecha de datos de alumnos, acceso no autorizado a producción, sistema caído | Inmediato (< 1 hora) |
| 🟠 Alto | Intento de acceso masivo, error en cálculo de fiado, falla de scraping BCV > 24h | < 4 horas |
| 🟡 Medio | Notificaciones fallando, reporte incorrecto, usuario bloqueado injustamente | < 24 horas |
| 🟢 Bajo | Bug de UI, lentitud puntual, error de validación menor | < 72 horas |

### 10.2 Protocolo ante Brecha de Datos

1. **Contener** — revocar todos los tokens activos, desactivar endpoints afectados
2. **Evaluar** — determinar qué datos fueron expuestos y a cuántos usuarios afecta
3. **Notificar** — informar a los administradores de las cantinas afectadas en máximo 72 horas
4. **Remediar** — parchear la vulnerabilidad, rotar todos los secretos
5. **Documentar** — registro completo del incidente para análisis post-mortem
6. **Revisar** — actualizar controles para prevenir recurrencia

### 10.3 Contactos de Emergencia

Definir antes del lanzamiento:
- Responsable técnico de guardia (con acceso a producción)
- Canal de comunicación de emergencia del equipo
- Credenciales de acceso de emergencia almacenadas en gestor de contraseñas (1Password, Bitwarden)

---

## 11. Módulo CRM Completo

### 11.1 Visión General

El CRM de CantinApp no es un CRM de ventas corporativo — es un sistema de inteligencia del negocio escolar que ayuda al dueño de la cantina a entender el comportamiento de sus clientes (alumnos y representantes), detectar patrones, y tomar decisiones operativas y financieras más inteligentes.

### 11.2 Perfil 360° del Alumno

Cada alumno tiene una ficha completa accesible para el administrador:

```
Alumno: Carlos López
├── Datos básicos: cédula, curso, sección, año de ingreso
├── Representante: María López (teléfono, email, relación)
├── Saldo actual: -$4.50 (en deuda)
├── Límite de fiado: sin límite / $10.00 (si se configura)
│
├── 📊 Comportamiento de compra
│   ├── Gasto promedio semanal: $3.20
│   ├── Frecuencia de visita: 4.2 días/semana
│   ├── Producto favorito: Empanada de queso (23 veces)
│   ├── Horario de compra típico: 7:00–7:30 AM
│   └── Método de pago preferido: fiado (68% de las compras)
│
├── 💳 Estado financiero
│   ├── Historial de deudas: 3 episodios en 6 meses
│   ├── Tiempo promedio de pago: 8 días
│   ├── Abonos recibidos: 5 (todos por Pago Móvil)
│   └── Calificación de pago: ⭐⭐⭐⭐ (pagador frecuente)
│
└── 🚦 Alertas activas
    ├── Deuda supera $5.00 (umbral configurado)
    └── No ha comprado en 3 días (inusual para este alumno)
```

### 11.3 Segmentación de Clientes

El administrador puede crear segmentos dinámicos de alumnos basados en criterios:

| Segmento | Criterio | Acción sugerida |
|----------|---------|----------------|
| **Buenos pagadores** | Deuda promedio < $2, pago en < 5 días | Ofrecerles mayor límite de fiado |
| **Deudores frecuentes** | Más de 2 episodios de deuda en 60 días | Notificación proactiva al representante |
| **Clientes frecuentes** | Más de 4 visitas/semana | Candidatos para beneficios o descuentos |
| **Clientes en riesgo** | Sin compras en más de 5 días hábiles | Verificar si hay problema (enfermedad, cambio de escuela) |
| **Alto valor** | Gasto semanal > $5 | Atención prioritaria |
| **Deuda antigua** | Deuda sin movimiento > 15 días | Requiere gestión urgente del representante |

Los segmentos se actualizan automáticamente cada noche (proceso cron).

### 11.4 Gestión de Representantes

El CRM también mantiene el perfil del representante como cliente indirecto:

- Historial de abonos: montos, métodos, frecuencia, puntualidad
- Canales de comunicación preferidos (WhatsApp vs Email)
- Registro de interacciones: cuándo fue notificado, si abrió el email, si respondió
- Múltiples hijos registrados bajo el mismo representante (vista familiar)
- Calificación de responsabilidad financiera (calculada automáticamente)
- Notas internas del administrador (campo de texto libre, no visible al representante)

### 11.5 Análisis de Comportamiento de Compra

**Por alumno:**
- Productos más comprados (top 5)
- Evolución del gasto mensual
- Días y horarios de mayor actividad
- Proporción efectivo vs fiado

**Por producto:**
- Volumen vendido por día/semana/mes
- Ingresos generados
- Correlación con inventario (cuándo se agota)
- Variación según día de la semana

**Por curso/sección:**
- Gasto promedio por sección
- Secciones con mayor deuda acumulada
- Horarios de pico por grado

**Por vendedor:**
- Ventas totales por turno
- Fiados otorgados vs cobros realizados
- Velocidad de atención (ventas por hora)
- Tasa de error en cobros (ventas anuladas)

### 11.6 Dashboard CRM del Administrador

Panel de control con métricas en tiempo real:

```
┌─────────────────────────────────────────────────────────────┐
│  HOY — Viernes 15 de mayo                    Tasa: Bs 36.60 │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Ventas hoy   │ Fiado hoy    │ Abonos hoy   │ Deuda total    │
│  $47.30      │  $12.50      │  $8.00       │  $234.80       │
│  ↑ 12%       │  3 alumnos   │  2 confirmados│  18 alumnos   │
├──────────────┴──────────────┴──────────────┴────────────────┤
│  ALERTAS                                                     │
│  🔴 5 alumnos con deuda > $10 sin movimiento en 10 días     │
│  🟡 Empanadas: stock en 3 unidades (mínimo: 10)             │
│  🟢 2 abonos pendientes de confirmación                     │
├─────────────────────────────────────────────────────────────┤
│  TENDENCIA SEMANAL          │  TOP PRODUCTOS HOY            │
│  [gráfica de barras]        │  1. Empanada queso   $14.00   │
│                             │  2. Jugo de naranja   $9.50   │
│                             │  3. Sandwich mixto    $7.50   │
└─────────────────────────────────────────────────────────────┘
```

### 11.7 Alertas Inteligentes del CRM

El sistema genera alertas automáticas basadas en reglas configurables:

| Alerta | Condición | Destinatario |
|--------|----------|-------------|
| Deuda crítica | Deuda > umbral configurado por admin | Admin + Representante |
| Alumno inactivo | Sin compras en N días hábiles (configurable) | Admin |
| Pico de fiado | Fiados del día > X% del total de ventas | Admin |
| Representante no responde | 3 notificaciones sin confirmación de abono | Admin |
| Producto estrella con stock bajo | Top 3 vendidos con stock < mínimo | Admin |
| Patrón de anulaciones | Vendedor con >3 anulaciones/semana | Admin |

### 11.8 Exportación y Reportes CRM

Reportes exportables en PDF y Excel:

- **Reporte de deudores:** lista completa con antigüedad, monto, datos de contacto del representante
- **Reporte de clientes frecuentes:** top alumnos por gasto y frecuencia
- **Reporte de comportamiento:** análisis de productos y horarios de venta
- **Reporte financiero por período:** ingresos, fiados, abonos, saldo neto
- **Reporte de vendedores:** rendimiento comparado por período
- **Estado de cuenta individual:** para entregar al representante como resumen mensual

### 11.9 Consideraciones de Privacidad en el CRM

El CRM maneja datos de comportamiento de menores — esto requiere controles adicionales:

- Los análisis de comportamiento se usan **exclusivamente** para operaciones de la cantina
- Los datos de segmentación no se exportan a sistemas externos
- El representante puede solicitar ver qué datos de comportamiento se almacenan sobre su hijo
- Los reportes que se exportan en PDF/Excel se generan con marca de agua "Confidencial" y la fecha
- Acceso al CRM restringido exclusivamente al rol Administrador

---

## 12. Checklist de Seguridad Pre-Producción

Antes del primer deploy con usuarios reales, verificar **cada ítem**:

### Autenticación y Acceso
- [ ] bcrypt con cost factor ≥ 12 implementado
- [ ] JWT RS256 configurado con access token 15min + refresh token HttpOnly
- [ ] MFA obligatorio para administradores
- [ ] Auto-logout por inactividad implementado (10 min vendedor, 30 min admin)
- [ ] Bloqueo tras 5 intentos fallidos funcionando
- [ ] Rate limiting en `/auth/login` activo

### API y Endpoints
- [ ] Middleware de autenticación en TODOS los endpoints protegidos
- [ ] Validación de `cantina_id` del JWT (no del request) en cada query
- [ ] Validación de esquemas con Zod en todos los endpoints de escritura
- [ ] Rate limiting global configurado
- [ ] Headers de seguridad HTTP configurados (helmet)
- [ ] CORS restringido a dominios autorizados
- [ ] Manejo de errores sin exponer stack traces al cliente

### Datos
- [ ] Columnas sensibles cifradas (cédulas, referencias bancarias)
- [ ] Fotos de alumnos en bucket privado con URLs firmadas
- [ ] Variables de entorno fuera del código fuente
- [ ] `.env` en `.gitignore` verificado
- [ ] Soft delete implementado en tablas financieras
- [ ] Backup automático configurado y probado

### Infraestructura
- [ ] HTTPS forzado, HTTP redirige a HTTPS
- [ ] TLS 1.2+ verificado
- [ ] RLS habilitado en Supabase
- [ ] Rol de DB con permisos mínimos configurado
- [ ] Entornos development/staging/production separados
- [ ] Dependencias auditadas (`npm audit` sin vulnerabilidades críticas)

### Auditoría y Monitoreo
- [ ] Tabla de auditoría implementada y funcionando
- [ ] Logs estructurados sin datos sensibles
- [ ] Alertas de eventos críticos configuradas
- [ ] Servicio externo de logs conectado

### CRM y Privacidad
- [ ] Política de privacidad redactada y visible en la app
- [ ] Consentimiento del representante registrado al crear alumno
- [ ] Acceso CRM restringido solo a administradores
- [ ] Mecanismo de solicitud de eliminación de datos implementado

### Pre-Lanzamiento
- [ ] Prueba de penetración básica realizada (al menos con OWASP ZAP)
- [ ] Revisión de código de seguridad por segundo par de ojos
- [ ] Plan de respuesta a incidentes documentado y comunicado al equipo
- [ ] Contactos de emergencia definidos y con acceso a producción verificado

---

*CantinApp — Documento de Seguridad y CRM © 2025*
*Confidencial — Solo para uso del equipo de desarrollo*
*Versión 1.0 | Mayo 2025*
