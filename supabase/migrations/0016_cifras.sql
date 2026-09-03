-- ============================================================
-- IDENTITY · 0016 · las cifras de la portada, de verdad
--
-- La portada enseña cuanta gente hay y cuantas visitas se han servido.
-- Esos numeros TIENEN que salir de aqui y no del codigo del navegador:
-- una cifra escrita a mano nace vieja, y ademas ya paso —la portada
-- decia «24.5K visitas» porque alguien habia escrito 24500 como punto de
-- partida—. Con esto, el dia que entre una persona mas, la portada lo
-- dice sola.
--
-- Es una VISTA y no una tabla con contadores: contar cuatro cosas sobre
-- unos miles de filas es instantaneo, y una tabla de contadores hay que
-- mantenerla al dia con disparadores que algun dia se desincronizan y
-- nadie se entera. Cuando esto sea lento —que sera con muchos ceros mas—
-- se cambia por una tabla materializada y la portada ni se entera,
-- porque pide lo mismo.
--
-- No expone nada nuevo: son totales, no filas. De aqui no se puede sacar
-- quien es nadie.
-- ============================================================

drop view if exists cifras_publicas;
create view cifras_publicas as
select
  (select count(*) from perfiles where estado = 'activo')          as perfiles,
  (select coalesce(sum(m.vistas_totales), 0)
     from perfil_metricas m
     join perfiles p on p.id = m.perfil_id
    where p.estado = 'activo')                                     as visitas,
  (select count(*) from plantillas where estado = 'activa')        as plantillas,
  (select coalesce(sum(usos), 0) from plantillas
    where estado = 'activa')                                       as usos_plantillas,
  /* Cuantos se han apuntado en los ultimos siete dias. Es el unico que
     dice si esto esta vivo o parado; los demas solo suben. */
  (select count(*) from perfiles
    where estado = 'activo' and creado > now() - interval '7 days') as nuevos_semana;

comment on view cifras_publicas is
  'Totales para la portada. Solo agregados: ninguna fila de nadie sale de aqui.';

grant select on cifras_publicas to anon, authenticated;

-- ---- La prueba, aqui mismo -------------------------------
do $$
declare r record;
begin
  select * into r from cifras_publicas;
  raise notice 'perfiles=% visitas=% plantillas=% usos=% nuevos7d=%',
    r.perfiles, r.visitas, r.plantillas, r.usos_plantillas, r.nuevos_semana;
end
$$;
