-- ============================================================
-- IDENTITY · 0010 · que la falta de pimienta se note y se cure
--
-- SINTOMA: las visitas se quedan a cero. La funcion de borde
-- responde 204 y no hay error de CORS, pero `perfil_metricas` no
-- sube nunca.
--
-- CAUSA: `registrar_vista` hashea al visitante con una «pimienta»
-- guardada en `privado.config`. Si esa fila falta:
--
--     v_pim              -> NULL
--     '...' || v_pim     -> NULL          (concatenar con NULL da NULL)
--     digest(NULL,...)   -> NULL
--     insert visitante   -> choca con `not null`
--
-- ...y la funcion de borde se traga la excepcion en un
-- console.error y devuelve 204 igual, que es lo correcto de cara
-- a fuera —la respuesta no debe revelar si un perfil existe— pero
-- deja el fallo invisible.
--
-- La fila se siembra en 0001. `APLICAR.sql` empieza en la 0002,
-- asi que quien aplico solo el bundle nunca la creo.
--
-- Esta migracion hace dos cosas, y las dos son seguras de
-- relanzar:
--
--   1 · la siembra si falta, sin tocarla si ya esta. La pimienta
--       NO se puede regenerar a lo tonto: cambiarla convierte a
--       todos los visitantes conocidos en desconocidos y las
--       visitas unicas se disparan de golpe.
--
--   2 · hace que la funcion falle DICIENDO POR QUE en vez de
--       chocar contra un `not null` tres lineas mas abajo. Si
--       algun dia vuelve a faltar, el registro lo dira en una
--       linea en vez de costar una tarde.
-- ============================================================

-- ---- 1 · lo que hace falta para hashear -------------------

create extension if not exists pgcrypto;

insert into privado.config (clave, valor)
values ('pimienta_visitas', encode(gen_random_bytes(32), 'hex'))
on conflict (clave) do nothing;

-- Y si existiera pero vacia —que produce el mismo hash para todo
-- el mundo, o sea un solo visitante para siempre— se rellena.
update privado.config
   set valor = encode(gen_random_bytes(32), 'hex')
 where clave = 'pimienta_visitas'
   and coalesce(valor, '') = '';

-- ---- 2 · la funcion, que ahora explica su fallo ------------
--
-- Identica a la de 0005 salvo la comprobacion de la pimienta.

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

  /* Antes esto seguia adelante con v_pim en NULL y reventaba tres
     lineas mas abajo con «null value in column visitante», que no
     dice nada de la causa. */
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

  /* barrido ocasional, para no acumular claves caducadas */
  if random() < 0.01 then perform privado.limpiar_limites(); end if;
end;
$$;

revoke all on function registrar_vista(citext, text, text) from public, anon, authenticated;
