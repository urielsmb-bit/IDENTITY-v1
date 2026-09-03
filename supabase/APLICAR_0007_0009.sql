-- ============================================================
-- IDENTITY · aplicar 0007, 0008 y 0009 de una vez
--
-- Pegar ENTERO en el editor SQL de Supabase:
--   supabase.com/dashboard  →  tu proyecto  →  SQL Editor  →  New query
--
-- Se puede volver a lanzar sin romper nada: todo es
-- `create ... if not exists`, `create or replace` o `drop ... if exists`.
--
-- OJO, un solo paso borra datos: el punto 4 de la 0007 quita la clave
-- `badges` de `perfiles.apariencia` en todas las filas. Es lo que hace
-- que las insignias que cada cual se puso a si mismo dejen de existir.
-- Si prefieres conservarlas por si acaso, saca una copia antes:
--
--   select id, username, apariencia->'badges' as badges
--   from perfiles where apariencia ? 'badges';
--
-- Al terminar, lanza VERIFICAR.sql.
-- ============================================================


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


-- ============================================================
-- IDENTITY · 0008 · que «perfil publico» apagado signifique algo
--
-- El ajuste «Perfil publico» escribe `discoverable` dentro de
-- `apariencia`, y la interfaz lo respeta: Descubrir y la portada filtran
-- por el. Pero la vista `descubrir` filtraba solo por `estado = 'activo'`,
-- asi que la fila se seguia sirviendo a quien la consultara directamente.
-- El ajuste era una cortesia de nuestro cliente, no una garantia. Aqui
-- pasa a serlo.
--
-- Lo que NO cambia, a proposito: el enlace directo. El ajuste promete
-- «no te encuentra nadie por su cuenta, pero tu enlace sigue funcionando
-- para quien lo tenga», y eso es exactamente lo que hace. Ocultar tambien
-- /u/tu-nombre seria otra cosa distinta y no es lo que dice la casilla.
--
-- Aplicar:  supabase db push
-- ============================================================

-- ---- 1 · las cifras publicas, en la vista del enlace directo ----
--
-- Antes solo estaban en `descubrir`, y de ahi las leia el cliente para
-- calcular las insignias de visitas y valoraciones. En cuanto `descubrir`
-- filtra por `discoverable` —paso 2—, un perfil oculto se quedaria sin
-- ellas: dejaria de aparecer en el buscador Y perderia sus insignias, que
-- no tiene nada que ver. Su sitio natural es esta vista, la que describe
-- un perfil concreto.
--
-- Son agregados que ya se ensenan en el propio perfil y en Descubrir, asi
-- que no exponen nada nuevo.

drop view if exists perfiles_publicos;
create view perfiles_publicos as
select
  p.id,
  p.username,
  p.apariencia,
  p.creado,
  p.actualizado,
  coalesce(m.vistas_unicas, 0) as vistas,
  case when coalesce(m.num_notas, 0) = 0 then null
       else round(m.suma_notas::numeric / m.num_notas, 2) end as nota,
  coalesce(m.num_notas, 0) as num_notas
from perfiles p
left join perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo';

grant select on perfiles_publicos to anon, authenticated;

comment on view perfiles_publicos is
  'Lo unico que un anonimo puede leer de un perfil, mas sus cifras publicas. Sin dueno ni registro de aceptacion.';

-- ---- 2 · descubrir deja fuera a quien no quiere que le encuentren ----
--
-- `is distinct from 'false'` y no un cast a boolean: si alguien colara en
-- ese campo algo que no sea un booleano, el cast reventaria la consulta
-- entera y con ella el buscador. Comparando el JSON no puede fallar, y
-- dice exactamente lo mismo que el cliente: oculto solo si vale false.

create or replace view descubrir
with (security_invoker = true) as
select
  p.id,
  p.username,
  p.apariencia,
  p.actualizado,
  coalesce(m.vistas_unicas, 0) as vistas,
  case when coalesce(m.num_notas,0) = 0 then null
       else round(m.suma_notas::numeric / m.num_notas, 2) end as nota,
  coalesce(m.num_notas, 0) as num_notas,
  (
    ln(coalesce(m.vistas_unicas, 0) + 1) * 1.0
    + ((coalesce(m.suma_notas,0) + 3.5 * 10)::numeric
       / (coalesce(m.num_notas,0) + 10)) * 0.6
  ) as puntuacion
from perfiles p
left join perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo'
  and (p.apariencia -> 'discoverable') is distinct from 'false'::jsonb;

comment on view descubrir is
  'Perfiles que se dejan encontrar. Quien apaga «Perfil publico» sale de aqui, pero su enlace directo sigue funcionando.';


-- ============================================================
-- IDENTITY · 0009 · arreglar tres cosas que dejaron rotas 0007 y 0008
--
-- Encontradas probando contra la base de datos de verdad, no leyendo.
-- Las tres se ven en una sola consulta desde el navegador: `descubrir`
-- devolvia 0 filas habiendo 3 perfiles activos, e `insignias_de_perfil`
-- respondia «permission denied».
--
-- ============================================================
-- 1 · `descubrir` volvio a los permisos de quien la llama
--
--     La 0004 le habia quitado `security_invoker` A PROPOSITO, y lo dejo
--     escrito: cuando `perfiles` dejo de ser legible en publico, una vista
--     con permisos del invocante se queda VACIA para todo el que no sea el
--     dueno. La 0008 la rehizo partiendo de la definicion de la 0001, que
--     es anterior a ese arreglo, y se llevo por delante las dos cosas que
--     la 0004 habia hecho:
--
--       · volvio a `security_invoker = true`  → Descubrir vacio para todos;
--       · volvio a exponer `p.apariencia` ENTERA en vez de los siete campos
--         de la miniatura → el listado publicaba el perfil completo.
--
--     Lo segundo no llego a filtrar nada porque lo primero dejaba la vista
--     muda, pero arreglar solo una de las dos habria abierto la puerta.
--
-- 2 · A `insignias_concedidas` le faltaba el GRANT
--
--     Tener politica de RLS no es tener permiso. Son dos puertas: el GRANT
--     decide si el rol puede tocar la tabla, y la politica decide que filas
--     ve. La 0007 puso la politica y se olvido del GRANT, asi que nadie
--     podia leer ninguna insignia.
--
-- 3 · `insignias_de_perfil` tenia el mismo problema que `descubrir`
--
--     Con `security_invoker`, su mitad de «verificado» lee `perfiles`, y
--     la RLS de esa tabla la deja muda para cualquiera que no sea el dueno.
--     Pasa a resolverse con los permisos de su dueno, como las otras dos
--     vistas publicas. Solo expone (perfil_id, insignia), que es lo que se
--     pinta en el perfil.
--
-- Aplicar: pegar en el editor SQL. Se puede relanzar.
-- ============================================================

-- ---- 1 · descubrir, otra vez como la dejo la 0004 ----------
--
-- Misma proyeccion de siete campos, mismos permisos de dueno, mas el
-- filtro de `discoverable` que traia la 0008.

drop view if exists descubrir;
create view descubrir as
select
  p.id,
  p.username,
  jsonb_build_object(
    'name',      p.apariencia -> 'name',
    'title',     p.apariencia -> 'title',
    'avatarUrl', p.apariencia -> 'avatarUrl',
    'theme',     p.apariencia -> 'theme',
    'accent',    p.apariencia -> 'accent',
    'emoji',     p.apariencia -> 'emoji',
    'verified',  p.apariencia -> 'verified'
  ) as apariencia,
  p.actualizado,
  coalesce(m.vistas_unicas, 0) as vistas,
  case when coalesce(m.num_notas,0) = 0 then null
       else round(m.suma_notas::numeric / m.num_notas, 2) end as nota,
  coalesce(m.num_notas, 0) as num_notas,
  (
    ln(coalesce(m.vistas_unicas, 0) + 1) * 1.0
    + ((coalesce(m.suma_notas,0) + 3.5 * 10)::numeric
       / (coalesce(m.num_notas,0) + 10)) * 0.6
  ) as puntuacion
from perfiles p
left join perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo'
  -- Oculto solo si vale false. Se compara el JSON en vez de castear a
  -- boolean: un valor raro ahi reventaria la consulta entera y con ella
  -- el buscador.
  and (p.apariencia -> 'discoverable') is distinct from 'false'::jsonb;

grant select on descubrir to anon, authenticated;

comment on view descubrir is
  'Perfiles que se dejan encontrar, con los siete campos de la miniatura. Quien apaga «Perfil publico» sale de aqui, pero su enlace directo sigue funcionando.';

-- ---- 2 · el permiso que faltaba ---------------------------

grant select on insignias_concedidas to anon, authenticated;

-- ---- 3 · la vista de insignias, con permisos de su dueno ---

drop view if exists insignias_de_perfil;
create view insignias_de_perfil as
  select perfil_id, insignia
  from insignias_concedidas
union
  select p.id as perfil_id, 'verified' as insignia
  from perfiles p
  where p.estado = 'activo'
    and perfil_verificado(p.id);

grant select on insignias_de_perfil to anon, authenticated;

comment on view insignias_de_perfil is
  'Lo unico que el cliente lee para saber que insignias tiene un perfil.';
