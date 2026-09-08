-- ============================================================
-- IDENTITY · 0018b · los permisos que le faltaban a `presencia`
--
-- Pegar entero. Se puede relanzar sin romper nada.
--
-- La 0018 creo la tabla y su politica de RLS, pero ningun GRANT. Son dos
-- porteros en serie y hacen falta los dos:
--
--   1. el GRANT de Postgres  -> ¿puede este rol tocar la tabla?
--   2. la politica de RLS    -> ¿que filas?
--
-- Con la politica `using (true)` y sin grant no pasa nadie:
--   42501: permission denied for table presencia
--
-- Y `service_role` tampoco se libra. Se salta la RLS, si — pero saltarse
-- la RLS no es tener permiso de tabla. Es la misma leccion que la 0012
-- con el EXECUTE de `registrar_vista`: en esta base no queda nada por
-- defecto, hay que decir quien puede.
-- ============================================================

-- LEER: cualquiera, que un perfil lo abre gente sin sesion.
grant select on public.presencia to anon, authenticated;

-- ESCRIBIR: solo la funcion de borde, que es la unica que lleva la clave
-- de servicio. Desde el navegador no se puede: no hay politica de insert
-- ni de update, y en RLS lo que no se permite esta prohibido.
grant select, insert, update, delete on public.presencia to service_role;

-- ---- comprobar -------------------------------------------
-- Deberian salir: anon y authenticated con SELECT, y service_role con
-- SELECT, INSERT, UPDATE y DELETE.
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'presencia'
   and grantee in ('anon', 'authenticated', 'service_role')
 group by grantee
 order by grantee;
