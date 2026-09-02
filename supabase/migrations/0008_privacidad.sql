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
