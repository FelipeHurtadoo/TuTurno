-- =====================================================================
-- TuTurno · Esquema de base de datos para Supabase (PostgreSQL)
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Es re-ejecutable: puedes correrlo de nuevo sin borrar datos.
--
-- MODELO DE SEGURIDAD (léelo antes de tocar nada):
--  1. Todas las tablas tienen Row Level Security (RLS) activo.
--  2. Nadie escribe en las tablas directamente desde el navegador: todas las
--     escrituras pasan por funciones SECURITY DEFINER que validan la entrada
--     y, cuando aplica, que el usuario sea el DUEÑO del negocio (auth.uid()).
--  3. Los clientes (anónimos) no pueden leer la tabla de turnos. Solo conocen
--     su turno por un token secreto aleatorio y ven números, nunca nombres.
--  4. Las funciones se revocan de PUBLIC/anon y se otorgan una por una.
-- =====================================================================

-- ---------- Utilidades ------------------------------------------------

-- "Hoy" según la hora de Colombia: los turnos se numeran y reinician por día.
create or replace function public.bogota_today()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Bogota')::date $$;

-- ---------- Tablas ----------------------------------------------------

create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  -- Límite de turnos EMITIDOS por día. Solo aplica al plan 'free' (RF10).
  daily_limit integer not null default 30 check (daily_limit > 0),
  created_at  timestamptz not null default now(),
  constraint businesses_slug_key unique (slug),
  constraint businesses_owner_id_key unique (owner_id)  -- 1 negocio por cuenta (sin multi-sede en el MVP)
);

create table if not exists public.tickets (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  ticket_date    date not null default public.bogota_today(),
  number         integer not null check (number > 0),
  customer_name  text not null check (char_length(customer_name) between 1 and 60),
  customer_phone text check (customer_phone is null or customer_phone ~ '^[0-9+ ()-]{7,20}$'),
  device_id      uuid,                                   -- evita turnos dobles por escanear el QR dos veces
  token          uuid not null default gen_random_uuid(), -- secreto del cliente para ver SU turno
  status         text not null default 'waiting'
                   check (status in ('waiting', 'called', 'attended', 'absent', 'cancelled')),
  source         text not null default 'qr' check (source in ('qr', 'manual')),
  consent_at     timestamptz,                             -- autorización de tratamiento de datos (Ley 1581)
  created_at     timestamptz not null default now(),
  called_at      timestamptz,
  finished_at    timestamptz,
  constraint tickets_token_key unique (token),
  -- Red de seguridad extra contra duplicados (RNF04): jamás dos turnos con el mismo número el mismo día.
  constraint tickets_unique_number_per_day unique (business_id, ticket_date, number)
);

create index if not exists tickets_business_day_idx on public.tickets (business_id, ticket_date, status, number);
create index if not exists tickets_device_idx on public.tickets (business_id, device_id) where device_id is not null;

-- Tabla mínima solo para avisar cambios en tiempo real (sin datos personales).
create table if not exists public.queue_state (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  updated_at  timestamptz not null default now()
);

-- Cada cambio en un turno "toca" queue_state → Supabase Realtime avisa a los celulares y a la pantalla.
create or replace function public.touch_queue_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.queue_state (business_id, updated_at)
  values (new.business_id, clock_timestamp())
  on conflict (business_id) do update set updated_at = clock_timestamp();
  return null;
end;
$$;

drop trigger if exists tickets_touch_queue_state on public.tickets;
create trigger tickets_touch_queue_state
  after insert or update on public.tickets
  for each row execute function public.touch_queue_state();

-- ---------- RLS y permisos sobre tablas --------------------------------

alter table public.businesses enable row level security;
alter table public.tickets    enable row level security;
alter table public.queue_state enable row level security;

revoke all on public.businesses, public.tickets, public.queue_state from anon, authenticated;

-- El dueño puede LEER su negocio. Nada más (no hay políticas de insert/update/delete).
grant select on public.businesses to authenticated;
drop policy if exists businesses_select_own on public.businesses;
create policy businesses_select_own on public.businesses
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- queue_state solo contiene business_id + updated_at: se puede leer para escuchar Realtime.
grant select on public.queue_state to anon, authenticated;
drop policy if exists queue_state_select_all on public.queue_state;
create policy queue_state_select_all on public.queue_state
  for select to anon, authenticated
  using (true);

-- tickets: RLS activo y SIN políticas → ni anon ni authenticated pueden leerla ni escribirla directo.
-- Todo el acceso es por las funciones de abajo.

-- ---------- Funciones internas (no expuestas) --------------------------

create or replace function public._assert_owner(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO';
  end if;
  if not exists (
    select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()
  ) then
    raise exception 'SIN_PERMISO';
  end if;
end;
$$;

-- Crea un turno de forma atómica. Bloquea la fila del negocio, así dos personas que
-- escanean a la vez SIEMPRE reciben números distintos (RNF04).
create or replace function public._create_ticket(
  p_business_id uuid,
  p_name        text,
  p_phone       text,
  p_device      uuid,
  p_source      text,
  p_consent     boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_today    date := public.bogota_today();
  v_name     text := btrim(coalesce(p_name, ''));
  v_phone    text := nullif(btrim(coalesce(p_phone, '')), '');
  v_existing public.tickets%rowtype;
  v_issued   integer;
  v_last     integer;
  v_new      public.tickets%rowtype;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'NOMBRE_INVALIDO';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9+ ()-]{7,20}$' then
    raise exception 'CELULAR_INVALIDO';
  end if;
  if p_source = 'qr' and coalesce(p_consent, false) is not true then
    raise exception 'CONSENTIMIENTO_REQUERIDO';
  end if;

  -- Serializa la creación de turnos por negocio.
  select * into v_business from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;

  -- Si este mismo dispositivo ya tiene un turno activo hoy, se devuelve ese (evita dobles).
  if p_source = 'qr' and p_device is not null then
    select * into v_existing
      from public.tickets
     where business_id = p_business_id
       and ticket_date = v_today
       and device_id = p_device
       and status in ('waiting', 'called')
     order by number desc
     limit 1;
    if found then
      return jsonb_build_object(
        'id', v_existing.id, 'number', v_existing.number,
        'token', v_existing.token, 'already_had', true
      );
    end if;
  end if;

  select count(*), coalesce(max(number), 0)
    into v_issued, v_last
    from public.tickets
   where business_id = p_business_id and ticket_date = v_today;

  -- RF10: el límite diario se aplica AQUÍ (servidor), no solo en la interfaz.
  if v_business.plan = 'free' and v_issued >= v_business.daily_limit then
    raise exception 'LIMITE_DIARIO';
  end if;

  insert into public.tickets (
    business_id, ticket_date, number, customer_name, customer_phone,
    device_id, source, consent_at
  ) values (
    p_business_id, v_today, v_last + 1, v_name, v_phone,
    case when p_source = 'qr' then p_device else null end,
    p_source,
    case when p_source = 'qr' then now() else null end
  )
  returning * into v_new;

  return jsonb_build_object(
    'id', v_new.id, 'number', v_new.number, 'token', v_new.token, 'already_had', false
  );
end;
$$;

-- ---------- Funciones públicas para CLIENTES (anon) --------------------

-- Datos mínimos del negocio para pintar la página de ingreso a la fila.
create or replace function public.get_join_info(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_issued   integer;
begin
  select * into v_business from public.businesses where slug = lower(btrim(p_slug));
  if not found then
    return jsonb_build_object('found', false);
  end if;

  select count(*) into v_issued
    from public.tickets
   where business_id = v_business.id and ticket_date = public.bogota_today();

  return jsonb_build_object(
    'found', true,
    'id', v_business.id,
    'name', v_business.name,
    'slug', v_business.slug,
    'accepting', not (v_business.plan = 'free' and v_issued >= v_business.daily_limit)
  );
end;
$$;

-- RF03: el cliente se une con nombre (y celular opcional). Sin cuenta, sin app.
create or replace function public.join_queue(
  p_slug    text,
  p_name    text,
  p_phone   text    default null,
  p_device  uuid    default null,
  p_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.businesses where slug = lower(btrim(p_slug));
  if v_id is null then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  return public._create_ticket(v_id, p_name, p_phone, p_device, 'qr', p_consent);
end;
$$;

-- RF04: estado del turno del cliente. Solo se accede con el token secreto.
create or replace function public.get_ticket_status(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t       public.tickets%rowtype;
  v_b       public.businesses%rowtype;
  v_now     integer;
  v_ahead   integer := 0;
  v_avg     numeric;
begin
  select * into v_t from public.tickets where token = p_token;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  select * into v_b from public.businesses where id = v_t.business_id;

  -- "En atención" = el último número llamado ese día.
  select number into v_now
    from public.tickets
   where business_id = v_t.business_id and ticket_date = v_t.ticket_date and called_at is not null
   order by called_at desc
   limit 1;

  if v_t.status = 'waiting' then
    select count(*) into v_ahead
      from public.tickets
     where business_id = v_t.business_id and ticket_date = v_t.ticket_date
       and status = 'waiting' and number < v_t.number;
  end if;

  -- Promedio de duración de atención de los últimos 20 turnos atendidos (para estimar espera).
  select avg(extract(epoch from (finished_at - called_at))) into v_avg
    from (
      select finished_at, called_at
        from public.tickets
       where business_id = v_t.business_id and ticket_date = v_t.ticket_date
         and status = 'attended' and called_at is not null and finished_at is not null
       order by finished_at desc
       limit 20
    ) s;

  return jsonb_build_object(
    'found', true,
    'expired', (v_t.ticket_date < public.bogota_today() and v_t.status in ('waiting', 'called')),
    'status', v_t.status,
    'number', v_t.number,
    'customer_name', v_t.customer_name,
    'business_id', v_b.id,
    'business_name', v_b.name,
    'business_slug', v_b.slug,
    'now_serving', v_now,
    'people_ahead', v_ahead,
    'estimated_wait_seconds',
      case when v_t.status = 'waiting' and v_avg is not null then round(v_avg * v_ahead)::integer else null end
  );
end;
$$;

-- El cliente puede salirse de la fila (solo si sigue en espera).
create or replace function public.cancel_my_ticket(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.tickets
     set status = 'cancelled', finished_at = now()
   where token = p_token and status = 'waiting'
  returning id into v_id;
  return jsonb_build_object('cancelled', v_id is not null);
end;
$$;

-- RF07: pantalla pública. SOLO números: jamás nombres ni celulares (RNF06).
create or replace function public.get_public_board(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_b     public.businesses%rowtype;
  v_today date := public.bogota_today();
begin
  select * into v_b from public.businesses where slug = lower(btrim(p_slug));
  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'business_id', v_b.id,
    'name', v_b.name,
    'now_serving', (
      select number from public.tickets
       where business_id = v_b.id and ticket_date = v_today and called_at is not null
       order by called_at desc limit 1
    ),
    'next', coalesce((
      select jsonb_agg(n.number order by n.number)
        from (
          select number from public.tickets
           where business_id = v_b.id and ticket_date = v_today and status = 'waiting'
           order by number limit 5
        ) n
    ), '[]'::jsonb),
    'waiting_count', (
      select count(*) from public.tickets
       where business_id = v_b.id and ticket_date = v_today and status = 'waiting'
    )
  );
end;
$$;

-- ---------- Funciones para el DUEÑO del negocio (authenticated) --------

-- RF01: el usuario autenticado crea SU negocio (plan free por defecto; no puede elegir plan ni límite).
create or replace function public.register_business(p_name text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_id         uuid;
  v_slug       text := lower(btrim(coalesce(p_slug, '')));
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  insert into public.businesses (owner_id, name, slug)
  values (v_uid, btrim(coalesce(p_name, '')), v_slug)
  returning id into v_id;

  insert into public.queue_state (business_id) values (v_id) on conflict do nothing;

  return jsonb_build_object('id', v_id, 'slug', v_slug);
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'businesses_slug_key' then
      raise exception 'SLUG_EN_USO';
    end if;
    raise exception 'YA_TIENES_NEGOCIO';
  when check_violation then
    raise exception 'DATOS_INVALIDOS';
end;
$$;

-- Panel: fila del día + estadísticas (RF09) en una sola llamada.
create or replace function public.get_admin_snapshot(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_b     public.businesses%rowtype;
  v_today date := public.bogota_today();
begin
  perform public._assert_owner(p_business_id);
  select * into v_b from public.businesses where id = p_business_id;

  return jsonb_build_object(
    'stats', (
      select jsonb_build_object(
        'issued',    count(*),
        'waiting',   count(*) filter (where status = 'waiting'),
        'called',    count(*) filter (where status = 'called'),
        'attended',  count(*) filter (where status = 'attended'),
        'absent',    count(*) filter (where status = 'absent'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'avg_wait_seconds',
          round(avg(extract(epoch from (called_at - created_at))) filter (where called_at is not null))::integer,
        'plan', v_b.plan,
        'daily_limit', case when v_b.plan = 'free' then v_b.daily_limit else null end
      )
      from public.tickets
     where business_id = p_business_id and ticket_date = v_today
    ),
    'tickets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id, 'number', number, 'customer_name', customer_name,
          'customer_phone', customer_phone, 'status', status, 'source', source,
          'created_at', created_at, 'called_at', called_at, 'finished_at', finished_at
        ) order by number
      )
      from public.tickets
     where business_id = p_business_id and ticket_date = v_today
    ), '[]'::jsonb)
  );
end;
$$;

-- R9: el administrador registra a un cliente sin celular/cámara desde el panel.
create or replace function public.admin_add_ticket(
  p_business_id uuid,
  p_name        text,
  p_phone       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._assert_owner(p_business_id);
  return public._create_ticket(p_business_id, p_name, p_phone, null, 'manual', false);
end;
$$;

-- RF05: llamar al siguiente. Solo un turno "en atención" a la vez.
-- p_resolve_current permite cerrar el turno actual y llamar al siguiente en una sola acción.
create or replace function public.call_next(p_business_id uuid, p_resolve_current text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today   date := public.bogota_today();
  v_current public.tickets%rowtype;
  v_next    public.tickets%rowtype;
begin
  perform public._assert_owner(p_business_id);

  if p_resolve_current is not null and p_resolve_current not in ('attended', 'absent') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  -- Mismo candado que al crear turnos: no hay carreras entre "llamar" y "unirse".
  perform 1 from public.businesses where id = p_business_id for update;

  select * into v_current
    from public.tickets
   where business_id = p_business_id and ticket_date = v_today and status = 'called'
   order by number
   limit 1
   for update;

  if found then
    if p_resolve_current is null then
      raise exception 'TURNO_EN_CURSO';
    end if;
    update public.tickets
       set status = p_resolve_current, finished_at = now()
     where id = v_current.id;
  end if;

  select * into v_next
    from public.tickets
   where business_id = p_business_id and ticket_date = v_today and status = 'waiting'
   order by number
   limit 1;

  if not found then
    return jsonb_build_object('called', null);
  end if;

  update public.tickets
     set status = 'called', called_at = now()
   where id = v_next.id;

  return jsonb_build_object(
    'called', jsonb_build_object('id', v_next.id, 'number', v_next.number, 'customer_name', v_next.customer_name)
  );
end;
$$;

-- RF06: marcar atendido / ausente / cancelado. Transiciones permitidas:
--   called  → attended | absent        waiting → absent | cancelled
create or replace function public.resolve_ticket(p_ticket_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.tickets%rowtype;
begin
  if p_status not in ('attended', 'absent', 'cancelled') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  select * into v_t from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'TURNO_NO_ENCONTRADO';
  end if;

  perform public._assert_owner(v_t.business_id);

  select * into v_t from public.tickets where id = p_ticket_id for update;

  if not (
    (v_t.status = 'called'  and p_status in ('attended', 'absent')) or
    (v_t.status = 'waiting' and p_status in ('absent', 'cancelled'))
  ) then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.tickets
     set status = p_status, finished_at = now()
   where id = p_ticket_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- Retención de datos (RNF06: datos mínimos) ------------------

-- Borra turnos con más de p_days días. No se expone a la API; se ejecuta desde pg_cron o el SQL Editor.
create or replace function public.purge_old_tickets(p_days integer default 30)
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with d as (
    delete from public.tickets
     where ticket_date < public.bogota_today() - p_days
    returning 1
  )
  select count(*)::integer from d
$$;

-- Opcional: programarlo cada noche (activa antes la extensión pg_cron en Database → Extensions):
--   select cron.schedule('purga-turnos', '0 8 * * *', $$ select public.purge_old_tickets(30) $$);

-- ---------- Permisos de ejecución (mínimo privilegio) ------------------

revoke all on function public._assert_owner(uuid)                                   from public, anon, authenticated;
revoke all on function public._create_ticket(uuid, text, text, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.touch_queue_state()                                   from public, anon, authenticated;
revoke all on function public.purge_old_tickets(integer)                            from public, anon, authenticated;

revoke all on function public.get_join_info(text)                        from public, anon, authenticated;
revoke all on function public.join_queue(text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_ticket_status(uuid)                    from public, anon, authenticated;
revoke all on function public.cancel_my_ticket(uuid)                     from public, anon, authenticated;
revoke all on function public.get_public_board(text)                     from public, anon, authenticated;
grant execute on function public.get_join_info(text)                        to anon, authenticated;
grant execute on function public.join_queue(text, text, text, uuid, boolean) to anon, authenticated;
grant execute on function public.get_ticket_status(uuid)                    to anon, authenticated;
grant execute on function public.cancel_my_ticket(uuid)                     to anon, authenticated;
grant execute on function public.get_public_board(text)                     to anon, authenticated;

revoke all on function public.register_business(text, text)        from public, anon, authenticated;
revoke all on function public.get_admin_snapshot(uuid)             from public, anon, authenticated;
revoke all on function public.admin_add_ticket(uuid, text, text)   from public, anon, authenticated;
revoke all on function public.call_next(uuid, text)                from public, anon, authenticated;
revoke all on function public.resolve_ticket(uuid, text)           from public, anon, authenticated;
grant execute on function public.register_business(text, text)      to authenticated;
grant execute on function public.get_admin_snapshot(uuid)           to authenticated;
grant execute on function public.admin_add_ticket(uuid, text, text) to authenticated;
grant execute on function public.call_next(uuid, text)              to authenticated;
grant execute on function public.resolve_ticket(uuid, text)         to authenticated;

-- ---------- Realtime ---------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.queue_state;
    exception when duplicate_object then
      null; -- ya estaba agregada
    end;
  end if;
end;
$$;
