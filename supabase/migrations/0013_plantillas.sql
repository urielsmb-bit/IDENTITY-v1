-- ============================================================
-- IDENTITY · 0013 · plantillas publicadas por la gente
--
-- Antes habia catorce plantillas escritas a mano en el codigo del
-- navegador. Se quitan: las plantillas ahora las publica quien usa
-- IDENTITY, se ordenan por cuantas veces las han usado, y si no hay
-- ninguna la pagina lo dice en vez de rellenar con inventos.
--
-- UNA PLANTILLA NO LLEVA CONTENIDO. Solo aspecto: tema, colores,
-- tipografia, superficie, particulas, la colocacion de los bloques y
-- el estilo de cada uno. Nunca el nombre, la biografia, el avatar,
-- los enlaces, las redes ni los archivos de nadie. La lista de campos
-- que se copian esta en `src/lib/plantilla.ts` y es una lista blanca
-- —se nombra lo que SI se lleva—, porque con una lista negra basta
-- que alguien añada un campo nuevo al perfil para publicarlo sin
-- querer.
-- ============================================================

create table if not exists plantillas (
  id      uuid primary key default gen_random_uuid(),
  dueno   uuid not null references auth.users(id) on delete cascade,

  -- Lo escribe una persona y se lee en una pagina publica, asi que se
  -- acota aqui ademas de en el navegador: la comprobacion del
  -- navegador se la salta cualquiera con la consola abierta.
  nombre  text not null check (length(btrim(nombre)) between 2 and 40),

  ajustes jsonb not null,
  usos    integer not null default 0 check (usos >= 0),

  -- Para poder esconder una sin borrarla: si alguien publica algo que
  -- no toca, se aparta y queda el rastro de quien fue.
  estado  text not null default 'activa'
          check (estado in ('activa', 'oculta')),

  creado  timestamptz not null default now()
);

-- Se ordena por usos en cada carga de la pagina, asi que el indice va
-- en el mismo orden en que se pide, y solo sobre las visibles.
create index if not exists plantillas_por_usos
  on plantillas (usos desc, creado desc)
  where estado = 'activa';

create index if not exists plantillas_por_dueno on plantillas (dueno);

alter table plantillas enable row level security;

-- ---- 1 · quien ve que -------------------------------------

-- Las activas las ve todo el mundo, con sesion o sin ella: es una
-- galeria publica. Su dueno ve tambien las suyas ocultas, para que no
-- se le desaparezcan sin explicacion.
drop policy if exists plantillas_lectura on plantillas;
create policy plantillas_lectura
  on plantillas for select
  using (estado = 'activa' or dueno = auth.uid());

drop policy if exists plantillas_insertar on plantillas;
create policy plantillas_insertar
  on plantillas for insert to authenticated
  with check (dueno = auth.uid());

drop policy if exists plantillas_editar on plantillas;
create policy plantillas_editar
  on plantillas for update to authenticated
  using (dueno = auth.uid())
  with check (dueno = auth.uid());

drop policy if exists plantillas_borrar on plantillas;
create policy plantillas_borrar
  on plantillas for delete to authenticated
  using (dueno = auth.uid());

-- ---- 2 · el contador NO lo escribe el navegador -------------
--
-- Esta es la misma leccion que costo tres migraciones con las visitas:
-- la RLS y los GRANT son dos puertas distintas. La politica de arriba
-- deja a alguien modificar SU plantilla, y sin esto eso incluiria
-- ponerle `usos = 999999` desde la consola del navegador. Entonces el
-- orden de la pagina lo decidiria quien tuviera mas ganas, no quien
-- tuviera mejor plantilla.
--
-- Los permisos por columna resuelven justo esto: se puede cambiar el
-- nombre y esconderla, y nada mas. El contador solo sube por la
-- funcion de mas abajo.
revoke update on plantillas from authenticated;
grant update (nombre, estado) on plantillas to authenticated;

-- ---- 3 · cuantas puede publicar cada uno --------------------
--
-- Sin tope, una cuenta puede llenar la galeria entera y dejar fuera a
-- todos los demas. Cinco es de sobra para el producto de hoy.
create or replace function limitar_plantillas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cuantas integer;
begin
  select count(*) into v_cuantas
    from plantillas where dueno = new.dueno;

  if v_cuantas >= 5 then
    -- PT429: PostgREST traduce los SQLSTATE que empiezan por PT al
    -- estado HTTP de sus tres ultimos digitos. Con un 5xx el cliente
    -- reintentaria, que es lo contrario de lo que hace falta aqui.
    raise exception 'Ya tienes cinco plantillas publicadas. Borra una para publicar otra.'
      using errcode = 'PT429';
  end if;

  return new;
end;
$$;

drop trigger if exists plantillas_tope on plantillas;
create trigger plantillas_tope
  before insert on plantillas
  for each row execute function limitar_plantillas();

-- ---- 4 · sumar un uso ---------------------------------------
--
-- `security definer` porque sube una columna que su dueno no puede
-- tocar. No acepta mas que el id, no devuelve nada y no dice si la
-- plantilla existe: quien la llama ya la esta viendo.
--
-- Y lleva freno. Sin el, un bucle de mil llamadas pone cualquier
-- plantilla la primera, que es exactamente el problema que se queria
-- evitar quitandole la columna al navegador. Se reutiliza el mismo
-- contador de limites que ya frena las visitas.
create or replace function usar_plantilla(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, privado, extensions, pg_temp
as $$
declare
  v_clave text;
begin
  if p_id is null then return; end if;

  -- Diez usos por hora y plantilla desde la misma sesion. Aplicar una
  -- plantilla varias veces mientras se decide es normal; mil, no.
  v_clave := 'plantilla:' || p_id::text || ':' || coalesce(auth.uid()::text, 'anon');

  if not privado.consumir(v_clave, 10, interval '1 hour') then
    return;
  end if;

  update plantillas
     set usos = least(usos + 1, 2147483000)
   where id = p_id and estado = 'activa';
end;
$$;

-- Igual que `registrar_vista`: fuera todos y dentro solo quien debe.
-- Aqui SI la llama el navegador —es la accion de «usar plantilla»—
-- asi que `authenticated` y `anon` la necesitan.
revoke all on function usar_plantilla(uuid) from public;
grant execute on function usar_plantilla(uuid) to authenticated, anon;

grant select on plantillas to anon, authenticated;
grant insert, delete on plantillas to authenticated;
