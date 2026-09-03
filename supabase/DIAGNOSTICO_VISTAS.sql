-- ============================================================
-- IDENTITY · por que no se cuentan las visitas
--
-- Pegar entero en el editor SQL. NO cambia nada: la unica parte
-- que escribe va dentro de una transaccion que se deshace sola al
-- final, asi que no deja ninguna visita de mentira.
--
-- La funcion de borde devuelve 204 tanto si conto como si fallo
-- —es a proposito, para no revelar si un perfil existe— asi que
-- desde fuera no se puede saber. Esto lo mira por dentro.
-- ============================================================

begin;

-- ---- 1 · lo que la funcion necesita para funcionar ----------

select
  'pgcrypto instalada'                                   as comprueba,
  case when exists (select 1 from pg_extension where extname = 'pgcrypto')
       then 'OK' else 'MAL: falta, digest() no existe' end as estado

union all
select
  'la pimienta de las visitas existe',
  case
    when not exists (select 1 from privado.config where clave = 'pimienta_visitas')
      then 'MAL: no hay fila. El hash sale NULL y el insert revienta.'
    when coalesce((select valor from privado.config where clave = 'pimienta_visitas'), '') = ''
      then 'MAL: la fila existe pero esta vacia o es NULL. Mismo efecto.'
    else 'OK'
  end

union all
select
  'la funcion registrar_vista existe',
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'registrar_vista'
  ) then 'OK' else 'MAL: no esta' end

union all
select
  'el contador de limites existe',
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'privado' and p.proname = 'consumir'
  ) then 'OK' else 'MAL: falta privado.consumir(), la funcion parara ahi' end

union all
select
  'hay perfiles activos',
  coalesce((select 'OK: ' || count(*)::text from perfiles where estado = 'activo'), 'MAL');

-- ---- 2 · ejecutarla de verdad y ver si cuenta --------------
--
-- Si algo falla por dentro, AQUI sale el error completo en vez de
-- quedar tragado por la funcion de borde.

select registrar_vista(
  (select username from perfiles where estado = 'activo' order by creado limit 1),
  '203.0.113.7',            -- IP de documentacion, no es de nadie
  'diagnostico'
);

-- ---- 3 · que quedo -----------------------------------------

select
  p.username,
  coalesce(m.vistas_unicas, 0)  as unicas,
  coalesce(m.vistas_totales, 0) as totales,
  (select count(*) from vistas v where v.perfil_id = p.id) as filas_de_visitas
from perfiles p
left join perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo'
order by p.creado;

-- Se deshace todo: la visita de prueba no queda guardada.
rollback;
