-- ============================================================
-- IDENTITY · 0020 · el id de lo que suena, para poder ponerlo
--
-- La presencia ya guardaba el titulo, el artista y la caratula de lo que
-- suena en Spotify: suficiente para CONTARLO, inutil para REPRODUCIRLO.
-- Con un titulo no se puede montar un reproductor; hace falta el id de
-- la pista.
--
-- Discord lo manda y no lo miraba nadie: en la actividad de Spotify viene
-- `sync_id`, que es exactamente el id de la cancion en Spotify. De ahi
-- sale `https://open.spotify.com/embed/track/<id>`, que es lo que el
-- bloque de musica ya sabe pintar —lleva desde siempre el campo `embed`—
-- y lo que la CSP ya deja incrustar.
--
-- PARA QUE: si tienes musica puesta en el perfil, manda la tuya. Si no
-- tienes ninguna, suena lo que estas escuchando ahora mismo. El perfil de
-- alguien que no ha configurado nada deja de tener un hueco vacio donde
-- podria estar lo que le gusta.
--
-- Se guarda SOLO el id, no una direccion: una columna que contiene una
-- URL acaba conteniendo cualquier URL. La direccion se arma al pintar,
-- con el id metido en una plantilla fija.
-- ============================================================

alter table public.presencia
  add column if not exists cancion_id text not null default '';

comment on column public.presencia.cancion_id is
  'Id de la pista en Spotify (`sync_id` de la actividad de Discord). Vacio si no hay nada sonando. Solo el id: la URL se arma al pintar.';


-- ---- y lo que el BOT puede leer por su cuenta ---------------
-- La etiqueta de servidor y el marco de Nitro no vienen en la presencia:
-- van en el USUARIO, no en el estado. Hasta ahora se copiaban al enlazar
-- la cuenta con el token de OAuth — lo que obliga a volver a conectar
-- Discord cada vez que aparece un campo nuevo, y ya ha pasado dos veces.
--
-- Pero el bot puede pedirlas el mismo: `GET /users/{id}` con su token
-- devuelve el usuario entero, y el bot ya sabe quien esta en el servidor.
-- Guardandolas aqui se refrescan solas —si cambias de etiqueta, cambia—
-- y nadie tiene que volver a enlazar nada nunca mas.
alter table public.presencia
  add column if not exists tag       text not null default '',
  add column if not exists tag_icono text not null default '',
  add column if not exists deco      text not null default '';

comment on column public.presencia.tag is
  'Etiqueta de servidor de Discord (`primary_guild.tag`). La lee el bot, no el enlace de OAuth.';
