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

## Variables de entorno nuevas (`.env` del servidor)

```
POSTGRES_PASSWORD=   APP_DB_PASSWORD=   SYSTEM_DB_PASSWORD=   REDIS_PASSWORD=   (hex aleatorios)
TRUST_PROXY=false    # "true" solo si hay un proxy/túnel que fija x-forwarded-for
```

`DATABASE_URL`, `DATABASE_SYSTEM_URL`, `REDIS_URL` y `UPLOADS_DIR` los inyecta `docker-compose.yml`. Se eliminan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Se conservan `NEXTAUTH_*`, `ENCRYPTION_KEY` e `INTERNAL_API_KEY`.

> `TRUST_PROXY=false` hace que todas las peticiones compartan la IP `unknown`: el límite por IP se vuelve global. Mientras tanto el login también se limita **por email**, así que no depende solo de la IP. Si la app queda detrás de Cloudflare/Tailscale Funnel/nginx, activar `true`.

## Pruebas realizadas en local (stack completo con `docker compose up --build`)

Arranque desde cero (roles + `migrate deploy`) y 93 comprobaciones contra la app real: login con sesión RS256, venta, 6 ventas simultáneas con stock 3 (exactamente 3 pasan), 2 fiados simultáneos con límite (1 pasa), doble anulación (se revierte una vez), rollback de carrito parcial, aislamiento entre cantinas, registro con cédula cifrada, portal del representante, abonos, fotos (el contenido se valida por bytes), auditoría inmutable y los tres rate limits.

## Pendiente antes del deploy

- Rebuild de la imagen tras el último ajuste (consultas en serie en dashboards) y repetir la pasada de humo; el daemon de Docker local se cayó por disco lleno (`C:` sin espacio) justo antes.
- `xlsx` sigue con advisories sin parche (`npm audit`): solo se usa para exportar.
- No incluido a propósito (fuera del alcance acordado): MFA obligatorio para admin, refresh tokens/sesiones revocables, zona horaria `America/Caracas`, TLS verificado en el scraping del BCV, tests automatizados y CI.
