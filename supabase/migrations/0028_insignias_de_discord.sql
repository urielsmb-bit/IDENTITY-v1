-- ============================================================
-- sharee · 0028 · las insignias de Discord, de cada perfil
--
-- Discord guarda las insignias de una cuenta en un solo numero,
-- `public_flags`, donde cada bit es una: el 1 es ser del equipo de
-- Discord, el 512 haber apoyado desde el principio, el 4194304 ser
-- desarrollador activo, y asi.
--
-- POR QUE POR EL BOT Y NO AL ENLAZAR LA CUENTA
--
-- Se puede pedir de dos formas. Una es con el token del propio inicio de
-- sesion, en la vuelta del enlace; la otra es que el bot pregunte por el
-- id. La primera solo sirve para el dueño del perfil y OBLIGA A VOLVER A
-- CONECTAR DISCORD cada vez que aparece un campo nuevo — ya paso con el
-- marco de avatar y con la etiqueta de servidor, y por eso las dos se
-- mudaron aqui.
--
-- El bot ya pide `/users/{id}` de cada perfil para traer esas dos cosas.
-- Añadir las insignias a esa misma peticion no cuesta nada, vale para
-- TODOS los perfiles sin que nadie toque nada, y ademas se refresca solo:
-- quien se gane una insignia manana la tendra al minuto siguiente.
--
-- SE GUARDA EL NUMERO, NO LA LISTA
--
-- La lista se deduce del numero en un momento. Guardando el numero, el dia
-- que Discord se invente un bit nuevo basta con añadir una fila a la tabla
-- del navegador para que aparezca en todos los perfiles que ya lo tengan
-- guardado. Guardando la lista habria que volver a preguntarle a todo el
-- mundo.
--
-- LO QUE NO ENTRA AQUI, Y CONVIENE SABERLO
--
-- `public_flags` no lo trae todo:
--
--   · NITRO no viene. Discord solo dice `premium_type` a la propia cuenta,
--     con el token de su inicio de sesion; a un bot no se lo cuenta. Por
--     eso el Nitro sigue guardandose en el perfil al enlazar, y es el
--     unico de todos que si necesita volver a conectar Discord.
--   · Impulsar un servidor tampoco: es por servidor, no por persona.
--   · Y lo que Discord va añadiendo ultimamente -misiones, orbes- no
--     tiene bit asignado en ningun sitio publico.
--
-- O sea que alguien puede llevar en Discord una insignia que aqui no
-- salga. No es un fallo: es que Discord no la publica.
-- ============================================================

alter table public.presencia
  add column if not exists flags bigint not null default 0;

comment on column public.presencia.flags is
  'public_flags de Discord: un entero donde cada bit es una insignia de la cuenta. Lo rellena el bot al tomar la foto, igual que tag y deco. El Nitro NO va aqui: Discord solo lo cuenta a la propia cuenta y se guarda en perfiles.discord_nitro.';

-- ── Comprobacion ────────────────────────────────────────────
-- Tiene que devolver una fila con la columna puesta.
select
  column_name,
  data_type,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'presencia'
  and column_name = 'flags';
