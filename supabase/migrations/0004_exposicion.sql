-- ============================================================
-- IDENTITY · 0004 · Exposición de datos
--
-- Fase 7. El problema no es que la RLS esté mal escrita: es que
-- **RLS es por FILA, no por columna**. La política decía "esta
-- fila es pública" y con ella se iba la fila ENTERA.
--
-- Comprobado con una petición anónima real contra la base:
--
--   GET /rest/v1/perfiles?select=dueno   ->  200
--   [{"dueno":"b52b5e37-6f0a-4bed-9f21-6861f3238659"}]
--
-- Se filtraban tres cosas que no son contenido público:
--
--   dueno           el id de la cuenta de auth. Es el nombre de la
--                   carpeta en Storage y lo que usa la funcion de
--                   borde para decidir a quien borra. Ademas sirve
--                   de identificador estable para correlacionar
--                   entre tablas.
--   acepto_en       cuando esa persona acepto los terminos.
--   acepto_version  que version acepto.
--                   Los dos son registro interno de auditoria: la
--                   razon de que existan es poder demostrar algo,
--                   no publicarlo.
--
-- Y peor en combinacion: con `dueno` publico y `valoraciones`
-- publica, se reconstruye QUIEN VALORO A QUIEN. Ahora mismo no se
-- nota porque no hay votos; el dia que los haya, ya esta abierto.
--
-- Se arregla como se arregla en Postgres: la tabla deja de ser
-- legible en publico y se expone una VISTA con las columnas que sí
-- lo son.
-- ============================================================


-- ============================================================
-- 1 · La tabla, solo para su dueño
-- ============================================================
-- Se borra la vieja Y la nueva. Solo quitaba la vieja, asi que al
-- volver a lanzar el archivo fallaba con 42710: la nueva ya existia.
-- La 0001 si llevaba esta guarda en sus once politicas; no la
-- arrastre a las migraciones siguientes, y "es re-ejecutable" paso
-- a ser mentira sin que nadie lo notara hasta reintentarlo.
drop policy if exists perfiles_leer_publicos on perfiles;
drop policy if exists perfiles_leer_el_mio on perfiles;
create policy perfiles_leer_el_mio on perfiles
  for select using (dueno = auth.uid());


-- ============================================================
-- 2 · La vista pública, con lo que sí es público
--
-- SIN `security_invoker`: corre con los permisos de su dueño y por
-- tanto no le aplica la RLS de `perfiles`. Es a propósito — la
-- vista ES el control de acceso, y por eso solo selecciona
-- columnas seguras de perfiles activos. Que un dato no aparezca
-- aquí es la garantía de que no sale.
-- ============================================================
drop view if exists perfiles_publicos;
create view perfiles_publicos as
select
  p.id,
  p.username,
  p.apariencia,
  p.creado,
  p.actualizado
from perfiles p
where p.estado = 'activo';

grant select on perfiles_publicos to anon, authenticated;


-- ============================================================
-- 3 · Descubrir tambien deja de heredar la RLS
--
-- Estaba con `security_invoker = true`, que era correcto mientras
-- la tabla fuera legible en publico. Al dejar de serlo, la vista
-- se quedaria vacia para cualquiera que no sea el dueño. Pasa a
-- resolverse con los permisos de su dueño, igual que la anterior,
-- y sigue exponiendo solo los siete campos de la miniatura.
-- ============================================================
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
where p.estado = 'activo';

grant select on descubrir to anon, authenticated;


-- ============================================================
-- 4 · Las valoraciones dejan de ser públicas
--
-- `using (true)` dejaba leer cada voto con su `autor_id`. Junto
-- con el `dueno` de arriba, eso es el grafo de quien valora a
-- quien: comportamiento de personas, no contenido de un perfil.
--
-- Nadie necesita esa tabla en publico: la media y el numero de
-- votos ya estan en `perfil_metricas`, que si es publica y no dice
-- quien voto. Cada uno ve su propio voto, para poder cambiarlo.
-- ============================================================
drop policy if exists valoraciones_leer on valoraciones;
drop policy if exists valoraciones_leer_la_mia on valoraciones;
create policy valoraciones_leer_la_mia on valoraciones
  for select using (autor_id = auth.uid());

revoke select on valoraciones from anon;
grant select on valoraciones to authenticated;


-- ============================================================
-- 5 · La vista de reincidentes, cerrada de forma explícita
--
-- Ya estaba cerrada por no tener grants —comprobado: responde
-- 42501— pero eso es una ausencia, no una decisión escrita. Lo que
-- protege por omisión se abre por descuido.
-- ============================================================
revoke all on reincidentes from anon, authenticated;


comment on view perfiles_publicos is
  'Lo unico que un anonimo puede leer de un perfil. Sin dueno ni registro de aceptacion: RLS es por fila y la fila entera incluia cosas que no son publicas.';
comment on policy perfiles_leer_el_mio on perfiles is
  'La tabla base solo la lee su dueno. Lo publico va por perfiles_publicos.';
