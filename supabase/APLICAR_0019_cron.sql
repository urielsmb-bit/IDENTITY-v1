-- ============================================================
-- IDENTITY · APLICAR 0019 · el cron de la presencia
--
-- Pegar en:  supabase.com/dashboard -> SQL Editor
--
-- SON DOS PASOS Y EL PRIMERO NO SE COMITEA. Guarda la clave de servicio
-- en `privado.config`; el segundo programa el trabajo leyendola de ahi.
-- Por eso este archivo se puede tener en un repositorio publico y aun
-- asi el cron sabe autenticarse.
-- ============================================================

-- ---- PASO 1 · la clave, una sola vez ----------------------
-- Panel -> Project Settings -> API -> `service_role`.
-- Cambia el texto de abajo por la clave ENTERA (empieza por eyJ...).
--
--   insert into privado.config (clave, valor)
--   values ('clave_servicio', 'PEGA-AQUI-LA-CLAVE')
--   on conflict (clave) do update set valor = excluded.valor;
--
-- Descomenta esas tres lineas, pon la clave y lanzalo. Luego sigue con
-- el paso 2 de abajo, que ya no lleva secretos.

-- ---- PASO 2 · el trabajo ----------------------------------

-- ============================================================
-- IDENTITY · 0019 · tomar la foto de Discord cada minuto
--
-- `discord-presencia` se conecta a la pasarela, recoge el estado de quien
-- esta en nuestro servidor y lo deja en `presencia`. Alguien tiene que
-- llamarla, y ese alguien es la propia base: `pg_cron` para el reloj y
-- `pg_net` para la llamada.
--
-- NO ES UN MUESTREO CADA DOS MINUTOS: SON TURNOS DE ESCUCHA
--
-- Cada pasada no hace una foto y cuelga. Hace la foto y SE QUEDA
-- escuchando 110 segundos, recibiendo cada `PRESENCE_UPDATE` en el
-- momento en que ocurre y escribiendolo al instante. El cron cada dos
-- minutos solo empalma un turno con el siguiente.
--
-- Asi que cambiar de cancion o ponerse ausente se ve YA, no dentro de dos
-- minutos. El unico hueco ciego son los ~10 segundos entre turno y turno,
-- y lo que pase ahi lo recoge la foto inicial del turno siguiente.
--
-- Medido: {"ok":true,"cambios":1,"segundos":110} — la ventana entera
-- aguanta y los cambios entran en vivo.
--
-- POR QUE DOS MINUTOS Y NO CADA UNO NI UNA CONEXION ETERNA
--
-- Porque cada pasada abre una sesion nueva con Discord, y Discord las
-- raciona. Medido contra `/gateway/bot` en este mismo bot:
--
--     {"quedan": 976, "de": 1000, "reponen_en_h": 23}
--
-- Mil al dia. Cada minuto son 1.440: se agotan a las dieciseis horas y a
-- partir de ahi la presencia se queda congelada SIN ERROR NINGUNO, que es
-- la peor forma de romperse. Cada dos minutos son 720, con margen de
-- sobra para los disparos a mano y algun reintento.
--
-- Una conexion eterna no cabe aqui: una funcion de borde vive lo que
-- dura su peticion, y 110s es lo que aguanta. Para tenerla de verdad hace
-- falta un proceso encendido siempre —un VPS, un Fly, un Railway— y
-- entonces son 1 sesion por reinicio en vez de 720 al dia. La diferencia
-- practica con lo de aqui es el hueco de 10 segundos entre turnos.
--
-- LO QUE ESTO CUESTA: la funcion pasa ~92% del tiempo corriendo. Son 720
-- invocaciones al dia, no 720 minutos facturados como servidor, pero
-- conviene saberlo antes de mirar la factura.
--
-- AQUI NO HAY NINGUNA CLAVE ESCRITA. La cabecera se arma leyendo
-- `privado.config`, que es la misma tabla donde ya vive la pimienta de
-- las visitas. Este archivo acaba en un repositorio publico; una clave
-- de servicio dentro seria dar de alta a cualquiera como administrador
-- de la base.
--
-- ANTES DE ESTO hay que guardar la clave, UNA vez y desde el editor:
--
--   insert into privado.config (clave, valor)
--   values ('clave_servicio', 'PEGA-AQUI-LA-SERVICE-ROLE-KEY')
--   on conflict (clave) do update set valor = excluded.valor;
--
-- La clave esta en el panel: Project Settings -> API -> service_role.
-- Si algun dia la rotas, se cambia ahi y el cron sigue solo.
-- ============================================================

-- ---- 1 · el reloj y el telefono ---------------------------
-- `pg_cron` crea su propio esquema `cron`. `pg_net` va en `extensions`,
-- que es donde Supabase pone las suyas.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---- 2 · fuera el trabajo anterior ------------------------
-- `cron.unschedule` protesta si no existe, asi que se pregunta antes.
-- Esto hace el archivo relanzable, que es la unica forma de corregir el
-- horario o la llamada sin borrar nada a mano.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'presencia-discord') then
    perform cron.unschedule('presencia-discord');
  end if;
end
$$;

-- ---- 3 · cada minuto --------------------------------------
select cron.schedule(
  'presencia-discord',
  '*/2 * * * *',
  $trabajo$
  select
    net.http_post(
      url := 'https://ypvipmhfnraalcqbttiq.supabase.co/functions/v1/discord-presencia',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        /* La clave de servicio. La funcion NO la compara con nada: mira
           el rol que declara el propio testigo —`service_role` si,
           `anon` no— porque la firma ya la ha comprobado la pasarela de
           Supabase antes de dejar pasar la peticion. */
        'Authorization',
        'Bearer ' || (select valor from privado.config where clave = 'clave_servicio')
      ),
      body := '{}'::jsonb,
      /* La funcion espera hasta 20s a que la pasarela mande la foto, asi
         que 30 le da margen sin dejar la llamada colgada para siempre. */
      timeout_milliseconds := 30000
    );
  $trabajo$
);

-- ---- comprobar --------------------------------------------
-- El trabajo:
--
--   select jobname, schedule, active from cron.job;
--
-- Y las ultimas llamadas. `net._http_response` no tiene columna
-- `status` ni una `response` compuesta —eso es de `http_collect_response`,
-- otra cosa— asi que lo seguro es pedirlo todo:
--
--   select * from net._http_response order by created desc limit 3;
--
-- Y si se quiere solo lo util:
--
--   select id, status_code, content, created
--     from net._http_response order by created desc limit 5;
--
-- Lo que se busca en `content` es {"ok":true,"vistos":N}.
--
-- La otra forma de comprobarlo, sin salir de aqui: mirar dos veces
-- seguidas cuanto ha envejecido la foto. Si baja sola, el cron corre.
--
--   select discord_id, now() - actualizado as edad from presencia;
