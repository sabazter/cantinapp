-- AlterEnum
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'alumno';

-- Actualizar política RLS para alumnos
DROP POLICY IF EXISTS tenant ON alumnos;
CREATE POLICY tenant ON alumnos FOR ALL TO cantinapp_app
  USING (
    app_is_super() OR (
      cantina_id = app_cantina()
      AND (
        (app_rol() NOT IN ('representante', 'profesor', 'alumno'))
        OR (app_rol() IN ('representante', 'profesor') AND representante_id = app_user())
        OR (app_rol() = 'alumno' AND (id = app_user() OR representante_id = app_user()))
      )
    )
  )
  WITH CHECK (
    app_is_super() OR (
      cantina_id = app_cantina()
      AND (
        (app_rol() NOT IN ('representante', 'profesor', 'alumno'))
        OR (app_rol() IN ('representante', 'profesor') AND representante_id = app_user())
        OR (app_rol() = 'alumno' AND (id = app_user() OR representante_id = app_user()))
      )
    )
  );

DROP POLICY IF EXISTS tenant ON ventas;
CREATE POLICY tenant ON ventas FOR ALL TO cantinapp_app
  USING (
    app_is_super() OR (
      cantina_id = app_cantina()
      AND (
        app_rol() NOT IN ('representante', 'profesor', 'alumno')
        OR EXISTS (SELECT 1 FROM alumnos a WHERE a.id = ventas.alumno_id)
      )
    )
  )
  WITH CHECK (app_is_super() OR cantina_id = app_cantina());
