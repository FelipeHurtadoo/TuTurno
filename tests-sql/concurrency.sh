#!/usr/bin/env bash
# Pruebas de concurrencia (RNF04): muchos clientes escaneando a la vez. Requiere pgbench.
DB=${DB:-tuturno_test}
command -v pgbench >/dev/null || { echo "pgbench no está instalado: se omite la prueba de concurrencia"; exit 0; }
P() { psql -X -q -tA -d "$DB" "$@"; }
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

P -c "truncate tickets, queue_state, businesses cascade; truncate auth.users cascade;" >/dev/null 2>&1
P -c "insert into auth.users(id) values ('33333333-3333-3333-3333-333333333333')" >/dev/null
P >/dev/null <<'SQL'
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
select register_business('Carga','carga-test');
update businesses set plan='pro' where slug='carga-test';
SQL

echo "== 1) 25 clientes simultáneos x 40 turnos (plan pro, sin límite) =="
echo "select public.join_queue('carga-test','Cliente '||:client_id,null,gen_random_uuid(),true);" > "$TMP/join.sql"
pgbench -n -d "$DB" -f "$TMP/join.sql" -c 25 -j 5 -t 40 2>&1 | grep -E "transactions actually|failed"
R=$(P -c "select count(*)||' '||count(distinct number)||' '||max(number) from tickets")
set -- $R
if [ "$1" = "1000" ] && [ "$2" = "1000" ] && [ "$3" = "1000" ]; then echo "  ✅ 1000 turnos, 1000 números distintos, sin huecos"; else echo "  ❌ emitidos=$1 distintos=$2 max=$3"; exit 1; fi

echo "== 2) Límite del plan gratuito bajo carga: 200 intentos, límite 30 =="
P >/dev/null <<'SQL'
create or replace function public.try_join() returns text language plpgsql as $$
begin
  perform public.join_queue('carga-test','x',null,gen_random_uuid(),true);
  return 'ok';
exception when others then return sqlerrm;
end $$;
truncate tickets;
update businesses set plan='free', daily_limit=30 where slug='carga-test';
SQL
echo "select public.try_join();" > "$TMP/try.sql"
pgbench -n -d "$DB" -f "$TMP/try.sql" -c 25 -j 5 -t 8 2>&1 | grep -E "transactions actually"
N=$(P -c "select count(*) from tickets")
P -c "drop function public.try_join()" >/dev/null
if [ "$N" = "30" ]; then echo "  ✅ exactamente 30 turnos emitidos (los otros 170 fueron rechazados)"; else echo "  ❌ se emitieron $N turnos (esperado 30)"; exit 1; fi
