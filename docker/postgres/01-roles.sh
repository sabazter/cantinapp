#!/bin/sh
# Se ejecuta una sola vez, al inicializar el volumen de Postgres.
#  - cantinapp         : dueño del esquema (POSTGRES_USER). Solo para migraciones.
#  - cantinapp_app     : usado por las rutas API. Sujeto a Row-Level Security.
#  - cantinapp_system  : login, cron, auditoría y registro. BYPASSRLS, sin DDL.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE cantinapp_app    LOGIN PASSWORD '${APP_DB_PASSWORD}'    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  CREATE ROLE cantinapp_system LOGIN PASSWORD '${SYSTEM_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO cantinapp_app, cantinapp_system;
EOSQL
