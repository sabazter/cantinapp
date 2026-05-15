# CantinApp — Roadmap de Desarrollo

**Proyecto:** CantinApp v1.0 MVP  
**Inicio estimado:** Mayo 2026  
**Stack:** Next.js 14 + Prisma + Supabase + NextAuth

---

## Estado Actual

> **Fase:** Pre-desarrollo — solo especificación técnica documentada.  
> No existe código fuente, base de datos, ni repositorio configurado.

---

## Fase 0 — Preparación del Entorno
**Duración estimada:** 2–3 días  
**Estado:** ⬜ Pendiente

| # | Tarea | Estado |
|---|-------|--------|
| 0.1 | `git init` + primer commit + `.gitignore` | ⬜ |
| 0.2 | `npx create-next-app@14` con TypeScript + Tailwind | ⬜ |
| 0.3 | Instalar y configurar shadcn/ui | ⬜ |
| 0.4 | Instalar Prisma + conectar Supabase | ⬜ |
| 0.5 | Crear esquema Prisma completo (todas las entidades) | ⬜ |
| 0.6 | Configurar NextAuth con roles (admin, vendedor, representante, directivo) | ⬜ |
| 0.7 | Variables de entorno (.env.local + .env.example) | ⬜ |
| 0.8 | Middleware de protección de rutas por rol | ⬜ |
| 0.9 | Deploy inicial en Vercel (sin funcionalidad) | ⬜ |

---

## Fase 1 — MVP Core
**Duración estimada:** 8–10 semanas  
**Estado:** ⬜ Pendiente

### Sprint 1.1 — Autenticación y Roles (1 semana)
| # | Tarea | Estado |
|---|-------|--------|
| 1.1.1 | Página de login con email/password | ⬜ |
| 1.1.2 | Sesión con JWT + refresh token | ⬜ |
| 1.1.3 | Middleware de roles en API Routes | ⬜ |
| 1.1.4 | Layout diferenciado por rol | ⬜ |
| 1.1.5 | Gestión de usuarios (CRUD admin) | ⬜ |

### Sprint 1.2 — Inventario (1.5 semanas)
| # | Tarea | Estado |
|---|-------|--------|
| 1.2.1 | Catálogo de productos (CRUD) | ⬜ |
| 1.2.2 | Categorías: tienda vs menú del día | ⬜ |
| 1.2.3 | Control de stock y stock mínimo | ⬜ |
| 1.2.4 | Alertas visuales de stock bajo | ⬜ |
| 1.2.5 | Registro de entradas de mercancía | ⬜ |
| 1.2.6 | Historial de movimientos por producto | ⬜ |

### Sprint 1.3 — Tasa BCV (3 días)
| # | Tarea | Estado |
|---|-------|--------|
| 1.3.1 | Scraping diario de `bcv.org.ve` con Cheerio | ⬜ |
| 1.3.2 | Cron job con node-cron (actualización 8am) | ⬜ |
| 1.3.3 | Override manual de tasa por administrador | ⬜ |
| 1.3.4 | Historial de tasas diarias | ⬜ |
| 1.3.5 | Widget de tasa activa en barra de estado | ⬜ |

### Sprint 1.4 — Alumnos y Cuentas (1.5 semanas)
| # | Tarea | Estado |
|---|-------|--------|
| 1.4.1 | Registro de alumnos (nombre, cédula, curso, foto) | ⬜ |
| 1.4.2 | Asociación alumno ↔ representante | ⬜ |
| 1.4.3 | Cuenta corriente por alumno (saldo) | ⬜ |
| 1.4.4 | Vista de lista de deudas filtrable | ⬜ |
| 1.4.5 | Generación de código QR por alumno | ⬜ |

### Sprint 1.5 — Punto de Venta (2 semanas)
| # | Tarea | Estado |
|---|-------|--------|
| 1.5.1 | Búsqueda de producto por nombre/código | ⬜ |
| 1.5.2 | Carrito de compra con cantidades editables | ⬜ |
| 1.5.3 | Conversión USD → Bs en tiempo real | ⬜ |
| 1.5.4 | Identificación de cliente por cédula | ⬜ |
| 1.5.5 | Escaneo de código QR del alumno | ⬜ |
| 1.5.6 | Selección de método de pago (Efectivo USD, Efectivo Bs, Pago Móvil) | ⬜ |
| 1.5.7 | Registro de venta como fiado | ⬜ |
| 1.5.8 | Generación de recibo digital (pantalla) | ⬜ |
| 1.5.9 | Descuento automático de stock al vender | ⬜ |

### Sprint 1.6 — Abonos y Cierre de Caja (1 semana)
| # | Tarea | Estado |
|---|-------|--------|
| 1.6.1 | Registro de abono presencial (vendedor/admin) | ⬜ |
| 1.6.2 | Confirmación de abono por administrador | ⬜ |
| 1.6.3 | Cierre de caja diario | ⬜ |
| 1.6.4 | Reporte básico: total vendido USD/Bs por método de pago | ⬜ |

---

## Fase 2 — Portal Representantes y Notificaciones
**Duración estimada:** 4–5 semanas  
**Estado:** ⬜ Pendiente

### Sprint 2.1 — Portal del Representante (1.5 semanas)
| # | Tarea | Estado |
|---|-------|--------|
| 2.1.1 | Vista de saldo y deuda del alumno | ⬜ |
| 2.1.2 | Historial de compras del alumno | ⬜ |
| 2.1.3 | Formulario de reporte de abono/transferencia | ⬜ |
| 2.1.4 | Soporte para representante con múltiples hijos | ⬜ |

### Sprint 2.2 — Notificaciones Email (1 semana)
| # | Tarea | Estado |
|---|-------|--------|
| 2.2.1 | Integración Resend API | ⬜ |
| 2.2.2 | Email al registrar fiado | ⬜ |
| 2.2.3 | Email al confirmar abono | ⬜ |
| 2.2.4 | Email de stock bajo al admin | ⬜ |
| 2.2.5 | Resumen diario de ventas al admin | ⬜ |

### Sprint 2.3 — Notificaciones WhatsApp (1 semana)
| # | Tarea | Estado |
|---|-------|--------|
| 2.3.1 | Integración Twilio WhatsApp API | ⬜ |
| 2.3.2 | Mensaje al registrar fiado | ⬜ |
| 2.3.3 | Mensaje al confirmar abono | ⬜ |
| 2.3.4 | Alerta de deuda alta al representante | ⬜ |

### Sprint 2.4 — Mejoras POS (1 semana)
| # | Tarea | Estado |
|---|-------|--------|
| 2.4.1 | Generación de recibo PDF | ⬜ |
| 2.4.2 | Menú del día con precio variable por jornada | ⬜ |
| 2.4.3 | Límite de fiado configurable por alumno | ⬜ |

---

## Fase 3 — Reportes Avanzados y Multi-sede
**Duración estimada:** 4–5 semanas  
**Estado:** ⬜ Pendiente

### Sprint 3.1 — Dashboard y Estadísticas (1.5 semanas)
| # | Tarea | Estado |
|---|-------|--------|
| 3.1.1 | Gráficas de ventas (Recharts/Chart.js) | ⬜ |
| 3.1.2 | Ranking de productos más vendidos | ⬜ |
| 3.1.3 | Rendimiento por vendedor | ⬜ |
| 3.1.4 | Vista de deudas por antigüedad | ⬜ |

### Sprint 3.2 — Exportación (1 semana)
| # | Tarea | Estado |
|---|-------|--------|
| 3.2.1 | Exportar reportes a PDF | ⬜ |
| 3.2.2 | Exportar reportes a Excel | ⬜ |

### Sprint 3.3 — Multi-tenant (1.5 semanas)
| # | Tarea | Estado |
|---|-------|--------|
| 3.3.1 | Tabla `cantinas` como raíz del árbol de datos | ⬜ |
| 3.3.2 | Foreign keys de cantina en todas las entidades | ⬜ |
| 3.3.3 | Panel superadmin para gestionar cantinas | ⬜ |
| 3.3.4 | Subdominio o slug por cantina | ⬜ |

### Sprint 3.4 — PWA Offline (1 semana)
| # | Tarea | Estado |
|---|-------|--------|
| 3.4.1 | Service Worker con caché de catálogo | ⬜ |
| 3.4.2 | Cola de ventas en IndexedDB sin internet | ⬜ |
| 3.4.3 | Sincronización automática al restaurar conexión | ⬜ |
| 3.4.4 | Indicador visual de estado de conexión | ⬜ |

---

## Leyenda de Estados

| Símbolo | Significado |
|---------|------------|
| ⬜ | Pendiente |
| 🔄 | En progreso |
| ✅ | Completado |
| ❌ | Bloqueado / cancelado |
| ⏸️ | En pausa |

---

## Decisiones Pendientes (de la especificación)

Antes de comenzar Fase 1, definir:

1. ¿Impresión de recibos? ¿Con impresora térmica o solo digital?
2. ¿El menú del día tiene precio fijo o varía por jornada?
3. ¿Límite de fiado configurable por alumno?
4. ¿Cuenta por familia o por alumno para representantes?
5. ¿Resumen automático de deudas semanal/mensual?
6. ¿Categorías de descuento (ej. niños becados)?
7. ¿Integración con sistema de matrículas o base independiente?
8. ¿Quién cubre el costo de hosting y APIs (WhatsApp, email)?
