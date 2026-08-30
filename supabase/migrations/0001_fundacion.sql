-- ============================================================
-- IDENTITY · 0001 · Fundación
--
-- Crea lo que hace ciertas las tres políticas: cuentas, perfiles
-- públicos, nombres reservados, vistas únicas, valoraciones,
-- denuncias y retiradas.
--
-- Todo con RLS activada y denegando por defecto. Se aplica sobre
-- un proyecto de Supabase vacío:
--     supabase db push
-- o pegándolo en el editor SQL del panel.
-- ============================================================

create extension if not exists citext;      -- texto insensible a mayúsculas
create extension if not exists pgcrypto;    -- digest() para los hashes

-- Esquema privado: nada de aquí se expone por la API de Supabase.
create schema if not exists privado;
revoke all on schema privado from anon, authenticated;


-- ============================================================
-- 1 · SECRETO PARA LOS HASHES DE VISITANTE
--
-- No guardamos la IP de quien visita. Guardamos un hash, y para
-- que ese hash no se pueda revertir probando las 4.000 millones
-- de IPv4 hace falta un secreto que solo conoce el servidor.
-- Eso es la "pimienta".
-- ============================================================
create table if not exists privado.config (
  clave  text primary key,
  valor  text not null
);

-- El esquema 'privado' no esta expuesto por la API, asi que en
-- teoria esto sobra. Se pone igual: si algun dia alguien anade
-- 'privado' a los esquemas expuestos, o una funcion mal escrita
-- filtra por aqui, esta tabla sigue cerrada. Sin politicas =
-- nadie entra.
--
-- No estorba a las funciones que la leen: son SECURITY DEFINER,
-- corren como su dueno y la RLS no se les aplica.
alter table privado.config enable row level security;

insert into privado.config (clave, valor)
values ('pimienta_visitas', encode(gen_random_bytes(32), 'hex'))
on conflict (clave) do nothing;


-- ============================================================
-- 2 · NOMBRES RESERVADOS
--
-- Dos motivos distintos, mismo remedio:
--   · técnico  — el perfil vive en /nombre, así que un usuario
--                llamado "dashboard" chocaría con una ruta propia
--   · confianza — quien coja "soporte" puede hacerse pasar por ti
-- ============================================================
create table if not exists nombres_reservados (
  nombre citext primary key,
  motivo text not null check (motivo in ('ruta', 'marca', 'abuso'))
);

alter table nombres_reservados enable row level security;
-- Nadie lo lee ni lo escribe desde fuera. La comprobación de
-- disponibilidad va por una función, no leyendo la tabla: así no
-- se puede descargar la lista entera para buscarle las cosquillas.

insert into nombres_reservados (nombre, motivo) values
  -- rutas de la propia aplicación
  ('api','ruta'), ('app','ruta'), ('www','ruta'), ('admin','ruta'),
  ('dashboard','ruta'), ('login','ruta'), ('logout','ruta'),
  ('signup','ruta'), ('register','ruta'), ('registro','ruta'),
  ('settings','ruta'), ('ajustes','ruta'), ('account','ruta'),
  ('cuenta','ruta'), ('profile','ruta'), ('perfil','ruta'),
  ('explore','ruta'), ('descubrir','ruta'), ('discover','ruta'),
  ('leaderboard','ruta'), ('ranking','ruta'), ('clasificacion','ruta'),
  ('templates','ruta'), ('plantillas','ruta'), ('pricing','ruta'),
  ('precios','ruta'), ('analytics','ruta'), ('estadisticas','ruta'),
  ('terms','ruta'), ('terminos','ruta'), ('privacy','ruta'),
  ('privacidad','ruta'), ('copyright','ruta'), ('dmca','ruta'),
  ('legal','ruta'), ('help','ruta'), ('ayuda','ruta'),
  ('status','ruta'), ('blog','ruta'), ('about','ruta'),
  ('assets','ruta'), ('static','ruta'), ('cdn','ruta'),
  ('img','ruta'), ('images','ruta'), ('media','ruta'), ('files','ruta'),
  -- suplantación
  ('identity','marca'), ('identidad','marca'), ('oficial','marca'),
  ('official','marca'), ('support','marca'), ('soporte','marca'),
  ('staff','marca'), ('team','marca'), ('equipo','marca'),
  ('mod','marca'), ('moderador','marca'), ('moderator','marca'),
  ('administrador','marca'), ('root','marca'), ('system','marca'),
  ('sistema','marca'), ('security','marca'), ('seguridad','marca'),
  ('billing','marca'), ('pagos','marca'), ('payments','marca'),
  ('noreply','marca'), ('no-reply','marca'), ('abuse','marca'),
  ('abuso','marca')
on conflict (nombre) do nothing;


-- ============================================================
-- 3 · PERFILES
--
-- Hoy: un perfil por cuenta. Pero el perfil NO es la cuenta.
--
-- Lo fácil habría sido que la clave primaria fuese el id del
-- usuario: una línea, y el límite queda garantizado. El problema
-- es el día que quieras permitir dos o tres —como hace la
-- competencia, y es una necesidad real: uno personal, uno de
-- gaming, uno de trabajo—. Ese día habría que cambiar la clave
-- primaria de la tabla central, con todo lo que cuelga de ella.
--
-- Así que la estructura admite varios y el límite lo pone una
-- fila de configuración. Subirlo es un UPDATE; bajarlo, un
-- problema. Por eso se empieza en 1: los límites son fáciles de
-- subir y muy caros de bajar.
-- ============================================================
-- Con guarda para que la migracion se pueda volver a lanzar. Si
-- falla a la mitad y la relanzas, un 'create type' pelado aborta
-- todo con "type already exists" y no llegas ni a ver el error de
-- verdad.
do $$ begin
  create type estado_perfil as enum ('activo', 'oculto', 'baneado');
exception when duplicate_object then null;
end $$;

create table if not exists perfiles (
  id             uuid primary key default gen_random_uuid(),
  dueno          uuid not null references auth.users(id) on delete cascade,
  username       citext not null unique,
  apariencia     jsonb  not null default '{}'::jsonb,   -- el modelo v4 entero
  estado         estado_perfil not null default 'activo',
  motivo_estado  text,                                  -- por qué se ocultó
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now(),

  -- Aceptación de los documentos legales. Sin esto no puedes
  -- demostrar que nadie aceptó nada.
  acepto_en      timestamptz,
  acepto_version text,

  constraint username_forma check (
    username ~ '^[a-zA-Z0-9_]{3,20}$'
  ),
  -- Lo que hoy comprueba el editor se puede saltar escribiendo
  -- cuatro líneas en la consola del navegador. Aquí no.
  constraint apariencia_tamano check (
    pg_column_size(apariencia) < 262144        -- 256 KB
  )
);

create index if not exists perfiles_actualizado_idx
  on perfiles (actualizado desc) where estado = 'activo';
create index if not exists perfiles_dueno_idx on perfiles (dueno);


-- ---- cuántos perfiles caben por cuenta ----------------------
insert into privado.config (clave, valor) values ('perfiles_por_cuenta', '1')
on conflict (clave) do nothing;

create or replace function comprobar_limite_perfiles()
returns trigger
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_tope  integer;
  v_tiene integer;
begin
  select valor::integer into v_tope from privado.config
   where clave = 'perfiles_por_cuenta';
  select count(*) into v_tiene from perfiles where dueno = new.dueno;
  if v_tiene >= coalesce(v_tope, 1) then
    raise exception 'Ya tienes el maximo de perfiles permitidos (%)', coalesce(v_tope, 1)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_limite on perfiles;
create trigger perfiles_limite
  before insert on perfiles
  for each row execute function comprobar_limite_perfiles();


-- ---- el nombre no puede estar reservado --------------------
create or replace function comprobar_nombre_reservado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from nombres_reservados r where r.nombre = new.username) then
    raise exception 'Ese nombre de usuario no está disponible'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_nombre_reservado on perfiles;
create trigger perfiles_nombre_reservado
  before insert or update of username on perfiles
  for each row execute function comprobar_nombre_reservado();


-- ---- actualizado se pone solo -------------------------------
create or replace function tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end;
$$;

drop trigger if exists perfiles_tocar on perfiles;
create trigger perfiles_tocar
  before update on perfiles
  for each row execute function tocar_actualizado();


-- ---- RLS ----------------------------------------------------
alter table perfiles enable row level security;

-- Todos los perfiles son públicos: esa fue la decisión, y hace
-- que la política de lectura sea una línea. Los ocultos y
-- baneados no salen, salvo para su dueño.
drop policy if exists perfiles_leer_publicos on perfiles;
create policy perfiles_leer_publicos on perfiles
  for select using (estado = 'activo' or dueno = auth.uid());

drop policy if exists perfiles_crear_el_suyo on perfiles;
create policy perfiles_crear_el_suyo on perfiles
  for insert with check (dueno = auth.uid());

drop policy if exists perfiles_editar_el_suyo on perfiles;
create policy perfiles_editar_el_suyo on perfiles
  for update using (dueno = auth.uid())
  with check (dueno = auth.uid());

-- El dueño edita lo suyo, pero hay tres campos que NO son suyos:
-- el estado (si no, un baneado se desbanea solo), el dueño (no te
-- regalas el perfil de otro) y la fecha de alta (antigüedad falsa
-- para trepar en Descubrir).
--
-- Esto va en un disparador y no en la política de RLS a propósito.
-- La forma "natural" sería un WITH CHECK que compare con el valor
-- actual, pero para eso la política tendría que consultar
-- 'perfiles'... que es la tabla que la política protege. Postgres
-- lo detecta y falla con "infinite recursion detected in policy".
-- Es la trampa más habitual de RLS en Supabase.
--
-- El disparador no pasa por RLS y ve OLD y NEW directamente, así
-- que resuelve el mismo problema sin el bucle. Como es
-- SECURITY DEFINER pero solo devuelve valores, la clave de
-- servicio sigue pudiendo cambiar el estado desde tu panel: el
-- disparador se salta cuando no hay auth.uid().
create or replace function proteger_campos_perfil()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;          -- clave de servicio: moderación desde el panel
  end if;
  new.estado := old.estado;
  new.dueno  := old.dueno;
  new.creado := old.creado;
  return new;
end;
$$;

drop trigger if exists perfiles_proteger on perfiles;
create trigger perfiles_proteger
  before update on perfiles
  for each row execute function proteger_campos_perfil();

drop policy if exists perfiles_borrar_el_suyo on perfiles;
create policy perfiles_borrar_el_suyo on perfiles
  for delete using (dueno = auth.uid());


-- ---- ¿está libre este nombre? -------------------------------
-- Función en vez de dejar leer las tablas: responde sí o no, y no
-- deja descargar ni la lista de reservados ni la de usuarios.
create or replace function nombre_disponible(p_nombre citext)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_nombre !~ '^[a-zA-Z0-9_]{3,20}$' then return false; end if;
  if exists (select 1 from nombres_reservados where nombre = p_nombre) then return false; end if;
  if exists (select 1 from perfiles where username = p_nombre) then return false; end if;
  return true;
end;
$$;

grant execute on function nombre_disponible(citext) to anon, authenticated;


-- ============================================================
-- 4 · VISTAS
--
-- La regla pedida: una persona cuenta UNA vez en el contador
-- público, por muchas veces que vuelva. Pero se guarda cuántas
-- veces volvió, y eso lo ve el dueño en sus estadísticas.
--
-- Cómo se sabe que es la misma persona sin guardar su IP:
--   hash = digest(ip + navegador + id del perfil + pimienta)
--
-- Dos detalles que importan:
--   · la IP en claro no se guarda en ningún sitio;
--   · el hash lleva DENTRO el id del perfil, así que el mismo
--     visitante produce hashes distintos en perfiles distintos.
--     No se puede seguir a nadie de un perfil a otro.
--
-- Limitación honesta: quien cambia de red cuenta dos veces, y dos
-- personas tras la misma IP pueden contar como una. Es una
-- aproximación, no una verdad. Le pasa a todo el mundo.
-- ============================================================
create table if not exists vistas (
  perfil_id  uuid not null references perfiles(id) on delete cascade,
  visitante  bytea not null,                       -- el hash, nunca la IP
  primera    timestamptz not null default now(),
  ultima     timestamptz not null default now(),
  veces      integer not null default 1,
  primary key (perfil_id, visitante)
);

create index if not exists vistas_perfil_idx on vistas (perfil_id);

alter table vistas enable row level security;

-- El dueño ve sus propias estadísticas. Nadie más lee esta tabla,
-- y nadie la escribe directamente: solo la función de abajo.
drop policy if exists vistas_solo_el_dueno on vistas;
create policy vistas_solo_el_dueno on vistas
  for select using (
    exists (select 1 from perfiles p
             where p.id = vistas.perfil_id and p.dueno = auth.uid())
  );


-- ---- contador público, ya calculado -------------------------
-- Contar filas en cada visita sería caro. Se lleva aparte.
create table if not exists perfil_metricas (
  perfil_id       uuid primary key references perfiles(id) on delete cascade,
  vistas_unicas   integer not null default 0,
  vistas_totales  bigint  not null default 0,
  suma_notas      bigint  not null default 0,
  num_notas       integer not null default 0
);

alter table perfil_metricas enable row level security;

drop policy if exists metricas_publicas on perfil_metricas;
create policy metricas_publicas on perfil_metricas
  for select using (true);


-- ---- registrar una visita -----------------------------------
-- SECURITY DEFINER y SIN permiso para anon/authenticated: solo la
-- puede llamar la función de borde con la clave de servicio, que
-- es la única que ve la IP de verdad. Si el navegador pudiera
-- llamarla, el ranking sería una broma.
create or replace function registrar_vista(
  p_username citext,
  p_ip       text,
  p_agente   text
)
returns void
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_perfil uuid;
  v_pim    text;
  v_hash   bytea;
  v_nuevo  boolean;
begin
  select id into v_perfil from perfiles
   where username = p_username and estado = 'activo';
  if v_perfil is null then return; end if;

  select valor into v_pim from privado.config where clave = 'pimienta_visitas';

  v_hash := digest(
    coalesce(p_ip,'') || '|' || coalesce(p_agente,'') || '|' ||
    v_perfil::text || '|' || v_pim,
    'sha256'
  );

  insert into vistas (perfil_id, visitante)
  values (v_perfil, v_hash)
  on conflict (perfil_id, visitante) do update
    set veces  = vistas.veces + 1,
        ultima = now()
  returning (xmax = 0) into v_nuevo;   -- true si la fila es nueva

  insert into perfil_metricas (perfil_id, vistas_unicas, vistas_totales)
  values (v_perfil, 1, 1)
  on conflict (perfil_id) do update
    set vistas_unicas  = perfil_metricas.vistas_unicas + (case when v_nuevo then 1 else 0 end),
        vistas_totales = perfil_metricas.vistas_totales + 1;
end;
$$;

revoke all on function registrar_vista(citext, text, text) from public, anon, authenticated;


-- ============================================================
-- 5 · VALORACIONES
-- Una por persona y perfil: la clave primaria lo garantiza.
-- ============================================================
create table if not exists valoraciones (
  perfil_id uuid not null references perfiles(id) on delete cascade,
  autor_id  uuid not null references auth.users(id) on delete cascade,
  nota      smallint not null check (nota between 1 and 5),
  creado    timestamptz not null default now(),
  primary key (perfil_id, autor_id)
);

alter table valoraciones enable row level security;

drop policy if exists valoraciones_leer on valoraciones;
create policy valoraciones_leer on valoraciones
  for select using (true);

-- Hay que estar dentro para valorar, y no puedes valorarte a ti
-- mismo. Sin estas dos, el ranking se compra con un script.
drop policy if exists valoraciones_poner_la_mia on valoraciones;
create policy valoraciones_poner_la_mia on valoraciones
  for insert with check (
    autor_id = auth.uid()
    and not exists (select 1 from perfiles p
                     where p.id = valoraciones.perfil_id and p.dueno = auth.uid())
  );

drop policy if exists valoraciones_cambiar_la_mia on valoraciones;
create policy valoraciones_cambiar_la_mia on valoraciones
  for update using (autor_id = auth.uid()) with check (autor_id = auth.uid());

drop policy if exists valoraciones_quitar_la_mia on valoraciones;
create policy valoraciones_quitar_la_mia on valoraciones
  for delete using (autor_id = auth.uid());


create or replace function recalcular_nota()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_perfil uuid;
begin
  v_perfil := coalesce(new.perfil_id, old.perfil_id);
  insert into perfil_metricas (perfil_id) values (v_perfil)
    on conflict (perfil_id) do nothing;
  update perfil_metricas m set
    suma_notas = (select coalesce(sum(nota),0) from valoraciones where perfil_id = v_perfil),
    num_notas  = (select count(*)              from valoraciones where perfil_id = v_perfil)
  where m.perfil_id = v_perfil;
  return null;
end;
$$;

drop trigger if exists valoraciones_recalcular on valoraciones;
create trigger valoraciones_recalcular
  after insert or update or delete on valoraciones
  for each row execute function recalcular_nota();


-- ============================================================
-- 6 · DESCUBRIR
--
-- Ordena por vistas y por nota, como se pidió. La nota usa media
-- ponderada: un perfil con un solo 5 no puede adelantar a uno con
-- doscientos 4,8. Sin eso, el primer puesto se consigue pidiéndole
-- una estrella a un amigo.
-- ============================================================
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
where p.estado = 'activo';

-- security_invoker: la vista se ejecuta con los permisos de quien
-- la consulta, no con los de quien la creó. Sin eso, una vista
-- sobre una tabla con RLS se salta la RLS, que es justo lo
-- contrario de lo que queremos.
grant select on descubrir to anon, authenticated;


-- ============================================================
-- 7 · DENUNCIAS Y RETIRADAS
--
-- Una política de retirada que no se puede ejecutar juega en tu
-- contra. Esto es la maquinaria que la hace cierta.
-- ============================================================
create table if not exists denuncias (
  id          bigserial primary key,
  perfil_id   uuid not null references perfiles(id) on delete cascade,
  autor_id    uuid references auth.users(id) on delete set null,
  motivo      text not null check (motivo in
                ('copyright','suplantacion','sexual','menores','violencia',
                 'acoso','spam','ilegal','otro')),
  detalle     text check (length(detalle) <= 2000),
  creado      timestamptz not null default now(),
  resuelto_en timestamptz,
  resolucion  text
);

alter table denuncias enable row level security;

-- Cualquiera puede denunciar; nadie puede leer las denuncias.
-- Solo tú, con la clave de servicio, desde tu panel.
drop policy if exists denuncias_crear on denuncias;
create policy denuncias_crear on denuncias
  for insert with check (true);


-- Reincidentes: llevar la cuenta es requisito del puerto seguro.
create table if not exists retiradas (
  id            bigserial primary key,
  perfil_id     uuid not null references perfiles(id) on delete cascade,
  tipo          text not null check (tipo in ('copyright','otro')),
  descripcion   text,
  retirado_en   timestamptz not null default now(),
  restaurado_en timestamptz,          -- tras una contranotificación válida
  reclamante    text
);

alter table retiradas enable row level security;
-- Solo desde el panel con clave de servicio. Sin políticas =
-- nadie desde fuera.

create or replace view reincidentes as
select perfil_id, count(*) as retiradas_validas, max(retirado_en) as ultima
from retiradas
where tipo = 'copyright' and restaurado_en is null
group by perfil_id
having count(*) >= 2;


-- ============================================================
-- 8 · BORRAR LA CUENTA
--
-- La política promete que borrar la cuenta se lo lleva todo. El
-- "on delete cascade" de cada tabla lo cumple para la base de
-- datos. Los archivos de Storage hay que borrarlos aparte, en la
-- función de borde: SQL no llega hasta ahí.
-- ============================================================
-- ============================================================
-- 9 · PERMISOS EXPLÍCITOS
--
-- Al crear el proyecto hay que DESMARCAR "Automatically expose new
-- tables". Con esa casilla puesta, cualquier tabla nueva queda
-- expuesta a la API en cuanto se crea, y basta olvidar una
-- política de RLS para dejarla abierta a internet.
--
-- Desmarcada, ninguna tabla se expone por defecto y hay que decir
-- una por una qué se puede hacer con ella. Es esto: dos capas
-- —permiso y política— en vez de una. Para llegar a un dato hay
-- que pasar las dos.
-- ============================================================

-- Perfiles: los lee cualquiera (la RLS filtra los ocultos); solo
-- escribe quien ha entrado (y la RLS restringe a los suyos).
grant select                         on perfiles        to anon, authenticated;
grant insert, update, delete         on perfiles        to authenticated;

-- Contadores: públicos de leer, nunca de escribir. Se tocan solo
-- desde las funciones, con clave de servicio.
grant select                         on perfil_metricas to anon, authenticated;

-- Valoraciones: las ve cualquiera, las pone quien ha entrado.
grant select                         on valoraciones    to anon, authenticated;
grant insert, update, delete         on valoraciones    to authenticated;

-- Vistas: solo el dueño, y solo de lectura. La RLS ya lo limita,
-- pero sin este grant no llega ni a intentarlo.
grant select                         on vistas          to authenticated;

-- Denunciar puede cualquiera, incluso sin cuenta. Leer las
-- denuncias, nadie: eso es tuyo, desde el panel.
grant insert                         on denuncias       to anon, authenticated;
grant usage, select on sequence denuncias_id_seq        to anon, authenticated;

-- Sin grants a propósito, y así deben quedarse:
--   nombres_reservados  · se consulta por nombre_disponible()
--   retiradas           · solo tú, con clave de servicio
--   reincidentes        · idem
--   privado.config      · el esquema entero está revocado

comment on table perfiles is
  'El limite de perfiles por cuenta vive en privado.config(perfiles_por_cuenta). Hoy 1; subirlo es un UPDATE.';
comment on table vistas is
  'Un visitante por perfil. Nunca guarda la IP: solo un hash con pimienta y con el id del perfil dentro.';
