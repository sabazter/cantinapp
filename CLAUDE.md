# CantinApp — Guía de Trabajo para Claude Code

## Descripción del Proyecto

CantinApp es una PWA de gestión para cantinas escolares venezolanas. Maneja fiado, inventario, doble moneda USD/Bs con tasa BCV, y portal para representantes.

Especificación completa: `CantinApp_Especificacion_Tecnica (1).md`

---

## Stack Tecnológico Definido

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Base de datos | PostgreSQL vía Supabase |
| ORM | Prisma |
| Autenticación | NextAuth.js v4 con JWT + roles |
| API | Next.js API Routes (Route Handlers) |
| Scraping BCV | Cheerio + node-cron |
| Email | Resend |
| WhatsApp | Twilio WhatsApp API |
| QR | qrcode + html5-qrcode |
| Hosting | Vercel (frontend) + Supabase (DB) |
| Testing | Vitest + Testing Library |

---

## Skills y Herramientas que Usa Claude Code

### Skills activos en este proyecto
- **`claude-api`** — si se integra alguna función IA (resúmenes, clasificación)
- **`security-review`** — antes de cada merge importante, especialmente en auth y pagos
- **`simplify`** — después de implementar módulos para revisar calidad
- **`fewer-permission-prompts`** — al inicio del proyecto para configurar permisos

### Herramientas prioritarias
1. `TodoWrite` — planificación y seguimiento de tareas en cada sesión
2. `Edit` / `Write` — modificación de archivos (preferir `Edit` sobre `Write`)
3. `Grep` / `Glob` — búsqueda en el código (nunca `grep` como Bash)
4. `Bash` / `PowerShell` — comandos de terminal, git, npm
5. `Agent` con `subagent_type=Explore` — exploración amplia del codebase
6. `WebFetch` — consultar documentación externa si es necesario

---

## Modo de Trabajo

### Principios generales
- Trabajar módulo por módulo según las fases del roadmap (`ROADMAP.md`)
- Registrar cada cambio significativo en `CHANGELOG.md` al completarlo
- Preferir editar archivos existentes antes de crear nuevos
- No añadir abstracciones prematuras: tres líneas similares > helper innecesario
- No agregar manejo de errores para casos imposibles
- Sin comentarios salvo que el WHY sea no obvio

### Convenciones de código
- TypeScript estricto (`strict: true`)
- Componentes de servidor por defecto, `"use client"` solo cuando sea necesario
- Funciones de servidor para mutaciones (Server Actions o API Routes)
- Variables de entorno en `.env.local`, nunca hardcoded
- Nombres en inglés para código, español para UI/textos

### Flujo por sesión
1. Leer `ROADMAP.md` para saber dónde estamos
2. Usar `TodoWrite` para listar tareas de la sesión
3. Implementar sin parar a preguntar (el usuario redirige si es necesario)
4. Marcar tareas completadas inmediatamente
5. Actualizar `CHANGELOG.md` con los cambios realizados

### Control de versiones
- Crear commits atómicos por funcionalidad
- Mensaje formato: `tipo(módulo): descripción breve`
- Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- No forzar push, no saltar hooks

---

## Seguridad (Reglas no negociables)
**Ref completa:** `CantinApp_Seguridad_y_CRM.md`

### Autenticación
- JWT RS256 (no HS256) — par de claves RSA en variables de entorno
- Access token: 15 min. Refresh token: 7 días, cookie HttpOnly + SameSite=Strict
- bcrypt cost factor mínimo 12 — nunca MD5, SHA1 ni SHA256 directo
- MFA TOTP obligatorio para rol `admin`
- Auto-logout: 10 min vendedor / 30 min admin
- Bloqueo tras 5 intentos fallidos (15 min); permanente a los 20

### Autorización
- `cantina_id` **siempre del JWT verificado**, nunca del body del request
- Usar helper `requireRole(...roles)` en todos los endpoints protegidos
- Representantes solo acceden a datos de sus propios hijos (validar `representante_id` en cada query)
- Nunca exponer si un recurso existe en errores 403 (solo "Sin permisos")

### Validación
- Zod en **todos** los endpoints de escritura — rechazar sin Zod
- Tamaño máx. de body: 1 MB (fotos: 5 MB)
- Archivos subidos: solo jpg, png, webp
- Sanitizar HTML en campos de texto libre

### Datos sensibles
- Cédulas de alumnos: AES-256-GCM antes de guardar en DB
- Referencias bancarias: AES-256-GCM antes de guardar en DB
- Fotos de alumnos: bucket privado Supabase, URLs firmadas exp. 1h
- Refresh tokens: SHA-256 hash antes de almacenar
- **Soft delete** en tablas financieras — nunca `.delete()` en ventas/abonos/movimientos

### API
- Rate limiting en login (10 req/min/IP) y global (300 req/min/IP)
- Headers HTTP de seguridad en `next.config.mjs` (CSP, HSTS, X-Frame)
- CORS: solo dominios autorizados, nunca wildcard en producción
- Nunca exponer stack traces al cliente
- Endpoint BCV `/internal/...`: solo localhost + `INTERNAL_API_KEY`

### Auditoría
- Función `audit(event, data)` para loguear toda operación financiera
- Loguear: userId, IP, timestamp, cantina_id — **nunca** contraseñas ni datos sensibles
- Tabla `audit_logs` inmutable (sin UPDATE/DELETE)

### Menores de edad
- Foto del alumno: opcional, nunca obligatoria
- Eliminar foto del storage cuando se da de baja al alumno
- Registrar consentimiento del representante con fecha, hora e IP

---

## Variables de Entorno Requeridas

```env
DATABASE_URL=
DIRECT_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
# RS256 — generar con: openssl genrsa -out private.pem 2048
NEXTAUTH_PRIVATE_KEY=
NEXTAUTH_PUBLIC_KEY=
INTERNAL_API_KEY=
ENCRYPTION_KEY=          # AES-256-GCM, 32 bytes en hex
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
RESEND_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
```

---

## Estructura de Carpetas Objetivo

```
cantina/
├── app/
│   ├── (auth)/login/
│   ├── (admin)/
│   │   ├── dashboard/
│   │   ├── inventario/
│   │   ├── alumnos/
│   │   ├── reportes/
│   │   └── configuracion/
│   ├── (vendedor)/
│   │   └── caja/
│   ├── (representante)/
│   │   └── portal/
│   └── api/
│       ├── auth/
│       ├── ventas/
│       ├── inventario/
│       ├── alumnos/
│       ├── abonos/
│       └── bcv/
├── components/
│   ├── ui/          (shadcn)
│   ├── pos/         (punto de venta)
│   ├── inventory/
│   └── shared/
├── lib/
│   ├── db.ts        (Prisma client)
│   ├── auth.ts      (NextAuth config)
│   ├── bcv.ts       (scraping)
│   └── notifications.ts
├── prisma/
│   └── schema.prisma
└── public/
```
