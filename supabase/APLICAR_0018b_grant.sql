-- ============================================================
-- IDENTITY · 0018b · el grant que le faltaba a `presencia`
--
-- La 0018 creo la tabla y su politica de RLS, pero no el permiso de
-- tabla. Son dos porteros en serie: primero el GRANT de Postgres
-- —¿puede este rol tocarla?— y solo despues la politica —¿que filas?—.
-- Con la politica puesta y sin grant, leerla daba:
--
--   42501: permission denied for table presencia
--
-- Pegar esto si ya se aplico la 0018. Si se aplica la 0018 de nuevo, ya
-- lo trae dentro y esto sobra (repetirlo tampoco rompe nada).
-- ============================================================

grant select on public.presencia to anon, authenticated;

-- ---- comprobar -------------------------------------------
-- Deberia devolver una fila por rol con `select` en true.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'presencia'
 order by grantee;
