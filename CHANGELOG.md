# CantinApp — Changelog y Documentación de Funcionalidades

Registro de todos los cambios realizados y planificados, más la documentación de cada funcionalidad del sistema.

---

## Formato de Entradas

```
### [YYYY-MM-DD] Título del cambio
**Tipo:** feat | fix | refactor | docs | chore
**Módulo:** nombre del módulo afectado
**Archivos modificados:** lista de archivos
**Descripción:** qué se hizo y por qué
```

---

## Historial de Cambios

### [2026-05-15] Fase 0.5 — Seguridad Fundacional implementada
**Tipo:** feat  
**Módulos:** Auth, Seguridad, Auditoría  
**Archivos creados/modificados:**
- `prisma/schema.prisma` — nuevos modelos: `RefreshToken`, `LoginIntento`, `AuditLog`; soft delete en `Venta`, `Abono`, `MovimientoInventario`, `Alumno`; campos MFA en `Usuario`; `cedulaEncriptada` y `referenciaEncriptada`
- `src/lib/auth.ts` — JWT RS256 con `jose`, access token 15 min, brute force protection integrada
- `src/lib/brute-force.ts` — bloqueo temporal (5 intentos/15 min) y permanente (20 intentos)
- `src/lib/audit.ts` — función `audit()` + catálogo `AuditEvent` (17 eventos predefinidos)
- `src/lib/crypto.ts` — cifrado/descifrado AES-256-GCM para cédulas y referencias bancarias
- `src/lib/rate-limit.ts` — rate limiting con Upstash Redis (login: 10/min, global: 300/min)
- `src/lib/require-role.ts` — `requireRole()`, `withAuth()`, `ForbiddenError`, `UnauthorizedError`
- `src/lib/validate.ts` — `validateBody()` con Zod, `ValidationError`, `withValidation()`
- `next.config.mjs` — headers HTTP de seguridad (CSP, HSTS, X-Frame, X-Content-Type, Referrer, Permissions), redirect HTTP→HTTPS en producción
- `src/app/login/page.tsx` + `login-form.tsx` — página de login con redirección por rol
- `.env.example` — nuevas variables: `NEXTAUTH_PRIVATE_KEY`, `NEXTAUTH_PUBLIC_KEY`, `ENCRYPTION_KEY`, `INTERNAL_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`

**Nuevas dependencias:** `zod`, `@upstash/ratelimit`, `@upstash/redis`, `otpauth`, `qrcode`, `react-hook-form`, `@hookform/resolvers`

**Descripción:**  
Todos los pilares de seguridad de la Fase 0.5 implementados. El sistema ahora firma JWTs con RS256 (no HS256), registra cada intento de login en `login_intentos`, bloquea cuentas automáticamente por fuerza bruta, audita operaciones sensibles, tiene cifrado AES-256-GCM para datos personales de menores, y aplica rate limiting via Redis. La página de login muestra mensajes de error diferenciados según el tipo de bloqueo.

**Tareas del roadmap completadas:** 0.5.1–0.5.17 (autenticación, API, auditoría, soft delete)

---

### [2026-05-15] Integración de especificaciones de Seguridad & CRM al roadmap
**Tipo:** docs  
**Módulo:** Documentación / Planificación  
**Archivos modificados:**
- `CantinApp_Seguridad_y_CRM.md` — nuevo documento fuente (agregado al repo)
- `ROADMAP.md` — reestructurado completamente para integrar seguridad y CRM
- `CLAUDE.md` — sección de seguridad expandida con todas las reglas del nuevo spec

**Descripción:**  
Se incorporó el documento `CantinApp_Seguridad_y_CRM.md` como especificación obligatoria. El roadmap fue reescrito para reflejar sus requerimientos:

- **Fase 0.5 nueva (bloqueante):** 19 tareas de seguridad fundacional antes de cualquier endpoint de negocio. Incluye JWT RS256, refresh tokens con rotación, auto-logout, bloqueo por intentos fallidos, rate limiting, Zod, headers HTTP, audit log, y soft delete.
- **Fase Pre-Producción nueva (bloqueante):** 30-ítem checklist que debe completarse antes del primer despliegue con usuarios reales.
- **Fase 4 nueva — CRM:** 5 sprints con perfil 360° de alumnos, segmentación dinámica, perfil del representante, dashboard CRM con alertas inteligentes, análisis de comportamiento por alumno/producto/sección/vendedor, y 7 tipos de reportes exportables.
- **Todos los sprints existentes** reciben tareas de seguridad transversales: aislamiento multi-tenant, Zod validation, audit logs, cifrado de datos sensibles.

**Notas técnicas:**
- JWT debe cambiar de HS256 a RS256 (requiere par de claves RSA en env vars)
- Se añaden nuevas variables de entorno: `NEXTAUTH_PRIVATE_KEY`, `NEXTAUTH_PUBLIC_KEY`, `INTERNAL_API_KEY`, `ENCRYPTION_KEY`, `UPSTASH_REDIS_REST_URL`
- El schema de Prisma necesitará dos tablas nuevas: `refresh_tokens` y `audit_logs`
- Zod y `@upstash/ratelimit` + `@upstash/redis` se instalan en Fase 0.5

---

### [2026-05-15] Documentación inicial del proyecto
**Tipo:** docs  
**Módulo:** — (proyecto base)  
**Archivos creados:**
- `CantinApp_Especificacion_Tecnica (1).md` — especificación técnica completa
- `CLAUDE.md` — guía de trabajo, skills y modo de trabajo para Claude Code
- `ROADMAP.md` — roadmap detallado por fases y sprints
- `CHANGELOG.md` — este documento

**Descripción:** Setup inicial de la documentación del proyecto. No existe código todavía. El proyecto está en fase de planificación. Se definen el stack tecnológico, los módulos funcionales, el modelo de datos y el plan de desarrollo en 3 fases.

---

### [2026-05-15] Setup inicial del proyecto — Fase 0 completa
**Tipo:** chore  
**Módulos:** Infraestructura base  
**Archivos creados/modificados:**
- `package.json` — Next.js 14, Tailwind, shadcn/ui, Prisma 7, NextAuth 4, bcryptjs, pg adapter
- `prisma/schema.prisma` — Esquema completo con 12 modelos y 8 enums
- `prisma.config.ts` — Configuración de datasource para Prisma 7
- `src/generated/prisma/` — Cliente Prisma generado (no commitear)
- `src/lib/db.ts` — Singleton del cliente Prisma con PrismaPg adapter
- `src/lib/auth.ts` — Configuración NextAuth con CredentialsProvider y JWT por roles
- `src/app/api/auth/[...nextauth]/route.ts` — Route handler de NextAuth
- `src/middleware.ts` — Protección de rutas por rol
- `src/components/providers.tsx` — SessionProvider wrapper
- `src/app/layout.tsx` — Root layout con Providers y metadata CantinApp
- `.env.example` — Variables de entorno requeridas documentadas
- `components.json` — Configuración shadcn/ui

**Descripción:**  
Setup completo de la Fase 0. El proyecto compila sin errores TypeScript. La base de datos necesita ser conectada (Supabase) y las migraciones aplicadas antes de continuar con la Fase 1 (Sprint 1.1 — Login y roles).

**Notas técnicas:**
- Prisma 7 requiere adaptador explícito (`@prisma/adapter-pg`), diferente a Prisma 5/6
- Rol `superadmin` añadido al schema para gestión multi-tenant futura
- JWT strategy elegida (no database sessions) para simplificar el MVP
- shadcn/ui inicializado con configuración default; componentes se añaden por demanda

---

*(Los cambios futuros se registran aquí en orden cronológico descendente)*

---

---

# Documentación de Funcionalidades

Referencia completa de todos los módulos del sistema.

---

## Módulo 1: Autenticación y Roles

### Descripción
Sistema de login con email/contraseña. Cuatro roles con permisos diferenciados gestionados por middleware.

### Roles
| Rol | Código | Permisos |
|-----|--------|---------|
| Administrador | `admin` | Acceso total: configuración, reportes, usuarios, cierre de caja, tasa BCV |
| Vendedor | `vendedor` | Punto de venta, inventario (lectura), alumnos (lectura/fiado) |
| Representante | `representante` | Solo portal propio: ver saldo e historial de sus hijos, reportar abonos |
| Directivo | `directivo` | Lectura: lista de deudas, resumen general. Sin acceso a finanzas ni inventario |

### Flujo de login
1. Usuario accede a `/login`
2. Introduce email y contraseña
3. NextAuth valida contra BD, genera JWT con `{ id, rol, cantina_id }`
4. Middleware de ruta redirige al dashboard correspondiente al rol
5. Token expira en 8h; refresh token silencioso renueva la sesión

### Seguridad
- Contraseñas hasheadas con bcrypt (cost factor 12)
- JWT firmado con `NEXTAUTH_SECRET`
- Rate limiting en el endpoint de login (10 intentos / 15 min)
- HTTPS obligatorio

---

## Módulo 2: Inventario

### Descripción
Catálogo de productos de la cantina. Gestiona stock, precios y entradas de mercancía.

### Entidades
- **Producto:** `id, cantina_id, nombre, categoria, precio_usd, stock, stock_min, activo`
- **Movimiento:** `id, producto_id, tipo (entrada|venta|ajuste), cantidad, fecha, usuario_id`

### Funcionalidades
- **CRUD de productos:** crear, editar, desactivar (no borrar para preservar historial)
- **Categorías:** `tienda` (snacks, bebidas) y `menu` (menú del día)
- **Stock mínimo:** configurable por producto; alerta visual cuando `stock <= stock_min`
- **Entradas de mercancía:** registro de proveedor, cantidad y fecha; suma al stock
- **Historial de movimientos:** todas las entradas, salidas por venta y ajustes manuales

### Reglas de negocio
- El stock se descuenta automáticamente al confirmar una venta en el POS
- No se puede vender más unidades de las que hay en stock (validación en servidor)
- El administrador puede hacer ajustes manuales de inventario con motivo registrado

---

## Módulo 3: Tasa BCV

### Descripción
Mantiene actualizada la tasa de cambio oficial USD/Bs del Banco Central de Venezuela.

### Fuente de datos
- Scraping de `bcv.org.ve` con Cheerio
- Tarea cron: ejecución diaria a las 8:00 AM (hora Venezuela, UTC-4)
- Si el scraping falla, conserva la última tasa válida y alerta al admin

### Funcionalidades
- **Tasa automática:** scraped diariamente y almacenada en tabla `tasas_bcv`
- **Override manual:** el admin puede sobreescribir la tasa del día
- **Historial:** registro de cada tasa diaria con fuente (`automatica` | `manual`)
- **Widget en POS:** muestra la tasa activa en todo momento en la barra de estado

### Uso en ventas
- Cada transacción registra la tasa vigente al momento de la venta
- El vendedor ve el total en USD y en Bs en tiempo real en el carrito
- No se puede procesar una venta sin tasa del día disponible

---

## Módulo 4: Alumnos y Cuentas

### Descripción
Registro de alumnos de la escuela y sus cuentas corrientes para el sistema de fiado.

### Entidades
- **Alumno:** `id, cantina_id, nombre, cedula, curso, seccion, foto_url, representante_id, activo`
- **Cuenta:** `id, alumno_id, saldo` (positivo = crédito prepagado; negativo = deuda)

### Funcionalidades
- **Registro de alumno:** nombre, cédula, curso/sección, foto (opcional), datos del representante
- **Cuenta corriente:** saldo único por alumno; cada compra de fiado lo decrementa; cada abono lo incrementa
- **Límite de fiado:** configurable globalmente y por alumno por el administrador (sin límite por defecto)
- **Código QR:** generado automáticamente por alumno para identificación rápida en el POS
- **Vista de deudas:** lista filtrable por curso, monto y antigüedad de la deuda

### Reglas de negocio
- Un alumno puede tener saldo positivo (prepago) o negativo (fiado)
- El representante está vinculado a uno o más alumnos
- No se puede borrar un alumno con deuda pendiente; solo desactivar

---

## Módulo 5: Punto de Venta (POS)

### Descripción
Interfaz principal del vendedor. Operación rápida durante el horario escolar.

### Flujo de venta normal
1. Vendedor busca producto por nombre o escanea código
2. Agrega al carrito con cantidad
3. Identifica al cliente (cédula escrita o escaneo QR)
4. Selecciona método de pago
5. Confirma la venta → descuenta stock → genera recibo

### Flujo de venta fiado
1. Igual que venta normal hasta identificar cliente
2. Selecciona "Fiado" como método
3. Sistema verifica que el alumno no supere su límite de deuda
4. Confirma → descuenta stock → carga deuda a cuenta del alumno → notifica al representante

### Métodos de pago
| Método | Moneda | Acción |
|--------|--------|--------|
| Efectivo USD | USD | Registra monto en USD |
| Efectivo Bs | Bs | Registra monto en Bs, calcula equivalente en USD |
| Pago Móvil | Bs | Registra número de referencia bancaria |
| Fiado | — | Carga a cuenta del alumno |

### Funcionalidades adicionales
- Conversión USD ↔ Bs en tiempo real usando tasa BCV del día
- Carrito editable (cantidad, eliminar ítem)
- Recibo digital por pantalla (imprimible)
- Soporte para menú del día como producto especial

---

## Módulo 6: Abonos y Pagos

### Descripción
Gestión de cobros para saldar las deudas de los alumnos. Soporta pago presencial y remoto.

### Tipos de abono

**Presencial** (registrado por vendedor o admin):
- El representante paga en la cantina
- El vendedor registra el monto, método y referencia
- El saldo del alumno se actualiza inmediatamente

**Remoto** (reportado por representante desde su portal):
1. Representante hace transferencia bancaria o Pago Móvil
2. Reporta en su portal: banco, número de referencia, monto, fecha
3. Estado queda como `pendiente`
4. El administrador revisa el comprobante y confirma
5. Al confirmar, el saldo del alumno se actualiza y se envía notificación

### Entidad `abonos`
```
id, cuenta_alumno_id, monto_usd, monto_bs, tasa_bcv,
metodo (efectivo_usd | efectivo_bs | pago_movil | transferencia),
referencia, banco, estado (pendiente | confirmado | rechazado),
confirmado_por, confirmado_at, comprobante_url
```

---

## Módulo 7: Portal del Representante

### Descripción
Vista simplificada para padres y representantes. Acceso mediante sus credenciales propias.

### Funcionalidades
- **Selector de hijo:** si tiene más de un alumno registrado, selector en la parte superior
- **Saldo actual:** monto en USD con indicador visual (verde = crédito, rojo = deuda)
- **Historial de compras:** fecha, productos, montos en USD y Bs, vendedor
- **Reporte de abono:** formulario con campos: banco, número de referencia, monto, fecha, captura del comprobante (imagen)
- **Notificaciones:** historial de los mensajes recibidos por email/WhatsApp

### Seguridad
- Los representantes solo ven datos de sus propios hijos (filtro por `representante_id` en todas las queries)
- Sin acceso a funciones de inventario, ventas de otros alumnos ni configuración

---

## Módulo 8: Notificaciones

### Descripción
Sistema de alertas automáticas vía email y WhatsApp.

### Eventos y canales

| Evento | Email | WhatsApp |
|--------|-------|---------|
| Fiado registrado al alumno | ✅ representante | ✅ representante |
| Abono confirmado | ✅ representante | ✅ representante |
| Deuda supera umbral configurado | ✅ representante | ✅ representante |
| Stock bajo en producto | ✅ admin | ❌ |
| Resumen diario de ventas | ✅ admin | ❌ |
| Abono remoto pendiente de revisión | ✅ admin | ❌ |

### Integraciones
- **Email:** Resend API — plantillas HTML por tipo de evento
- **WhatsApp:** Twilio WhatsApp Business API — mensajes de texto estructurados

### Configuración
- El admin puede activar/desactivar cada tipo de notificación
- El umbral de "deuda alta" es configurable (por defecto: 20 USD)
- El horario del resumen diario es configurable (por defecto: 6:00 PM)

---

## Módulo 9: Reportes y Dashboard

### Descripción
Panel de control para el administrador con métricas clave del negocio.

### Reportes disponibles

**Cierre de caja diario:**
- Total vendido en USD y Bs
- Desglose por método de pago
- Número de ventas y ventas de fiado
- Abonos cobrados en el día

**Inventario:**
- Productos con stock bajo
- Historial de movimientos del período
- Valorización del inventario (stock × precio_usd)

**Deudas:**
- Lista de deudas pendientes con antigüedad
- Filtros: curso, monto, días de antigüedad
- Total de deuda acumulada

**Ventas:**
- Ranking de productos más vendidos
- Rendimiento por vendedor
- Gráficas de tendencia (semanal / mensual)

**Exportación:** PDF y Excel para todos los reportes

---

## Módulo 10: Configuración de la Cantina

### Descripción
Parámetros globales de la cantina gestionados por el administrador.

### Configuraciones disponibles
- Nombre e información de la cantina
- Tasa BCV (override manual)
- Límite global de fiado (USD)
- Umbral de alerta de deuda alta (USD)
- Horario de resumen diario por email
- Activación de canales de notificación (email, WhatsApp)
- Gestión de usuarios del sistema (crear, editar, desactivar)

---

## Consideraciones Venezuela

| Desafío | Solución implementada |
|---------|----------------------|
| Inflación diaria del Bs | Precios en USD; conversión BCV en tiempo real |
| Cortes de internet | PWA offline (Fase 3): cola IndexedDB + sync automático |
| Pago Móvil | Método de pago nativo con campo de referencia bancaria |
| WhatsApp como canal primario | Twilio WhatsApp API integrada en todas las notificaciones |
| Dispositivos Android predominantes | PWA optimizada, sin necesidad de Play Store |
| Sin APIs bancarias locales | Confirmación manual de transferencias por el admin |
