-- ============================================================
-- IDENTITY · 0002 · Autorización
--
-- Correcciones de la Fase 3 de la auditoría. Como la 0001, se
-- puede volver a lanzar sin romper nada.
-- ============================================================


-- ============================================================
-- F3-01 · CRITICO · Se podía denunciar en nombre de otra persona
--
-- La política de denuncias era `with check (true)`: el cliente
-- mandaba el `autor_id` que quisiera. Comprobado con una petición
-- real: la fila llegó hasta la comprobación de clave ajena (23503),
-- o sea que la política SÍ la dejó pasar; solo la paró que el
-- perfil no existiera. Con un perfil real habría entrado.
--
-- Impacto: se puede llenar la cola de moderación de denuncias
-- firmadas por terceros. El día que se mire "quién denunció" para
-- decidir algo -- reincidencia, credibilidad, castigar denuncias
-- falsas -- ese dato es inventable por cualquiera.
--
-- No se arregla con una política que compare `autor_id`: bastaría
-- con omitir la columna. Lo pone el servidor y punto: el cliente
-- ya no controla ese campo.
-- ============================================================
create or replace function fijar_autor_denuncia()
returns trigger
language plpgsql
as $$
begin
  /* auth.uid() es NULL sin sesión: una denuncia anónima queda
     anónima de verdad, no atribuida a nadie. */
  new.autor_id := auth.uid();
  new.resuelto_en := null;      /* nadie llega ya resuelta */
  new.resolucion := null;
  new.creado := now();          /* ni con fecha inventada */
  return new;
end;
$$;

drop trigger if exists denuncias_fijar_autor on denuncias;
create trigger denuncias_fijar_autor
  before insert on denuncias
  for each row execute function fijar_autor_denuncia();

-- Y que nadie edite una denuncia despues de crearla.
-- El grant solo daba INSERT, pero esto es la segunda capa.
revoke update, delete on denuncias from anon, authenticated;

-- Una cuenta, una denuncia por perfil. No frena al anonimo -- los
-- NULL no chocan entre si -- pero corta el caso facil: alguien con
-- sesion denunciando cien veces el mismo perfil.
create unique index if not exists denuncias_una_por_cuenta
  on denuncias (perfil_id, autor_id) where autor_id is not null;


-- ============================================================
-- F3-02 · HIGH · Asignación masiva en perfiles
--
-- `proteger_campos_perfil` congelaba estado, dueño y fecha de alta,
-- pero se dejaba tres columnas que el cliente sí podía escribir:
--
--   acepto_en, acepto_version -> el registro de que alguien acepto
--     los terminos. Es justo el dato que existe para poder
--     demostrarlo; si lo escribe el cliente, no demuestra nada.
--   motivo_estado -> el texto de por que se oculto un perfil. Es
--     de la moderacion, no de quien lo escribio.
-- ============================================================
create or replace function proteger_campos_perfil()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;          -- clave de servicio: moderación desde el panel
  end if;
  new.estado        := old.estado;
  new.dueno         := old.dueno;
  new.creado        := old.creado;
  new.motivo_estado := old.motivo_estado;
  new.acepto_en     := old.acepto_en;
  new.acepto_version:= old.acepto_version;
  return new;
end;
$$;

-- La aceptación se sella al crear el perfil, con la hora del
-- servidor. Antes venía del navegador: una fecha que pone quien
-- firma no vale como prueba de cuándo firmó.
create or replace function sellar_alta_perfil()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.acepto_en := now();
    new.creado    := now();
    new.estado    := 'activo';        -- nadie se crea ya oculto o baneado
    new.motivo_estado := null;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_sellar_alta on perfiles;
create trigger perfiles_sellar_alta
  before insert on perfiles
  for each row execute function sellar_alta_perfil();


-- ============================================================
-- F3-03 · LOW · Se podía valorar un perfil oculto o baneado
--
-- La política solo impedía valorarse a uno mismo. Un perfil
-- retirado seguía acumulando nota, y esa nota ordena Descubrir.
-- ============================================================
drop policy if exists valoraciones_poner_la_mia on valoraciones;
create policy valoraciones_poner_la_mia on valoraciones
  for insert with check (
    autor_id = auth.uid()
    and exists (
      select 1 from perfiles p
       where p.id = valoraciones.perfil_id
         and p.estado = 'activo'
         and p.dueno <> auth.uid()      -- ni el propio, ni uno retirado
    )
  );

drop policy if exists valoraciones_cambiar_la_mia on valoraciones;
create policy valoraciones_cambiar_la_mia on valoraciones
  for update using (autor_id = auth.uid())
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from perfiles p
       where p.id = valoraciones.perfil_id and p.estado = 'activo'
    )
  );

-- Igual que con la denuncia: el autor lo pone el servidor, no el
-- cliente. La política ya lo comprobaba, pero una comprobación que
-- se puede intentar es una comprobación que alguien intentará.
create or replace function fijar_autor_valoracion()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que entrar para valorar' using errcode = '42501';
  end if;
  new.autor_id := auth.uid();
  /* OLD no existe en un INSERT: en plpgsql, tocarlo ahi revienta
     con "record old is not assigned yet" y tumbaria TODAS las
     valoraciones nuevas. Hay que mirar la operacion. */
  if TG_OP = 'UPDATE' then
    new.creado := old.creado;
  else
    new.creado := now();
  end if;
  return new;
end;
$$;

drop trigger if exists valoraciones_fijar_autor on valoraciones;
create trigger valoraciones_fijar_autor
  before insert or update on valoraciones
  for each row execute function fijar_autor_valoracion();


-- ============================================================
-- F3-04 · MEDIUM · Descubrir devolvía la apariencia entera
--
-- La vista hacía `p.apariencia`: el JSON completo de cada perfil,
-- para todos los perfiles, en una sola consulta. Un raspado se
-- lleva la base entera de una vez.
--
-- Descubrir solo necesita pintar una miniatura. Se le da eso.
-- El perfil completo sigue estando en /u/nombre, de uno en uno.
-- ============================================================
drop view if exists descubrir;
create view descubrir
with (security_invoker = true) as
select
  p.id,
  p.username,
  /* solo lo que hace falta para la tarjeta */
  jsonb_build_object(
    'name',      p.apariencia -> 'name',
    'title',     p.apariencia -> 'title',
    'avatarUrl', p.apariencia -> 'avatarUrl',
    'theme',     p.apariencia -> 'theme',
    'accent',    p.apariencia -> 'accent',
    'emoji',     p.apariencia -> 'emoji',
    'verified',  p.apariencia -> 'verified'
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
from perfiles p
left join perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo';

grant select on descubrir to anon, authenticated;


-- ============================================================
-- COMPROBACIÓN · que quede constancia de lo que protege cada cosa
-- ============================================================
comment on function fijar_autor_denuncia() is
  'El autor de una denuncia lo pone el servidor. El cliente no controla ese campo.';
comment on function sellar_alta_perfil() is
  'La aceptacion de los terminos se sella con la hora del servidor: una fecha que pone quien firma no prueba nada.';
comment on view descubrir is
  'Solo los campos de la miniatura. La apariencia completa se sirve de uno en uno en /u/nombre.';
