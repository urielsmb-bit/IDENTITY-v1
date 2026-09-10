-- ============================================================
-- IDENTITY · 0021 · el logo de lo que estas haciendo
--
-- La presencia ya guardaba el TEXTO de la actividad -«Jugando a
-- Fortnite»- y nada mas. Con eso el widget cuenta lo que haces pero no lo
-- enseña: un renglon de texto gris entre otros dos renglones de texto
-- gris. El logo del juego se reconoce antes de leerlo, que es justo lo
-- que se le pide a un widget que se mira de reojo.
--
-- Discord lo manda y no lo miraba nadie. En `activities[].assets` viene
-- `large_image`, que NO es una direccion: es un identificador de archivo
-- que hay que resolver contra el id de la aplicacion. Eso lo hace el bot
-- -es quien ve la presencia cruda- y aqui se guarda ya resuelto.
--
-- Se guarda la direccion entera y no las piezas porque armarla tiene tres
-- casos distintos (proxy de Discord, archivo de la aplicacion, Spotify) y
-- resolverlos en cada pintada seria repetir la misma decision en el
-- navegador de cada visitante.
-- ============================================================

alter table public.presencia
  add column if not exists actividad_img text not null default '';

comment on column public.presencia.actividad_img is
  'Logo de la actividad (el icono del juego o la aplicacion), ya resuelto a una direccion de la CDN de Discord por el bot. Vacio si la actividad no trae imagen.';
