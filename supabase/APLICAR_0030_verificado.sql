-- ============================================================
-- sharee · 0030 · «Verificado» lo da el equipo, no se regala
--
-- Hasta hoy habia DOS verificados y ninguno significaba nada:
--
--   · la INSIGNIA salia sola a cualquiera con Discord o Google enlazado
--     —`perfil_verificado()` solo mira eso—. 15 de 17 perfiles la tenian;
--   · el CHECK AZUL junto al nombre, en el perfil y en las listas, salia de
--     `apariencia.verified`, un campo que escribe el propio dueño. Sin boton
--     para activarlo, pero con la API cualquiera podia ponerselo. Hoy no lo
--     tiene nadie: el agujero estaba abierto y sin usar.
--
-- En las plataformas grandes, verificado quiere decir que el equipo ha
-- comprobado que eres quien dices. Asi queda aqui:
--
--   1. Los que YA tienen la insignia la conservan. Se guarda como concedida,
--      con la nota «heredada», y sigue saliendo igual que hasta ahora.
--   2. Deja de repartirse sola: a partir de hoy solo la tiene quien la
--      recibe desde el panel de administracion.
--   3. El check junto al nombre sale de la base, y solo para quien has
--      verificado tu. Las heredadas NO lo encienden: esos perfiles no lo
--      tenian, y darselo ahora seria verificar a quien nadie ha comprobado.
--      Para dar el check a uno de ellos, quitale la insignia en el panel y
--      vuelvesela a dar.
--
-- COMO SE APLICA: Supabase → SQL Editor → pegar entero → Run. Se puede
-- ejecutar dos veces sin romper nada.
-- ============================================================


-- ---- 1 · los que ya la tienen, la conservan -----------------
--
-- Los mismos que hoy la ven: perfiles activos con una cuenta de fuera
-- enlazada. Si alguno ya la tenia concedida a mano, no se toca.

insert into public.insignias_concedidas (perfil_id, insignia, nota)
select p.id, 'verified', 'heredada'
from public.perfiles p
where p.estado = 'activo'
  and public.perfil_verificado(p.id)
on conflict (perfil_id, insignia) do nothing;


-- ---- 2 · y deja de repartirse sola ---------------------------
--
-- La misma vista que dejo la 0025, sin la segunda mitad: la que añadia
-- `verified` a todo perfil con Discord o Google. `create or replace`
-- porque las columnas no cambian, y asi conserva sus permisos.

create or replace view public.insignias_de_perfil
with (security_invoker = false) as
  select perfil_id, insignia, expira
  from public.insignias_concedidas
  where expira is null or expira > now();

comment on view public.insignias_de_perfil is
  'Lo unico que el cliente lee para saber que insignias tiene un perfil. Solo las concedidas y vigentes: ninguna se calcula aqui.';


-- ---- 3 · el check junto al nombre, de la base ----------------
--
-- Las dos vistas que leen los perfiles —la del perfil y la de las listas—
-- dejan de copiar `apariencia.verified` de lo que escribio el dueño y lo
-- calculan: verificado es tener la insignia concedida, vigente, y que no
-- sea heredada. Lo que haya escrito cada uno en ese campo deja de contar.
--
-- En `perfiles_publicos` se hace con `||`: el objeto entero tal cual, con
-- `verified` pisado. Asi la vista sigue devolviendo lo mismo que antes y
-- ni el navegador ni `perfil.php` tienen que cambiar nada.

create or replace view public.perfiles_publicos
with (security_invoker = false) as
select
  p.id,
  p.username,
  p.apariencia || jsonb_build_object(
    'verified', exists (
      select 1 from public.insignias_concedidas c
      where c.perfil_id = p.id
        and c.insignia = 'verified'
        and (c.expira is null or c.expira > now())
        and c.nota is distinct from 'heredada'
    )
  ) as apariencia,
  p.creado,
  p.actualizado,
  coalesce(m.vistas_unicas, 0) as vistas,
  case when coalesce(m.num_notas, 0) = 0 then null
       else round(m.suma_notas::numeric / m.num_notas, 2) end as nota,
  coalesce(m.num_notas, 0) as num_notas
from public.perfiles p
left join public.perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo';

create or replace view public.descubrir as
select
  p.id,
  p.username,
  jsonb_build_object(
    'name',          p.apariencia -> 'name',
    'title',         p.apariencia -> 'title',
    'avatarUrl',     p.apariencia -> 'avatarUrl',
    'discordAvatar', p.apariencia -> 'discordAvatar',
    'cuentaAvatar',  p.apariencia -> 'cuentaAvatar',
    'theme',         p.apariencia -> 'theme',
    'accent',        p.apariencia -> 'accent',
    'emoji',         p.apariencia -> 'emoji',
    'verified', exists (
      select 1 from public.insignias_concedidas c
      where c.perfil_id = p.id
        and c.insignia = 'verified'
        and (c.expira is null or c.expira > now())
        and c.nota is distinct from 'heredada'
    )
  ) as apariencia,
  p.actualizado,
  coalesce(m.vistas_unicas, 0) as vistas,
  case when coalesce(m.num_notas,0) = 0 then null
       else round(m.suma_notas::numeric / m.num_notas, 2) end as nota,
  coalesce(m.num_notas, 0) as num_notas,
  (
    ln(coalesce(m.vistas_unicas, 0) + 1) * 1.0
    + ((coalesce(m.suma_notas,0) + 3.5 * 10)::numeric
       / (coalesce(m.num_notas,0) + 10)) * 0.6
  ) as puntuacion
from public.perfiles p
left join public.perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo'
  and (p.apariencia -> 'discoverable') is distinct from 'false'::jsonb;

-- `create or replace` conserva los permisos, pero se vuelven a dar por si
-- alguna de las tres se hubiera recreado a mano entre medias.
grant select on public.insignias_de_perfil to anon, authenticated;
grant select on public.perfiles_publicos   to anon, authenticated;
grant select on public.descubrir           to anon, authenticated;


-- ---- comprobar que ha entrado -------------------------------
-- `con_insignia` tiene que seguir dando lo mismo que antes (15 el dia que
-- se escribio esto). `con_check` tiene que dar 0 hasta que verifiques a
-- alguien desde el panel.
select
  (select count(*) from public.insignias_de_perfil where insignia = 'verified') as con_insignia,
  (select count(*) from public.insignias_concedidas where insignia = 'verified' and nota = 'heredada') as heredadas,
  (select count(*) from public.perfiles_publicos where (apariencia ->> 'verified')::boolean) as con_check;
