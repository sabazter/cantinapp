-- AlterTable: agregar campo fiado_habilitado a alumnos (default false = deshabilitado)
ALTER TABLE "alumnos" ADD COLUMN "fiado_habilitado" BOOLEAN NOT NULL DEFAULT false;
