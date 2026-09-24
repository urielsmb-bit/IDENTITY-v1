-- ============================================================
-- sharee · 0029 · los errores que le salen a la gente
--
-- Hasta hoy, cuando algo fallaba en el navegador de alguien, nadie se
-- enteraba: `Frontera` pintaba «algo ha ido mal» y el fallo moria ahi.
-- Te enterabas cuando alguien te lo contaba, si te lo contaba.
--
-- Esto los guarda aqui, en tu propia base, sin terceros. Y guarda
-- exactamente lo que la politica de privacidad (1.5) ya dice que se
-- guarda: que fallo, tu identificador de cuenta si habias entrado, y el
-- navegador. Ni la IP, ni la direccion completa con su `?` y su `#` —ahi
-- viajan los tokens de inicio de sesion—, ni nada del perfil.
--
-- COMO SE APLICA: Supabase → SQL Editor → pegar entero → Run. Se puede
-- ejecutar dos veces sin romper nada.
-- ============================================================


-- ---- 1 · la tabla, en `privado` -----------------------------
--
-- En `privado` y no en `public`: PostgREST solo expone `public`, asi que
-- esta tabla no se puede leer ni escribir desde fuera de ninguna manera.
-- Se entra solo por las dos funciones de abajo.

create table if not exists privado.errores (
  id         bigint generated always as identity primary key,
  -- Agrupa: el mismo fallo en el mismo sitio del codigo es UNA fila con
  -- un contador, no mil filas iguales.
  firma      text        not null,
  mensaje    text        not null,
  pila       text,
  donde      text,
  origen     text        not null,
  navegador  text,
  -- Quien, si habia entrado. Al borrar la cuenta se desvincula sola: la
  -- fila se queda para poder arreglar el fallo, pero ya no es de nadie.
  cuenta     uuid        references auth.users(id) on delete set null,
  veces      integer     not null default 1,
  creado     timestamptz not null default now(),
  visto      timestamptz not null default now()
);

create index if not exists errores_visto_idx on privado.errores (visto desc);
create index if not exists errores_firma_idx on privado.errores (firma, visto desc);

alter table privado.errores enable row level security;
revoke all on privado.errores from public, anon, authenticated;


-- ---- 2 · la puerta de entrada ------------------------------
--
-- Cualquiera puede llamarla, con sesion o sin ella: los fallos que mas
-- importan son los de quien visita un perfil sin cuenta. Por eso tiene
-- TOPES, porque una puerta abierta a cualquiera es tambien una puerta
-- para llenarte la base:
--
--   · cada campo se recorta;
--   · el mismo fallo en la misma hora suma al contador en vez de crear
--     otra fila;
--   · no entran mas de 30 filas NUEVAS por minuto entre todos;
--   · y la tabla no pasa de 20.000 filas. Con los recortes son unos 50 MB
--     como mucho, lejos de los 500 del plan gratis.
--
-- Pasado un tope se descarta en silencio. Quien llama no necesita saberlo:
-- un aviso de error que falla no puede convertirse en otro error.

create or replace function public.registrar_error(
  p_mensaje   text,
  p_pila      text default null,
  p_donde     text default null,
  p_origen    text default 'error',
  p_navegador text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mensaje text := left(coalesce(nullif(trim(p_mensaje), ''), '(sin mensaje)'), 300);
  v_pila    text := left(p_pila, 2000);
  -- Solo la ruta: sin `?` ni `#`, que es donde viajan los tokens.
  v_donde   text := left(split_part(split_part(coalesce(p_donde, ''), '?', 1), '#', 1), 200);
  v_origen  text := left(coalesce(p_origen, 'error'), 20);
  v_nav     text := left(p_navegador, 300);
  v_firma   text;
  v_id      bigint;
begin
  -- La firma: que fallo y en que linea del codigo. La primera linea de la
  -- pila repite el mensaje; la segunda es donde revento.
  v_firma := md5(v_origen || '|' || v_mensaje || '|' || coalesce(split_part(v_pila, E'\n', 2), ''));

  -- ¿Ya ha pasado en la ultima hora? Entonces suma.
  select id into v_id
  from privado.errores
  where firma = v_firma and visto > now() - interval '1 hour'
  order by visto desc
  limit 1
  for update;

  if v_id is not null then
    update privado.errores
    set veces = veces + 1, visto = now()
    where id = v_id;
    return;
  end if;

  -- Los topes.
  if (select count(*) from privado.errores where creado > now() - interval '1 minute') >= 30 then
    return;
  end if;
  if (select count(*) from privado.errores) >= 20000 then
    return;
  end if;

  insert into privado.errores (firma, mensaje, pila, donde, origen, navegador, cuenta)
  values (v_firma, v_mensaje, v_pila, nullif(v_donde, ''), v_origen, v_nav, (select auth.uid()));
end;
$$;

comment on function public.registrar_error(text, text, text, text, text) is
  'Guarda un fallo del navegador. La llama la pagina sola; con topes para que no se pueda llenar la base.';

revoke all on function public.registrar_error(text, text, text, text, text) from public;
grant execute on function public.registrar_error(text, text, text, text, text) to anon, authenticated;


-- ---- 3 · la lectura, solo para ti ---------------------------
--
-- Los ultimos 100, agrupados, con el @usuario en vez del identificador.
-- Solo para quien es administrador: cualquier otro recibe un error de
-- permisos y nada mas.

create or replace function public.errores_recientes()
returns table (
  mensaje   text,
  pila      text,
  donde     text,
  origen    text,
  navegador text,
  usuario   text,
  veces     integer,
  creado    timestamptz,
  visto     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  return query
    select e.mensaje, e.pila, e.donde, e.origen, e.navegador,
           (select p.username::text from public.perfiles p where p.dueno = e.cuenta limit 1),
           e.veces, e.creado, e.visto
    from privado.errores e
    order by e.visto desc
    limit 100;
end;
$$;

comment on function public.errores_recientes() is
  'Los ultimos fallos del navegador, para el panel de administracion. Solo administradores.';

revoke all on function public.errores_recientes() from public, anon;
grant execute on function public.errores_recientes() to authenticated;


-- ---- 4 · y se borran solos a los 30 dias ---------------------
--
-- Un registro de fallos es para arreglar fallos, no un archivo. Treinta
-- dias es el mismo plazo que la politica da para todo lo demas.

select cron.unschedule('limpiar-errores')
where exists (select 1 from cron.job where jobname = 'limpiar-errores');

select cron.schedule(
  'limpiar-errores',
  '17 4 * * *',
  $$delete from privado.errores where visto < now() - interval '30 days'$$
);
