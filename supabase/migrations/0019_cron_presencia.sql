-- ============================================================
-- IDENTITY · 0019 · tomar la foto de Discord cada minuto
--
-- `discord-presencia` se conecta a la pasarela, recoge el estado de quien
-- esta en nuestro servidor y lo deja en `presencia`. Alguien tiene que
-- llamarla, y ese alguien es la propia base: `pg_cron` para el reloj y
-- `pg_net` para la llamada.
--
-- POR QUE CADA MINUTO. Es el compromiso: mas a menudo no aporta —un
-- estado de Discord no cambia cada diez segundos y cada pasada abre un
-- websocket— y menos se nota, porque «en linea» que tarda cinco minutos
-- en aparecer no se lee como en vivo, se lee como roto.
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
  '* * * * *',
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
