-- ============================================================
-- IDENTITY · 0018 · el estado de Discord, sin Lanyard
--
-- Discord no publica la presencia por su API REST. Ni la tuya con tu
-- propio token: no existe el endpoint. Solo la manda por la pasarela, y
-- solo a un bot que comparta servidor contigo. Eso es lo que es Lanyard
-- —un bot en un servidor publico— y por eso hasta hoy «en linea» y
-- «jugando a…» solo se veian si ademas entrabas ahi.
--
-- Aqui vive lo mismo, leido por un bot NUESTRO en un servidor NUESTRO.
-- La funcion `discord-presencia` se conecta a la pasarela cada minuto,
-- toma la foto y la deja en esta tabla. El perfil publico la lee de aqui.
--
-- LO QUE SE GUARDA: lo que Discord ya publica de ti a cualquiera que
-- comparta servidor contigo. Tu estado, a que juegas y que suena. Nada
-- que no estuviera ya a la vista en la lista de miembros.
--
-- NO SE GUARDA HISTORIAL. Una fila por persona, sobrescrita. Un registro
-- de «a que hora estaba conectado cada dia» seria un dato de vigilancia,
-- y no hace falta para pintar un punto verde.
--
-- SE BORRA SOLA. Quien deja de estar en el servidor deja de aparecer en
-- la foto, y la funcion pone su fila en «offline»; quien borra su cuenta
-- de IDENTITY se lleva su fila por delante (`on delete cascade` no vale
-- aqui porque la clave es el id de Discord, no el del perfil: lo hace la
-- funcion `borrar-cuenta`).
-- ============================================================

create table if not exists public.presencia (
  -- El snowflake de Discord. Es la clave porque es lo unico que el perfil
  -- publico conoce de quien mira: `perfiles.apariencia->>'discordId'`.
  discord_id      text primary key,

  -- online | idle | dnd | offline
  estado          text        not null default 'offline',

  -- «Jugando a Rocket League», «Viendo YouTube», o el estado
  -- personalizado. Vacio cuando no hay NADA que contar.
  actividad       text        not null default '',
  detalle         text        not null default '',

  -- Lo que suena en Spotify. Va aparte de la actividad porque trae mas
  -- cosas: titulo, artista y caratula.
  cancion_titulo  text        not null default '',
  cancion_artista text        not null default '',
  cancion_portada text        not null default '',

  actualizado     timestamptz not null default now()
);

comment on table public.presencia is
  'Foto del estado de Discord de quien esta en nuestro servidor. La escribe la funcion discord-presencia; se sobrescribe, no se acumula.';

-- Para la limpieza de filas rancias: si la funcion deja de correr, el
-- perfil no puede seguir enseñando «en linea» de hace tres dias.
create index if not exists presencia_actualizado_idx
  on public.presencia (actualizado);

-- ---- el permiso de tabla, que RLS NO sustituye ------------
-- Se me habia olvidado y la lectura fallaba con 42501 antes de llegar
-- siquiera a la politica. Son dos porteros en serie: primero el GRANT de
-- Postgres —¿puede este rol tocar la tabla?— y solo despues la politica
-- de RLS —¿que filas?—. Una politica `using (true)` sobre una tabla sin
-- grant no deja pasar a nadie.
--
-- `anon` porque un perfil lo abre cualquiera, sin sesion. Solo SELECT:
-- escribir sigue siendo cosa de la funcion de borde.
grant select on public.presencia to anon, authenticated;

alter table public.presencia enable row level security;

-- LEER: cualquiera. Es lo que pinta un perfil publico, y no hay nada
-- aqui que no publique ya Discord a quien comparta servidor contigo.
drop policy if exists "presencia visible" on public.presencia;
create policy "presencia visible"
  on public.presencia for select
  using (true);

-- ESCRIBIR: nadie con una clave de navegador. Solo la funcion de borde,
-- que usa la clave de servicio y se salta RLS. Sin esta politica —o con
-- una permisiva— cualquiera podria ponerse «jugando a» lo que quisiera,
-- que es exactamente el problema que tenia el contador de visitas antes
-- de moverlo al servidor.
--
-- No se declara ninguna politica de insert/update/delete a proposito:
-- en RLS, lo que no se permite esta prohibido.
