-- ============================================================
-- IDENTITY · 0011 · `digest()` no estaba al alcance de la funcion
--
-- SINTOMA: `vistas` completamente vacia. Ni una fila, nunca. La
-- funcion de borde responde 204, no hay error de CORS, las 44
-- comprobaciones en verde y el contador clavado en cero.
--
-- CAUSA: `pgcrypto` esta instalada —la comprobacion 42 lo dice—
-- pero en Supabase las extensiones NO viven en `public`: van al
-- esquema `extensions`. Y `registrar_vista` se declara con
--
--     set search_path = public, privado, pg_temp
--
-- Ese `set` es una jaula: dentro de la funcion solo se ven esos
-- tres esquemas. `extensions` no esta, asi que `digest(...)` no
-- se resuelve y la llamada lanza «function digest(text, unknown)
-- does not exist».
--
-- La excepcion sube hasta la funcion de borde, que la anota en un
-- console.error y devuelve 204 igual. Desde fuera, identico a que
-- todo hubiera ido bien. De ahi que costara encontrarlo.
--
-- El `search_path` fijo NO es el error: es una defensa deliberada
-- —sin el, cualquiera que pueda crear una tabla en un esquema del
-- path puede secuestrar lo que la funcion llama, y esto es
-- SECURITY DEFINER—. La comprobacion 14 lo exige. El arreglo no
-- es quitarlo, es incluir tambien el esquema donde de verdad esta
-- lo que se usa.
--
-- Se anade `extensions` al path. Sirve tanto si pgcrypto acabo
-- ahi como si acabo en `public`: los dos estan en la lista.
--
-- Aplicar: pegar en el editor SQL. Se puede relanzar.
-- ============================================================

create or replace function registrar_vista(
  p_username citext,
  p_ip       text,
  p_agente   text
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

  if random() < 0.01 then perform privado.limpiar_limites(); end if;
end;
$$;

revoke all on function registrar_vista(citext, text, text) from public, anon, authenticated;

-- ---- La prueba, aqui mismo -------------------------------
--
-- Si `digest` sigue sin resolverse, esto lanza y lo veras en rojo
-- en vez de descubrirlo dentro de un mes mirando un cero.
do $$
declare v_x bytea;
begin
  select digest('prueba', 'sha256') into v_x;
  if v_x is null then
    raise exception 'digest() devolvio NULL';
  end if;
  raise notice 'digest() responde: %', encode(v_x, 'hex');
end
$$;
