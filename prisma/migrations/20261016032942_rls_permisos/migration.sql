-- Row-Level Security, permisos por rol e inmutabilidad de auditoría.
--
-- Roles (creados por docker/postgres/01-roles.sh al inicializar el volumen):
--   cantinapp         dueño del esquema. Solo migraciones.
--   cantinapp_app     rutas API autenticadas. Sujeto a RLS; el contexto del request llega con
--                     set_config('app.cantina_id' | 'app.rol' | 'app.user_id', ..., true).
--   cantinapp_system  login, cron, registro, auditoría. BYPASSRLS, sin DDL.
--
-- Regla: si el contexto no está definido, las funciones devuelven NULL y toda política
-- evalúa a NULL = acceso denegado (deny-all por defecto).
--
-- Al añadir una tabla nueva en una migración futura: ENABLE + FORCE RLS, crear su política
-- y otorgar GRANTs explícitos (no hay privilegios por defecto).

-- ─── Contexto del request ────────────────────────────────────────────────────

CREATE FUNCTION app_cantina() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.cantina_id', true), '') $$;

CREATE FUNCTION app_rol() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.rol', true), '') $$;

CREATE FUNCTION app_user() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '') $$;

CREATE FUNCTION app_is_super() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce(app_rol() = 'superadmin', false) $$;

-- ─── Activar RLS en todas las tablas ─────────────────────────────────────────

ALTER TABLE cantinas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumnos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_alumnos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasas_bcv              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_intentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;

ALTER TABLE cantinas               FORCE ROW LEVEL SECURITY;
ALTER TABLE usuarios               FORCE ROW LEVEL SECURITY;
ALTER TABLE alumnos                FORCE ROW LEVEL SECURITY;
ALTER TABLE cuentas_alumnos        FORCE ROW LEVEL SECURITY;
ALTER TABLE productos              FORCE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario FORCE ROW LEVEL SECURITY;
ALTER TABLE tasas_bcv              FORCE ROW LEVEL SECURITY;
ALTER TABLE ventas                 FORCE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas         FORCE ROW LEVEL SECURITY;
ALTER TABLE abonos                 FORCE ROW LEVEL SECURITY;
ALTER TABLE notificaciones         FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens         FORCE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens  FORCE ROW LEVEL SECURITY;
ALTER TABLE login_intentos         FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             FORCE ROW LEVEL SECURITY;

-- ─── Políticas para cantinapp_app ────────────────────────────────────────────
-- login_intentos y password_reset_tokens: sin política = inaccesibles para la app (solo system).

CREATE POLICY tenant ON cantinas FOR ALL TO cantinapp_app
  USING      (app_is_super() OR id = app_cantina())
  WITH CHECK (app_is_super() OR id = app_cantina());

CREATE POLICY tenant ON usuarios FOR ALL TO cantinapp_app
  USING      (app_is_super() OR cantina_id = app_cantina())
  WITH CHECK (app_is_super() OR cantina_id = app_cantina());

-- Representantes y profesores solo ven/modifican a sus propios alumnos.
CREATE POLICY tenant ON alumnos FOR ALL TO cantinapp_app
  USING (
    app_is_super() OR (
      cantina_id = app_cantina()
      AND (app_rol() NOT IN ('representante', 'profesor') OR representante_id = app_user())
    )
  )
  WITH CHECK (
    app_is_super() OR (
      cantina_id = app_cantina()
      AND (app_rol() NOT IN ('representante', 'profesor') OR representante_id = app_user())
    )
  );

-- Las subconsultas heredan la RLS de la tabla padre (se evalúan con los derechos del invocador).
CREATE POLICY tenant ON cuentas_alumnos FOR ALL TO cantinapp_app
  USING      (EXISTS (SELECT 1 FROM alumnos a WHERE a.id = cuentas_alumnos.alumno_id))
  WITH CHECK (EXISTS (SELECT 1 FROM alumnos a WHERE a.id = cuentas_alumnos.alumno_id));

CREATE POLICY tenant ON abonos FOR ALL TO cantinapp_app
  USING      (EXISTS (SELECT 1 FROM cuentas_alumnos c WHERE c.id = abonos.cuenta_alumno_id))
  WITH CHECK (EXISTS (SELECT 1 FROM cuentas_alumnos c WHERE c.id = abonos.cuenta_alumno_id));

CREATE POLICY tenant ON productos FOR ALL TO cantinapp_app
  USING      (app_is_super() OR cantina_id = app_cantina())
  WITH CHECK (app_is_super() OR cantina_id = app_cantina());

CREATE POLICY tenant ON movimientos_inventario FOR ALL TO cantinapp_app
  USING      (EXISTS (SELECT 1 FROM productos p WHERE p.id = movimientos_inventario.producto_id))
  WITH CHECK (EXISTS (SELECT 1 FROM productos p WHERE p.id = movimientos_inventario.producto_id));

CREATE POLICY tenant ON tasas_bcv FOR ALL TO cantinapp_app
  USING      (app_is_super() OR cantina_id = app_cantina())
  WITH CHECK (app_is_super() OR cantina_id = app_cantina());

CREATE POLICY tenant ON ventas FOR ALL TO cantinapp_app
  USING (
    app_is_super() OR (
      cantina_id = app_cantina()
      AND (
        app_rol() NOT IN ('representante', 'profesor')
        OR EXISTS (SELECT 1 FROM alumnos a WHERE a.id = ventas.alumno_id)
      )
    )
  )
  WITH CHECK (app_is_super() OR cantina_id = app_cantina());

CREATE POLICY tenant ON detalle_ventas FOR ALL TO cantinapp_app
  USING      (EXISTS (SELECT 1 FROM ventas v WHERE v.id = detalle_ventas.venta_id))
  WITH CHECK (EXISTS (SELECT 1 FROM ventas v WHERE v.id = detalle_ventas.venta_id));

CREATE POLICY tenant ON notificaciones FOR ALL TO cantinapp_app
  USING      (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = notificaciones.usuario_id))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = notificaciones.usuario_id));

CREATE POLICY tenant ON refresh_tokens FOR ALL TO cantinapp_app
  USING      (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = refresh_tokens.usuario_id))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = refresh_tokens.usuario_id));

-- Lectura de auditoría: solo admin de la cantina o superadmin. La escritura es exclusiva de system.
CREATE POLICY lectura ON audit_logs FOR SELECT TO cantinapp_app
  USING (app_is_super() OR (app_rol() = 'admin' AND cantina_id = app_cantina()));

-- ─── Permisos (GRANT) ────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO cantinapp_app, cantinapp_system;
GRANT EXECUTE ON FUNCTION app_cantina(), app_rol(), app_user(), app_is_super()
  TO cantinapp_app, cantinapp_system;

-- App: lectura/escritura sin DELETE físico (soft delete) en tablas financieras.
GRANT SELECT, INSERT, UPDATE ON
  usuarios, alumnos, cuentas_alumnos, productos, tasas_bcv, notificaciones, refresh_tokens,
  ventas, detalle_ventas, abonos, movimientos_inventario
  TO cantinapp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cantinas TO cantinapp_app;
GRANT SELECT ON audit_logs TO cantinapp_app;

-- System: sin DELETE en ninguna tabla; audit_logs solo se inserta y se lee.
GRANT SELECT, INSERT, UPDATE ON
  cantinas, usuarios, alumnos, cuentas_alumnos, productos, tasas_bcv, notificaciones,
  refresh_tokens, password_reset_tokens, login_intentos,
  ventas, detalle_ventas, abonos, movimientos_inventario
  TO cantinapp_system;
GRANT SELECT, INSERT ON audit_logs TO cantinapp_system;

-- ─── audit_logs inmutable ────────────────────────────────────────────────────

CREATE FUNCTION audit_logs_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es inmutable: % no permitido', TG_OP;
END;
$$;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_inmutable();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_inmutable();
