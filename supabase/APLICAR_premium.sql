-- ============================================================
-- IDENTITY · conceder el plan a una cuenta
--
-- No hay campo `plan` ni cobro conectado: lo que decide es la insignia del
-- diamante (`premium`), y el editor lee de ahi. Eso tiene una ventaja que
-- vale mas que la simplicidad: `insignias_concedidas` solo la escribe la
-- clave de servicio, o sea que el dueño de un perfil NO puede darse el plan
-- a si mismo por ningun camino.
--
-- El dia que haya cobro, lo unico que cambia es QUIEN ejecuta esto: hoy
-- tu, mañana un webhook. Nada de lo que hay en la aplicacion se entera.
--
-- CAMBIA EL @USUARIO de abajo y pegalo en el editor SQL.
-- ============================================================

insert into public.insignias_concedidas (perfil_id, insignia, nota)
select p.id, 'premium', 'concedida a mano mientras no hay cobro'
  from public.perfiles p
 where p.username = 'shark'          -- <<< el @usuario, sin la arroba
on conflict (perfil_id, insignia) do nothing;


-- ---- comprobar que ha entrado -------------------------------
select p.username, i.insignia, i.concedida
  from public.insignias_concedidas i
  join public.perfiles p on p.id = i.perfil_id
 where i.insignia = 'premium';


-- ---- y para quitarlo ----------------------------------------
-- delete from public.insignias_concedidas
--  where insignia = 'premium'
--    and perfil_id = (select id from public.perfiles where username = 'shark');
