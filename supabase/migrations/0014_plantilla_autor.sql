-- ============================================================
-- IDENTITY · 0014 · el autor de una plantilla, sin abrir `perfiles`
--
-- La galeria de plantillas quiere enseñar una previa DE VERDAD: el perfil
-- de quien la publico, con la plantilla puesta encima. Para eso hace
-- falta su `apariencia`.
--
-- El primer intento fue leer `perfiles` uniendo por `dueno`. Devuelve
-- cero filas, y no por un fallo: `perfiles` NO se lee desde fuera. Lo
-- publico sale por la vista `perfiles_publicos`, que da la apariencia
-- entera pero deliberadamente NO da `dueno` —su propio comentario lo
-- dice: «Sin dueno ni registro de aceptacion»—. Es una decision de
-- privacidad tomada en 0008 y no se toca: exponer `dueno` permitiria
-- atar cada perfil a una cuenta de acceso.
--
-- La salida es al reves: que la plantilla lleve el NOMBRE DE USUARIO de
-- su autor, que es publico de todas formas —es la firma que se enseña— y
-- con el se busca en la vista sin necesidad de ningun id interno.
--
-- El problema de guardar un nombre de usuario es que se puede cambiar, y
-- entonces la plantilla apuntaria a un perfil que ya no existe: el enlace
-- lleva a un 404 y la previa se queda en blanco, sin avisar de nada. Por
-- eso no basta con copiarlo al publicar: hay un disparador que lo
-- persigue. Se arregla en el origen, no recordando actualizarlo.
-- ============================================================

alter table plantillas
  add column if not exists usuario citext;

-- Las que ya existan, con el nombre de ahora.
update plantillas t
   set usuario = p.username
  from perfiles p
 where p.dueno = t.dueno
   and t.usuario is distinct from p.username;

create index if not exists plantillas_por_usuario on plantillas (usuario);

-- ---- 1 · al publicar, se rellena solo ----------------------
--
-- No se le pide al navegador que lo mande: si lo mandara, podria mandar
-- el de otra persona y firmar una plantilla con su nombre.
create or replace function plantilla_pon_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select username into new.usuario from perfiles where dueno = new.dueno;
  return new;
end;
$$;

drop trigger if exists plantillas_usuario on plantillas;
create trigger plantillas_usuario
  before insert on plantillas
  for each row execute function plantilla_pon_usuario();

-- ---- 2 · si se cambia el nombre, las plantillas van detras --
create or replace function plantillas_sigue_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.username is distinct from old.username then
    update plantillas set usuario = new.username where dueno = new.dueno;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_renombra_plantillas on perfiles;
create trigger perfiles_renombra_plantillas
  after update of username on perfiles
  for each row execute function plantillas_sigue_usuario();

-- El navegador nunca escribe esta columna: la ponen los disparadores.
-- `usos` ya estaba fuera por lo mismo.
revoke update on plantillas from authenticated;
grant update (nombre, estado) on plantillas to authenticated;

-- ---- La prueba, aqui mismo --------------------------------
do $$
declare v_sin integer;
begin
  select count(*) into v_sin
    from plantillas t join perfiles p on p.dueno = t.dueno
   where t.usuario is distinct from p.username;

  if v_sin > 0 then
    raise exception 'Quedan % plantillas con el usuario sin cuadrar', v_sin;
  end if;
  raise notice 'Todas las plantillas tienen el usuario de su autor.';
end
$$;
