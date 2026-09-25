-- ============================================================
-- sharee · 0031 · Premium de por vida, cobrado con Tebex
--
-- Premium es un pago unico: se paga una vez y es tuyo para siempre. Tebex
-- cobra —es quien vende y factura, el «comerciante registrado»— y avisa
-- a la funcion `tebex-webhook`, que llama a `tebex_aviso` de aqui abajo.
--
-- Lo que hace cada aviso:
--
--   · payment.completed      → el diamante, SIN caducidad. Si tenia la
--                               semana de prueba, se convierte en para
--                               siempre.
--   · payment.refunded       → se quita, pero SOLO el que dio ese pago. Si
--   · payment.dispute.lost      el equipo se lo habia dado a mano, se queda.
--   · payment.dispute.opened → se anota; no se quita nada todavia.
--
-- Lo que NO se guarda: ni el correo, ni el nombre, ni la tarjeta de quien
-- paga. Todo eso lo tiene Tebex. Aqui solo queda el numero de la
-- transaccion, el importe y a que perfil fue.
--
-- COMO SE APLICA: Supabase → SQL Editor → pegar entero → Run. Se puede
-- ejecutar dos veces sin romper nada.
-- ============================================================


-- ---- 1 · las dos tablas, en `privado` -----------------------

-- Un pago por fila. Es el historial: sirve para saber quien compro, para
-- deshacer justo lo que dio un pago si se devuelve, y para cuadrar con lo
-- que dice Tebex.
create table if not exists privado.pagos (
  transaccion text        primary key,          -- el id de Tebex (tbx-…)
  perfil_id   uuid        references public.perfiles(id) on delete set null,
  estado      text        not null,             -- completado | sin_perfil | disputa | reembolsado | disputa_perdida
  importe     numeric(10,2),
  moneda      text,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Los avisos ya recibidos. Tebex reintenta si no contesta a tiempo, asi
-- que el mismo aviso puede llegar dos veces: el segundo no hace nada.
create table if not exists privado.avisos_tebex (
  id       text        primary key,
  tipo     text        not null,
  recibido timestamptz not null default now()
);

alter table privado.pagos        enable row level security;
alter table privado.avisos_tebex enable row level security;
revoke all on privado.pagos        from public, anon, authenticated;
revoke all on privado.avisos_tebex from public, anon, authenticated;


-- ---- 2 · lo que hace cada aviso ------------------------------
--
-- Solo la puede llamar la funcion del borde, con la clave de servicio.
-- Ni anon ni authenticated: si cualquiera pudiera llamarla, cualquiera se
-- regalaria el plan. La firma del aviso se comprueba en la funcion, antes
-- de llegar aqui.

create or replace function public.tebex_aviso(
  p_aviso       text,
  p_tipo        text,
  p_transaccion text,
  p_perfil      uuid,
  p_importe     numeric default null,
  p_moneda      text    default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- La nota dice de donde salio el diamante. Es lo que permite quitar
  -- SOLO el de este pago si se devuelve.
  v_nota   text := 'tebex ' || p_transaccion;
  v_perfil uuid;
begin
  insert into privado.avisos_tebex (id, tipo) values (p_aviso, p_tipo)
  on conflict (id) do nothing;
  if not found then
    return 'repetido';
  end if;

  if p_tipo = 'payment.completed' then
    -- Un pago sin perfil al que darselo —el perfil se borro entre medias,
    -- o el identificador no llego— se apunta para resolverlo a mano.
    if p_perfil is null or not exists (select 1 from public.perfiles where id = p_perfil) then
      insert into privado.pagos (transaccion, perfil_id, estado, importe, moneda)
      values (p_transaccion, null, 'sin_perfil', p_importe, p_moneda)
      on conflict (transaccion) do update
        set estado = 'sin_perfil', actualizado = now();
      return 'sin_perfil';
    end if;

    insert into privado.pagos (transaccion, perfil_id, estado, importe, moneda)
    values (p_transaccion, p_perfil, 'completado', p_importe, p_moneda)
    on conflict (transaccion) do update
      set estado = 'completado', perfil_id = excluded.perfil_id, actualizado = now();

    insert into public.insignias_concedidas (perfil_id, insignia, nota, expira, por)
    values (p_perfil, 'premium', v_nota, null, null)
    on conflict (perfil_id, insignia) do update
      set expira = null, nota = excluded.nota, concedida = now(), por = null;
    return 'premium';

  elsif p_tipo in ('payment.refunded', 'payment.dispute.lost') then
    update privado.pagos
    set estado = case p_tipo when 'payment.refunded' then 'reembolsado' else 'disputa_perdida' end,
        actualizado = now()
    where transaccion = p_transaccion
    returning perfil_id into v_perfil;

    delete from public.insignias_concedidas
    where perfil_id = v_perfil and insignia = 'premium' and nota = v_nota;
    return 'retirado';

  elsif p_tipo = 'payment.dispute.opened' then
    update privado.pagos set estado = 'disputa', actualizado = now()
    where transaccion = p_transaccion;
    return 'anotado';

  elsif p_tipo = 'payment.dispute.won' then
    update privado.pagos set estado = 'completado', actualizado = now()
    where transaccion = p_transaccion;
    return 'anotado';
  end if;

  return 'ignorado';
end;
$$;

comment on function public.tebex_aviso(text, text, text, uuid, numeric, text) is
  'Aplica un aviso de pago de Tebex: da o quita el Premium de por vida. Solo la llama la funcion tebex-webhook, con la clave de servicio.';

revoke all on function public.tebex_aviso(text, text, text, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.tebex_aviso(text, text, text, uuid, numeric, text) to service_role;
