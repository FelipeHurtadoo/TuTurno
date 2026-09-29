#!/usr/bin/env bash
# Pruebas del supabase/schema.sql contra un PostgreSQL real. Cada llamada corre con el rol indicado
# (anon / authenticated) y un auth.uid() simulado. Se ejecuta desde run.sh.
DB=${DB:-tuturno_test}
PASS=0; FAIL=0
psqlq() { psql -X -q -tA -d "$DB" "$@"; }
sup() { psqlq -c "$1" 2>&1; }
# q ROLE SUB SQL  -> ejecuta como ese rol y (opcional) ese auth.uid()
q() {
  local role="$1" sub="$2" sql="$3"
  psqlq 2>&1 <<SQL | grep -v '^set_config$' | grep -v '^SET$' | sed '/^$/d'
set role $role;
select set_config('request.jwt.claim.sub', '$sub', false) \gset
$sql
SQL
}
check() { # check "nombre" "salida" "patrón esperado"
  if echo "$2" | grep -q -- "$3"; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; echo "     obtenido: $2"; echo "     esperado: $3"; fi
}

sup "truncate public.tickets, public.queue_state, public.businesses cascade; truncate auth.users cascade;" >/dev/null
UA=11111111-1111-1111-1111-111111111111; UB=22222222-2222-2222-2222-222222222222
sup "insert into auth.users(id,email) values ('$UA','a@x.co'),('$UB','b@x.co')" >/dev/null

echo "== Registro de negocios (RF01) =="
out=$(q authenticated $UA "select register_business('Peluquería Ana','pelu-ana-x1');")
check "A registra su negocio" "$out" '"slug": "pelu-ana-x1"'
out=$(q authenticated $UA "select register_business('Otra','otra-slug');")
check "A no puede tener 2 negocios" "$out" 'YA_TIENES_NEGOCIO'
out=$(q authenticated $UB "select register_business('Clon','pelu-ana-x1');")
check "slug duplicado rechazado" "$out" 'SLUG_EN_USO'
out=$(q authenticated $UB "select register_business('Barbería Beto','barberia-beto-z9');")
check "B registra su negocio" "$out" '"slug": "barberia-beto-z9"'
out=$(q anon "" "select register_business('Anon','anon-slug');")
check "anon NO puede registrar negocio (permiso denegado)" "$out" 'permission denied'

BA=$(sup "select id from businesses where slug='pelu-ana-x1'")
BB=$(sup "select id from businesses where slug='barberia-beto-z9'")

echo "== Aislamiento de datos y RLS (RNF05) =="
out=$(q anon "" "select * from tickets;");                         check "anon no lee tickets" "$out" 'permission denied'
out=$(q anon "" "select * from businesses;");                      check "anon no lee businesses" "$out" 'permission denied'
out=$(q authenticated $UA "select * from tickets;");               check "dueño no lee tickets directo" "$out" 'permission denied'
out=$(q authenticated $UA "insert into tickets(business_id,number,customer_name) values ('$BA',99,'x');"); check "dueño no inserta tickets directo" "$out" 'permission denied'
out=$(q authenticated $UA "update businesses set plan='pro' where id='$BA';"); check "dueño NO puede subirse a plan pro" "$out" 'permission denied'
out=$(q authenticated $UA "select count(*) from businesses;");     check "A solo ve 1 negocio (el suyo)" "$out" '^1$'
out=$(q authenticated $UA "select get_admin_snapshot('$BB');");    check "A no ve el panel del negocio de B" "$out" 'SIN_PERMISO'
out=$(q authenticated $UA "select call_next('$BB');");             check "A no puede llamar turnos en el negocio de B" "$out" 'SIN_PERMISO'
out=$(q authenticated $UA "select admin_add_ticket('$BB','Intruso');"); check "A no puede agregar turnos en el negocio de B" "$out" 'SIN_PERMISO'
out=$(q anon "" "select call_next('$BA');");                       check "anon no ejecuta call_next" "$out" 'permission denied'
out=$(q anon "" "select get_admin_snapshot('$BA');");              check "anon no ejecuta get_admin_snapshot" "$out" 'permission denied'
out=$(q anon "" "select _create_ticket('$BA','x',null,null,'manual',false);"); check "anon no ejecuta función interna" "$out" 'permission denied'
out=$(q authenticated $UA "select _create_ticket('$BA','x',null,null,'manual',false);"); check "dueño no ejecuta función interna" "$out" 'permission denied'
out=$(q anon "" "select purge_old_tickets(0);");                   check "anon no ejecuta purge" "$out" 'permission denied'
out=$(q authenticated "" "select get_admin_snapshot('$BA');");     check "sin sesión (uid nulo) → NO_AUTENTICADO" "$out" 'NO_AUTENTICADO'

echo "== Ingreso del cliente (RF03) =="
D1=aaaaaaaa-0000-0000-0000-000000000001; D2=aaaaaaaa-0000-0000-0000-000000000002
out=$(q anon "" "select join_queue('pelu-ana-x1','Luis',null,'$D1',false);"); check "sin consentimiento → rechazado" "$out" 'CONSENTIMIENTO_REQUERIDO'
out=$(q anon "" "select join_queue('pelu-ana-x1','   ',null,'$D1',true);");  check "nombre vacío → rechazado" "$out" 'NOMBRE_INVALIDO'
out=$(q anon "" "select join_queue('pelu-ana-x1','Luis','abc',null,true);");  check "celular inválido → rechazado" "$out" 'CELULAR_INVALIDO'
out=$(q anon "" "select join_queue('no-existe','Luis',null,null,true);");     check "negocio inexistente" "$out" 'NEGOCIO_NO_ENCONTRADO'
out=$(q anon "" "select join_queue('PELU-ANA-X1','Luis','300 123 4567','$D1',true);"); check "turno 1 (slug en mayúsculas ok)" "$out" '"number": 1'
T1=$(echo "$out" | sed -n 's/.*"token": "\([^"]*\)".*/\1/p')
out=$(q anon "" "select join_queue('pelu-ana-x1','Luis otra vez',null,'$D1',true);"); check "mismo dispositivo → mismo turno (already_had)" "$out" '"already_had": true'
out=$(q anon "" "select join_queue('pelu-ana-x1','María',null,'$D2',true);"); check "otro dispositivo → turno 2" "$out" '"number": 2'
T2=$(echo "$out" | sed -n 's/.*"token": "\([^"]*\)".*/\1/p')
out=$(q anon "" "select join_queue('barberia-beto-z9','Pedro',null,'$D1',true);"); check "numeración independiente por negocio" "$out" '"number": 1'
out=$(q authenticated $UA "select admin_add_ticket('$BA','Cliente sin celular');"); check "admin agrega turno manual (R9) → turno 3" "$out" '"number": 3'

echo "== Estado del turno del cliente (RF04) =="
out=$(q anon "" "select get_ticket_status('$T2');")
check "turno 2 con 1 persona delante" "$out" '"people_ahead": 1'
check "estado del turno = waiting" "$out" '"status": "waiting"'
out=$(q anon "" "select get_ticket_status('00000000-0000-0000-0000-000000000000');"); check "token desconocido → found:false" "$out" '"found": false'

echo "== Flujo del panel (RF05, RF06) =="
out=$(q authenticated $UA "select call_next('$BA');");  check "llamar siguiente → turno 1" "$out" '"number": 1'
out=$(q authenticated $UA "select call_next('$BA');");  check "no llama otro con uno en curso" "$out" 'TURNO_EN_CURSO'
out=$(q anon "" "select get_ticket_status('$T1');");    check "cliente 1 ve status=called" "$out" '"status": "called"'
out=$(q authenticated $UA "select call_next('$BA','attended');"); check "atender y llamar siguiente → turno 2" "$out" '"number": 2'
out=$(q anon "" "select get_ticket_status('$T1');");    check "turno 1 quedó attended" "$out" '"status": "attended"'
out=$(q anon "" "select get_ticket_status('$T2');");    check "turno 2 ahora en atención (now_serving=2)" "$out" '"now_serving": 2'
TID1=$(sup "select id from tickets where business_id='$BA' and number=1")
TID3=$(sup "select id from tickets where business_id='$BA' and number=3")
out=$(q authenticated $UA "select resolve_ticket('$TID1','absent');"); check "attended→absent es inválido" "$out" 'TRANSICION_INVALIDA'
out=$(q authenticated $UA "select resolve_ticket('$TID3','attended');"); check "waiting→attended es inválido" "$out" 'TRANSICION_INVALIDA'
out=$(q authenticated $UA "select resolve_ticket('$TID3','bogus');"); check "estado inventado rechazado" "$out" 'ESTADO_INVALIDO'
out=$(q authenticated $UB "select resolve_ticket('$TID3','absent');"); check "B no puede resolver turnos de A" "$out" 'SIN_PERMISO'
out=$(q authenticated $UA "select call_next('$BA','absent');"); check "ausente y llamar siguiente → turno 3" "$out" '"number": 3'
out=$(q authenticated $UA "select call_next('$BA','attended');"); check "sin más en espera → called:null" "$out" '"called": null'

echo "== Pantalla pública (RF07, RNF06) =="
q anon "" "select join_queue('pelu-ana-x1','Secreto Nombre','311 999 8888','aaaaaaaa-0000-0000-0000-000000000009',true);" >/dev/null
out=$(q anon "" "select get_public_board('pelu-ana-x1');")
check "board muestra números" "$out" '"waiting_count": 1'
if echo "$out" | grep -qi -e 'Secreto' -e '311' -e 'customer'; then FAIL=$((FAIL+1)); echo "  ❌ el board filtra datos personales: $out"; else PASS=$((PASS+1)); echo "  ✅ el board NO contiene nombres ni celulares"; fi

echo "== Salirse de la fila =="
out=$(q anon "" "select join_queue('pelu-ana-x1','Saliente',null,'aaaaaaaa-0000-0000-0000-000000000008',true);")
TS=$(echo "$out" | sed -n 's/.*"token": "\([^"]*\)".*/\1/p')
out=$(q anon "" "select cancel_my_ticket('$TS');"); check "cliente cancela su turno en espera" "$out" '"cancelled": true'
out=$(q anon "" "select cancel_my_ticket('$T1');"); check "no puede cancelar turno ya atendido" "$out" '"cancelled": false'

echo "== Límite del plan gratuito (RF10) =="
sup "update businesses set daily_limit=3 where slug='barberia-beto-z9'" >/dev/null
q anon "" "select join_queue('barberia-beto-z9','N2',null,'bbbbbbbb-0000-0000-0000-000000000002',true);" >/dev/null
q anon "" "select join_queue('barberia-beto-z9','N3',null,'bbbbbbbb-0000-0000-0000-000000000003',true);" >/dev/null
out=$(q anon "" "select get_join_info('barberia-beto-z9');"); check "con 3/3 emitidos: accepting=false" "$out" '"accepting": false'
out=$(q anon "" "select join_queue('barberia-beto-z9','N4',null,'bbbbbbbb-0000-0000-0000-000000000004',true);"); check "el 4.º turno se rechaza en el servidor" "$out" 'LIMITE_DIARIO'
out=$(q authenticated $UB "select admin_add_ticket('$BB','Manual extra');"); check "el límite también aplica al turno manual" "$out" 'LIMITE_DIARIO'
sup "update businesses set plan='pro' where slug='barberia-beto-z9'" >/dev/null
out=$(q anon "" "select join_queue('barberia-beto-z9','N4',null,'bbbbbbbb-0000-0000-0000-000000000004',true);"); check "plan pro: sin límite" "$out" '"number": 4'

echo "== Estadísticas (RF09) =="
out=$(q authenticated $UA "select get_admin_snapshot('$BA');")
check "estadística: 2 atendidos (turnos 1 y 3)" "$out" '"attended": 2'
check "estadística: 5 emitidos = 2+1+1+1" "$out" '"issued": 5'
check "estadística: 1 ausente" "$out" '"absent": 1'
check "estadística: tiene avg_wait_seconds" "$out" '"avg_wait_seconds": [0-9]'
check "lista de tickets del día incluida" "$out" '"tickets": \['

echo "== Tiempo real =="
before=$(sup "select updated_at from queue_state where business_id='$BA'")
sleep 0.05; q anon "" "select join_queue('pelu-ana-x1','Trigger',null,'aaaaaaaa-0000-0000-0000-000000000007',true);" >/dev/null
after=$(sup "select updated_at from queue_state where business_id='$BA'")
if [ "$before" != "$after" ]; then PASS=$((PASS+1)); echo "  ✅ cada cambio toca queue_state (dispara Realtime)"; else FAIL=$((FAIL+1)); echo "  ❌ queue_state no cambió"; fi
out=$(q anon "" "select count(*) from queue_state;"); check "anon puede leer queue_state (para Realtime)" "$out" '^[0-9]'
out=$(q anon "" "select * from queue_state limit 1;"); if echo "$out" | grep -q 'customer'; then echo "  ❌"; FAIL=$((FAIL+1)); else PASS=$((PASS+1)); echo "  ✅ queue_state no contiene datos personales"; fi

echo; echo "RESULTADO: $PASS pruebas OK, $FAIL fallidas"
[ $FAIL -eq 0 ]
