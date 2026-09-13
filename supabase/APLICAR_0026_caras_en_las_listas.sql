-- ============================================================
-- 0026 · Las listas necesitan la cara, no solo el nombre
--
-- En el ranking salian circulos de colores con un simbolo en vez de la
-- foto de cada persona. No era un fallo de diseño: la consulta NO TRAIA
-- la foto.
--
-- ------------------------------------------------------------
-- LO QUE PASABA, MEDIDO CONTRA PRODUCCION
-- ------------------------------------------------------------
--
-- `descubrir` no devuelve el perfil entero: devuelve un resumen de siete
-- campos pensado para pintar miniaturas. Y en ese resumen estaban
-- `avatarUrl` y `emoji`, pero no `discordAvatar`.
--
-- La aplicacion prueba las caras en orden —la que subiste, la de Discord,
-- y si no, tu inicial— asi que a quien no habia subido foto se le caia al
-- ultimo escalon aunque SI tuviera foto de Discord. De los siete perfiles
-- que hay, a tres les pasaba justo eso:
--
--     shark       avatarUrl: no    discordAvatar: SI   -> salia el simbolo
--     arlettex3   avatarUrl: no    discordAvatar: SI   -> salia el simbolo
--     mi_perfil   avatarUrl: no    discordAvatar: SI   -> salia el simbolo
--
-- El dato estaba guardado y completo. Solo que esta vista no lo dejaba
-- salir, y el perfil entero —`perfiles_publicos`— si.
--
-- ------------------------------------------------------------
-- Y SE AÑADE UNA CARA MAS
-- ------------------------------------------------------------
--
-- `cuentaAvatar`: la foto de la cuenta con la que se entra, que hoy solo
-- trae Google. Tapa el hueco de quien entra con su correo y nunca conecta
-- Discord — esa persona no tenia NINGUNA cara posible y caia a la inicial
-- teniendo foto en su cuenta.
--
-- Las dos se validan en el cliente contra el servidor de imagenes que les
-- corresponde (el CDN de Discord, el de Google) antes de guardarse, asi
-- que por aqui no sale una direccion arbitraria.
--
-- ------------------------------------------------------------
-- QUE NO CAMBIA
-- ------------------------------------------------------------
--
-- Ni los permisos, ni las filas que devuelve, ni el orden. Se añaden dos
-- claves al objeto `apariencia` y nada mas. `emoji` se queda dentro
-- aunque la aplicacion ya no lo lea: quitarlo obligaria a repasar que
-- nadie mas lo mire, y no estorba.
--
-- Es `create or replace`: la vista conserva sus permisos y no hay que
-- volver a darlos.
-- ============================================================

create or replace view public.descubrir as
select
  p.id,
  p.username,
  jsonb_build_object(
    'name',          p.apariencia -> 'name',
    'title',         p.apariencia -> 'title',
    'avatarUrl',     p.apariencia -> 'avatarUrl',
    -- Las dos nuevas. Sin ellas, una lista de perfiles enseña simbolos
    -- donde tendria que enseñar caras.
    'discordAvatar', p.apariencia -> 'discordAvatar',
    'cuentaAvatar',  p.apariencia -> 'cuentaAvatar',
    'theme',         p.apariencia -> 'theme',
    'accent',        p.apariencia -> 'accent',
    'emoji',         p.apariencia -> 'emoji',
    'verified',      p.apariencia -> 'verified'
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
from public.perfiles p
left join public.perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo'
  -- Oculto solo si vale false. Se compara el JSON en vez de castear a
  -- boolean: un valor raro ahi reventaria la consulta entera y con ella
  -- el buscador.
  and (p.apariencia -> 'discoverable') is distinct from 'false'::jsonb;

comment on view public.descubrir is
  'Perfiles que se dejan encontrar, con los campos de la miniatura: nombre, oficio, las tres caras posibles, tema, acento y verificado. Quien apaga «Perfil publico» sale de aqui, pero su enlace directo sigue funcionando.';


-- ---- comprobar que ha entrado -------------------------------
-- Cuantos perfiles de los que se ven en las listas tienen ya una cara.
-- Si «sin_ninguna_foto» baja despues de aplicar esto, ha funcionado.
select
  count(*)                                                          as perfiles,
  count(*) filter (where apariencia ->> 'avatarUrl'     <> '')      as con_foto_propia,
  count(*) filter (where apariencia ->> 'discordAvatar' <> '')      as con_foto_de_discord,
  count(*) filter (where apariencia ->> 'cuentaAvatar'  <> '')      as con_foto_de_la_cuenta,
  count(*) filter (where coalesce(apariencia ->> 'avatarUrl', '')     = ''
                     and coalesce(apariencia ->> 'discordAvatar', '') = ''
                     and coalesce(apariencia ->> 'cuentaAvatar', '')  = '') as sin_ninguna_foto
from public.descubrir;
