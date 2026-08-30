// ============================================================
// IDENTITY · función de borde · borrar la cuenta
//
// La política de privacidad promete: "Puedes borrar tu cuenta, y
// con ella se va todo". Esa promesa no se podía cumplir: desde el
// navegador NO se puede borrar un usuario de auth — hace falta la
// clave de servicio, y esa no puede tocar el navegador jamás.
//
// Esta función es el único sitio donde esa clave existe. Recibe el
// JWT de quien pide el borrado, comprueba con Supabase de QUIÉN es
// ese JWT, y borra a ESE usuario. Nunca al que diga el cuerpo de la
// petición: el cliente no elige a quién se borra.
//
// El resto cae solo: `perfiles.dueno` referencia `auth.users` con
// `on delete cascade`, y de `perfiles` cuelgan en cascada vistas,
// valoraciones, denuncias y retiradas.
//
// Desplegar:  supabase functions deploy borrar-cuenta
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, preflight, origenValido, cuerpoEsJson } from '../_compartido/cors.ts';

const CABECERAS = 'content-type, authorization';

Deno.serve(async (req: Request) => {
  const CORS = cors(req, 'POST, OPTIONS', CABECERAS);

  function json(cuerpo: unknown, estado = 200) {
    return new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') return preflight(req, 'POST, OPTIONS', CABECERAS);
  if (req.method !== 'POST') return json({ error: 'metodo no permitido' }, 405);

  /* Borrar una cuenta no se dispara desde una pagina cualquiera.
     El token protege de todos modos —una web ajena no puede leer
     el localStorage de la victima— pero no hay razon para que este
     endpoint acepte peticiones de ningun otro origen. */
  if (!origenValido(req)) return json({ error: 'origen no permitido' }, 403);
  if (!cuerpoEsJson(req)) return json({ error: 'se espera application/json' }, 415);

  /* ---- quién pide esto -------------------------------------
     El token va en la cabecera, no en el cuerpo: el cuerpo lo
     escribe el cliente y podría poner el id de otra persona. */
  const cabecera = req.headers.get('authorization') ?? '';
  const jwt = cabecera.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'falta la sesion' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  /* Cliente con la clave PÚBLICA solo para preguntar de quién es
     este token. Con la de servicio, getUser() devolvería lo que le
     pidieran sin comprobar nada. */
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: quien, error: errQuien } = await comoUsuario.auth.getUser(jwt);
  if (errQuien || !quien?.user) return json({ error: 'sesion no valida' }, 401);

  const idUsuario = quien.user.id;

  /* ---- confirmación explícita ------------------------------
     Se exige repetir el nombre de usuario del perfil. Sin esto,
     bastaría con que alguien consiguiera que la víctima cargara
     una página que llama a este endpoint con su propia sesión.
     Un borrado no se puede deshacer: pedir que se escriba algo es
     la diferencia entre una acción y un accidente. */
  let confirmacion = '';
  try {
    const cuerpo = await req.json();
    confirmacion = String(cuerpo?.confirmacion ?? '');
  } catch {
    return json({ error: 'peticion mal formada' }, 400);
  }

  const admin = createClient(url, servicio, { auth: { persistSession: false } });

  const { data: perfil } = await admin
    .from('perfiles')
    .select('id, username')
    .eq('dueno', idUsuario)
    .maybeSingle();

  /* Si tiene perfil, la confirmación es su nombre de usuario. Si no
     tiene ninguno, la palabra BORRAR. */
  const esperado = perfil?.username ?? 'BORRAR';
  if (confirmacion.trim().toLowerCase() !== String(esperado).toLowerCase()) {
    return json({ error: 'la confirmacion no coincide', esperado }, 400);
  }

  /* ---- borrar ---------------------------------------------
     Primero los archivos: Storage no cae en cascada con la base de
     datos, y si se borra el usuario antes, se queda huérfano lo
     que hubiera subido y ya no hay forma de saber de quién era. */
  const cubo = Deno.env.get('BUCKET_MEDIA') ?? 'media';
  try {
    const { data: archivos } = await admin.storage.from(cubo).list(idUsuario);
    if (archivos?.length) {
      await admin.storage.from(cubo)
        .remove(archivos.map((f) => `${idUsuario}/${f.name}`));
    }
  } catch (e) {
    /* Que el cubo no exista todavia no puede impedir el borrado de
       la cuenta: la promesa de la politica es esa, no la limpieza. */
    console.warn('storage', (e as Error).message);
  }

  const { error: errBorrado } = await admin.auth.admin.deleteUser(idUsuario);
  if (errBorrado) {
    console.error('deleteUser', errBorrado.message);
    return json({ error: 'no se pudo completar el borrado' }, 500);
  }

  return json({ ok: true });
});
