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

- Nunca exponer claves API en el frontend
- Validar roles en cada API Route con middleware
- Los representantes solo acceden a datos de sus propios hijos (RLS en Supabase)
- Logs de auditoría para toda operación financiera
- Inputs sanitizados antes de queries (Prisma protege contra SQL injection)
- HTTPS obligatorio en producción

---

## Variables de Entorno Requeridas

```env
DATABASE_URL=
DIRECT_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
RESEND_API_KEY=
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
