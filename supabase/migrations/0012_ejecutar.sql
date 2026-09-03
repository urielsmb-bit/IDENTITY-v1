-- ============================================================
-- IDENTITY · 0012 · quien puede EJECUTAR registrar_vista
--
-- Sigue sin contar despues de 0010 y 0011. Queda un camino que
-- ninguna comprobacion miraba:
--
--     revoke all on function registrar_vista(...) from public, anon, authenticated;
--
-- En PostgreSQL, EXECUTE sobre una funcion se concede a `PUBLIC`
-- por defecto. Quitarselo a PUBLIC se lo quita a TODO el que no
-- tenga un permiso propio y explicito — y la funcion de borde
-- llama con `service_role`, que es justo un rol mas.
--
-- Si `service_role` se quedo sin EXECUTE, `db.rpc(...)` devuelve
-- «permission denied for function registrar_vista». La funcion de
-- borde lo anota y responde 204 igual, que es exactamente lo que
-- se ve: 204, sin CORS, sin filas y sin pistas.
--
-- El revoke sigue siendo lo correcto: esta funcion NO puede
-- llamarse desde el navegador, porque escribe visitas saltandose
-- la RLS. Lo que faltaba es decir quien SI puede, en vez de
-- confiar en que le quedara el permiso por accidente.
--
-- Se hace explicito en los dos sentidos: fuera todos, dentro solo
-- `service_role`, que es la clave que vive unicamente en las
-- variables de la funcion de borde y nunca toca el navegador.
--
-- Aplicar: pegar en el editor SQL. Se puede relanzar.
-- ============================================================

revoke all on function registrar_vista(citext, text, text)
  from public, anon, authenticated;

grant execute on function registrar_vista(citext, text, text)
  to service_role;

-- El resto de funciones que solo debe llamar el servidor, por lo
-- mismo. `consumir` la llaman otras funciones SECURITY DEFINER
-- —que corren como su dueno— pero dejarlo escrito evita repetir
-- este rato el dia que algo la llame desde fuera.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'privado' and p.proname = 'consumir'
  ) then
    execute 'grant execute on function privado.consumir(text, integer, interval) to service_role';
  end if;
end
$$;

-- ---- La prueba, aqui mismo -------------------------------
--
-- Ejecuta la funcion COMO service_role. Si el permiso sigue sin
-- estar, esto sale en rojo ahora en vez de quedar en un 204 mudo.

do $$
declare
  v_usuario citext;
begin
  select username into v_usuario
    from perfiles where estado = 'activo' order by creado limit 1;

  if v_usuario is null then
    raise notice 'No hay perfiles activos: no se puede probar.';
    return;
  end if;

  set local role service_role;
  perform registrar_vista(v_usuario, '198.51.100.99', 'prueba-0012');
  reset role;

  raise notice 'registrar_vista se ejecuto como service_role sobre %', v_usuario;
end
$$;

-- Y se ensena que quedo. Esta visita de prueba SI se guarda: es
-- una sola, de una IP de documentacion, y sirve de constancia de
-- que el camino entero funciona.
select
  p.username,
  coalesce(m.vistas_unicas, 0)  as unicas,
  coalesce(m.vistas_totales, 0) as totales,
  (select count(*) from vistas v where v.perfil_id = p.id) as filas
from perfiles p
left join perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo'
order by p.creado;
