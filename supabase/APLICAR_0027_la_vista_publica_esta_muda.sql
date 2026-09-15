-- ============================================================
-- 0027 · La vista publica esta MUDA, y por eso los enlaces dicen 404
--
-- ------------------------------------------------------------
-- LO QUE PASA, MEDIDO CONTRA PRODUCCION
-- ------------------------------------------------------------
--
-- Con la clave anonima —la que lleva cualquier visitante— contra el
-- servidor de verdad, ahora mismo:
--
--     cifras_publicas                  ->  200   perfiles: 10
--     descubrir?select=id              ->  206   Content-Range: 0-0/10
--     perfiles                         ->  200   Content-Range: */0   (correcto: es del dueño)
--     perfiles_publicos                ->  200   Content-Range: */0   <-- AQUI
--     perfiles_publicos?username=eq.m4lito -> []
--     perfiles_publicos?username=eq.uriel  -> []
--
-- Diez perfiles activos. `descubrir` los ve. `perfiles_publicos`, que
-- tiene EL MISMO `where p.estado = 'activo'`, no ve ninguno.
--
-- Y en el navegador, entrando a https://sharee.fun/m4lito sin sesion:
--
--     «404 — El perfil @m4lito no existe o no es publico todavia.»
--     [ Ir al inicio ]  [ Reclamar @m4lito ]
--
-- Le esta ofreciendo a un desconocido el nombre de alguien que lo tiene.
--
-- ------------------------------------------------------------
-- POR QUE
-- ------------------------------------------------------------
--
-- `security_invoker = true`. La vista se resuelve con los permisos de
-- QUIEN pregunta, y desde la 0004 la regla de filas de `perfiles` dice
-- `dueno = auth.uid()`: para un anonimo, la tabla base no tiene ni una
-- fila, asi que la vista tampoco.
--
-- Se descarta lo demas porque no encaja:
--
--   · no es el `where`      -> `descubrir` lleva el mismo y devuelve 10
--   · no es el GRANT        -> sin permiso serian 401/42501, no 200 con []
--   · no es que falte       -> una vista inexistente da 404 PGRST205
--   · no es el estado       -> `cifras_publicas` cuenta 10 activos
--
-- Es la TERCERA vez que pasa esto mismo en este proyecto:
--
--     0008  ->  se lo hizo a `descubrir`        (lo arreglo la 0009)
--     ?     ->  se lo hizo a `insignias_de_perfil` (lo arreglo la 0025)
--     ?     ->  se lo hace ahora a `perfiles_publicos`
--
-- Siempre igual: alguien vuelve a crear la vista —el aviso del panel de
-- Supabase sobre «security definer view» invita justo a esto— y la app no
-- lo grita, porque una lista vacia es identica a «no existe».
--
-- Por eso aqui, ademas de arreglarlo, se escribe `security_invoker = false`
-- A MANO. Estaba puesto por omision, y lo que se protege por omision se
-- rompe por descuido. Escrito, el que lo cambie tiene que borrarlo antes.
--
-- ------------------------------------------------------------
-- QUE NO CAMBIA
-- ------------------------------------------------------------
--
-- Las mismas ocho columnas de la 0008 y el mismo filtro. No se afloja
-- nada: `dueno`, `acepto_en` y `acepto_version` siguen sin asomarse, que
-- es la razon de que esta vista exista. Un perfil `oculto` o `baneado`
-- sigue sin salir.
--
-- Es DROP y CREATE, no REPLACE: cambiar `security_invoker` es cambiar
-- como se resuelve la vista, no su forma, y REPLACE no lo toca. Por eso
-- hay que volver a dar el permiso de lectura, que se va con ella.
--
-- Aplicar: pegar entero en el SQL Editor de Supabase.
-- ============================================================

drop view if exists public.perfiles_publicos;

create view public.perfiles_publicos
with (security_invoker = false) as
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
from public.perfiles p
left join public.perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo';

grant select on public.perfiles_publicos to anon, authenticated;

comment on view public.perfiles_publicos is
  'Lo unico que un anonimo puede leer de un perfil, mas sus cifras publicas. Sin dueno ni registro de aceptacion. Con los permisos de su dueño A PROPOSITO: con security_invoker la RLS de `perfiles` la deja muda y todos los enlaces contestan 404.';


-- ---- comprobar que ha entrado -------------------------------
-- `visibles` tiene que dar lo mismo que `activos`. Si da 0, la vista
-- sigue muda y los enlaces siguen rotos.
select
  (select count(*) from public.perfiles where estado = 'activo') as activos,
  (select count(*) from public.perfiles_publicos)                as visibles,
  case when coalesce(
    (select 'si' from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'perfiles_publicos'
       and array_to_string(coalesce(c.reloptions, '{}'), ',') like '%security_invoker=true%'),
    'no') = 'no'
  then 'OK' else 'MAL: sigue con security_invoker' end                as permisos;
