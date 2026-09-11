-- ============================================================
-- sharee · 0023 · quien reparte las insignias
--
-- Hasta ahora conceder una insignia era abrir el editor SQL de Supabase y
-- pegar un INSERT con la clave de servicio. Es seguro —nadie mas puede
-- escribir en `insignias_concedidas`— pero no es un sistema: no hay forma
-- de quitarla sin otro SQL, no queda constancia de quien la dio (en el
-- editor `auth.uid()` es null), y no se puede delegar en nadie sin darle la
-- clave de servicio, que es la llave de TODO el proyecto.
--
--
-- LA DECISION QUE SOSTIENE ESTO: UN ROL NO ES UNA INSIGNIA
--
-- Se parecen, y por eso es facil juntarlos. «Staff» suena a rol. Pero son
-- dos cosas con propiedades opuestas:
--
--   · una INSIGNIA es decoracion PUBLICA. La lee cualquiera, sale pintada
--     en el perfil, y su unico requisito es que su dueno no pueda ponersela
--     solo.
--   · un ROL es autoridad PRIVADA. No lo ve nadie, decide quien puede
--     hacer que, y si se filtra o se puede escribir, se acabo.
--
-- Si «Staff» diera poder, entonces las insignias de concurso —«Winner»,
-- «Estrella»— y la de Staff pasarian a ser una escalada de privilegios: a
-- quien le dieras Staff podria darse Staff a si mismo, y a cualquiera.
--
-- Asi que los roles viven en `privado`, un esquema que la API de Supabase
-- no expone (0001 le quito todos los permisos a anon y authenticated), y
-- las insignias siguen donde estaban.
--
-- Aplicar:  supabase db push   (o pegar en el editor SQL)
-- ============================================================


-- ---- 1 · quien manda ---------------------------------------

create table if not exists privado.roles (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol        text not null check (rol in ('owner', 'admin')),
  desde      timestamptz not null default now(),
  -- Quien te nombro. Null solo para el primero, que se nombra aqui.
  por        uuid references auth.users(id) on delete set null,
  nota       text
);

comment on table privado.roles is
  'Quien puede conceder insignias. Vive en `privado`: la API no lo expone.';

-- Sin una sola politica. Sin politicas, RLS lo niega todo — y ademas el
-- esquema entero esta fuera de la API. Son dos cierres para lo mismo, y es
-- a proposito: el dia que alguien exponga `privado` por error, esto sigue
-- cerrado.
alter table privado.roles enable row level security;

-- El primero, del perfil que ya existe. Se busca por nombre de usuario y no
-- se escribe un uuid a mano: un uuid pegado en un fichero del repositorio
-- no se puede leer, no se puede comprobar, y el dia que se cambie de
-- proyecto de Supabase apunta a nadie.
insert into privado.roles (usuario_id, rol, nota)
select p.dueno, 'owner', 'fundador'
from public.perfiles p
where p.username = 'shark'
  and p.dueno is not null
on conflict (usuario_id) do nothing;


-- ---- 2 · ¿soy de los que reparten? -------------------------
--
-- `security definer` porque `privado.roles` no lo lee nadie desde fuera.
-- `search_path = ''` y todo cualificado: sin eso, una funcion definer se
-- puede engañar creando una tabla con el mismo nombre en un esquema que
-- vaya antes en la ruta de busqueda.
--
-- Y `(select auth.uid())` y no `auth.uid()` a secas: envuelto en un select,
-- Postgres lo evalua una vez en vez de una por fila.

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from privado.roles r
    where r.usuario_id = (select auth.uid())
  );
$$;

comment on function public.es_admin() is
  'Si quien llama puede conceder insignias. Lo usa la interfaz para saber si enseñar el panel.';

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;


-- ---- 3 · el catalogo, para que no entre basura --------------
--
-- `insignias_concedidas.insignia` era `text` a secas: cabia cualquier cosa.
-- Un id que no existe no se pinta —el catalogo del navegador lo descarta—
-- asi que el daño era nulo, pero una columna sin forma acaba llena de
-- variantes escritas a mano («Staff», «staff », «stafff») y entonces ya no
-- se sabe quien tiene que.
--
-- Las filas salen de `src/data/badges.ts`, que sigue siendo el sitio donde
-- vive una insignia de verdad: su nombre, su icono y su rareza. Aqui solo
-- estan los identificadores, que es lo unico que la base necesita saber.

create table if not exists public.insignias_catalogo (
  id     text primary key,
  -- De donde sale. Lo usa el panel para avisar de que las de `perfil` se
  -- calculan solas y concederlas a mano es raro.
  fuente text not null check (fuente in ('perfil', 'servidor', 'plan', 'externo'))
);

comment on table public.insignias_catalogo is
  'Los identificadores validos. El nombre y el icono viven en el cliente.';

insert into public.insignias_catalogo (id, fuente) values
  ('staff', 'servidor'),
  ('helper', 'servidor'),
  ('premium', 'plan'),
  ('verified', 'servidor'),
  ('donar', 'plan'),
  ('gifter', 'plan'),
  ('star', 'servidor'),
  ('legend', 'externo'),
  ('og', 'perfil'),
  ('booster', 'externo'),
  ('bughunter', 'servidor'),
  ('winner', 'servidor'),
  ('second', 'servidor'),
  ('third', 'servidor'),
  ('veterano', 'perfil'),
  ('popular', 'perfil'),
  ('aclamado', 'perfil')
on conflict (id) do update set fuente = excluded.fuente;

alter table public.insignias_catalogo enable row level security;

drop policy if exists catalogo_lectura on public.insignias_catalogo;
create policy catalogo_lectura
  on public.insignias_catalogo for select
  using (true);

-- La llave foranea. `add constraint if not exists` no existe en Postgres,
-- de ahi el bloque.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'insignias_concedidas_insignia_fk'
      and conrelid = 'public.insignias_concedidas'::regclass
  ) then
    alter table public.insignias_concedidas
      add constraint insignias_concedidas_insignia_fk
      foreign key (insignia) references public.insignias_catalogo(id)
      on update cascade;
  end if;
end $$;

-- Postgres no indexa las foraneas solo. Sin esto, borrar una fila del
-- catalogo recorre la tabla entera.
create index if not exists insignias_concedidas_insignia
  on public.insignias_concedidas (insignia);


-- ---- 4 · lo que no es publico de una concesion -------------
--
-- `insignias_concedidas` se lee con `using (true)`, que es correcto para lo
-- que se pinta: quien tiene que. Pero la tabla tiene dos columnas mas —`por`
-- y `nota`— y esas NO son publicas: `por` es el id de una cuenta de acceso,
-- y `nota` es lo que escribimos nosotros («compensacion por el fallo del
-- dia 3»). Cualquiera podia leerlas pidiendo `select=*` a la API.
--
-- Se cierran por columna, que es la herramienta exacta para esto: la
-- politica de filas no cambia, la vista publica sigue funcionando —solo
-- pide `perfil_id` e `insignia`— y un `select=*` desde fuera pasa a fallar.
--
-- En DOS pasos y no en uno: en Postgres un permiso de columna no puede
-- recortar uno de tabla. `revoke select (por) ...` sobre una tabla que ya
-- tiene `grant select` entero no quita nada — se ejecuta sin error y no
-- hace nada, que es la peor forma de fallar. Hay que retirar el de tabla y
-- volver a dar solo las columnas que si son publicas.

revoke select on public.insignias_concedidas from anon, authenticated;
grant select (perfil_id, insignia, concedida)
  on public.insignias_concedidas to anon, authenticated;


-- ---- 5 · el registro, que no se borra ----------------------
--
-- `insignias_concedidas` guarda el ESTADO: quien tiene que ahora mismo.
-- Retirar una insignia borra su fila, y con ella el rastro de que existio.
-- Para una insignia de concurso eso da igual; para «Verificado» o para el
-- plan, no: la pregunta «¿esto se le quito, y quien?» tiene que poder
-- contestarse. Aqui no se borra nada.

create table if not exists privado.registro_insignias (
  id        bigint generated always as identity primary key,
  cuando    timestamptz not null default now(),
  -- Ninguna de las dos lleva foranea, y es a proposito: si la cuenta o el
  -- perfil se borran, lo que NO puede desaparecer es el rastro de lo que se
  -- dio y se quito. Un registro que se limpia solo no es un registro.
  quien     uuid,
  perfil_id uuid,
  insignia  text,
  accion    text not null check (accion in ('conceder', 'retirar')),
  nota      text
);

comment on table privado.registro_insignias is
  'Todo lo que se ha dado y quitado. Solo se anade; nunca se borra.';

alter table privado.registro_insignias enable row level security;

create index if not exists registro_insignias_cuando
  on privado.registro_insignias (cuando desc);


-- ---- 6 · dar y quitar --------------------------------------
--
-- Las dos comprueban el permiso DENTRO. Una funcion `security definer` que
-- no lo haga es peor que no tener funcion: corre como su dueño y se salta
-- todas las politicas, asi que dejarla abierta es publicar la clave de
-- servicio con otro nombre.

create or replace function public.conceder_insignia(
  p_username text,
  p_insignia text,
  p_nota     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  v_quien  uuid := (select auth.uid());
  v_nota   text := nullif(btrim(p_nota), '');
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para conceder insignias'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.insignias_catalogo c where c.id = p_insignia) then
    raise exception 'La insignia «%» no existe', p_insignia
      using errcode = '22023';
  end if;

  select p.id into v_perfil
  from public.perfiles p
  where p.username = btrim(p_username);

  if v_perfil is null then
    raise exception 'No hay ningun perfil que se llame «%»', p_username
      using errcode = 'P0002';
  end if;

  -- Volver a concederla actualiza quien la dio y por que, en vez de fallar:
  -- desde el panel es un interruptor, y un interruptor que ya esta puesto
  -- no tiene que dar error.
  insert into public.insignias_concedidas (perfil_id, insignia, por, nota)
  values (v_perfil, p_insignia, v_quien, v_nota)
  on conflict (perfil_id, insignia)
  do update set por = excluded.por, nota = excluded.nota;

  insert into privado.registro_insignias (quien, perfil_id, insignia, accion, nota)
  values (v_quien, v_perfil, p_insignia, 'conceder', v_nota);
end;
$$;

revoke all on function public.conceder_insignia(text, text, text) from public, anon;
grant execute on function public.conceder_insignia(text, text, text) to authenticated;


create or replace function public.retirar_insignia(
  p_username text,
  p_insignia text,
  p_nota     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  v_quien  uuid := (select auth.uid());
  v_nota   text := nullif(btrim(p_nota), '');
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para retirar insignias'
      using errcode = '42501';
  end if;

  select p.id into v_perfil
  from public.perfiles p
  where p.username = btrim(p_username);

  if v_perfil is null then
    raise exception 'No hay ningun perfil que se llame «%»', p_username
      using errcode = 'P0002';
  end if;

  delete from public.insignias_concedidas
  where perfil_id = v_perfil and insignia = p_insignia;

  insert into privado.registro_insignias (quien, perfil_id, insignia, accion, nota)
  values (v_quien, v_perfil, p_insignia, 'retirar', v_nota);
end;
$$;

revoke all on function public.retirar_insignia(text, text, text) from public, anon;
grant execute on function public.retirar_insignia(text, text, text) to authenticated;


-- ---- 7 · lo que ve el panel --------------------------------
--
-- Con `por` y `nota`, que desde fuera ya no se leen. Solo para quien
-- reparte: es la unica forma de saber si una insignia rara fue un premio o
-- un dedazo, que es justo lo que `por` y `nota` vienen a contestar.

create or replace function public.insignias_de_admin(p_username text)
returns table (insignia text, concedida timestamptz, por uuid, nota text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;

  return query
    select i.insignia, i.concedida, i.por, i.nota
    from public.insignias_concedidas i
    join public.perfiles p on p.id = i.perfil_id
    where p.username = btrim(p_username)
    order by i.concedida desc;
end;
$$;

revoke all on function public.insignias_de_admin(text) from public, anon;
grant execute on function public.insignias_de_admin(text) to authenticated;


-- ---- 8 · nombrar a otra persona ----------------------------
--
-- A PROPOSITO NO HAY FUNCION PARA ESTO, y no es un olvido.
--
-- Conceder una insignia es decoracion: lo peor que puede pasar es que
-- alguien lleve un «Winner» que no gano. Nombrar a un admin es dar la
-- capacidad de decorar a cualquiera, y de nombrar a mas gente si algun dia
-- se añade esa funcion. Las dos cosas no merecen la misma friccion.
--
-- Se hace aqui, a mano, una vez cada mucho:
--
--   insert into privado.roles (usuario_id, rol, por, nota)
--   select p.dueno, 'admin', (select id from auth.users where email = 'TU_CORREO'),
--          'por que se lo das'
--   from public.perfiles p
--   where p.username = 'el_nombre_de_usuario';
--
-- Y para quitarselo:
--
--   delete from privado.roles
--   where usuario_id = (select dueno from public.perfiles where username = 'el_nombre');
--
-- Para ver quien reparte hoy:
--
--   select r.rol, p.username, r.desde, r.nota
--   from privado.roles r
--   left join public.perfiles p on p.dueno = r.usuario_id;
--
-- Y para leer el registro de lo dado y quitado:
--
--   select g.cuando, g.accion, g.insignia, p.username, g.nota
--   from privado.registro_insignias g
--   left join public.perfiles p on p.id = g.perfil_id
--   order by g.cuando desc limit 50;
