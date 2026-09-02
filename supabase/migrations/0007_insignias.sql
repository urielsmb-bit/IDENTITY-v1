-- ============================================================
-- IDENTITY · 0007 · insignias que no se puede poner uno mismo
--
-- El problema que cierra esta migracion:
--   `badges` era un campo mas de `perfiles.apariencia`, y esa columna la
--   escribe su dueno. Cualquiera podia ponerse «Staff», «Verificado» o
--   «Premium» y salian en su perfil publico igual que si se las hubieran
--   dado. Un adorno de mas es una cosa; un «Verificado» que se regala uno
--   mismo es una afirmacion falsa sobre identidad.
--
-- Como se cierra:
--   Las insignias dejan de guardarse en el perfil y pasan a leerse de aqui.
--   El cliente LEE esta vista y no escribe nunca en ella.
--
--   · las que concede el equipo van en `insignias_concedidas`, donde solo
--     escribe la clave de servicio;
--   · «verificado» se calcula mirando si la cuenta tiene de verdad una
--     identidad de un proveedor externo enlazada;
--   · las que dependen de cifras publicas —antiguedad, visitas, notas— NO
--     estan aqui: se calculan en el navegador a partir de `descubrir`, que
--     ya las expone. Salen de datos del servidor, asi que su dueno tampoco
--     puede falsearlas, y calcularlas en el cliente permite ensenar cuanto
--     falta para la siguiente sin una consulta por insignia.
--
-- Aplicar:  supabase db push     (o pegar en el editor SQL)
-- ============================================================

-- ---- 1 · las que concede el equipo -------------------------

create table if not exists insignias_concedidas (
  perfil_id  uuid not null references perfiles(id) on delete cascade,
  insignia   text not null,
  concedida  timestamptz not null default now(),
  -- Quien la dio y por que. Sin esto, dentro de un ano nadie sabe si una
  -- insignia rara fue un premio o un dedazo.
  por        uuid references auth.users(id) on delete set null,
  nota       text,
  primary key (perfil_id, insignia)
);

comment on table insignias_concedidas is
  'Insignias que da el equipo a mano. Solo escribe la clave de servicio.';

create index if not exists insignias_concedidas_perfil
  on insignias_concedidas (perfil_id);

alter table insignias_concedidas enable row level security;

-- Leer: cualquiera, porque son publicas por definicion —se ensenan en el
-- perfil—. Escribir: nadie. No hay politica de insert, update ni delete, y
-- sin politica RLS lo niega todo. La clave de servicio se salta RLS, que es
-- exactamente el unico camino que queremos.
drop policy if exists insignias_lectura on insignias_concedidas;
create policy insignias_lectura
  on insignias_concedidas for select
  using (true);

-- ---- 2 · «verificado», calculado ---------------------------

-- Mira en `auth.identities` si el dueno del perfil tiene enlazada alguna
-- identidad que no sea la de correo y contrasena. `security definer` porque
-- el esquema `auth` no lo puede leer un usuario cualquiera; la funcion no
-- acepta parametros del cliente mas alla del id de perfil, y solo devuelve
-- un si o un no.
create or replace function perfil_verificado(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from perfiles p
    join auth.identities i on i.user_id = p.dueno
    where p.id = p_perfil
      and i.provider <> 'email'
  );
$$;

revoke all on function perfil_verificado(uuid) from public;
grant execute on function perfil_verificado(uuid) to anon, authenticated;

-- ---- 3 · la vista que lee el cliente -----------------------

create or replace view insignias_de_perfil
with (security_invoker = true) as
  select perfil_id, insignia
  from insignias_concedidas
union
  select p.id as perfil_id, 'verified' as insignia
  from perfiles p
  where p.estado = 'activo'
    and perfil_verificado(p.id);

comment on view insignias_de_perfil is
  'Lo unico que el cliente lee para saber que insignias tiene un perfil.';

-- ---- 4 · limpiar lo que se creyo antes ---------------------

-- Las que la gente se puso a si misma siguen escritas dentro de
-- `apariencia`. El cliente nuevo ya no las mira, pero dejarlas ahi es dejar
-- una mentira guardada: si alguien exporta su perfil en JSON, o si algun
-- dia se vuelve a leer ese campo, reaparecen. Se van.
update perfiles
set apariencia = apariencia - 'badges'
where apariencia ? 'badges';

-- ---- 5 · como se concede una a mano ------------------------
--
--   insert into insignias_concedidas (perfil_id, insignia, por, nota)
--   select id, 'staff', auth.uid(), 'equipo fundador'
--   from perfiles where username = 'uriel';
--
-- Y para quitarla:
--
--   delete from insignias_concedidas
--   where insignia = 'staff'
--     and perfil_id = (select id from perfiles where username = 'uriel');
