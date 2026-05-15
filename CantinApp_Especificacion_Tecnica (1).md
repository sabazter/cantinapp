# 🏫 CantinApp
## Sistema de Gestión para Cantinas y Bodegas Escolares
**República Bolivariana de Venezuela | Versión 1.0 — MVP | Mayo 2025**

---

## Tabla de Contenidos
1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Roles y Permisos](#2-roles-y-permisos-del-sistema)
3. [Módulos Funcionales](#3-módulos-funcionales)
4. [Arquitectura Técnica](#4-arquitectura-técnica-recomendada)
5. [Modelo de Datos](#5-modelo-de-datos-principal)
6. [Plan de Desarrollo](#6-plan-de-desarrollo-por-fases)
7. [Consideraciones Venezuela](#7-consideraciones-específicas--venezuela)
8. [Puntos Pendientes](#8-puntos-a-definir-antes-de-desarrollar)
9. [Glosario](#9-glosario)

---

## 1. Resumen Ejecutivo

CantinApp es una aplicación web progresiva (PWA) diseñada específicamente para la realidad operativa de cantinas y bodegas escolares venezolanas. El sistema resuelve los principales puntos de dolor del negocio: control de fiado, manejo de doble moneda (USD/Bs), conversión automática a tasa BCV, y visibilidad en tiempo real para dueños, vendedores y representantes.

### Propuesta de Valor
- ✅ Control total del inventario con alertas de stock bajo
- ✅ Sistema de fiado con cuentas por alumno y abonos remotos
- ✅ Conversión USD ↔ Bs automática vía scraping BCV
- ✅ Historial de ventas por cliente, vendedor y producto
- ✅ Portal para representantes: ver saldo, fiado e historial del alumno
- ✅ Notificaciones por WhatsApp y correo electrónico
- ✅ Multi-sede: diseñado para escalar a varias escuelas

---

## 2. Roles y Permisos del Sistema

El sistema maneja 4 tipos de usuario con permisos diferenciados:

| Rol | Capacidades principales |
|-----|------------------------|
| 👑 **Administrador / Dueño** | Acceso total. Configura la cantina, gestiona usuarios, ve todos los reportes, cierra caja, ajusta tasa de cambio, aprueba abonos. |
| 🧾 **Vendedor / Empleado** | Registra ventas, aplica fiado, cobra pagos presenciales, consulta inventario, ve su historial de ventas del día. |
| 👨‍👩‍👧 **Representante / Padre** | Ve el saldo y deuda de su(s) hijo(s), historial de compras, reporta transferencias/abonos, recibe notificaciones. |
| 🏫 **Personal Escolar (Directivo)** | Vista de lectura: lista de alumnos con deuda, resumen general. Sin acceso a finanzas detalladas ni inventario. |

---

## 3. Módulos Funcionales

### 3.1 Módulo de Ventas (Punto de Venta)

Es el corazón del sistema. El vendedor opera desde aquí durante el horario escolar.

- Búsqueda de producto por nombre o código
- Carrito de compra con cantidades editables
- Selección de método de pago: efectivo (USD o Bs) o Pago Móvil
- Conversión automática USD → Bs usando la tasa BCV del día
- Identificación del cliente: por cédula/ID o escaneo de código QR
- Opción de registrar la venta como fiado (cargo a cuenta del alumno)
- Impresión o generación de recibo digital (PDF o pantalla)
- Soporte para venta de menú del día y productos individuales

---

### 3.2 Módulo de Inventario

- Catálogo de hasta 50 productos (escalable)
- Campos por producto: nombre, categoría, precio en USD, stock actual, stock mínimo
- Alertas automáticas cuando el stock cae por debajo del mínimo configurado
- Registro de entradas de mercancía (proveedores)
- Historial de movimientos: entradas, salidas por venta, ajustes manuales
- Separación entre productos de tienda (snacks, bebidas) y menú del día

---

### 3.3 Módulo de Fiado y Cuentas de Alumnos

Cada alumno tiene una cuenta corriente en el sistema. El fiado funciona como saldo negativo; los abonos lo reponen.

- Registro de alumno: nombre, cédula, curso/sección, foto opcional, datos del representante
- Saldo actual (positivo = crédito prepagado, negativo = deuda)
- Historial completo: compras, abonos, pagos
- Sin límite de deuda por defecto (ajustable por el administrador)
- Vista de deudas pendientes filtrable por curso, monto, antigüedad

---

### 3.4 Módulo de Abonos y Pagos

El representante puede saldar la deuda de forma presencial o remota.

- **Pago presencial:** efectivo (USD/Bs) o Pago Móvil — el vendedor lo registra
- **Pago remoto:** el representante reporta la transferencia desde su portal
- El administrador valida y confirma el abono manualmente
- Opción futura: confirmación semiautomática vía webhook bancario
- Registro del comprobante: número de referencia, banco, monto, fecha
- Notificación automática al representante al confirmar el abono

---

### 3.5 Módulo de Tasa de Cambio BCV

Dado que los precios están en USD pero se cobra también en bolívares, el sistema mantiene la tasa actualizada.

- Scraping diario automático de la tasa oficial BCV (`bcv.org.ve`)
- El administrador puede sobreescribir la tasa manualmente si lo requiere
- La tasa activa se muestra claramente en el punto de venta
- Historial de tasas diarias para auditoría
- Toda transacción registra la tasa vigente en el momento de la venta

---

### 3.6 Portal del Representante

Vista simplificada y segura para padres y representantes. Acceso mediante enlace personalizado o credenciales propias.

- Saldo actual y deuda de cada hijo registrado
- Historial de compras del alumno (qué compró, cuándo, cuánto)
- Formulario para reportar abono/transferencia con datos del comprobante
- Recepción de notificaciones (ver sección 3.7)

---

### 3.7 Módulo de Notificaciones

| Evento | Canal |
|--------|-------|
| Nuevo fiado registrado al alumno | WhatsApp + Email al representante |
| Abono confirmado por el admin | WhatsApp + Email al representante |
| Saldo bajo en inventario | Email al administrador |
| Resumen diario de ventas | Email al administrador |
| Deuda supera umbral configurado | WhatsApp + Email al representante |

> **Integración WhatsApp:** vía Twilio WhatsApp API o Meta Cloud API (número de negocio requerido).

---

### 3.8 Módulo de Reportes y Estadísticas

Panel de control para el administrador con métricas clave del negocio:

- Cierre de caja diario: total vendido en USD y Bs, por método de pago
- Ranking de productos más vendidos (período configurable)
- Deudas pendientes por alumno y representante con antigüedad
- Rendimiento por vendedor: ventas, fiados otorgados, cobros realizados
- Gráficas de tendencia de ventas (semanal, mensual)
- Exportación de reportes en PDF y Excel

---

## 4. Arquitectura Técnica Recomendada

### 4.1 Stack Tecnológico

| Capa | Tecnología recomendada |
|------|------------------------|
| Frontend (Web + PWA) | Next.js 14 (React) + Tailwind CSS |
| Backend / API | Node.js con Express o Next.js API Routes |
| Base de datos | PostgreSQL (Supabase para MVP rápido) |
| Autenticación | NextAuth.js o Supabase Auth (JWT + roles) |
| Scraping BCV | Puppeteer / Cheerio (tarea cron diaria) |
| Notificaciones WhatsApp | Twilio WhatsApp API o Meta Cloud API |
| Notificaciones Email | Resend o SendGrid (plan gratuito suficiente) |
| Hosting | Vercel (frontend) + Railway o Render (backend) |
| Código QR alumnos | `qrcode` + `html5-qrcode` |

---

### 4.2 Modelo Multi-Tenant

El sistema se diseña desde el inicio para soportar múltiples cantinas/escuelas sin redeploy. Cada cantina es un "tenant" con su propio subdominio o identificador.

- Tabla `cantinas` como raíz del árbol de datos
- Todo registro (alumno, venta, producto) lleva `foreign key` de cantina
- El superadmin puede gestionar todas las cantinas desde un panel central
- Facturación por cantina (modelo SaaS futuro)

---

### 4.3 PWA y Conectividad Offline

Dado que la conectividad puede fallar, el sistema implementa estrategia offline-first para la caja:

- Service Worker con caché del catálogo y datos de alumnos
- Las ventas se encolan en IndexedDB si no hay internet
- Al recuperar conexión, se sincronizan automáticamente al servidor
- Indicador visual de estado de conexión en el punto de venta

---

### 4.4 Seguridad

- Contraseñas hasheadas con bcrypt
- JWT con expiración corta + refresh tokens
- HTTPS obligatorio en producción
- Los representantes solo ven datos de sus propios hijos
- Logs de auditoría para toda operación financiera (quién, qué, cuándo)

---

## 5. Modelo de Datos Principal

| Entidad | Campos clave |
|---------|-------------|
| `cantinas` | `id`, `nombre`, `escuela`, `dirección`, `config` (tasa_manual, límite_fiado) |
| `usuarios` | `id`, `cantina_id`, `nombre`, `email`, `rol` (admin\|vendedor\|representante\|directivo), `hash_pwd` |
| `alumnos` | `id`, `cantina_id`, `nombre`, `cedula`, `curso`, `foto_url`, `representante_id` |
| `cuentas_alumnos` | `id`, `alumno_id`, `saldo` (positivo=crédito, negativo=deuda) |
| `productos` | `id`, `cantina_id`, `nombre`, `categoria` (tienda\|menu), `precio_usd`, `stock`, `stock_min` |
| `ventas` | `id`, `cantina_id`, `vendedor_id`, `alumno_id`, `fecha`, `tasa_bcv`, `total_usd`, `total_bs`, `metodo_pago`, `es_fiado` |
| `detalle_ventas` | `id`, `venta_id`, `producto_id`, `cantidad`, `precio_usd_unitario` |
| `abonos` | `id`, `cuenta_alumno_id`, `monto_usd`, `monto_bs`, `metodo`, `referencia`, `estado` (pendiente\|confirmado), `confirmado_por` |
| `tasas_bcv` | `id`, `fecha`, `tasa_usd_bs`, `fuente` (automatica\|manual) |
| `notificaciones` | `id`, `usuario_id`, `tipo`, `canal`, `mensaje`, `enviado_at`, `estado` |

---

## 6. Plan de Desarrollo por Fases

### Fase 1 — MVP (8–10 semanas)

1. Autenticación y roles (admin, vendedor)
2. Gestión de productos e inventario básico
3. Punto de venta: venta directa y fiado
4. Cuentas de alumnos y registro de deudas
5. Scraping BCV y conversión USD/Bs en caja
6. Cierre de caja diario y reporte básico
7. Registro de abonos (manual por admin)

### Fase 2 — Portal Representantes y Notificaciones (4–5 semanas)

1. Portal web para representantes (vista saldo, historial)
2. Flujo de reporte de abono desde representante
3. Notificaciones por email (Resend/SendGrid)
4. Notificaciones por WhatsApp (Twilio)
5. Código QR para identificación de alumnos

### Fase 3 — Reportes Avanzados y Multi-sede (4–5 semanas)

1. Dashboard con estadísticas y gráficas
2. Exportación PDF y Excel de reportes
3. Soporte multi-tenant (varias cantinas)
4. Panel superadmin
5. Funcionalidad offline (PWA + IndexedDB)
6. Gestión de menú del día con precios variables

---

## 7. Consideraciones Específicas — Venezuela

| Desafío | Solución en CantinApp |
|---------|----------------------|
| Inflación y variación diaria del Bs | Precios en USD como moneda base; conversión a Bs en tiempo real con tasa BCV del día |
| Cortes de internet frecuentes | PWA con modo offline; cola de ventas sincronizada al restaurar conexión |
| Método de pago Pago Móvil | Campo de método de pago con opción Pago Móvil; registro de referencia bancaria |
| Uso intensivo de WhatsApp | Notificaciones vía WhatsApp Business API como canal primario |
| Dispositivos Android predominantes | PWA optimizada para Android; sin necesidad de Play Store |
| Infraestructura de hosting local limitada | Hosting en la nube internacional (Vercel + Railway) con baja latencia |
| Falta de formalización bancaria | Confirmación manual de transferencias sin dependencia de APIs bancarias |

---

## 8. Puntos a Definir Antes de Desarrollar

1. ¿Se requiere impresión de recibos? Si sí, ¿con impresora térmica o solo digital?
2. ¿El menú del día tiene precio fijo o varía cada jornada? ¿Quién lo configura?
3. ¿Se necesita un límite de fiado configurable por alumno en el futuro?
4. ¿Los representantes tendrán una cuenta por familia o una cuenta por alumno?
5. ¿Se requiere envío automático de resumen de deudas (semanal/mensual) a todos los representantes?
6. ¿Hay necesidad de gestionar categorías de descuento? (ej. niños becados)
7. ¿Se necesita integración con el sistema de matrículas de la escuela, o la base de alumnos es independiente?
8. ¿Quién pagará el hosting y las APIs de terceros (WhatsApp, email)? ¿Hay presupuesto definido?

---

## 9. Glosario

| Término | Definición |
|---------|-----------|
| **BCV** | Banco Central de Venezuela — fuente oficial de la tasa de cambio USD/Bs |
| **Pago Móvil** | Sistema de transferencia interbancaria instantánea venezolano vía número de teléfono y cédula |
| **Fiado** | Venta a crédito donde el cargo queda pendiente en la cuenta del alumno |
| **Abono** | Pago parcial o total que el representante realiza para saldar la deuda del alumno |
| **PWA** | Progressive Web App — aplicación web instalable que funciona como app nativa, incluso offline |
| **MVP** | Minimum Viable Product — versión funcional mínima con las funciones esenciales |
| **Multi-tenant** | Arquitectura donde una sola instancia del software sirve a múltiples cantinas/escuelas de forma aislada |
| **Tasa BCV** | Tipo de cambio oficial publicado diariamente por el Banco Central de Venezuela |

---

*CantinApp © 2025 — Documento Confidencial*
