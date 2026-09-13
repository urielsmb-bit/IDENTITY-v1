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

-- OJO CON EL `do update`, QUE NO ES UN DETALLE.
--
-- Antes esto decia `do nothing`, y desde que existe la prueba de siete
-- dias (migracion 0025) eso era una trampa: quien ya tuvo la prueba
-- TIENE una fila `premium`, aunque este vencida. Con `do nothing`, esta
-- orden se ejecutaba sin quejarse, no cambiaba nada, y te quedabas
-- creyendo que le habias dado el plan a alguien que seguia sin el.
--
-- `expira = null` es lo que convierte una prueba vencida en plan de
-- verdad: null quiere decir «para siempre».
insert into public.insignias_concedidas (perfil_id, insignia, nota, expira)
select p.id, 'premium', 'concedida a mano mientras no hay cobro', null
  from public.perfiles p
 where p.username = 'shark'          -- <<< el @usuario, sin la arroba
on conflict (perfil_id, insignia) do update
  set expira = null,
      nota   = excluded.nota;


-- ---- comprobar que ha entrado -------------------------------
select p.username,
       i.concedida,
       case when i.expira is null then 'para siempre'
            when i.expira > now() then 'prueba, vence ' || i.expira::date
            else                      'prueba VENCIDA el ' || i.expira::date
       end as estado
  from public.insignias_concedidas i
  join public.perfiles p on p.id = i.perfil_id
 where i.insignia = 'premium'
 order by i.concedida desc;


-- ---- y para quitarlo ----------------------------------------
-- delete from public.insignias_concedidas
--  where insignia = 'premium'
--    and perfil_id = (select id from public.perfiles where username = 'shark');
