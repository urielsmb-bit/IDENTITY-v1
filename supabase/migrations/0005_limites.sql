-- ============================================================
-- IDENTITY · 0005 · Límites de uso
--
-- Fase 10. Medido antes de escribir nada: ocho denuncias anónimas
-- seguidas, todas aceptadas (201). Diez comprobaciones de nombre,
-- todas 200. No había ningún límite en ninguna parte.
--
-- Aquí NO se pone "100 peticiones por minuto" a todo. Cada
-- operación tiene un abuso distinto y un uso legítimo distinto, y
-- un límite que estorba a una persona normal se acaba quitando.
-- ============================================================


-- ============================================================
-- El contador · ventana deslizante simple
--
-- Una fila por clave. Cuando la ventana caduca se reinicia. No es
-- un algoritmo fino —no reparte el gasto dentro de la ventana—
-- pero para frenar abuso es de sobra, y cabe en veinte líneas que
-- se pueden leer y entender.
-- ============================================================
create table if not exists privado.limites (
  clave    text primary key,
  desde    timestamptz not null default now(),
  cuenta   integer not null default 0
);

alter table privado.limites enable row level security;

create or replace function privado.consumir(
  p_clave   text,
  p_tope    integer,
  p_ventana interval
)
returns boolean
language plpgsql
security definer
set search_path = privado, pg_temp
as $$
declare
  v_cuenta integer;
begin
  insert into privado.limites (clave, desde, cuenta)
  values (p_clave, now(), 1)
  on conflict (clave) do update
    set
      /* si la ventana caducó, empieza de cero */
      desde  = case when privado.limites.desde < now() - p_ventana
                    then now() else privado.limites.desde end,
      cuenta = case when privado.limites.desde < now() - p_ventana
                    then 1 else privado.limites.cuenta + 1 end
  returning cuenta into v_cuenta;

  return v_cuenta <= p_tope;
end;
$$;

revoke all on function privado.consumir(text, integer, interval)
  from public, anon, authenticated;

/* La tabla crece con las claves que caducan y nadie vuelve a usar.
   Se limpia sola en cada llamada, de vez en cuando, para no tener
   que montar una tarea programada por veinte filas. */
create or replace function privado.limpiar_limites()
returns void
language sql
security definer
set search_path = privado, pg_temp
as $$
  delete from privado.limites where desde < now() - interval '2 days';
$$;


-- ============================================================
-- F10-01 · HIGH · Denuncias sin límite
--
-- Comprobado: 8 seguidas, todas aceptadas. Un anónimo con un
-- bucle llena la tabla y ahoga la cola de moderación — que es
-- justo el mecanismo del que depende poder retirar contenido
-- ilegal. Inutilizar la moderación es tan útil para un atacante
-- como saltársela.
--
-- Dos límites, porque son dos abusos distintos:
--
--   por PERFIL  frena el ahogo aunque el atacante cambie de IP y
--               no tenga cuenta. Cincuenta denuncias en una hora
--               sobre el mismo perfil ya es señal de sobra: la
--               cincuenta y una no aporta nada que la cincuenta no
--               dijera.
--   por CUENTA  frena a quien sí ha entrado y denuncia en masa a
--               mucha gente.
-- ============================================================
create or replace function limitar_denuncias()
returns trigger
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
begin
  if not privado.consumir('denuncia:perfil:' || new.perfil_id::text, 50, interval '1 hour') then
    raise exception 'Este perfil ya ha recibido muchas denuncias; ya lo estamos mirando.'
      /* PT429, no 54000. PostgREST traduce los codigos SQLSTATE que
         empiezan por PT al estado HTTP de sus tres ultimos digitos,
         asi que esto sale como 429 Too Many Requests.
         Con 54000 salia 500: "el servidor se rompio". Y eso importa
         por dos cosas — con alertas de error, cada abuso frenado te
         despierta como si fuera una caida; y los clientes reintentan
         los 5xx y no los 4xx, o sea que un reintento automatico
         amplificaba el abuso en vez de frenarlo. */
      using errcode = 'PT429';
  end if;

  if auth.uid() is not null then
    if not privado.consumir('denuncia:cuenta:' || auth.uid()::text, 10, interval '1 day') then
      raise exception 'Has enviado demasiadas denuncias hoy. Vuelve manana.'
        using errcode = 'PT429';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists denuncias_limitar on denuncias;
create trigger denuncias_limitar
  before insert on denuncias
  for each row execute function limitar_denuncias();


-- ============================================================
-- F10-02 · MEDIUM · Valoraciones sin límite
--
-- La clave primaria ya impide votar dos veces al MISMO perfil,
-- pero nada impedía recorrer todos los perfiles votando. Veinte a
-- la hora es muchísimo para una persona y poquísimo para un script.
-- ============================================================
create or replace function limitar_valoraciones()
returns trigger
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null then
    if not privado.consumir('voto:' || auth.uid()::text, 20, interval '1 hour') then
      raise exception 'Has valorado demasiados perfiles seguidos. Espera un poco.'
        using errcode = 'PT429';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists valoraciones_limitar on valoraciones;
create trigger valoraciones_limitar
  before insert on valoraciones
  for each row execute function limitar_valoraciones();


-- ============================================================
-- F10-03 · MEDIUM · Escritura de perfil sin límite
--
-- El editor guarda solo, con retardo, así que en una hora de
-- edición intensa saldrán unas decenas de escrituras. Cien por
-- minuto no lo alcanza nadie escribiendo; un bucle sí, y cada
-- escritura arrastra un jsonb de hasta 256 KB.
--
-- El tope es alto a propósito: un límite que corta a quien está
-- trabajando de verdad se acaba quitando, y entonces no protege de
-- nada.
-- ============================================================
create or replace function limitar_escrituras_perfil()
returns trigger
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
begin
  if auth.uid() is not null then
    if not privado.consumir('perfil:' || auth.uid()::text, 100, interval '1 minute') then
      raise exception 'Demasiados cambios seguidos. Espera unos segundos.'
        using errcode = 'PT429';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_limitar on perfiles;
create trigger perfiles_limitar
  before insert or update on perfiles
  for each row execute function limitar_escrituras_perfil();


-- ============================================================
-- F10-04 · LOW · Un visitante podía generar escrituras sin fin
--
-- `registrar_vista` ya cuenta una sola visita ÚNICA por huella,
-- así que recargar no mueve el ranking. Pero cada recarga sí
-- escribía: subía `veces` y `vistas_totales`. Un bucle no falsea
-- nada, pero hace trabajar a la base gratis.
--
-- Sesenta por hora y por visitante y perfil. Por encima, se ignora
-- en silencio: quien recarga no tiene que enterarse de nada.
-- ============================================================
create or replace function registrar_vista(
  p_username citext,
  p_ip       text,
  p_agente   text
)
returns void
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_perfil uuid;
  v_pim    text;
  v_hash   bytea;
  v_nuevo  boolean;
  v_ip     text := coalesce(p_ip, '');
  v_ag     text := coalesce(p_agente, '');
begin
  select id into v_perfil from perfiles
   where username = p_username and estado = 'activo';
  if v_perfil is null then return; end if;

  select valor into v_pim from privado.config where clave = 'pimienta_visitas';

  v_hash := digest(
    length(v_ip)::text || ':' || v_ip ||
    length(v_ag)::text || ':' || v_ag ||
    v_perfil::text || v_pim,
    'sha256'
  );

  /* Silencioso a proposito: recargar mucho no es un delito, y no
     hay nada util que decirle a quien lo hace. */
  if not privado.consumir('vista:' || encode(v_hash, 'hex'), 60, interval '1 hour') then
    return;
  end if;

  insert into vistas (perfil_id, visitante)
  values (v_perfil, v_hash)
  on conflict (perfil_id, visitante) do update
    set veces  = least(vistas.veces + 1, 2147483000),
        ultima = now()
  returning (xmax = 0) into v_nuevo;

  insert into perfil_metricas (perfil_id, vistas_unicas, vistas_totales)
  values (v_perfil, 1, 1)
  on conflict (perfil_id) do update
    set vistas_unicas  = perfil_metricas.vistas_unicas + (case when v_nuevo then 1 else 0 end),
        vistas_totales = perfil_metricas.vistas_totales + 1;

  /* barrido ocasional, para no acumular claves caducadas */
  if random() < 0.01 then perform privado.limpiar_limites(); end if;
end;
$$;

revoke all on function registrar_vista(citext, text, text) from public, anon, authenticated;


comment on table privado.limites is
  'Ventana deslizante por clave. Un limite que estorba a una persona normal se acaba quitando, asi que los topes son altos para el uso legitimo y bajos para el abuso.';
