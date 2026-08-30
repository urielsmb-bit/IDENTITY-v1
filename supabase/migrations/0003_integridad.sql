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
