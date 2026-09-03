-- ============================================================
-- IDENTITY · VERIFICAR
--
-- Se ejecuta DESPUÉS de APLICAR.sql y de APLICAR_0007_0008.sql.
-- No cambia nada: solo mira.
--
-- Cada fila dice qué se esperaba y qué hay. Si alguna sale MAL, esa
-- parte de la auditoría sigue abierta en producción, por mucho que
-- el archivo esté en el repositorio.
-- ============================================================

with comprobaciones as (

  -- ---- Fase 1 y 3: RLS en todas las tablas ------------------
  select 1 as n, 'RLS activa en todas las tablas' as comprueba,
    case when count(*) = 0 then 'OK'
         else 'MAL: ' || string_agg(tablename, ', ') end as resultado
  from pg_tables
  where schemaname = 'public' and not rowsecurity

  union all
  -- ---- F3-01: el autor de una denuncia lo pone el servidor --
  select 2, 'Disparador que fija el autor de las denuncias',
    case when exists (
      select 1 from pg_trigger
      where tgname = 'denuncias_fijar_autor' and not tgisinternal
    ) then 'OK' else 'MAL: falta (se puede denunciar en nombre de otro)' end

  union all
  select 3, 'Denuncias: sin UPDATE ni DELETE para el publico',
    case when not exists (
      select 1 from information_schema.role_table_grants
      where table_name = 'denuncias'
        and grantee in ('anon','authenticated')
        and privilege_type in ('UPDATE','DELETE')
    ) then 'OK' else 'MAL: se pueden editar denuncias ajenas' end

  union all
  select 4, 'Una denuncia por cuenta y perfil',
    case when exists (
      select 1 from pg_indexes
      where indexname = 'denuncias_una_por_cuenta'
    ) then 'OK' else 'MAL: falta el indice' end

  union all
  -- ---- F3-02: asignacion masiva --------------------------
  select 5, 'El alta de perfil se sella en el servidor',
    case when exists (
      select 1 from pg_trigger
      where tgname = 'perfiles_sellar_alta' and not tgisinternal
    ) then 'OK' else 'MAL: la fecha de aceptacion la pone el cliente' end

  union all
  -- ---- F6: integridad -------------------------------------
  select 6, 'Huella de visitante con longitudes (sin colisiones)',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'registrar_vista' and n.nspname = 'public'
      limit 1
    ) like '%length(v_ip)%' then 'OK'
    else 'MAL: sigue la version con separador' end

  union all
  select 7, 'Restricciones de los contadores',
    case when exists (
      select 1 from pg_constraint where conname = 'metricas_no_negativas'
    ) then 'OK' else 'MAL: faltan' end

  union all
  select 8, 'Indices de moderacion',
    case when (
      select count(*) from pg_indexes
      where indexname in ('denuncias_por_perfil','denuncias_sin_resolver','valoraciones_por_perfil')
    ) = 3 then 'OK' else 'MAL: faltan indices' end

  union all
  -- ---- F7: exposicion --------------------------------------
  select 9, 'La tabla perfiles solo la lee su dueno',
    case when exists (
      select 1 from pg_policies
      where tablename = 'perfiles' and policyname = 'perfiles_leer_el_mio'
    ) and not exists (
      select 1 from pg_policies
      where tablename = 'perfiles' and policyname = 'perfiles_leer_publicos'
    ) then 'OK' else 'MAL: `dueno` y la aceptacion siguen siendo publicos' end

  union all
  select 10, 'Existe la vista publica de perfiles',
    case when exists (
      select 1 from pg_views where viewname = 'perfiles_publicos'
    ) then 'OK' else 'MAL: falta (el frontend caera al respaldo)' end

  union all
  select 11, 'La vista publica NO expone `dueno`',
    case when not exists (
      select 1 from information_schema.columns
      where table_name = 'perfiles_publicos' and column_name in ('dueno','acepto_en','acepto_version')
    ) then 'OK' else 'MAL: la vista filtra lo mismo que la tabla' end

  union all
  select 12, 'Las valoraciones no son publicas',
    case when not exists (
      select 1 from information_schema.role_table_grants
      where table_name = 'valoraciones' and grantee = 'anon' and privilege_type = 'SELECT'
    ) then 'OK' else 'MAL: se puede reconstruir quien valoro a quien' end

  union all
  select 13, 'reincidentes cerrada',
    case when not exists (
      select 1 from information_schema.role_table_grants
      where table_name = 'reincidentes' and grantee in ('anon','authenticated')
    ) then 'OK' else 'MAL: expuesta' end

  union all
  -- ---- Fase 6: search_path en las funciones privilegiadas ---
  select 14, 'Funciones SECURITY DEFINER con search_path fijo',
    case when count(*) = 0 then 'OK'
         else 'MAL: ' || string_agg(p.proname, ', ') end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and (p.proconfig is null or not exists (
      select 1 from unnest(p.proconfig) c where c like 'search_path=%'
    ))

  union all
  select 15, 'registrar_vista sigue vedada al navegador',
    case when not exists (
      select 1 from information_schema.role_routine_grants
      where routine_name = 'registrar_vista' and grantee in ('anon','authenticated')
    ) then 'OK' else 'MAL: cualquiera puede inflar sus visitas' end

  union all
  -- ---- Fase 10: limites ------------------------------------
  select 16, 'Existe el contador de limites',
    case when exists (
      select 1 from pg_tables where schemaname='privado' and tablename='limites'
    ) then 'OK' else 'MAL: falta privado.limites' end

  union all
  select 17, 'Limite de denuncias',
    case when exists (
      select 1 from pg_trigger where tgname='denuncias_limitar' and not tgisinternal
    ) then 'OK' else 'MAL: se puede ahogar la cola de moderacion' end

  union all
  select 18, 'Limite de valoraciones',
    case when exists (
      select 1 from pg_trigger where tgname='valoraciones_limitar' and not tgisinternal
    ) then 'OK' else 'MAL: se puede votar en masa' end

  union all
  select 19, 'Limite de escrituras de perfil',
    case when exists (
      select 1 from pg_trigger where tgname='perfiles_limitar' and not tgisinternal
    ) then 'OK' else 'MAL: sin tope de escrituras' end

  union all
  select 20, 'consumir() vedada al navegador',
    case when not exists (
      select 1 from information_schema.role_routine_grants
      where routine_name='consumir' and grantee in ('anon','authenticated')
    ) then 'OK' else 'MAL: se puede agotar el contador de otro' end

  union all
  -- ---- Storage ---------------------------------------------
  select 21, 'Existe el cubo de medios',
    case when exists (select 1 from storage.buckets where id='media')
      then 'OK' else 'MAL: las imagenes no viajaran' end

  union all
  select 22, 'El cubo tiene tope de tamano y tipos',
    case when exists (
      select 1 from storage.buckets
      where id='media' and file_size_limit is not null and allowed_mime_types is not null
    ) then 'OK' else 'MAL: se puede subir cualquier cosa de cualquier tamano' end

  union all
  select 23, 'Cada cuenta escribe solo en su carpeta',
    case when (
      select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname in ('media_subir_lo_mio','media_cambiar_lo_mio','media_borrar_lo_mio')
    ) = 3 then 'OK' else 'MAL: se puede escribir en la carpeta de otro' end

  union all
  select 24, 'Los medios se pueden leer en publico',
    case when exists (
      select 1 from pg_policies
      where schemaname='storage' and tablename='objects' and policyname='media_leer_todos'
    ) then 'OK' else 'MAL: los avatares no se veran' end

  union all
  select 25, 'Tope de archivos por cuenta',
    case when exists (
      select 1 from pg_trigger where tgname='media_limitar_archivos' and not tgisinternal
    ) then 'OK' else 'MAL: se pueden subir archivos sin fin' end

  union all
  select 26, 'Los limites responden 429, no 500',
    case when (
      select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public'
        and p.proname in ('limitar_denuncias','limitar_valoraciones',
                          'limitar_escrituras_perfil','limitar_archivos')
        and pg_get_functiondef(p.oid) like '%PT429%'
    ) = 4 then 'OK'
    else 'MAL: algun limite sigue devolviendo 500 (el cliente lo reintentaria)' end

  union all
  select 27, 'El cubo es publico de lectura',
    case when exists (select 1 from storage.buckets where id='media' and public)
      then 'OK'
      else 'MAL: los avatares no se cargaran (la URL publica dara 403)' end

  union all
  select 28, 'El cubo admite imagenes Y video',
    case when (
      select allowed_mime_types from storage.buckets where id='media'
    ) @> array['image/webp','video/mp4'] then 'OK'
    else 'MAL: faltan tipos, el editor no podra subir' end

  -- ============================================================
  -- 0007 · insignias que no se puede poner uno mismo
  -- ============================================================

  union all
  select 29, 'Existe la tabla de insignias concedidas',
    case when exists (
      select 1 from pg_tables
      where schemaname='public' and tablename='insignias_concedidas'
    ) then 'OK' else 'MAL: falta 0007 (las insignias no se pueden conceder)' end

  union all
  -- Lo importante no es que tenga RLS, es que NO tenga politica de
  -- escritura: sin politica, RLS lo niega todo y solo entra por la clave
  -- de servicio. Una politica de insert aqui seria volver al problema.
  select 30, 'Nadie puede concederse una insignia',
    case when not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='insignias_concedidas'
        and cmd in ('INSERT','UPDATE','ALL')
    ) then 'OK' else 'MAL: hay politica de escritura, cualquiera se las pone' end

  union all
  select 31, 'perfil_verificado() con search_path fijo',
    case when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='perfil_verificado'
        and p.prosecdef
        and array_to_string(coalesce(p.proconfig,'{}'), ',') like '%search_path%'
    ) then 'OK' else 'MAL: falta, o es SECURITY DEFINER sin search_path' end

  union all
  select 32, 'Existe la vista de insignias del perfil',
    case when exists (
      select 1 from pg_views
      where schemaname='public' and viewname='insignias_de_perfil'
    ) then 'OK' else 'MAL: el cliente no podra leer ninguna insignia' end

  union all
  -- Esto es el borrado del punto 4 de la 0007. Si queda alguna, la
  -- migracion no llego a correr entera.
  select 33, 'No queda ninguna insignia autoasignada guardada',
    case when (
      select count(*) from perfiles where apariencia ? 'badges'
    ) = 0 then 'OK'
    else 'MAL: ' || (select count(*) from perfiles where apariencia ? 'badges')
         || ' perfiles conservan su lista vieja de insignias' end

  -- ============================================================
  -- 0008 · que «perfil publico» apagado signifique algo
  -- ============================================================

  union all
  select 34, 'Descubrir respeta el ajuste de perfil publico',
    -- `to_regclass` devuelve null si no existe, en vez de lanzar y abortar
    -- la consulta entera dejando sin salida a las demas comprobaciones.
    case when coalesce(
      (select pg_get_viewdef(to_regclass('public.descubrir'))
       where to_regclass('public.descubrir') is not null),
      '') like '%discoverable%' then 'OK'
    else 'MAL: apagar el ajuste no esconde nada, la fila se sigue sirviendo' end

  union all
  select 35, 'La vista publica trae las cifras del perfil',
    case when (
      select count(*) from information_schema.columns
      where table_schema='public' and table_name='perfiles_publicos'
        and column_name in ('vistas','nota','num_notas')
    ) = 3 then 'OK'
    else 'MAL: sin ellas, un perfil oculto pierde sus insignias de visitas' end

  union all
  -- La 0008 rehace `perfiles_publicos`, asi que la comprobacion 11 se
  -- repite aqui a proposito: importa que siga siendo cierta DESPUES.
  select 36, 'La vista publica sigue sin exponer `dueno`',
    case when not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='perfiles_publicos'
        and column_name in ('dueno','acepto_en','acepto_version')
    ) then 'OK' else 'MAL: la vista rehecha filtro datos que no son publicos' end

  -- ============================================================
  -- 0009 · lo que 0007 y 0008 dejaron roto
  -- ============================================================

  union all
  -- Tener politica de RLS no es tener permiso: son dos puertas. La 0007
  -- puso la politica y se olvido del GRANT, asi que nadie leia nada.
  select 37, 'Se pueden LEER las insignias concedidas',
    case when exists (
      select 1 from information_schema.role_table_grants
      where table_name='insignias_concedidas'
        and grantee in ('anon','authenticated')
        and privilege_type='SELECT'
    ) then 'OK' else 'MAL: falta el GRANT, ninguna insignia se cargara' end

  union all
  select 38, 'Se puede leer la vista de insignias',
    case when exists (
      select 1 from information_schema.role_table_grants
      where table_name='insignias_de_perfil'
        and grantee in ('anon','authenticated')
        and privilege_type='SELECT'
    ) then 'OK' else 'MAL: falta el GRANT' end

  union all
  -- Con `security_invoker`, la RLS de `perfiles` deja estas vistas mudas
  -- para todo el que no sea el dueno. Fue justo lo que rompio la 0008.
  select 39, 'Descubrir no depende de los permisos de quien la llama',
    case when coalesce(
      (select 'si' from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname='descubrir'
         and array_to_string(coalesce(c.reloptions,'{}'), ',') like '%security_invoker=true%'),
      'no') = 'no' then 'OK'
    else 'MAL: Descubrir saldra vacio para todo el mundo menos el dueno' end

  union all
  select 40, 'La misma vista de insignias, igual',
    case when coalesce(
      (select 'si' from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname='insignias_de_perfil'
         and array_to_string(coalesce(c.reloptions,'{}'), ',') like '%security_invoker=true%'),
      'no') = 'no' then 'OK'
    else 'MAL: «verificado» no aparecera en ningun perfil ajeno' end

  union all
  -- La 0004 redujo el listado a siete campos. La 0008 lo devolvio entero
  -- sin querer; si vuelve a pasar, el buscador publica el perfil completo.
  select 41, 'El listado publica solo la miniatura, no el perfil entero',
    case when coalesce(
      (select pg_get_viewdef(to_regclass('public.descubrir'))
       where to_regclass('public.descubrir') is not null),
      '') like '%jsonb_build_object%' then 'OK'
    else 'MAL: Descubrir esta exponiendo `apariencia` completa' end

  -- ============================================================
  -- 0010 · lo que hace falta para contar visitas
  -- ============================================================

  union all
  select 42, 'pgcrypto instalada (digest para el hash del visitante)',
    case when exists (select 1 from pg_extension where extname='pgcrypto')
      then 'OK' else 'MAL: sin ella registrar_vista no puede hashear' end

  union all
  -- Sin esta fila el hash sale NULL y el insert choca contra `not null`.
  -- La funcion de borde se lo traga y devuelve 204: las visitas se quedan
  -- a cero sin que nada lo diga.
  select 43, 'La pimienta de las visitas existe y no esta vacia',
    case
      when not exists (select 1 from privado.config where clave='pimienta_visitas')
        then 'MAL: falta la fila. Las visitas nunca se contaran.'
      when coalesce((select valor from privado.config where clave='pimienta_visitas'),'') = ''
        then 'MAL: la fila esta vacia. Mismo efecto.'
      else 'OK'
    end

  union all
  select 44, 'registrar_vista avisa si le falta la pimienta',
    case when coalesce(
      (select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='registrar_vista' limit 1),
      '') like '%pimienta_visitas: sin ella%' then 'OK'
    else 'MAL: sigue la version que revienta sin decir por que (falta 0010)' end
)

select
  lpad(n::text, 2, ' ') as "#",
  case when resultado = 'OK' then '  OK  ' else ' MAL  ' end as estado,
  comprueba,
  case when resultado = 'OK' then '' else resultado end as detalle
from comprobaciones
order by n;
