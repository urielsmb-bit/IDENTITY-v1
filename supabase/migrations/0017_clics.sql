-- ============================================================
-- IDENTITY · 0017 · cuantas veces pulsan tus enlaces
--
-- En una pagina de enlaces, «¿alguien pulso?» es LA pregunta. Hasta hoy
-- se contaban visitas y nada mas: sabias cuanta gente entraba y no si
-- alguna se llevo algo de ahi. Media pelicula.
--
-- LO QUE SE GUARDA: un contador por enlace y por dia. Nada mas.
--
--     perfil · destino · dia · veces
--
-- NO HAY VISITANTE. Ni siquiera hasheado. Las visitas si identifican a
-- quien mira —con una huella y una pimienta— porque hace falta para no
-- contar diez veces a la misma persona; aqui no hace falta y por tanto
-- no se recoge. Es el dato mas barato de proteger: el que no existe.
--
-- Y por eso mismo esto cuenta CLICS, no PERSONAS. La pagina tiene que
-- decirlo asi. Un contador de pulsaciones presentado como «personas que
-- pulsaron» seria una cifra inventada, y ya hemos quitado unas cuantas.
--
-- SE GUARDA EL DESTINO, NO LA POSICION. Si guardaramos «el enlace numero
-- 3», reordenar tus enlaces reescribiria tu historia hacia atras: los
-- clics de tu Instagram pasarian a contar como de tu TikTok. La URL es
-- tuya, es publica y es lo que de verdad quieres saber — cuanta gente
-- fue a tu Instagram.
--
-- SOLO CUENTA DE AQUI EN ADELANTE. Lo de antes no esta y no se puede
-- deducir: no se guardo. Igual que con el pais en 0015, la pagina lo
-- dice en vez de enseñar un total a medias.
-- ============================================================

create table if not exists clics (
  perfil_id uuid not null references perfiles(id) on delete cascade,
  -- El enlace al que fue. Recortado: es una URL de perfil, no un ensayo.
  destino   text not null check (length(destino) between 1 and 300),
  dia       date not null default current_date,
  veces     integer not null default 0,
  primary key (perfil_id, destino, dia)
);

-- Se lee «lo mio, de los ultimos N dias», que es exactamente este orden.
create index if not exists clics_por_dia
  on clics (perfil_id, dia desc);

alter table clics enable row level security;

-- Igual que `vistas`: el dueño ve lo suyo, nadie mas lee, y NADIE
-- escribe directamente — solo la funcion de abajo, que es la que aplica
-- el tope. Sin esto, cualquiera con la clave publica podria escribir la
-- cifra que quisiera en el contador de otro.
drop policy if exists clics_solo_el_dueno on clics;
create policy clics_solo_el_dueno on clics
  for select using (
    exists (select 1 from perfiles p
             where p.id = clics.perfil_id and p.dueno = auth.uid())
  );


-- ---- registrar un clic -------------------------------------
--
-- Va desde el navegador y no desde el borde, al reves que las visitas.
-- Las visitas necesitan la IP para hacer la huella, y la IP solo la ve
-- el borde; aqui no hay huella que hacer, asi que no hay motivo para
-- dar el rodeo.
--
-- `security definer` porque la tabla no deja escribir a nadie: la unica
-- puerta es esta funcion, y por aqui se pasa por el tope.
create or replace function registrar_clic(
  p_username citext,
  p_destino  text
)
returns void
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_perfil uuid;
  v_dest   text;
begin
  v_dest := left(btrim(coalesce(p_destino, '')), 300);
  if v_dest = '' then return; end if;

  select id into v_perfil
    from perfiles
   where username = p_username and estado = 'activo';
  if v_perfil is null then return; end if;

  /* Tope por perfil Y destino. No identifica a nadie —no hay a quien
     identificar— pero corta que un script infle un contador toda la
     tarde. 600 a la hora es muchisimo para un enlace de verdad y
     poquisimo para un bucle.

     Se sale en SILENCIO, no con error. Un clic pasado de tope no es un
     fallo de quien navega: ya se esta yendo a otra pagina y una alerta
     ahi no le sirve a nadie. Las visitas hacen lo mismo. */
  if not privado.consumir('clic:' || v_perfil::text || ':' || v_dest, 600, interval '1 hour') then
    return;
  end if;

  insert into clics (perfil_id, destino, dia, veces)
  values (v_perfil, v_dest, current_date, 1)
  on conflict (perfil_id, destino, dia) do update
    -- El tope de integer, igual que en `vistas`: un contador que da la
    -- vuelta es peor que uno que se planta.
    set veces = least(clics.veces + 1, 2147483000);
end;
$$;

-- ---- permisos ----------------------------------------------
--
-- La funcion es NUEVA, o sea que nace sin permisos y hay que darlos a
-- mano. Es el fallo que costo la 0012 y que la 0015 volvio a avisar:
-- sin esto, el navegador llama a una funcion que no puede ejecutar y
-- los clics dejan de contarse EN SILENCIO.
revoke all on function registrar_clic(citext, text) from public;
grant execute on function registrar_clic(citext, text) to anon, authenticated;


-- ---- La prueba, aqui mismo ---------------------------------
do $$
declare
  v_id uuid;
  v_user citext;
  v_antes bigint;
  v_despues bigint;
begin
  select id, username into v_id, v_user
    from perfiles where estado = 'activo' limit 1;

  if v_id is null then
    raise notice '0017: no hay perfiles todavia; la prueba se salta.';
    return;
  end if;

  select coalesce(sum(veces), 0) into v_antes
    from clics where perfil_id = v_id and destino = 'https://prueba.invalido/0017';

  perform registrar_clic(v_user, 'https://prueba.invalido/0017');

  select coalesce(sum(veces), 0) into v_despues
    from clics where perfil_id = v_id and destino = 'https://prueba.invalido/0017';

  if v_despues <> v_antes + 1 then
    raise exception '0017: registrar_clic no sumo (antes %, despues %)', v_antes, v_despues;
  end if;

  -- Se limpia: la prueba no debe dejarle basura en las estadisticas a
  -- nadie. `.invalido` es un dominio que no existe por norma, asi que
  -- si algo se escapara tampoco apuntaria a ningun sitio.
  delete from clics
   where perfil_id = v_id and destino = 'https://prueba.invalido/0017';

  raise notice '0017: registrar_clic funciona.';
end $$;
