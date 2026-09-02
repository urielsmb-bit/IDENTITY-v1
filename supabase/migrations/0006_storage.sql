-- ============================================================
-- IDENTITY · 0006 · Almacenamiento de medios
--
-- Hasta ahora las imágenes y el vídeo vivían en IndexedDB, o sea
-- en el navegador de quien los subió. Funcionaba muy bien para el
-- peso —un vídeo de 5,65 MB ocupaba 4 KB dentro del perfil— pero
-- ese blob no viaja: abrir tu propio perfil desde el móvil lo
-- mostraba sin foto y sin fondo.
--
-- Aquí se crea el sitio donde sí viajan.
-- ============================================================


-- ============================================================
-- 1 · El cubo
--
-- Público de LECTURA a propósito: los perfiles son públicos, y una
-- foto de perfil detrás de una firma temporal obliga a renovarla
-- en cada visita. Lo que no es público es la ESCRITURA.
--
-- El tope por archivo lo pone la base, no el navegador: la
-- comprobación del navegador se salta escribiendo cuatro líneas en
-- la consola. Aquí no.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true,
  8388608,                                   -- 8 MB por archivo
  array[
    'image/png','image/jpeg','image/webp','image/gif','image/avif',
    'video/mp4','video/webm'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- 2 · Cada uno escribe SOLO en su carpeta
--
-- La ruta es  <id de la cuenta>/<archivo>  y la política compara
-- esa primera carpeta con la sesión. Sin esto, cualquiera con
-- cuenta podría subir a la carpeta de otra persona y reemplazarle
-- el avatar — que es de los ataques más molestos que hay, porque
-- la víctima ve su perfil cambiado y no entiende por qué.
--
-- `storage.foldername(name)` devuelve el array de carpetas de la
-- ruta; `[1]` es la primera.
-- ============================================================
drop policy if exists media_leer_todos on storage.objects;
create policy media_leer_todos on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists media_subir_lo_mio on storage.objects;
create policy media_subir_lo_mio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists media_cambiar_lo_mio on storage.objects;
create policy media_cambiar_lo_mio on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists media_borrar_lo_mio on storage.objects;
create policy media_borrar_lo_mio on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- 3 · Cuántos archivos caben por cuenta
--
-- La decisión 0.4 fue: un vídeo por cuenta, y al cambiarlo se
-- borra el anterior. Eso sale gratis con nombres deterministas
-- —`<id>/fondo.mp4` siempre se llama igual, así que subir uno
-- nuevo pisa al viejo— pero nada impide subir cien archivos con
-- otros nombres.
--
-- Ocho por cuenta: avatar, fondo, vídeo y cinco de galería. De
-- sobra para el producto de hoy y un techo claro para la cuota.
-- ============================================================
create or replace function limitar_archivos()
returns trigger
language plpgsql
security definer
set search_path = storage, public, pg_temp
as $$
declare
  v_carpeta text;
  v_cuantos integer;
begin
  if new.bucket_id <> 'media' then return new; end if;

  v_carpeta := (storage.foldername(new.name))[1];

  select count(*) into v_cuantos
    from storage.objects
   where bucket_id = 'media'
     and (storage.foldername(name))[1] = v_carpeta
     and name <> new.name;          -- reemplazar no cuenta como añadir

  if v_cuantos >= 8 then
    raise exception 'Has alcanzado el maximo de archivos. Borra alguno antes de subir otro.'
      /* PT429, no 54000. PostgREST traduce los codigos SQLSTATE que
         empiezan por PT al estado HTTP de sus tres ultimos digitos,
         asi que esto sale como 429 Too Many Requests.
         Con 54000 salia 500: "el servidor se rompio". Y eso importa
         por dos cosas — con alertas de error, cada abuso frenado te
         despierta como si fuera una caida; y los clientes reintentan
         los 5xx y no los 4xx, o sea que un reintento automatico
         amplificaba el abuso en vez de frenarlo. */
      using errcode = 'PT429';
  end if;

  return new;
end;
$$;

drop trigger if exists media_limitar_archivos on storage.objects;
create trigger media_limitar_archivos
  before insert on storage.objects
  for each row execute function limitar_archivos();


comment on function limitar_archivos() is
  'Ocho archivos por cuenta. Los nombres deterministas hacen que reemplazar no sume, asi que este tope solo frena a quien invente nombres nuevos.';
