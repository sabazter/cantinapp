# Migración Supabase → PostgreSQL propio + Redis

**Rama:** `migracion-postgres-redis` · **Estado:** probada en local, **sin desplegar**.

## Qué cambió

| Área | Antes | Ahora |
|---|---|---|
| Base de datos | Supabase (REST, `service_role`) | PostgreSQL 17 en el compose (volumen `cantinapp_pgdata`) |
| Acceso a datos | `supabase-js` (~49 archivos) | Prisma 7 + `pg` en todo el código |
| Esquema | 2 migraciones incompletas + `apply_schema.mjs` | 2 migraciones de Prisma (`init`, `rls_permisos`); `prisma migrate deploy` al arrancar |
| Aislamiento entre cantinas | Solo filtros en las queries | **RLS de Postgres** (deny-all) + filtros en las queries |
| Rate limiting | Definido y nunca invocado (Upstash) | `rate-limiter-flexible` sobre Redis, cableado en login, registro, recuperar contraseña y global |
| Archivos (fotos, comprobantes) | Supabase Storage | Volumen privado `cantinapp_uploads`, servido solo con sesión |
| Ventas | Lectura → cálculo → escritura sin transacción | Transacción por request + `UPDATE … WHERE stock >= n` + `FOR UPDATE` en fiado |

## Roles de Postgres

| Rol | Uso | RLS |
|---|---|---|
| `cantinapp` | Dueño del esquema. **Solo** el servicio `migrate` | — |
| `cantinapp_app` | Rutas API autenticadas (`db`) | Sujeto (contexto `app.cantina_id`, `app.rol`, `app.user_id`) |
| `cantinapp_system` | Login, registro, recuperación, cron, auditoría (`dbSystem`) | `BYPASSRLS`, sin DDL ni DELETE |

El contenedor de la app **no recibe** credenciales de superusuario. `cantinapp_app` no puede hacer `DELETE` sobre ventas, abonos, movimientos ni auditoría; `audit_logs` además tiene un trigger que rechaza `UPDATE`, `DELETE` y `TRUNCATE`.

## Cómo funciona `db`

`withAuth` abre **una transacción por request**, fija el contexto de RLS con `set_config(..., true)` y ejecuta el handler dentro. Si el handler lanza o responde con status ≥ 400, **se revierte todo**. Fuera de `withAuth`, `db` lanza un error (falla cerrado): las rutas públicas deben usar `dbSystem`.

Dentro de una misma request las consultas deben ir **en serie** (no `Promise.all` sobre `db`): comparten la conexión de la transacción.

## Archivos de entorno (dos, a propósito)

| Archivo | Lo lee | Contenido |
|---|---|---|
| `.env` | `docker compose` (sustitución de variables) | `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `SYSTEM_DB_PASSWORD`, `REDIS_PASSWORD` |
| `.env.app` | el contenedor `cantinapp` (`env_file`) | `NEXTAUTH_*`, `ENCRYPTION_KEY`, `INTERNAL_API_KEY`, `TRUST_PROXY`, Resend/Twilio |

La app **nunca** recibe las contraseñas de Postgres ni de Redis como variables sueltas: solo las URLs de su rol (`DATABASE_URL`, `DATABASE_SYSTEM_URL`, `REDIS_URL`), que inyecta `docker-compose.yml`. Ver `.env.example` y `.env.app.example`. Se eliminan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `DIRECT_URL`.

> `TRUST_PROXY=false` (sin proxy): las cabeceras `x-forwarded-for` se ignoran porque cualquiera puede falsificarlas. El límite por IP funciona como un cupo común; el login además se limita por email.

## Checklist de salida a producción (20 puntos)

| # | Punto | Estado |
|---|---|---|
| 1 | Ocultar API keys | ✅ Solo en `.env`/`.env.app` (fuera de git y de la imagen); sin llaves en el código |
| 2 | Eliminar secretos de Git | ✅ Historial sin llaves ni `.env`; scripts con la `service_role` borrados (nunca se versionaron) |
| 3 | Key pública para DB | ✅ N/A: ya no hay cliente de BD en el navegador ni `anon key` |
| 4 | Row-Level Security | ✅ Deny-all + políticas por cantina y por rol, `FORCE`, 3 roles de Postgres |
| 5 | Encriptar datos sensibles | ✅ AES-256-GCM en cédulas y referencias (falla cerrado). ⚠️ `mfa_secret` aún en claro |
| 6 | Forzar autenticación | ✅ `withAuth` en todas las rutas privadas + middleware en páginas |
| 7 | Restringir acceso a registros | ✅ RLS + filtros en la query; representantes solo ven a sus hijos |
| 8 | Bloquear manipulación de campos | ✅ Zod con campos explícitos; `cantina_id` siempre del JWT; `representanteId` validado contra la cantina |
| 9 | Proteger cookies de sesión | ✅ HttpOnly + SameSite=Strict. ⚠️ `Secure` solo con HTTPS (ver 19) |
| 10 | Hashear contraseñas | ✅ bcrypt cost 12 |
| 11 | Rate limiting | ✅ Redis: login, registro, recuperar contraseña y global |
| 12 | Protección contra bots | ❌ Sin CAPTCHA/Turnstile (solo rate limiting) |
| 13 | Parametrizar queries | ✅ Prisma y `$queryRaw` con parámetros |
| 14 | Validar inputs | ✅ Zod en escritura; magic bytes en archivos |
| 15 | Sanitizar contenido | ✅ React escapa la UI; plantillas de correo con `esc()` |
| 16 | Restringir archivos | ✅ jpg/png/webp por contenido, 5 MB, volumen privado servido con sesión |
| 17 | Devolver solo datos necesarios | ✅ `select` explícito; la cédula cifrada nunca sale en listas |
| 18 | Security headers | ✅ XFO, nosniff, HSTS, Referrer, Permissions-Policy (cámara solo propia). ⚠️ CSP aún con `unsafe-inline`/`unsafe-eval` |
| 19 | Forzar HTTPS | ❌ Sin proxy ni TLS el sitio va por HTTP: las cookies viajan en claro por la red local. Recomendado: `tailscale serve` o Caddy con certificado |
| 20 | Escanear dependencias | ✅ `npm audit`: solo `xlsx` (sin parche; únicamente se usa para **escribir**, no para leer archivos) |

## Pruebas realizadas en local (stack completo con `docker compose up --build`)

Arranque desde cero (roles + `migrate deploy`) y 94 comprobaciones contra la app real: login con sesión RS256, venta, 6 ventas simultáneas con stock 3 (exactamente 3 pasan), 2 fiados simultáneos con límite (1 pasa), doble anulación (se revierte una vez), rollback de carrito parcial, aislamiento entre cantinas, registro con cédula cifrada, portal del representante, abonos, fotos (el contenido se valida por bytes), auditoría inmutable y los tres rate limits.

## Pendiente antes del deploy

- ~~Rebuild y repetir pruebas~~ **Hecho**: imagen reconstruida con el último código y baterías repetidas desde una BD vacía (44 + 46 + 4 + 7 comprobaciones, incluido el rol `superadmin` bajo RLS).
- Aviso menor en los logs del contenedor: `pg` advierte (`DeprecationWarning`) de una consulta lanzada mientras otra sigue en curso en la misma conexión. No causa fallos hoy, pero dejará de funcionar en `pg@9`; hay que localizar la ruta que lo dispara (`NODE_OPTIONS=--trace-deprecation`).
- `xlsx` sigue con advisories sin parche (`npm audit`): solo se usa para exportar.
- No incluido a propósito (fuera del alcance acordado): MFA obligatorio para admin, refresh tokens/sesiones revocables, zona horaria `America/Caracas`, TLS verificado en el scraping del BCV, tests automatizados y CI.
