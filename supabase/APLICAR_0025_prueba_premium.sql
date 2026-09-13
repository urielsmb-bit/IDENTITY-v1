-- ============================================================
-- 0025 · Una semana de plan al crear el perfil
--
-- Quien crea su perfil se lleva siete dias del diamante. Se acaba solo.
--
-- Y DE PASO ARREGLA ALGO QUE ESTA ROTO AHORA MISMO. Al montar esto se
-- descubrio que `insignias_de_perfil` devuelve 401 en produccion, asi que
-- HOY no se pinta ni una insignia y `tienePlan()` dice que no a todo el
-- mundo: no hay ni un premium, ni el concedido a mano. El detalle esta en
-- la seccion 2. Sin ese arreglo, esta migracion repartiria pruebas que no
-- servirian para nada.
--
-- ------------------------------------------------------------
-- DONDE SE ENGANCHA, Y POR QUE AHI
-- ------------------------------------------------------------
--
-- El plan no es un campo del perfil: es la insignia `premium` en
-- `insignias_concedidas`, una tabla que el dueño de un perfil NO puede
-- escribir. Esa es la pieza que hace que esto no se pueda falsificar, y
-- por eso la prueba se concede igual — desde dentro de la base, con un
-- disparador — y no desde la aplicacion.
--
-- Va al crear el PERFIL y no al crear la cuenta. Son dos momentos
-- distintos: alguien puede registrarse y no montar nada hasta la semana
-- siguiente, y regalarle una prueba que se le gasta mientras no mira no
-- es un regalo. El reloj empieza cuando hay algo que decorar.
--
-- ------------------------------------------------------------
-- LO QUE PASA CUANDO SE ACABA
-- ------------------------------------------------------------
--
-- Nada se rompe, y esto se comprobo antes de escribirlo: `tienePlan()`
-- solo se usa en el EDITOR. El perfil publicado no pregunta por el plan
-- en ningun sitio.
--
-- O sea que al vencer la semana, esa persona deja de poder ELEGIR
-- opciones de pago, pero su pagina sigue exactamente como la dejo: los
-- efectos puestos siguen puestos y quien la visita no nota nada. Si un
-- dia se decide que al vencer haya que apagarle cosas, sera una decision
-- aparte y a la vista; hoy no pasa por accidente.
-- ============================================================


-- ---- 1 · las insignias pueden caducar ----------------------
-- `expira` a null significa «para siempre», que es lo que eran todas
-- hasta ahora. Por eso la columna entra vacia: ninguna de las que ya
-- estan concedidas cambia de significado.
alter table public.insignias_concedidas
  add column if not exists expira timestamptz;

comment on column public.insignias_concedidas.expira is
  'Cuando deja de valer. Null = para siempre. La vista ya no la devuelve pasada esa hora.';


-- ---- 2 · la vista: deja de devolver las vencidas, Y SE ARREGLA ----
--
-- Dos cosas a la vez, y la segunda no estaba prevista.
--
-- LO PREVISTO. La aplicacion lee SOLO esta vista para saber que insignias
-- tiene un perfil, asi que filtrando aqui se apaga el plan vencido en
-- todas partes a la vez, sin tocar una linea de la aplicacion y sin
-- ningun proceso que pase limpiando. Se añade `expira` a lo que devuelve
-- para poder enseñar un dia «te quedan tres dias» sin pedirte otra vez
-- que apliques SQL; hoy el cliente pide solo `insignia`, asi que la
-- columna de mas no le molesta.
--
-- LO OTRO. Esta vista esta ROTA en produccion ahora mismo. Comprobado
-- contra el servidor en vivo:
--
--     insignias_de_perfil?select=insignia   ->  401  42501
--     «permission denied for table insignias_concedidas»
--
-- y en el perfil publico se pintan CERO insignias. Como `tienePlan()`
-- lee de aqui, hoy no hay ni un solo premium: el diamante concedido a
-- mano tampoco cuenta. La aplicacion no lo grita porque `insigniasDe()`
-- se traga el fallo y devuelve una lista vacia, que es exactamente lo
-- mismo que «no tiene ninguna».
--
-- El motivo es `security_invoker = true`: la vista se resuelve con los
-- permisos de QUIEN pregunta, y su mitad de «verificado» lee `perfiles`,
-- cuya regla de filas deja muda a cualquiera que no sea el dueño.
-- Exactamente el fallo que APLICAR.sql ya describe y arregla mas abajo
-- —quitandole `security_invoker`— y que se ve que no llego a aplicarse.
--
-- Asi que aqui se deja como debe estar: con los permisos de su dueño,
-- igual que `descubrir`. Eso NO afloja nada. La vista solo deja salir
-- (perfil_id, insignia, expira); `por` y `nota` siguen sin asomarse, y
-- los permisos por columna que puso la 0023 sobre la tabla siguen
-- intactos para quien la pida directamente — comprobado: `select=por` y
-- `select=*` siguen devolviendo 401.
--
-- Es DROP y CREATE, no REPLACE: cambiar `security_invoker` es cambiar
-- como se resuelve la vista, no su forma. Y por eso hay que volver a dar
-- el permiso de lectura, que se va con ella.

drop view if exists public.insignias_de_perfil;

create view public.insignias_de_perfil as
  select perfil_id, insignia, expira
  from public.insignias_concedidas
  where expira is null or expira > now()
union
  select p.id as perfil_id, 'verified' as insignia, null::timestamptz as expira
  from public.perfiles p
  where p.estado = 'activo'
    and public.perfil_verificado(p.id);

grant select on public.insignias_de_perfil to anon, authenticated;

comment on view public.insignias_de_perfil is
  'Lo unico que el cliente lee para saber que insignias tiene un perfil. Con los permisos de su dueño, y sin devolver las vencidas.';


-- ---- 3 · una prueba por persona, no por perfil --------------
-- El esquema `privado` ya existe en la base —lo usan `privado.consumir`,
-- `privado.roles` y compania— pero su creacion no esta escrita en ningun
-- fichero de esta carpeta. Se pone aqui para que esta migracion se pueda
-- aplicar sobre una base limpia sin fallar. Si ya esta, no hace nada.
create schema if not exists privado;

-- Y que no se asome por la API. PostgREST solo expone los esquemas que se
-- le dicen, asi que esto es la segunda cerradura, no la primera.
revoke all on schema privado from anon, authenticated;

-- Sin esta tabla, la prueba se renueva borrando el perfil y creandolo
-- otra vez: `insignias_concedidas` cuelga del perfil y se va con el (`on
-- delete cascade`), asi que al volver a crearlo no queda rastro de que ya
-- hubo una semana.
--
-- Esta cuelga de la CUENTA, que es lo que de verdad identifica a una
-- persona aqui, y no se borra con el perfil.
--
-- No arregla registrarse otra vez con otro correo. Eso no lo arregla
-- ninguna tabla, y ponerle mas puertas a una prueba gratuita cuesta mas
-- de lo que ahorra.
create table if not exists privado.pruebas_premium (
  usuario    uuid primary key references auth.users(id) on delete cascade,
  concedida  timestamptz not null default now(),
  hasta      timestamptz not null
);

comment on table privado.pruebas_premium is
  'Quien ya gasto su semana de prueba. Cuelga de la cuenta, no del perfil, para que borrar el perfil no la devuelva.';


-- ---- 4 · el disparador --------------------------------------
create or replace function public.conceder_prueba_premium()
returns trigger
language plpgsql
-- `security definer` porque el que inserta el perfil es la propia
-- persona, y la persona NO tiene permiso sobre `insignias_concedidas`.
-- Ese es justo el motivo de que el plan no se pueda falsificar: la
-- unica forma de escribir ahi es desde dentro, como esto.
security definer
-- Y con el camino de busqueda fijado. Sin esta linea, una funcion
-- `security definer` se puede secuestrar creando una tabla con el mismo
-- nombre en un esquema que vaya antes: la funcion corre con permisos
-- altos y escribe en la tabla del atacante.
set search_path = public, privado, pg_temp
as $$
declare
  dias constant int := 7;
begin
  -- Sin dueño no hay a quien regalarle nada (perfiles de siembra, o
  -- cualquier insercion hecha desde el editor SQL a mano).
  if new.dueno is null then
    return new;
  end if;

  -- Una por cuenta. `on conflict do nothing` deja la primera y descarta
  -- la segunda sin quejarse: crear el segundo perfil no debe FALLAR por
  -- esto, solo no repetir el regalo.
  insert into privado.pruebas_premium (usuario, hasta)
  values (new.dueno, now() + make_interval(days => dias))
  on conflict (usuario) do nothing;

  if not found then
    return new;                      -- ya la gasto
  end if;

  -- Y la insignia. `do nothing` protege lo importante: si esta persona
  -- YA tiene el diamante para siempre —comprado, o dado a mano— esto no
  -- se lo puede convertir en uno que caduca en siete dias.
  insert into public.insignias_concedidas (perfil_id, insignia, nota, expira)
  values (new.id, 'premium', 'prueba de ' || dias || ' dias al crear el perfil',
          now() + make_interval(days => dias))
  on conflict (perfil_id, insignia) do nothing;

  return new;
end;
$$;

-- DESPUES de insertar, no antes: hace falta que la fila del perfil
-- exista ya para que `insignias_concedidas.perfil_id` la pueda
-- referenciar.
drop trigger if exists perfiles_prueba_premium on public.perfiles;
create trigger perfiles_prueba_premium
  after insert on public.perfiles
  for each row execute function public.conceder_prueba_premium();


-- ---- 5 · comprobar que ha entrado ---------------------------

-- a) La vista responde y devuelve insignias. Si esto sale 0 habiendo
--    insignias concedidas, el arreglo de la seccion 2 no entro.
select count(*) as insignias_que_ve_la_vista from public.insignias_de_perfil;

-- b) El reparto del plan, de un vistazo.
select
  (select count(*) from public.insignias_concedidas
    where insignia = 'premium' and expira is not null and expira > now()) as pruebas_vivas,
  (select count(*) from public.insignias_concedidas
    where insignia = 'premium' and expira is not null and expira <= now()) as pruebas_vencidas,
  (select count(*) from public.insignias_concedidas
    where insignia = 'premium' and expira is null)                        as planes_para_siempre,
  (select count(*) from privado.pruebas_premium)                          as personas_que_ya_la_gastaron;


-- ---- 6 · y si quieres darsela tambien a los de antes --------
--
-- Esto NO se ejecuta solo. Descomenta y lanza solo si decides que la
-- gente que ya tiene perfil tambien se lleva su semana.
--
-- OJO: a dia de hoy esto no le daria nada a nadie. Los cuatro perfiles
-- que hay tienen ya el diamante permanente, asi que el primer `not
-- exists` los descarta a los cuatro. Se deja escrito igualmente porque el
-- dia que se lance habra gente nueva, y entonces si importa a quien se lo
-- da y a quien no.
--
-- QUIEN QUEDA FUERA, y por que cada uno:
--
--   · quien YA tiene el diamante, del tipo que sea. Es lo unico que no se
--     puede estropear aqui: convertir un plan para siempre en uno que
--     caduca en siete dias seria quitarle algo a alguien.
--   · el EQUIPO. Y se mira por los dos caminos, porque son cosas
--     distintas: `privado.roles` es el permiso de verdad —`owner`,
--     `admin`, lo que lee `es_admin()`— y la insignia `staff` es el
--     reconocimiento. Alguien puede llevar una y no la otra.
--
-- `helper` NO esta en la lista: son de la comunidad, no del equipo. Si
-- quieres dejarlos fuera tambien, anade 'helper' a esa linea y ya.
--
-- Los dos INSERT van encadenados a proposito, con el segundo leyendo del
-- primero. Asi solo se apunta como «prueba gastada» a quien de verdad la
-- recibio, y las dos listas no pueden separarse el dia que alguien toque
-- el filtro de arriba y se olvide del de abajo.
--
-- with dados as (
--   insert into public.insignias_concedidas (perfil_id, insignia, nota, expira)
--   select p.id, 'premium', 'semana de regalo a los de antes',
--          now() + interval '7 days'
--     from public.perfiles p
--    where p.dueno is not null
--      and not exists (select 1 from public.insignias_concedidas i
--                       where i.perfil_id = p.id and i.insignia = 'premium')
--      and not exists (select 1 from privado.roles r
--                       where r.usuario_id = p.dueno)
--      and not exists (select 1 from public.insignias_concedidas i
--                       where i.perfil_id = p.id and i.insignia in ('staff'))
--   on conflict (perfil_id, insignia) do nothing
--   returning perfil_id
-- )
-- insert into privado.pruebas_premium (usuario, hasta)
-- select p.dueno, now() + interval '7 days'
--   from dados d
--   join public.perfiles p on p.id = d.perfil_id
-- on conflict (usuario) do nothing;
--
--
-- ---- y para ver a quien le tocaria ANTES de lanzarlo ---------
-- Esto no escribe nada. Lanzalo primero y mira la lista.
--
-- select p.username,
--        case
--          when exists (select 1 from public.insignias_concedidas i
--                        where i.perfil_id = p.id and i.insignia = 'premium')
--            then 'no: ya tiene el diamante'
--          when exists (select 1 from privado.roles r where r.usuario_id = p.dueno)
--            then 'no: es del equipo (rol)'
--          when exists (select 1 from public.insignias_concedidas i
--                        where i.perfil_id = p.id and i.insignia = 'staff')
--            then 'no: es del equipo (insignia)'
--          when p.dueno is null then 'no: sin dueño'
--          else 'SI, se lleva la semana'
--        end as que_pasaria
--   from public.perfiles p
--  order by 2, 1;
