-- ============================================================
-- IDENTITY · 0015 · de que pais te ven
--
-- LO QUE SE GUARDA: dos letras. `CO`, `MX`, `ES`. Nada mas.
--
-- LA IP SIGUE SIN GUARDARSE. Se usa igual que hasta ahora —para hashear
-- al visitante con la pimienta y no contar diez veces a la misma
-- persona— y se tira. El pais lo pone Cloudflare en una cabecera antes
-- de que la peticion llegue aqui, asi que no hace falta ni mirar la IP
-- para saberlo, ni llamar a ningun servicio de terceros con ella. Nadie
-- de fuera se entera de nada.
--
-- Dos letras no identifican a nadie. La IP si, y por eso no esta.
--
-- SOLO CUENTA DE AQUI EN ADELANTE. Las visitas que ya estan guardadas no
-- tienen pais y no hay forma de saberlo: la IP con la que llegaron no se
-- guardo, que era justo la intencion. La pagina lo dice en vez de
-- enseñar un reparto a medias como si fuera el total.
-- ============================================================

alter table vistas
  add column if not exists pais text
  check (pais is null or pais ~ '^[A-Z]{2}$');

create index if not exists vistas_por_pais
  on vistas (perfil_id, pais) where pais is not null;

-- ---- la funcion, ahora con pais ----------------------------
--
-- OJO: añadir un parametro NO reemplaza la funcion, crea otra distinta.
-- Quedarian las dos y los permisos de 0012 seguirian en la vieja, o sea
-- que el borde llamaria a una funcion sin EXECUTE y las visitas dejarian
-- de contarse EN SILENCIO. Ya paso una vez con esto mismo. Se tira la
-- vieja a mano y se vuelven a dar los permisos abajo.
drop function if exists registrar_vista(citext, text, text);

create or replace function registrar_vista(
  p_username citext,
  p_ip       text,
  p_agente   text,
  p_pais     text default null
)
returns void
language plpgsql
security definer
set search_path = public, privado, extensions, pg_temp
as $$
declare
  v_perfil uuid;
  v_pim    text;
  v_hash   bytea;
  v_nuevo  boolean;
  v_ip     text := coalesce(p_ip, '');
  v_ag     text := coalesce(p_agente, '');
  v_pais   text;
begin
  select id into v_perfil from perfiles
   where username = p_username and estado = 'activo';
  if v_perfil is null then return; end if;

  select valor into v_pim from privado.config where clave = 'pimienta_visitas';

  if coalesce(v_pim, '') = '' then
    raise exception
      'Falta privado.config.pimienta_visitas: sin ella no se puede identificar al visitante. Aplica 0010.'
      using errcode = 'P0001';
  end if;

  /* Cloudflare manda `XX` cuando no lo sabe y `T1` para Tor. Ninguno de
     los dos es un pais, asi que se quedan en nulo en vez de aparecer
     como si lo fueran. */
  v_pais := upper(nullif(trim(coalesce(p_pais, '')), ''));
  if v_pais is null or v_pais !~ '^[A-Z]{2}$' or v_pais in ('XX', 'T1') then
    v_pais := null;
  end if;

  v_hash := digest(
    length(v_ip)::text || ':' || v_ip ||
    length(v_ag)::text || ':' || v_ag ||
    v_perfil::text || v_pim,
    'sha256'
  );

  if not privado.consumir('vista:' || encode(v_hash, 'hex'), 60, interval '1 hour') then
    return;
  end if;

  insert into vistas (perfil_id, visitante, pais)
  values (v_perfil, v_hash, v_pais)
  on conflict (perfil_id, visitante) do update
    set veces  = least(vistas.veces + 1, 2147483000),
        ultima = now(),
        /* El primero que se supo, y no el ultimo: si alguien vuelve
           desde un movil con otra salida a internet, su pais no deberia
           bailar. Y si la primera vez no se supo, se aprovecha esta. */
        pais   = coalesce(vistas.pais, excluded.pais)
  returning (xmax = 0) into v_nuevo;

  insert into perfil_metricas (perfil_id, vistas_unicas, vistas_totales)
  values (v_perfil, 1, 1)
  on conflict (perfil_id) do update
    set vistas_unicas  = perfil_metricas.vistas_unicas + (case when v_nuevo then 1 else 0 end),
        vistas_totales = perfil_metricas.vistas_totales + 1;

  if random() < 0.01 then perform privado.limpiar_limites(); end if;
end;
$$;

-- ---- los permisos, otra vez -------------------------------
--
-- Esto NO es repetirse por si acaso: la funcion es nueva, o sea que nace
-- con los permisos por defecto y sin esto `service_role` no la puede
-- ejecutar. Es exactamente el fallo que costo la migracion 0012.
revoke all on function registrar_vista(citext, text, text, text)
  from public, anon, authenticated;
grant execute on function registrar_vista(citext, text, text, text)
  to service_role;

-- ---- La prueba, aqui mismo -------------------------------
do $$
declare
  v_usuario citext;
  v_pais    text;
begin
  select username into v_usuario
    from perfiles where estado = 'activo' order by creado limit 1;
  if v_usuario is null then
    raise notice 'No hay perfiles activos: no se puede probar.';
    return;
  end if;

  set local role service_role;
  perform registrar_vista(v_usuario, '198.51.100.77', 'prueba-0015', 'CO');
  reset role;

  select pais into v_pais from vistas v
    join perfiles p on p.id = v.perfil_id
   where p.username = v_usuario and v.pais is not null
   order by v.primera desc limit 1;

  if v_pais is null then
    raise exception 'La visita de prueba se guardo sin pais.';
  end if;
  raise notice 'registrar_vista guarda el pais. Ultima de prueba: %', v_pais;
end
$$;
