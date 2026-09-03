-- ============================================================
-- IDENTITY · empezar de cero
--
-- ESTO NO SE DESHACE. No hay papelera, no hay «ctrl+z» y Supabase no
-- guarda una copia por su cuenta salvo que la tengas contratada. Cuando
-- termine, lo que habia no vuelve.
--
-- Y NO BORRA SOLO LO TUYO. Borra las cuentas de TODO EL MUNDO: los
-- perfiles de otras personas, sus fotos, sus enlaces y sus visitas.
-- Si alguien te lo estaba probando, pierde lo que hizo sin avisarle.
--
-- Antes de lanzarlo, la primera consulta te dice exactamente que hay.
-- Leela. Si el numero de cuentas es mayor del que esperabas, para.
--
-- LO QUE ESTO NO PUEDE BORRAR:
--   · Los videos que esten en Vimeo. Viven en tu cuenta de Vimeo y hay
--     que borrarlos alli, a mano.
--   · Nada de Vercel, que no guarda datos.
--
-- Se ejecuta en el editor SQL del panel de Supabase, que corre como
-- dueño de la base y puede tocar `auth`.
-- ============================================================


-- ---- 1 · QUE HAY AHORA MISMO. Mira esto antes de nada. -----
select 'cuentas'    as cosa, count(*) from auth.users
union all select 'perfiles',    count(*) from perfiles
union all select 'visitas',     count(*) from vistas
union all select 'valoraciones',count(*) from valoraciones
union all select 'plantillas',  count(*) from plantillas
union all select 'archivos',    count(*) from storage.objects where bucket_id = 'media';


-- ---- 2 · LOS ARCHIVOS, PRIMERO -----------------------------
--
-- Va antes que las cuentas a proposito. Las rutas del cubo empiezan por
-- el id del usuario —`<id>/avatar.png`— y NO tienen clave foranea contra
-- `auth.users`: no caen en cascada. Si borras las cuentas primero, los
-- archivos se quedan huerfanos y ya no sabes de quien era cada uno.
delete from storage.objects where bucket_id = 'media';


-- ---- 3 · LAS CUENTAS ---------------------------------------
--
-- Con esto cae casi todo lo demas solo, porque esta encadenado:
--
--   auth.users
--     └─ perfiles          (dueno, on delete cascade)
--          ├─ vistas
--          ├─ perfil_metricas
--          ├─ valoraciones
--          ├─ denuncias
--          └─ insignias_de_perfil
--     ├─ valoraciones      (autor_id)
--     └─ plantillas        (dueno)
--
-- No hace falta borrar tabla por tabla: hacerlo a mano es como se dejan
-- filas sueltas que luego rompen una clave foranea.
delete from auth.users;


-- ---- 4 · LO QUE NO CUELGA DE NADIE -------------------------
--
-- Los contadores de limites son basura de funcionamiento, no datos de
-- nadie, y no cuelgan de ninguna cuenta.
truncate privado.limites;

-- La pimienta NO se toca. Es la sal con la que se identifica a los
-- visitantes sin guardar su IP; cambiarla no aporta nada y si algun dia
-- se quiere comparar algo, se pierde la referencia.


-- ---- 5 · COMO QUEDO ----------------------------------------
select 'cuentas'    as cosa, count(*) from auth.users
union all select 'perfiles',    count(*) from perfiles
union all select 'visitas',     count(*) from vistas
union all select 'valoraciones',count(*) from valoraciones
union all select 'plantillas',  count(*) from plantillas
union all select 'archivos',    count(*) from storage.objects where bucket_id = 'media';
