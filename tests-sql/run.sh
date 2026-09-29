#!/usr/bin/env bash
# Corre TODAS las pruebas SQL contra un PostgreSQL local DESECHABLE.
#   Requisitos: psql (y opcionalmente pgbench) y un servidor PostgreSQL local con un usuario superusuario.
#   Uso:  PGHOST=localhost PGUSER=postgres PGPASSWORD=tu_clave ./tests-sql/run.sh
# ¡Crea y BORRA la base de datos "tuturno_test"! Nunca la apuntes a una base real.
set -euo pipefail
cd "$(dirname "$0")"
export DB=${DB:-tuturno_test}
export PGHOST=${PGHOST:-localhost} PGUSER=${PGUSER:-postgres}
[[ "$DB" == *_test ]] || { echo "Por seguridad, DB debe terminar en _test"; exit 1; }

psql -X -q -d postgres -c "drop database if exists $DB" -c "create database $DB" 2>/dev/null
psql -X -q -d "$DB" -f shim.sql 2>/dev/null                       # imita roles y auth.uid() de Supabase
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f ../supabase/schema.sql 2>/dev/null && echo "✅ schema.sql aplica sin errores"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f ../supabase/schema.sql 2>/dev/null && echo "✅ schema.sql es re-ejecutable (idempotente)"
echo
bash ./run_tests.sh
echo
bash ./concurrency.sh
