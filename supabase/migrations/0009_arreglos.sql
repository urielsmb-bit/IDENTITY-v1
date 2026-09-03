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
