-- ============================================================
-- IDENTITY · APLICAR TODO
--
-- Migraciones 0002 a 0008, en orden, en un solo archivo.
-- Re-ejecutable: se puede lanzar entero aunque ya aplicaras parte.
--
-- Saldra el aviso de "operaciones destructivas": casi todo son
-- `drop policy if exists`, `drop view` y `revoke`, que no tocan
-- datos.
--
-- La UNICA excepcion esta en 0007: quita la clave `badges` de
-- `perfiles.apariencia` en todas las filas. Es a proposito —eran
-- insignias que cada cual se habia puesto a si mismo y ya no las
-- lee nadie— pero es un borrado, y conviene saberlo antes de
-- pulsar. Volver a lanzar el archivo no hace mas dano: la clave
-- ya no esta.
--
-- Al terminar, ejecuta VERIFICAR.sql.
-- ============================================================



-- ############################################################
-- ##  0002_autorizacion.sql
-- ############################################################

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


-- ############################################################
-- ##  0003_integridad.sql
-- ############################################################

-- ============================================================
-- IDENTITY · 0003 · Integridad de datos
--
-- Fase 6 de la auditoría. Nada de esto es inyección SQL —no hay
-- SQL dinámico en ningún sitio, y PostgREST parametriza todo— sino
-- integridad: colisiones, desbordes y privilegios.
-- ============================================================


-- ============================================================
-- F6-01 · MEDIUM · Colisión de huellas de visitante
--
-- El hash se armaba así:
--     ip || '|' || agente || '|' || perfil || '|' || pimienta
--
-- El separador puede aparecer DENTRO de los datos. Un agente de
-- usuario lo elige quien visita, y una IPv6 lleva ':' pero nada
-- impide un agente con '|'. Entonces:
--
--     ip='1.2.3.4|Mozilla'  agente='X'
--     ip='1.2.3.4'          agente='Mozilla|X'
--
-- dan la MISMA cadena y por tanto la misma huella. Dos visitantes
-- distintos cuentan como uno.
--
-- Suena inofensivo hasta que se mira al revés: alguien puede
-- fabricar un agente que colisione con la huella de otra persona
-- para NO ser contado, o para ensuciar el recuento de un perfil
-- ajeno. Y ese recuento es el que ordena Descubrir.
--
-- Se arregla poniendo delante la LONGITUD de cada parte. Con
-- '7:1.2.3.4' + '1:X' ya no hay dos descomposiciones posibles:
-- la codificación pasa a ser inyectiva.
-- ============================================================
create or replace function registrar_vista(
  p_username citext,
  p_ip       text,
  p_agente   text
)
returns void
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_perfil uuid;
  v_pim    text;
  v_hash   bytea;
  v_nuevo  boolean;
  v_ip     text := coalesce(p_ip, '');
  v_ag     text := coalesce(p_agente, '');
begin
  select id into v_perfil from perfiles
   where username = p_username and estado = 'activo';
  if v_perfil is null then return; end if;

  select valor into v_pim from privado.config where clave = 'pimienta_visitas';

  /* longitud delante de cada parte: sin eso, un separador dentro
     de los datos permite que dos visitantes distintos produzcan la
     misma huella */
  v_hash := digest(
    length(v_ip)::text || ':' || v_ip ||
    length(v_ag)::text || ':' || v_ag ||
    v_perfil::text || v_pim,
    'sha256'
  );

  insert into vistas (perfil_id, visitante)
  values (v_perfil, v_hash)
  on conflict (perfil_id, visitante) do update
    set veces  = least(vistas.veces + 1, 2147483000),   -- ver F6-02
        ultima = now()
  returning (xmax = 0) into v_nuevo;

  insert into perfil_metricas (perfil_id, vistas_unicas, vistas_totales)
  values (v_perfil, 1, 1)
  on conflict (perfil_id) do update
    set vistas_unicas  = perfil_metricas.vistas_unicas + (case when v_nuevo then 1 else 0 end),
        vistas_totales = perfil_metricas.vistas_totales + 1;
end;
$$;

revoke all on function registrar_vista(citext, text, text) from public, anon, authenticated;

-- Aviso: cambiar la fórmula del hash hace que los visitantes ya
-- registrados produzcan una huella distinta y se cuenten una vez
-- más. Con la base vacía no afecta a nadie; aplicarlo con tráfico
-- real inflaría los contadores una sola vez.


-- ============================================================
-- F6-02 · LOW · `veces` podía desbordar
--
-- `veces` es integer y solo subía. A 2.147.483.647 recargas la
-- suma revienta con un error, y el error se lleva por delante toda
-- la función: la visita deja de contarse para ese perfil, para
-- siempre. No es alcanzable a mano, pero un script sí, y el coste
-- de evitarlo es un `least()`.
-- ============================================================
alter table vistas
  drop constraint if exists vistas_veces_positivo;
alter table vistas
  add constraint vistas_veces_positivo check (veces >= 0);


-- ============================================================
-- F6-03 · LOW · Disparadores sin search_path fijo
--
-- No son SECURITY DEFINER, así que corren con los privilegios de
-- quien escribe y el riesgo es mucho menor. Aun así, fijar el
-- search_path es gratis y quita de en medio toda una familia de
-- problemas: que un objeto creado en otro esquema se cuele delante
-- del que se pretendía usar.
-- ============================================================
alter function tocar_actualizado()        set search_path = public, pg_temp;
alter function proteger_campos_perfil()   set search_path = public, pg_temp;
alter function sellar_alta_perfil()       set search_path = public, pg_temp;
alter function fijar_autor_denuncia()     set search_path = public, pg_temp;
alter function fijar_autor_valoracion()   set search_path = public, pg_temp;


-- ============================================================
-- F6-04 · LOW · Integridad de los contadores
--
-- Nada impedía un contador negativo. No hay forma conocida de
-- llegar ahí —solo se suma— pero una restricción declarada es una
-- garantía; una invariante que solo vive en el código es una
-- costumbre.
-- ============================================================
alter table perfil_metricas
  drop constraint if exists metricas_no_negativas;
alter table perfil_metricas
  add constraint metricas_no_negativas check (
    vistas_unicas >= 0 and vistas_totales >= 0
    and suma_notas >= 0 and num_notas >= 0
    and vistas_unicas <= vistas_totales      -- únicos nunca supera totales
  );


-- ============================================================
-- F6-05 · INFO · Índices que faltaban
--
-- `vistas` se consulta por perfil (la clave primaria ya sirve),
-- pero las denuncias y las valoraciones se listan por perfil desde
-- el panel de moderación y no tenían índice.
-- ============================================================
create index if not exists denuncias_por_perfil
  on denuncias (perfil_id, creado desc);
create index if not exists denuncias_sin_resolver
  on denuncias (creado desc) where resuelto_en is null;
create index if not exists valoraciones_por_perfil
  on valoraciones (perfil_id);


comment on function registrar_vista(citext, text, text) is
  'La huella lleva la longitud de cada parte delante: sin eso, un separador dentro de los datos permite colisiones entre visitantes distintos.';


-- ############################################################
-- ##  0004_exposicion.sql
-- ############################################################

-- ============================================================
-- IDENTITY · 0004 · Exposición de datos
--
-- Fase 7. El problema no es que la RLS esté mal escrita: es que
-- **RLS es por FILA, no por columna**. La política decía "esta
-- fila es pública" y con ella se iba la fila ENTERA.
--
-- Comprobado con una petición anónima real contra la base:
--
--   GET /rest/v1/perfiles?select=dueno   ->  200
--   [{"dueno":"b52b5e37-6f0a-4bed-9f21-6861f3238659"}]
--
-- Se filtraban tres cosas que no son contenido público:
--
--   dueno           el id de la cuenta de auth. Es el nombre de la
--                   carpeta en Storage y lo que usa la funcion de
--                   borde para decidir a quien borra. Ademas sirve
--                   de identificador estable para correlacionar
--                   entre tablas.
--   acepto_en       cuando esa persona acepto los terminos.
--   acepto_version  que version acepto.
--                   Los dos son registro interno de auditoria: la
--                   razon de que existan es poder demostrar algo,
--                   no publicarlo.
--
-- Y peor en combinacion: con `dueno` publico y `valoraciones`
-- publica, se reconstruye QUIEN VALORO A QUIEN. Ahora mismo no se
-- nota porque no hay votos; el dia que los haya, ya esta abierto.
--
-- Se arregla como se arregla en Postgres: la tabla deja de ser
-- legible en publico y se expone una VISTA con las columnas que sí
-- lo son.
-- ============================================================


-- ============================================================
-- 1 · La tabla, solo para su dueño
-- ============================================================
-- Se borra la vieja Y la nueva. Solo quitaba la vieja, asi que al
-- volver a lanzar el archivo fallaba con 42710: la nueva ya existia.
-- La 0001 si llevaba esta guarda en sus once politicas; no la
-- arrastre a las migraciones siguientes, y "es re-ejecutable" paso
-- a ser mentira sin que nadie lo notara hasta reintentarlo.
drop policy if exists perfiles_leer_publicos on perfiles;
drop policy if exists perfiles_leer_el_mio on perfiles;
create policy perfiles_leer_el_mio on perfiles
  for select using (dueno = auth.uid());


-- ============================================================
-- 2 · La vista pública, con lo que sí es público
--
-- SIN `security_invoker`: corre con los permisos de su dueño y por
-- tanto no le aplica la RLS de `perfiles`. Es a propósito — la
-- vista ES el control de acceso, y por eso solo selecciona
-- columnas seguras de perfiles activos. Que un dato no aparezca
-- aquí es la garantía de que no sale.
-- ============================================================
drop view if exists perfiles_publicos;
create view perfiles_publicos as
select
  p.id,
  p.username,
  p.apariencia,
  p.creado,
  p.actualizado
from perfiles p
where p.estado = 'activo';

grant select on perfiles_publicos to anon, authenticated;


-- ============================================================
-- 3 · Descubrir tambien deja de heredar la RLS
--
-- Estaba con `security_invoker = true`, que era correcto mientras
-- la tabla fuera legible en publico. Al dejar de serlo, la vista
-- se quedaria vacia para cualquiera que no sea el dueño. Pasa a
-- resolverse con los permisos de su dueño, igual que la anterior,
-- y sigue exponiendo solo los siete campos de la miniatura.
-- ============================================================
drop view if exists descubrir;
create view descubrir as
select
  p.id,
  p.username,
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
-- 4 · Las valoraciones dejan de ser públicas
--
-- `using (true)` dejaba leer cada voto con su `autor_id`. Junto
-- con el `dueno` de arriba, eso es el grafo de quien valora a
-- quien: comportamiento de personas, no contenido de un perfil.
--
-- Nadie necesita esa tabla en publico: la media y el numero de
-- votos ya estan en `perfil_metricas`, que si es publica y no dice
-- quien voto. Cada uno ve su propio voto, para poder cambiarlo.
-- ============================================================
drop policy if exists valoraciones_leer on valoraciones;
drop policy if exists valoraciones_leer_la_mia on valoraciones;
create policy valoraciones_leer_la_mia on valoraciones
  for select using (autor_id = auth.uid());

revoke select on valoraciones from anon;
grant select on valoraciones to authenticated;


-- ============================================================
-- 5 · La vista de reincidentes, cerrada de forma explícita
--
-- Ya estaba cerrada por no tener grants —comprobado: responde
-- 42501— pero eso es una ausencia, no una decisión escrita. Lo que
-- protege por omisión se abre por descuido.
-- ============================================================
revoke all on reincidentes from anon, authenticated;


comment on view perfiles_publicos is
  'Lo unico que un anonimo puede leer de un perfil. Sin dueno ni registro de aceptacion: RLS es por fila y la fila entera incluia cosas que no son publicas.';
comment on policy perfiles_leer_el_mio on perfiles is
  'La tabla base solo la lee su dueno. Lo publico va por perfiles_publicos.';


-- ############################################################
-- ##  0005_limites.sql
-- ############################################################

-- ============================================================
-- IDENTITY · 0005 · Límites de uso
--
-- Fase 10. Medido antes de escribir nada: ocho denuncias anónimas
-- seguidas, todas aceptadas (201). Diez comprobaciones de nombre,
-- todas 200. No había ningún límite en ninguna parte.
--
-- Aquí NO se pone "100 peticiones por minuto" a todo. Cada
-- operación tiene un abuso distinto y un uso legítimo distinto, y
-- un límite que estorba a una persona normal se acaba quitando.
-- ============================================================


-- ============================================================
-- El contador · ventana deslizante simple
--
-- Una fila por clave. Cuando la ventana caduca se reinicia. No es
-- un algoritmo fino —no reparte el gasto dentro de la ventana—
-- pero para frenar abuso es de sobra, y cabe en veinte líneas que
-- se pueden leer y entender.
-- ============================================================
create table if not exists privado.limites (
  clave    text primary key,
  desde    timestamptz not null default now(),
  cuenta   integer not null default 0
);

alter table privado.limites enable row level security;

create or replace function privado.consumir(
  p_clave   text,
  p_tope    integer,
  p_ventana interval
)
returns boolean
language plpgsql
security definer
set search_path = privado, pg_temp
as $$
declare
  v_cuenta integer;
begin
  insert into privado.limites (clave, desde, cuenta)
  values (p_clave, now(), 1)
  on conflict (clave) do update
    set
      /* si la ventana caducó, empieza de cero */
      desde  = case when privado.limites.desde < now() - p_ventana
                    then now() else privado.limites.desde end,
      cuenta = case when privado.limites.desde < now() - p_ventana
                    then 1 else privado.limites.cuenta + 1 end
  returning cuenta into v_cuenta;

  return v_cuenta <= p_tope;
end;
$$;

revoke all on function privado.consumir(text, integer, interval)
  from public, anon, authenticated;

/* La tabla crece con las claves que caducan y nadie vuelve a usar.
   Se limpia sola en cada llamada, de vez en cuando, para no tener
   que montar una tarea programada por veinte filas. */
create or replace function privado.limpiar_limites()
returns void
language sql
security definer
set search_path = privado, pg_temp
as $$
  delete from privado.limites where desde < now() - interval '2 days';
$$;


-- ============================================================
-- F10-01 · HIGH · Denuncias sin límite
--
-- Comprobado: 8 seguidas, todas aceptadas. Un anónimo con un
-- bucle llena la tabla y ahoga la cola de moderación — que es
-- justo el mecanismo del que depende poder retirar contenido
-- ilegal. Inutilizar la moderación es tan útil para un atacante
-- como saltársela.
--
-- Dos límites, porque son dos abusos distintos:
--
--   por PERFIL  frena el ahogo aunque el atacante cambie de IP y
--               no tenga cuenta. Cincuenta denuncias en una hora
--               sobre el mismo perfil ya es señal de sobra: la
--               cincuenta y una no aporta nada que la cincuenta no
--               dijera.
--   por CUENTA  frena a quien sí ha entrado y denuncia en masa a
--               mucha gente.
-- ============================================================
create or replace function limitar_denuncias()
returns trigger
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
begin
  if not privado.consumir('denuncia:perfil:' || new.perfil_id::text, 50, interval '1 hour') then
    raise exception 'Este perfil ya ha recibido muchas denuncias; ya lo estamos mirando.'
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

  if auth.uid() is not null then
    if not privado.consumir('denuncia:cuenta:' || auth.uid()::text, 10, interval '1 day') then
      raise exception 'Has enviado demasiadas denuncias hoy. Vuelve manana.'
        using errcode = 'PT429';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists denuncias_limitar on denuncias;
create trigger denuncias_limitar
  before insert on denuncias
  for each row execute function limitar_denuncias();


-- ============================================================
-- F10-02 · MEDIUM · Valoraciones sin límite
--
-- La clave primaria ya impide votar dos veces al MISMO perfil,
-- pero nada impedía recorrer todos los perfiles votando. Veinte a
-- la hora es muchísimo para una persona y poquísimo para un script.
-- ============================================================
create or replace function limitar_valoraciones()
returns trigger
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null then
    if not privado.consumir('voto:' || auth.uid()::text, 20, interval '1 hour') then
      raise exception 'Has valorado demasiados perfiles seguidos. Espera un poco.'
        using errcode = 'PT429';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists valoraciones_limitar on valoraciones;
create trigger valoraciones_limitar
  before insert on valoraciones
  for each row execute function limitar_valoraciones();


-- ============================================================
-- F10-03 · MEDIUM · Escritura de perfil sin límite
--
-- El editor guarda solo, con retardo, así que en una hora de
-- edición intensa saldrán unas decenas de escrituras. Cien por
-- minuto no lo alcanza nadie escribiendo; un bucle sí, y cada
-- escritura arrastra un jsonb de hasta 256 KB.
--
-- El tope es alto a propósito: un límite que corta a quien está
-- trabajando de verdad se acaba quitando, y entonces no protege de
-- nada.
-- ============================================================
create or replace function limitar_escrituras_perfil()
returns trigger
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
begin
  if auth.uid() is not null then
    if not privado.consumir('perfil:' || auth.uid()::text, 100, interval '1 minute') then
      raise exception 'Demasiados cambios seguidos. Espera unos segundos.'
        using errcode = 'PT429';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_limitar on perfiles;
create trigger perfiles_limitar
  before insert or update on perfiles
  for each row execute function limitar_escrituras_perfil();


-- ============================================================
-- F10-04 · LOW · Un visitante podía generar escrituras sin fin
--
-- `registrar_vista` ya cuenta una sola visita ÚNICA por huella,
-- así que recargar no mueve el ranking. Pero cada recarga sí
-- escribía: subía `veces` y `vistas_totales`. Un bucle no falsea
-- nada, pero hace trabajar a la base gratis.
--
-- Sesenta por hora y por visitante y perfil. Por encima, se ignora
-- en silencio: quien recarga no tiene que enterarse de nada.
-- ============================================================
create or replace function registrar_vista(
  p_username citext,
  p_ip       text,
  p_agente   text
)
returns void
language plpgsql
security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_perfil uuid;
  v_pim    text;
  v_hash   bytea;
  v_nuevo  boolean;
  v_ip     text := coalesce(p_ip, '');
  v_ag     text := coalesce(p_agente, '');
begin
  select id into v_perfil from perfiles
   where username = p_username and estado = 'activo';
  if v_perfil is null then return; end if;

  select valor into v_pim from privado.config where clave = 'pimienta_visitas';

  v_hash := digest(
    length(v_ip)::text || ':' || v_ip ||
    length(v_ag)::text || ':' || v_ag ||
    v_perfil::text || v_pim,
    'sha256'
  );

  /* Silencioso a proposito: recargar mucho no es un delito, y no
     hay nada util que decirle a quien lo hace. */
  if not privado.consumir('vista:' || encode(v_hash, 'hex'), 60, interval '1 hour') then
    return;
  end if;

  insert into vistas (perfil_id, visitante)
  values (v_perfil, v_hash)
  on conflict (perfil_id, visitante) do update
    set veces  = least(vistas.veces + 1, 2147483000),
        ultima = now()
  returning (xmax = 0) into v_nuevo;

  insert into perfil_metricas (perfil_id, vistas_unicas, vistas_totales)
  values (v_perfil, 1, 1)
  on conflict (perfil_id) do update
    set vistas_unicas  = perfil_metricas.vistas_unicas + (case when v_nuevo then 1 else 0 end),
        vistas_totales = perfil_metricas.vistas_totales + 1;

  /* barrido ocasional, para no acumular claves caducadas */
  if random() < 0.01 then perform privado.limpiar_limites(); end if;
end;
$$;

revoke all on function registrar_vista(citext, text, text) from public, anon, authenticated;


comment on table privado.limites is
  'Ventana deslizante por clave. Un limite que estorba a una persona normal se acaba quitando, asi que los topes son altos para el uso legitimo y bajos para el abuso.';


-- ############################################################
-- ##  0006_storage.sql
-- ############################################################

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



-- ############################################################
-- ##  0007_insignias.sql
-- ############################################################

-- ============================================================
-- IDENTITY · 0007 · insignias que no se puede poner uno mismo
--
-- El problema que cierra esta migracion:
--   `badges` era un campo mas de `perfiles.apariencia`, y esa columna la
--   escribe su dueno. Cualquiera podia ponerse «Staff», «Verificado» o
--   «Premium» y salian en su perfil publico igual que si se las hubieran
--   dado. Un adorno de mas es una cosa; un «Verificado» que se regala uno
--   mismo es una afirmacion falsa sobre identidad.
--
-- Como se cierra:
--   Las insignias dejan de guardarse en el perfil y pasan a leerse de aqui.
--   El cliente LEE esta vista y no escribe nunca en ella.
--
--   · las que concede el equipo van en `insignias_concedidas`, donde solo
--     escribe la clave de servicio;
--   · «verificado» se calcula mirando si la cuenta tiene de verdad una
--     identidad de un proveedor externo enlazada;
--   · las que dependen de cifras publicas —antiguedad, visitas, notas— NO
--     estan aqui: se calculan en el navegador a partir de `descubrir`, que
--     ya las expone. Salen de datos del servidor, asi que su dueno tampoco
--     puede falsearlas, y calcularlas en el cliente permite ensenar cuanto
--     falta para la siguiente sin una consulta por insignia.
--
-- Aplicar:  supabase db push     (o pegar en el editor SQL)
-- ============================================================

-- ---- 1 · las que concede el equipo -------------------------

create table if not exists insignias_concedidas (
  perfil_id  uuid not null references perfiles(id) on delete cascade,
  insignia   text not null,
  concedida  timestamptz not null default now(),
  -- Quien la dio y por que. Sin esto, dentro de un ano nadie sabe si una
  -- insignia rara fue un premio o un dedazo.
  por        uuid references auth.users(id) on delete set null,
  nota       text,
  primary key (perfil_id, insignia)
);

comment on table insignias_concedidas is
  'Insignias que da el equipo a mano. Solo escribe la clave de servicio.';

create index if not exists insignias_concedidas_perfil
  on insignias_concedidas (perfil_id);

alter table insignias_concedidas enable row level security;

-- Leer: cualquiera, porque son publicas por definicion —se ensenan en el
-- perfil—. Escribir: nadie. No hay politica de insert, update ni delete, y
-- sin politica RLS lo niega todo. La clave de servicio se salta RLS, que es
-- exactamente el unico camino que queremos.
drop policy if exists insignias_lectura on insignias_concedidas;
create policy insignias_lectura
  on insignias_concedidas for select
  using (true);

-- ---- 2 · «verificado», calculado ---------------------------

-- Mira en `auth.identities` si el dueno del perfil tiene enlazada alguna
-- identidad que no sea la de correo y contrasena. `security definer` porque
-- el esquema `auth` no lo puede leer un usuario cualquiera; la funcion no
-- acepta parametros del cliente mas alla del id de perfil, y solo devuelve
-- un si o un no.
create or replace function perfil_verificado(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from perfiles p
    join auth.identities i on i.user_id = p.dueno
    where p.id = p_perfil
      and i.provider <> 'email'
  );
$$;

revoke all on function perfil_verificado(uuid) from public;
grant execute on function perfil_verificado(uuid) to anon, authenticated;

-- ---- 3 · la vista que lee el cliente -----------------------

create or replace view insignias_de_perfil
with (security_invoker = true) as
  select perfil_id, insignia
  from insignias_concedidas
union
  select p.id as perfil_id, 'verified' as insignia
  from perfiles p
  where p.estado = 'activo'
    and perfil_verificado(p.id);

comment on view insignias_de_perfil is
  'Lo unico que el cliente lee para saber que insignias tiene un perfil.';

-- ---- 4 · limpiar lo que se creyo antes ---------------------

-- Las que la gente se puso a si misma siguen escritas dentro de
-- `apariencia`. El cliente nuevo ya no las mira, pero dejarlas ahi es dejar
-- una mentira guardada: si alguien exporta su perfil en JSON, o si algun
-- dia se vuelve a leer ese campo, reaparecen. Se van.
update perfiles
set apariencia = apariencia - 'badges'
where apariencia ? 'badges';

-- ---- 5 · como se concede una a mano ------------------------
--
--   insert into insignias_concedidas (perfil_id, insignia, por, nota)
--   select id, 'staff', auth.uid(), 'equipo fundador'
--   from perfiles where username = 'uriel';
--
-- Y para quitarla:
--
--   delete from insignias_concedidas
--   where insignia = 'staff'
--     and perfil_id = (select id from perfiles where username = 'uriel');



-- ############################################################
-- ##  0008_privacidad.sql
-- ############################################################

-- ============================================================
-- IDENTITY · 0008 · que «perfil publico» apagado signifique algo
--
-- El ajuste «Perfil publico» escribe `discoverable` dentro de
-- `apariencia`, y la interfaz lo respeta: Descubrir y la portada filtran
-- por el. Pero la vista `descubrir` filtraba solo por `estado = 'activo'`,
-- asi que la fila se seguia sirviendo a quien la consultara directamente.
-- El ajuste era una cortesia de nuestro cliente, no una garantia. Aqui
-- pasa a serlo.
--
-- Lo que NO cambia, a proposito: el enlace directo. El ajuste promete
-- «no te encuentra nadie por su cuenta, pero tu enlace sigue funcionando
-- para quien lo tenga», y eso es exactamente lo que hace. Ocultar tambien
-- /u/tu-nombre seria otra cosa distinta y no es lo que dice la casilla.
--
-- Aplicar:  supabase db push
-- ============================================================

-- ---- 1 · las cifras publicas, en la vista del enlace directo ----
--
-- Antes solo estaban en `descubrir`, y de ahi las leia el cliente para
-- calcular las insignias de visitas y valoraciones. En cuanto `descubrir`
-- filtra por `discoverable` —paso 2—, un perfil oculto se quedaria sin
-- ellas: dejaria de aparecer en el buscador Y perderia sus insignias, que
-- no tiene nada que ver. Su sitio natural es esta vista, la que describe
-- un perfil concreto.
--
-- Son agregados que ya se ensenan en el propio perfil y en Descubrir, asi
-- que no exponen nada nuevo.

drop view if exists perfiles_publicos;
create view perfiles_publicos as
select
  p.id,
  p.username,
  p.apariencia,
  p.creado,
  p.actualizado,
  coalesce(m.vistas_unicas, 0) as vistas,
  case when coalesce(m.num_notas, 0) = 0 then null
       else round(m.suma_notas::numeric / m.num_notas, 2) end as nota,
  coalesce(m.num_notas, 0) as num_notas
from perfiles p
left join perfil_metricas m on m.perfil_id = p.id
where p.estado = 'activo';

grant select on perfiles_publicos to anon, authenticated;

comment on view perfiles_publicos is
  'Lo unico que un anonimo puede leer de un perfil, mas sus cifras publicas. Sin dueno ni registro de aceptacion.';

-- ---- 2 · descubrir deja fuera a quien no quiere que le encuentren ----
--
-- `is distinct from 'false'` y no un cast a boolean: si alguien colara en
-- ese campo algo que no sea un booleano, el cast reventaria la consulta
-- entera y con ella el buscador. Comparando el JSON no puede fallar, y
-- dice exactamente lo mismo que el cliente: oculto solo si vale false.

create or replace view descubrir
with (security_invoker = true) as
select
  p.id,
  p.username,
  p.apariencia,
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
where p.estado = 'activo'
  and (p.apariencia -> 'discoverable') is distinct from 'false'::jsonb;

comment on view descubrir is
  'Perfiles que se dejan encontrar. Quien apaga «Perfil publico» sale de aqui, pero su enlace directo sigue funcionando.';
