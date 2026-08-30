// ============================================================
// IDENTITY · función de borde · registrar una visita
//
// Existe por una razón: la IP de quien visita solo la ve el
// servidor. Si el contador lo llevara el navegador, subir en
// Descubrir sería cuestión de abrir la consola y escribir un
// bucle. Aquí el navegador solo dice "he entrado en /uriel"; el
// resto lo decide el servidor.
//
// Lo que NO hace: guardar la IP. Se la pasa a la función de base
// de datos, que la convierte en un hash con pimienta y la
// descarta. En ninguna tabla queda una IP en claro.
//
// Desplegar:  supabase functions deploy registrar-vista
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, preflight, origenValido, cuerpoEsJson } from '../_compartido/cors.ts';

/* De dónde sacar la IP de verdad.
   `cf-connecting-ip` la pone Cloudflare y el cliente no la puede
   falsear. `x-forwarded-for` sí es manipulable si el cliente
   manda la suya: por eso va después y se toma el PRIMER valor
   solo como último recurso. Si un día cambias de proveedor,
   revisa esta función: es el punto donde se decide si el ranking
   se puede comprar o no. */
function ipDe(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '';
}

Deno.serve(async (req: Request) => {
  const CORS = cors(req);

  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  /* Sin esto, cualquier pagina de internet podia hacer que sus
     visitantes contaran como visitas UNICAS de un perfil ajeno
     —IPs distintas de verdad— y comprar el puesto en Descubrir con
     un <script> escondido. */
  if (!origenValido(req)) {
    return new Response(null, { status: 403, headers: CORS });
  }

  /* Segunda defensa, independiente de la anterior: un <form> de
     otro sitio no puede declarar application/json. Cierra el
     unico camino que no necesita cabeceras. */
  if (!cuerpoEsJson(req)) {
    return new Response(null, { status: 415, headers: CORS });
  }

  let username = '';
  try {
    const cuerpo = await req.json();
    username = String(cuerpo?.username ?? '');
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS });
  }

  /* Misma forma que exige la base de datos. Comprobarlo aquí
     evita una ida y vuelta por cada tontería. */
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return new Response('Bad request', { status: 400, headers: CORS });
  }

  const ip = ipDe(req);
  const agente = (req.headers.get('user-agent') ?? '').slice(0, 400);

  /* Sin IP no se puede distinguir a nadie de nadie: contarlo
     inflaría el número de visitantes únicos con cada petición.
     Mejor no contar que contar mal. */
  if (!ip) return new Response(null, { status: 204, headers: CORS });

  /* La clave de servicio se salta RLS. Vive SOLO aquí, en las
     variables de entorno de la función. Nunca en el navegador. */
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { error } = await db.rpc('registrar_vista', {
    p_username: username,
    p_ip: ip,
    p_agente: agente,
  });

  if (error) {
    console.error('registrar_vista', error.message);
    return new Response(null, { status: 204, headers: CORS });
  }

  /* 204 siempre, tanto si contó como si no. Que la respuesta no
     revele si el perfil existe, si estaba oculto o si ya te había
     contado: es información que no aporta nada a quien mira y sí
     a quien tantea. */
  return new Response(null, { status: 204, headers: CORS });
});
