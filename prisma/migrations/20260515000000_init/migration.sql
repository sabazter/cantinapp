◇ injected env (1) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
◇ injected env (12) from .env.local // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('admin', 'vendedor', 'representante', 'directivo', 'superadmin');

-- CreateEnum
CREATE TYPE "CategoriaProducto" AS ENUM ('tienda', 'menu');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('entrada', 'venta', 'ajuste');

-- CreateEnum
CREATE TYPE "FuenteTasa" AS ENUM ('automatica', 'manual');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('efectivo_usd', 'efectivo_bs', 'pago_movil', 'fiado');

-- CreateEnum
CREATE TYPE "MetodoAbono" AS ENUM ('efectivo_usd', 'efectivo_bs', 'pago_movil', 'transferencia');

-- CreateEnum
CREATE TYPE "EstadoAbono" AS ENUM ('pendiente', 'confirmado', 'rechazado');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('fiado_registrado', 'abono_confirmado', 'deuda_alta', 'stock_bajo', 'resumen_diario', 'abono_pendiente');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('email', 'whatsapp');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('pendiente', 'enviado', 'error');

-- CreateTable
CREATE TABLE "cantinas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "escuela" TEXT NOT NULL,
    "direccion" TEXT,
    "tasa_manual" DECIMAL(12,4),
    "limite_fiado_usd" DECIMAL(10,2),
    "umbral_deuda_usd" DECIMAL(10,2) NOT NULL DEFAULT 20,
    "notif_email" BOOLEAN NOT NULL DEFAULT true,
    "notif_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cantinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "cantina_id" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hash_pwd" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "mfa_secret" TEXT,
    "mfa_habilitado" BOOLEAN NOT NULL DEFAULT false,
    "email_verificado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_intentos" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "exitoso" BOOLEAN NOT NULL,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_intentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "cantina_id" TEXT,
    "evento" TEXT NOT NULL,
    "entidad" TEXT,
    "entidad_id" TEXT,
    "datos" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumnos" (
    "id" TEXT NOT NULL,
    "cantina_id" TEXT NOT NULL,
    "representante_id" TEXT,
    "nombre" TEXT NOT NULL,
    "cedula_encriptada" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "seccion" TEXT,
    "foto_url" TEXT,
    "qr_code" TEXT,
    "limite_fiado_usd" DECIMAL(10,2),
    "consentimiento_ip" TEXT,
    "consentimiento_at" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_alumnos" (
    "id" TEXT NOT NULL,
    "alumno_id" TEXT NOT NULL,
    "saldo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "cantina_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaProducto" NOT NULL DEFAULT 'tienda',
    "precio_usd" DECIMAL(10,4) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_min" INTEGER NOT NULL DEFAULT 5,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "usuario_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasas_bcv" (
    "id" TEXT NOT NULL,
    "cantina_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tasa_usd_bs" DECIMAL(12,4) NOT NULL,
    "fuente" "FuenteTasa" NOT NULL DEFAULT 'automatica',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasas_bcv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "cantina_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "alumno_id" TEXT,
    "tasa_bcv" DECIMAL(12,4) NOT NULL,
    "total_usd" DECIMAL(10,4) NOT NULL,
    "total_bs" DECIMAL(14,4) NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "es_fiado" BOOLEAN NOT NULL DEFAULT false,
    "referencia" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "deleted_motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_ventas" (
    "id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_usd_unitario" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "detalle_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abonos" (
    "id" TEXT NOT NULL,
    "cuenta_alumno_id" TEXT NOT NULL,
    "monto_usd" DECIMAL(10,4) NOT NULL,
    "monto_bs" DECIMAL(14,4),
    "tasa_bcv" DECIMAL(12,4),
    "metodo" "MetodoAbono" NOT NULL,
    "referencia_encriptada" TEXT,
    "banco" TEXT,
    "comprobante_url" TEXT,
    "estado" "EstadoAbono" NOT NULL DEFAULT 'pendiente',
    "confirmado_por" TEXT,
    "confirmado_at" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'pendiente',
    "enviado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuario_id_idx" ON "refresh_tokens"("usuario_id");

-- CreateIndex
CREATE INDEX "login_intentos_email_created_at_idx" ON "login_intentos"("email", "created_at");

-- CreateIndex
CREATE INDEX "login_intentos_ip_created_at_idx" ON "login_intentos"("ip", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_cantina_id_created_at_idx" ON "audit_logs"("cantina_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_usuario_id_created_at_idx" ON "audit_logs"("usuario_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_evento_created_at_idx" ON "audit_logs"("evento", "created_at");

-- CreateIndex
CREATE INDEX "alumnos_cantina_id_idx" ON "alumnos"("cantina_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_alumnos_alumno_id_key" ON "cuentas_alumnos"("alumno_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasas_bcv_cantina_id_fecha_key" ON "tasas_bcv"("cantina_id", "fecha");

-- CreateIndex
CREATE INDEX "ventas_cantina_id_created_at_idx" ON "ventas"("cantina_id", "created_at");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cantina_id_fkey" FOREIGN KEY ("cantina_id") REFERENCES "cantinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_cantina_id_fkey" FOREIGN KEY ("cantina_id") REFERENCES "cantinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_representante_id_fkey" FOREIGN KEY ("representante_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_alumnos" ADD CONSTRAINT "cuentas_alumnos_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_cantina_id_fkey" FOREIGN KEY ("cantina_id") REFERENCES "cantinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasas_bcv" ADD CONSTRAINT "tasas_bcv_cantina_id_fkey" FOREIGN KEY ("cantina_id") REFERENCES "cantinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cantina_id_fkey" FOREIGN KEY ("cantina_id") REFERENCES "cantinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_ventas" ADD CONSTRAINT "detalle_ventas_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_ventas" ADD CONSTRAINT "detalle_ventas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_cuenta_alumno_id_fkey" FOREIGN KEY ("cuenta_alumno_id") REFERENCES "cuentas_alumnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_confirmado_por_fkey" FOREIGN KEY ("confirmado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

