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
/* El pais, de la cabecera que pone la infraestructura.

   `cf-ipcountry` la pone Cloudflare, que ya esta delante —de ahi sale
   tambien `cf-connecting-ip`— y el cliente NO la puede falsear. Las otras
   son por si algun dia cambia quien esta delante: con una sola, el dia
   que cambie el proveedor esto dejaria de saber el pais en silencio, que
   es como se descubren estas cosas seis meses tarde.

   No se consulta ningun servicio de terceros con la IP: eso seria
   mandarle la IP de cada visitante a una empresa mas. La cabecera ya
   viene con la peticion. */
function paisDe(req: Request): string {
  for (const nombre of ['cf-ipcountry', 'x-vercel-ip-country', 'x-country-code', 'fly-client-country']) {
    const v = req.headers.get(nombre);
    if (v && v.trim()) return v.trim().toUpperCase().slice(0, 2);
  }
  return '';
}

function ipDe(req: Request): string {
  /* En orden de confianza. Las de arriba las pone la infraestructura y
     el cliente no las puede falsear; `x-forwarded-for` si, porque
     cualquiera puede mandarla, y por eso va la ultima y se toma solo el
     primer valor. Se prueban varias porque el nombre depende de quien
     este delante: Cloudflare, Fly, el proxy de Supabase... y con una
     sola, si el proveedor cambia, esto deja de contar EN SILENCIO. */
  for (const nombre of ['cf-connecting-ip', 'true-client-ip', 'fly-client-ip', 'x-real-ip']) {
    const v = req.headers.get(nombre);
    if (v && v.trim()) return v.trim();
  }
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const primera = xff.split(',')[0]?.trim() ?? '';
    if (primera) return primera;
  }
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
  if (!ip) {
    /* Sin esto el fallo era invisible: 204 sin contar y sin rastro. Si
       aparece en el registro, es que ninguna de las cabeceras de arriba
       llega y hay que anadir la que use el proveedor de turno. */
    console.error(
      'registrar_vista: sin IP. Cabeceras presentes:',
      [...req.headers.keys()].join(', '),
    );
    return new Response(null, { status: 204, headers: CORS });
  }

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
    /* Dos letras. La IP se usa para hashear al visitante y se tira, como
       hasta ahora: lo que se guarda del sitio de donde entra es esto y
       nada mas. */
    p_pais: paisDe(req),
  });

  if (error) {
    console.error('registrar_vista fallo:', error.message, '| perfil:', username);
    return new Response(null, { status: 204, headers: CORS });
  }

  /* Rastro de que si conto. Sin esto, «204» y «204» son la misma cosa
     desde fuera y desde el registro, y no hay forma de distinguir que
     funciona de que se cae en silencio. */
  console.log('registrar_vista ok:', username);

  /* 204 siempre, tanto si contó como si no. Que la respuesta no
     revele si el perfil existe, si estaba oculto o si ya te había
     contado: es información que no aporta nada a quien mira y sí
     a quien tantea. */
  return new Response(null, { status: 204, headers: CORS });
});
