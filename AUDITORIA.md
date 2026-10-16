# Auditoría técnica — CantinApp

**Fecha:** 2026-10-15 · **Alcance:** repo completo (rama `main`, 38 commits) · **Tipo:** diagnóstico de solo lectura; no se corrigió nada.

> **Nota sobre método:** revisión manual de `src/lib/*`, `middleware.ts`, `next.config.mjs`, Docker y las rutas API más sensibles (auth, ventas, registro, recuperación de contraseña, MFA, usuarios, fotos, BCV interno), más barridos con grep sobre todas las rutas, `tsc --noEmit` y `npm audit --omit=dev`. No se ejecutó la app ni se probó contra la base de datos real. Las rutas CRM, reportes, superadmin y las páginas cliente se revisaron solo por patrones (grep), no línea por línea.

---

## 1. Stack y arquitectura

### Stack real (versiones instaladas)

| Capa | Realidad en el repo | Diferencia con `CLAUDE.md` |
|---|---|---|
| Framework | **Next.js 16.2.6** (App Router), React 19.2.6, TypeScript | Doc dice Next 14 |
| UI | Tailwind **3.4** + shadcn/ui + `@base-ui/react`, recharts, sonner | `tw-animate-css` es de Tailwind 4: mezcla de eras |
| Datos | **Supabase JS (service role, REST)** en casi todo el código; **Prisma 7 + adapter-pg** solo en 5 rutas de superadmin | Doc dice "Prisma como ORM"; en la práctica hay **dos capas de datos** |
| Auth | NextAuth v4 (Credentials) + JWT **RS256** custom con `jose` | `jose` **no está declarado** en `package.json` (llega transitivo) |
| Validación | Zod 4 | — |
| Rate limit | Upstash Ratelimit | **Definido pero nunca invocado** (ver §2) |
| Email / WhatsApp | Resend / Twilio | — |
| BCV | Cheerio + `node-cron` iniciado en `instrumentation.ts` | — |
| Exportes | `jspdf`, `xlsx` | `xlsx` 0.18.5 tiene CVE sin parche |
| Despliegue | Dockerfile multi-stage (`standalone`) + `docker-compose.yml` (puerto 3005) | Doc dice Vercel |
| Tests | **Ninguno** (sin Vitest en `package.json`) | Doc dice Vitest + Testing Library |

### Organización

- `src/app/` con route groups por rol: `(admin)`, `(vendedor)`, `(representante)`, `(directivo)`, `(superadmin)`, más `login`, `registro`, `recuperar-password`, `offline`.
- Patrón repetido por pantalla: `page.tsx` (servidor) + `*-client.tsx` (cliente).
- `src/app/api/**`: ~60 Route Handlers agrupados por rol (`admin/`, `representante/`, `superadmin/`, `auth/`, `ventas/`, `internal/`).
- `src/lib/`: `auth`, `require-role` (`withAuth`/`requireRole`), `validate` (Zod), `audit`, `brute-force`, `crypto` (AES-256-GCM), `rate-limit`, `bcv`/`bcv-cron`, `notifications`, `email/`, `idb` (cola offline), `logger`.
- `src/middleware.ts`: protege solo rutas de **páginas** por prefijo y rol; las rutas `/api` se protegen una a una con `withAuth`.
- PWA con cola offline de ventas en IndexedDB (`idb.ts`, `sw-register.tsx`).

### Observaciones de arquitectura

1. **Todo corre con `service_role`**, que se salta cualquier RLS. El aislamiento entre cantinas (multi-tenant) depende al 100 % de que cada query recuerde filtrar por `cantina_id`. Las migraciones **no definen RLS** en ninguna tabla.
2. **Esquema desincronizado:** `login_intentos`, `refresh_tokens`, etc. están en migraciones, pero el código usa tablas/columnas (`password_reset_tokens`, `mfa_secret`, `mfa_habilitado`, `email_verificado`, `deleted_at`, `consentimiento_*`, `qr_code`) que no aparecen en las 2 migraciones versionadas; existe `apply_schema.mjs` suelto. No se puede reconstruir la BD desde el repo con confianza.
3. **Repo con ruido:** 8 scripts sueltos en la raíz (`reset_pwd.ts`, `create_vendedor*.ts`, `force_bcv.ts`, `apply_schema.mjs`, …), `dev-server.log`, `.agents/` sin trackear.
4. Documentación (`CLAUDE.md`, `README`) describe un stack distinto al implementado (Next 14, Vercel, Vitest, refresh tokens en cookie).

---

## 2. Seguridad

### 2.1 Credenciales y secretos

| Hallazgo | Severidad | Detalle |
|---|---|---|
| **Service role key de Supabase hardcodeada** | 🔴 Crítica | `sb_secret_MX0S…` aparece en texto plano en **7 archivos** de la raíz: `apply_schema.mjs`, `check_tasa.ts`, `create_vendedor_sb.ts`, `force_bcv.ts`, `migrate_pedidos.ts`, `reset_pwd.ts`, `test_supabase.ts` (en 5 como *fallback* de `process.env`, en 2 sin fallback). Hoy están **sin trackear** (`??` en git) y **no están en `.gitignore`**: un `git add .` los sube a GitHub. Esa llave da acceso total a la BD. |
| Historial de git | ✅ | `git log -S"sb_secret_"` no encuentra la llave en commits; `.env` nunca se commiteó. |
| `.env` / `.env.local` | ⚠️ | Correctamente ignorados. Contienen la llave privada RSA y credenciales reales; ver nota de rotación abajo. |
| `.env.example` | ✅ | Solo placeholders. |
| Token de reset en logs | 🟠 Alta | `recuperar-password/route.ts`: si `sendEmail` falla, hace `console.info("[reset-pwd] TOKEN (fallback dev): <token>")`. En producción, cualquiera con acceso a logs (o Logtail) puede tomar cuentas ajenas. |
| Fallback de cifrado en claro | 🟠 Alta | `registro/route.ts`: si `encrypt()` lanza (p. ej. falta `ENCRYPTION_KEY`), guarda la **cédula del menor en texto plano** sin avisar. Viola la regla de seguridad del proyecto. |
| `ENCRYPTION_KEY` leída al importar | 🟡 Media | `crypto.ts` captura `process.env.ENCRYPTION_KEY` a nivel de módulo; funciona, pero sin rotación ni versión de clave. |

> **Acción inmediata recomendada (fuera de código):** durante esta auditoría la salida de un comando mostró en pantalla la llave privada RSA de `.env` (por un `sed` que no ocultó líneas multilínea). No salió de la sesión, pero **trátala como expuesta si ese terminal se registra/comparte** y considera rotar `NEXTAUTH_PRIVATE_KEY/PUBLIC_KEY`. La `service_role` de los scripts debe rotarse de todos modos si el repo en GitHub es público o ha sido compartido.

### 2.2 Autenticación y sesiones

| Hallazgo | Severidad | Detalle |
|---|---|---|
| **Rate limiting inexistente en la práctica** | 🔴 Crítica | `checkLoginRateLimit` / `checkGlobalRateLimit` están definidos en `rate-limit.ts` pero **ningún archivo los llama** (grep sin resultados). Login, `/registro`, `/recuperar-password` y todo `/api` quedan sin límite por IP, pese a lo que dicen `CLAUDE.md` y `ROADMAP`. Además `bcrypt` cost 12 en endpoints públicos (`registro`, `nueva`) es un vector de DoS de CPU. |
| Bloqueo permanente acumulativo | 🟠 Alta | `brute-force.ts`: el umbral de 20 cuenta **todos** los fallos históricos del email, sin reiniciar tras un login exitoso. Un usuario legítimo que falle 20 veces *en toda su vida* queda bloqueado para siempre. A la vez, cualquiera puede bloquear la cuenta de un tercero (DoS de cuentas) conociendo su email. |
| IP de cliente falsificable | 🟡 Media | Se toma `x-forwarded-for` crudo (primer valor) en `auth.ts`, `audit.ts`, `registro` y `rate-limit.ts`. Sin proxy confiable delante, un atacante controla su "IP" en auditoría, consentimiento y (cuando se active) rate limit. |
| **MFA no es obligatorio para admin** | 🟠 Alta | `CLAUDE.md` lo exige; el código solo pide TOTP si el usuario lo activó. No hay chequeo en `authorize` ni en el layout admin. Sin anti-replay del código TOTP ni límite de intentos en `POST /api/auth/mfa`. |
| MFA: secreto sobrescribible | 🟡 Media | `GET /api/auth/mfa` regenera y guarda `mfa_secret` en cada llamada, incluso con MFA ya activo (queda en estado inconsistente si el usuario recarga). El secreto TOTP se guarda **en claro** en la BD. |
| **No hay refresh token ni cookie HttpOnly propia** | 🟠 Alta | El diseño del doc (access 15 min + refresh 7 días) no existe: solo hay un JWT de 15 min con `maxAge` fijo, sin renovación → el vendedor se desloguea cada 15 min en plena caja (y en POS offline puede perder el contexto). La tabla `refresh_tokens` solo se consulta para "revocar", pero **nunca se inserta nada**: `DELETE /api/auth/sesiones`, el cambio de contraseña y el reset **no invalidan ninguna sesión real**. |
| Desactivar usuario no corta acceso | 🟡 Media | `PUT /admin/usuarios/[id]` con `activo:false` no afecta al JWT ya emitido (hasta 15 min). Los handlers no revalidan `activo` ni `rol` contra la BD. |
| Sin auto-logout por inactividad | 🟡 Media | Regla "10 min vendedor / 30 min admin" no implementada (grep sin resultados en cliente). |
| JWT correcto en lo esencial | ✅ | RS256 con claves en env, `algorithms: ["RS256"]` fijado al verificar (evita *alg confusion*), expiración incluida; `bcrypt` cost 12; contraseña de reset hasheada con SHA-256 y de un solo uso. |
| Políticas de contraseña débiles | 🟡 Media | `registro` y `change-password` no ponen `max(72)` (bcrypt trunca a 72 bytes; contraseñas enormes → carga de CPU). Mínimo 8, sin chequeo de contraseñas comunes. |
| Token de verificación de email | 🟡 Media | JWT HS256 firmado con `NEXTAUTH_SECRET`, reutilizable durante 24 h (no de un solo uso). Mezcla HS256 en un sistema que declara RS256. Además `registro` activa la cuenta de representantes **sin** exigir verificación. |
| Enumeración de usuarios | 🟡 Media | `/api/auth/registro` responde 409 "El email ya está registrado" (contradice el cuidado que sí tiene `recuperar-password`). |

### 2.3 Autorización y multi-tenancy

| Hallazgo | Severidad | Detalle |
|---|---|---|
| `cantina_id` del body en registro público | 🟠 Alta | `registro` acepta `cantinaId` del body sin validar existencia ni invitación; cualquiera puede crear cuentas (activas) dentro de **cualquier cantina** y se notifica a su admin. Si no se envía, toma "la primera cantina" de la tabla (incorrecto en multi-tenant). |
| `alumnoId` sin validar cantina en ventas no-fiado | 🟡 Media | `POST /api/ventas`: el `alumno_id` solo se verifica contra `cantina_id` cuando `metodoPago === "fiado"`; en los otros métodos se inserta tal cual → una venta puede referenciar un alumno de otra cantina. |
| Verificación de propiedad tras el fetch | 🟡 Media | Patrón repetido: consulta `.eq("id", id)` y *luego* compara `cantina_id` en JS (ventas, foto, usuarios). Funciona, pero un olvido = fuga entre cantinas; sería más seguro filtrar en la query (y con RLS como red de seguridad). |
| 403 "Sin permisos" uniforme | ✅ | Se respeta la regla de no revelar existencia de recursos. |
| `withAuth` + `requireRole` | ✅ | Todas las rutas salvo 4 lo usan; las 4 sin sesión son públicas por diseño (`registro`, `recuperar-password` ×2, `nextauth`). |
| `cantinaId!` para superadmin | 🟡 Media | Muchos handlers usan `session.user.cantinaId!`; un superadmin sin cantina produce `null`/errores o filtros `cantina_id = null`. |
| Endpoint interno BCV | 🟡 Media | `/api/internal/bcv/actualizar` decide "localhost" por el header `Host` (controlable por el cliente) y compara la API key con `!==` (no tiempo-constante). Tras un proxy, el `Host` real es el dominio público y la ruta queda inutilizable; sin proxy, es falsificable. La llave es el único control real. |

### 2.4 Validación de inputs

- ✅ Zod en la gran mayoría de rutas de escritura (`validateBody`).
- 🟠 **Sin Zod** (contra la regla "rechazar sin Zod"): `admin/alumnos/[id]/foto` (POST/DELETE; `formData`), `auth/sesiones`, `internal/bcv/actualizar`, `representante/solicitar-eliminacion` (estas dos últimas no leen body, riesgo bajo).
- 🟠 **Subida de fotos confía en `file.type`** (MIME enviado por el cliente), sin verificar magic bytes; la extensión sale de ese mismo valor. `upsert:true` sobrescribe sin auditar. Sin límite de body a nivel de servidor (la comprobación de 5 MB ocurre *después* de leer el `formData` completo).
- 🟡 Sin límite global de body (1 MB) configurado; `registro` público acepta JSON arbitrario hasta el límite de Next.
- 🟡 Parámetros de query sin esquema (`fecha`, `q`, `id`): `fecha` sin validar formato; `q` se interpola en `ilike("%${q}%")` sin escapar `%`/`_` (no es inyección, pero permite patrones comodín costosos).
- 🟡 Cantidades de ventas sin tope máximo (`cantidad: int ≥ 1`), `limite_fiado`, montos de abonos: revisar topes razonables.
- 🟡 "Sanitizar HTML en campos libres" no está implementado (nombres, notas CRM, motivos). Ver XSS.

### 2.5 Inyección SQL y XSS

- **SQL injection: riesgo bajo.** Todas las consultas pasan por `supabase-js` (PostgREST, parametrizado) o Prisma; no hay `$queryRaw`/SQL concatenado en el código de la app. No se usa `.or()`/filtros con interpolación de strings crudos de usuario (único caso: el `ilike` descrito arriba, que está acotado a un valor).
- **XSS: riesgo bajo-medio.**
  - No hay `dangerouslySetInnerHTML`, `innerHTML` ni `eval` en `app/`, `components/` ni `lib/`; React escapa por defecto.
  - **CSP débil:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (comentario dice "requerido por dev", pero se aplica también en producción) anula gran parte del valor del CSP. `img-src https:` es muy amplio.
  - **Plantillas de email** (`lib/email/templates.ts`) interpolan `nombre`, `email`, `alumno` en HTML; revisar que se escapen, ya que `nombre` viene de registro público (HTML injection en el correo que recibe el admin).
- **CSRF:** NextAuth protege su propio endpoint; las rutas `/api` autentican por cookie de sesión de NextAuth (SameSite=Lax por defecto). Las mutaciones JSON requieren `Content-Type: application/json` parseado manualmente, pero **no hay verificación de `Origin`** ni cookie `SameSite=Strict` como pide el doc. Riesgo moderado en endpoints que aceptan `multipart/form-data` (fotos, abonos).

### 2.6 CORS y cabeceras

- ✅ No hay CORS abierto: no existe ninguna cabecera `Access-Control-*` (por defecto solo mismo origen). Si se agrega una API pública, hay que configurarlo explícitamente.
- ✅ `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, redirección a HTTPS.
- 🟡 `Permissions-Policy: camera=()` **bloquea la cámara**, pero el POS usa `html5-qrcode` para escanear QR de alumnos → probable fallo funcional del escáner en navegadores que respetan la política (verificar).
- 🟡 HSTS sin `preload`; sin `Cross-Origin-Opener-Policy`.

### 2.7 TLS y base de datos

- 🟠 `lib/db.ts` usa `ssl: { rejectUnauthorized: false }` → acepta cualquier certificado (MITM posible entre la app y Postgres).
- 🟠 `lib/bcv.ts` desactiva la verificación TLS al hacer scraping de `bcv.org.ve`. El dato extraído (la tasa) alimenta **todos los cobros**: un atacante en la red podría fijar una tasa falsa. Se mitiga validando rango/variación diaria y exigiendo confirmación del admin.
- 🟠 **Sin RLS** en ninguna tabla (ver §1). Si algún día se expone la `anon key` o se usa el cliente de Supabase en el navegador, todos los datos quedan abiertos. Hoy `NEXT_PUBLIC_SUPABASE_URL` es público (y está en el CSP `connect-src`).

### 2.8 Dependencias con vulnerabilidades (`npm audit --omit=dev`)

Total: **38 avisos — 3 críticos, 25 altos, 8 moderados, 2 bajos.**

| Paquete | Versión | Avisos relevantes | Solución |
|---|---|---|---|
| **next** | 16.2.6 | 3 críticos: RCE en `next/og` ImageResponse, RCE sin autenticación en Image Optimization con AVIF, RCE en servidores Windows (≥16.0 <16.3.3 / <16.3.6). Altos: bypass de Middleware/Proxy con Turbopack, SSRF en rewrites/Server Actions, DoS en Server Actions. Varios moderados (cache poisoning/confusion, divulgación de endpoints de Server Functions). | Actualizar a **≥ 16.3.8** (cubre todos los rangos listados). |
| **next-auth** | 4.24.14 | Crítico: bypass de normalización de email con homoglifo `@`; alto: `getToken()` lanza excepción con cabecera Bearer malformada (el `middleware.ts` usa `getToken`). | Actualizar a **≥ 4.24.15**. |
| **xlsx** | 0.18.5 | Alto (prototype pollution / ReDoS), **sin parche en npm**. | Reemplazar (p. ej. `exceljs` o la build oficial de SheetJS desde su CDN) o limitar a *escritura* de datos propios, nunca parsear archivos subidos. |
| undici, hono, axios, `@prisma/*`, `sharp`, `uuid`, etc. | varios | Altos/moderados, en su mayoría **transitivos de tooling** (`prisma`, `shadcn`, `@modelcontextprotocol/sdk`). | `npm audit fix`; mover `shadcn`/`prisma` CLI a `devDependencies` (hoy `shadcn` está en `dependencies`, lo que arrastra decenas de paquetes a producción). |

> Nota: `npm audit` fue ejecutado en esta máquina; los avisos son los reportados por el registro a la fecha de hoy.

### 2.9 Auditoría y datos sensibles

- ✅ `audit()` existe y se invoca en ventas, anulaciones, abonos, usuarios, MFA, etc.; no registra contraseñas.
- 🟠 `audit()` **traga todos los errores**: si falla, la operación financiera queda sin rastro y nadie se entera. No hay garantía de inmutabilidad de `audit_logs` (no hay trigger/REVOKE de UPDATE/DELETE en las migraciones).
- 🟠 Cédulas y referencias cifradas con AES-256-GCM ✅ (formato `iv:tag:ct`), pero la búsqueda por cédula **descifra todos los alumnos de la cantina en cada búsqueda** (O(n) en CPU) y el fallback "sin cifrar" arriba anula la garantía.
- 🟡 Eliminación de datos (derecho del menor): `solicitar-eliminacion` solo envía un email al admin; no hay flujo que borre fotos/datos. Sin job que elimine la foto del Storage al dar de baja al alumno (solo el endpoint manual `DELETE foto`).
- 🟡 Soft delete en ventas ✅; `registro` hace `delete()` físico de `usuarios` (rollback; aceptable, no es tabla financiera).

---

## 3. Testing

### Estado actual: **cobertura 0 %**

- No hay un solo archivo `*.test.*` / `*.spec.*`, ni `vitest.config`, ni script `test` en `package.json`, ni Vitest/Testing Library como dependencia (aunque `CLAUDE.md` los lista).
- No hay CI (`.github/` no existe): nada ejecuta `tsc`, lint ni tests antes de integrar.
- Lo que sí hay: `tsc --noEmit` pasa limpio (sin errores de tipos) — buena base. El script `lint` usa `next lint`, que ya no existe en Next 16, y `eslint-config-next` está en 14.2.35 → el lint probablemente no corre.
- Los 8 scripts raíz (`test_supabase.ts`, `check_db.ts`…) son utilidades manuales, no pruebas.

### Mínimo razonable recomendado (proyecto de ~60 rutas, maneja dinero y datos de menores)

No hace falta apuntar a 80 % global. Prioridad por riesgo:

1. **Unitarios (Vitest) — 1-2 días, alto retorno**
   - `crypto.ts`: roundtrip, IV distinto por cifrado, fallo con tag alterado, clave inválida.
   - Cálculo de totales/tasa/redondeo (extraer de `ventas/route.ts` a una función pura) y límite de fiado.
   - `brute-force.ts` (con Supabase mockeado): umbrales 5/20, reinicio tras éxito.
   - `requireRole`/`withAuth`: 401, 403, 400 de Zod, 500 sin stack trace.
   - Esquemas Zod de ventas, registro, abonos (casos límite).
2. **Integración de rutas críticas (Vitest + Supabase de prueba o mocks) — 2-3 días**
   - `POST /api/ventas`: éxito, stock insuficiente, producto de otra cantina, fiado sobre límite, fiado sin habilitar, **dos ventas concurrentes del último producto**.
   - `DELETE /api/ventas/[id]`: revierte stock y saldo una sola vez (doble anulación).
   - **Tests de aislamiento entre cantinas** para cada ruta con `[id]` (token de cantina A sobre recurso de cantina B → 403). Es el riesgo #1 del diseño.
   - Autorización por rol: cada ruta `admin/*` rechaza vendedor/representante; representante solo ve sus hijos.
   - Flujo de reset de contraseña: token expirado, reutilizado, inválido.
3. **E2E mínimo (Playwright) — 1 día:** login → abrir caja → venta en efectivo → venta fiado → anular (admin). Cubre el camino de dinero real.
4. **Puerta de calidad en CI (GitHub Actions) — medio día:** `tsc --noEmit`, `eslint`, `vitest run`, `npm audit --audit-level=high`. Meta inicial realista: **≥ 60 % en `src/lib` y las rutas de ventas/abonos/auth**, sin exigir cobertura en componentes UI.

---

## 4. Calidad de código

### Fortalezas

- TypeScript estricto compila sin errores; solo ~13 usos de `any`.
- Patrón consistente `withAuth` + `requireRole` + `validateBody` → rutas cortas y legibles.
- Precios y totales se calculan **en el servidor** (no se confía en el cliente) ✅; precios históricos guardados en `detalle_ventas`.
- Soft delete y auditoría en las operaciones financieras principales.
- Separación clara por roles y por carpetas.

### Problemas

| Tema | Detalle | Impacto |
|---|---|---|
| **Transacciones / concurrencia** | `POST /api/ventas` hace *leer stock → calcular → escribir `stock = leído − n`* en pasos sueltos sin transacción: dos cajas vendiendo el mismo producto se pisan y el stock/`saldo` fiado quedan incorrectos (lost update). El saldo fiado igual (`saldo = leído − total`). Anular una venta repite el patrón y no es idempotente (dos anulaciones simultáneas devuelven el stock dos veces). | 🔴 Integridad financiera. Usar funciones SQL/RPC atómicas (`UPDATE … SET stock = stock - $1 WHERE stock >= $1`) o una transacción Prisma. |
| **Errores ignorados en escrituras** | En ventas, `insert(detalles)` y `update(stock)` terminan en `.then(() => {})`: el error de Supabase se descarta. Puede quedar una **venta cobrada sin detalle ni descuento de stock**, y responder 201. Lo mismo con saldo, reversión de stock y el `update` de QR en `registro` (los resultados de `Promise.all` no se comprueban). | 🔴 Corrupción silenciosa de datos. |
| **Sin compensación de fallos parciales** | `registro` crea usuario → alumno → cuenta → email sin transacción; solo hay rollback manual del usuario si falla el alumno. | 🟠 |
| **Logging** | Existe `lib/logger.ts` (con Logtail) pero **nadie lo usa** (0 referencias); hay `console.log/error` en ~14 archivos. Sin request-id, sin correlación, y los `console.error(e)` pueden volcar objetos de error de Supabase con datos. `withAuth` captura excepciones pero registra el objeto completo. | 🟠 |
| **Manejo de errores incoherente** | Algunas rutas usan `withAuth` (error → JSON genérico 500), otras `try/catch` propio con `console.error`, otras (`registro`, `internal/bcv`) sin patrón común. `throw error` de Supabase llega a 500 genérico sin distinguir (p. ej. clave duplicada → 409). | 🟡 |
| **Dos capas de datos** | Supabase REST en ~55 rutas + Prisma en 5; `db.ts` crea un pool de `pg` con `rejectUnauthorized:false`. Tipos de tablas Supabase sin generar (`as string`, `as Rol` en todas partes) → el compilador no detecta cambios de esquema. | 🟠 Deuda estructural. Elegir una. |
| **Duplicación** | Patrón "obtener recurso → comparar cantina → 403" copiado en decenas de rutas; extracción de IP copiada 4 veces; cálculo de agregados (deuda, saldo, fiado) repetido en CRM/reportes/dashboard; obtención de "fecha de hoy" con `toISOString().slice(0,10)` en 12 sitios. | 🟡 |
| **Zona horaria** | Los "días" se calculan en **UTC** (`toISOString().slice(0,10)`, `${fecha}T00:00:00`) pero la cantina opera en UTC-4 (Venezuela): ventas de la tarde-noche caen en el día siguiente en cajas y reportes; la tasa "de hoy" cambia a las 8 pm hora local. | 🟠 Bug funcional de caja/reportes. |
| **Componentes cliente enormes** | `*-client.tsx` con cientos de líneas y mucha lógica de fetch/estado; sin capa de datos compartida (React Query/SWR) ni manejo de errores de red uniforme. | 🟡 |
| **Cron en el proceso web** | `node-cron` se inicia en `instrumentation.ts`: con varias instancias corre N veces; en serverless (Vercel) no corre. Falta idempotencia garantizada y alerta si el scraping falla. Scraping frágil (HTML de BCV) con TLS desactivado. | 🟡 |
| **Tooling desfasado** | `eslint-config-next@14` + `next@16`, `@types/react@18` + `react@19`, `next lint` inexistente en 16, `middleware.ts` (convención renombrada a `proxy.ts` en Next 16), `shadcn` CLI en dependencias de producción. | 🟡 |
| **Docker/Compose** | `docker-compose` inyecta todo el `.env` por `env_file` y mapea 3005→3000; `Dockerfile` hace `COPY . .` (los scripts raíz con la llave no están en `.dockerignore`, aunque solo llegan a la etapa `builder`); sin `HEALTHCHECK`. | 🟡 |
| **Sin migraciones completas** | Ver §1.2. Cambios de esquema se aplican con scripts ad hoc. | 🟠 |

---

## 5. Riesgos críticos vs. mejoras deseables

### 🔴 Bloqueantes — corregir **antes de producción**

1. **Rotar y sacar del repo la `service_role` de Supabase** hardcodeada en 7 scripts; moverlos a `scripts/` leyendo solo de `process.env`, o borrarlos; añadir `.env*`, `*.log` y `scripts/` sensibles al `.gitignore` y activar *secret scanning* en GitHub. Rotar también las claves RSA si hubo exposición.
2. **Actualizar `next` (≥ 16.3.8) y `next-auth` (≥ 4.24.15).** Hay RCE sin autenticación y bypass de proxy/middleware con parche disponible.
3. **Activar el rate limiting** (login, registro, recuperar contraseña, global) y confiar en la IP solo de un proxy conocido. Hoy no limita nada.
4. **Operaciones de venta/anulación/abono atómicas** (transacción o RPC SQL con `UPDATE … WHERE stock >= n`), **comprobar el `error` de cada escritura** y revertir si falla. Hoy se pueden perder o duplicar inventario y deuda.
5. **RLS en todas las tablas** (deny-all para `anon`/`authenticated`; la app usa `service_role`) y filtrar `cantina_id` en la propia query en vez de comparar después. Añadir pruebas de aislamiento entre cantinas.
6. **No registrar el token de reset** ni caer en cifrado "en claro" (`registro`); fallar en cerrado si falta `ENCRYPTION_KEY` o el email no sale.
7. **Cerrar el registro público:** validar `cantinaId` contra un código/enlace de invitación (o resolver la cantina por subdominio) y exigir verificación de email antes de activar.
8. **Sesiones reales:** implementar refresh token (cookie HttpOnly, SameSite=Strict, hash SHA-256 en BD) o, como mínimo, `maxAge` operativo + renovación + revocación por `tokenVersion`; hoy "cerrar sesiones" y el reset de contraseña no invalidan nada y el vendedor se desloguea cada 15 min.
9. **Corregir el bloqueo por fuerza bruta** (contar fallos consecutivos / reiniciar tras éxito) para no bloquear de por vida a usuarios legítimos ni permitir bloqueo de cuentas ajenas.
10. **Esquema reproducible:** generar migraciones completas desde la BD real (tablas/columnas faltantes), eliminar `apply_schema.mjs`.
11. **MFA obligatorio para `admin`** como exige la política (y proteger `mfa` contra fuerza bruta y replays).
12. **Tests mínimos de dinero y aislamiento + CI** (ver §3, puntos 1-2 y 4) antes de abrir a usuarios reales.

### 🟠 Importantes — primer mes tras el piloto

- Reemplazar/aislar `xlsx`; mover `shadcn`, `prisma` CLI a `devDependencies`; `npm audit fix` del resto.
- Verificar TLS en la conexión a Postgres (`rejectUnauthorized: true` con el CA de Supabase) y en el scraping BCV (o usar fuente alternativa/API + validación de rango y variación máxima diaria de la tasa).
- CSP sin `unsafe-eval` en producción (nonces) y `Permissions-Policy` compatible con la cámara del POS.
- Validar magic bytes en fotos; Zod en los endpoints restantes; límite de body; escape de HTML en plantillas de email.
- Zona horaria `America/Caracas` para "día de caja", reportes y tasa del día.
- Unificar en una sola capa de datos (Prisma con transacciones, o Supabase con tipos generados + RPC).
- Logger único con request-id, y que `audit()` falle de forma visible (cola/reintento); `audit_logs` realmente inmutable (REVOKE/trigger).
- Flujo real de eliminación de datos del menor (fotos incluidas) y job de limpieza.
- Inactividad: auto-logout 10/30 min.
- Revalidar `activo`/`rol` contra BD en operaciones sensibles (o `tokenVersion`).

### 🟢 Deseables — pueden esperar

- Extraer helpers (`getClientIp`, `ownedByCantina`, `hoyCaracas`) y consolidar el cálculo de agregados CRM.
- React Query/SWR para las pantallas cliente; partir los `*-client.tsx` gigantes.
- Mover el cron a un scheduler externo (Vercel Cron / GitHub Action / pg_cron) con alerta de fallo.
- Migrar `middleware.ts` → `proxy.ts`, actualizar eslint/types a las versiones reales, restaurar el script `lint`.
- Playwright E2E ampliado, pruebas de carga de la caja y de la cola offline.
- Documentación al día (`CLAUDE.md`/`README` reflejan Next 14/Vercel/Vitest, no la realidad); limpiar `dev-server.log`, `.agents/`, scripts raíz.
- HSTS `preload`, `COOP`, healthcheck en Docker, imagen sin `npm` en el runner.

---

## 6. Lista priorizada de próximos pasos

| # | Acción | Esfuerzo | Por qué primero |
|---|---|---|---|
| 1 | Rotar `service_role` de Supabase (y claves RSA si procede); borrar/mover los 7 scripts con la llave; ampliar `.gitignore`; activar *secret scanning* | 1-2 h | Compromiso total de la BD si algo se sube a GitHub |
| 2 | `npm i next@latest next-auth@latest` (≥ 16.3.8 / ≥ 4.24.15) + `npm audit fix`; probar build | 2-3 h | RCE sin autenticación con parche disponible |
| 3 | Cablear rate limiting (login/registro/reset/global) y resolver la IP del cliente de forma confiable | 3-4 h | Defensa contra fuerza bruta y DoS, hoy ausente |
| 4 | Hacer atómicas venta/anulación/abono (RPC SQL o transacción) y comprobar errores de cada escritura | 1-2 días | Evita descuadres de inventario y deuda |
| 5 | RLS deny-all + filtros por `cantina_id` en query + tests de aislamiento multi-tenant | 1-2 días | Mayor riesgo estructural del sistema |
| 6 | Quitar el log del token de reset y el fallback de cédula en claro; fallar cerrado | 1-2 h | Fugas de credenciales/datos de menores |
| 7 | Rediseñar sesiones (refresh + revocación real) y corregir lógica de bloqueo; MFA obligatorio para admin | 2-3 días | Cumple la política y quita el logout cada 15 min |
| 8 | Cerrar registro público (invitación/cantina validada, verificación de email) | 0.5-1 día | Evita altas arbitrarias en cualquier cantina |
| 9 | Montar Vitest + CI (tsc, eslint, test, audit) y los tests de §3.1-3.2 | 2-4 días | Red de seguridad para todo lo demás |
| 10 | Regenerar migraciones completas desde la BD y eliminar `apply_schema.mjs` | 0.5 día | Despliegue reproducible |
| 11 | Zona horaria `America/Caracas`; unificar capa de datos; logger/auditoría robustos | 3-5 días | Correctitud de caja/reportes y operabilidad |
| 12 | TLS verificado (Postgres y BCV), CSP endurecida, validación de fotos, reemplazo de `xlsx` | 2-3 días | Endurecimiento previo a escalar |
| 13 | Limpieza: documentación, tooling desfasado, helpers duplicados, `proxy.ts` | continuo | Reduce deuda técnica |

**Estimación orientativa para llegar a "listo para producción" (puntos 1-10): ~2 semanas de una persona.**
