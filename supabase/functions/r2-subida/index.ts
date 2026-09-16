// ============================================================
// sharee · r2-subida
//
// Un permiso de un solo uso para dejar UN archivo en R2.
//
// ------------------------------------------------------------
// POR QUE ESTA FUNCION EXISTE
// ------------------------------------------------------------
//
// Para escribir en R2 hacen falta unas claves de S3. Esas claves NO pueden
// vivir en el navegador: cualquiera que abra las herramientas del navegador
// las tendria, y con ellas el cubo entero — leer, escribir y BORRAR lo de
// todo el mundo.
//
// Asi que el navegador no las ve nunca. Pide aqui un permiso, esta funcion
// lo firma con las claves y devuelve una direccion que sirve para subir UN
// archivo, de UN tamaño, de UN tipo, durante DIEZ MINUTOS. El archivo va
// derecho del navegador a R2 sin pasar por aqui: son decenas de MB y
// hacerlos rebotar seria pagar el viaje dos veces y chocar con el limite de
// memoria de la funcion.
//
// Es el mismo reparto que ya usa `vimeo-subida`, y por las mismas razones.
//
// ------------------------------------------------------------
// LO QUE QUEDA CLAVADO EN LA FIRMA
// ------------------------------------------------------------
//
// El permiso no es un cheque en blanco. Van FIRMADOS:
//
//   · la clave      -> no se puede pisar el archivo de otra persona
//   · content-type  -> no se puede colar un HTML donde se pidio un mp4
//
// Si el navegador cambia cualquiera de los dos, R2 contesta 403 y no
// escribe nada.
//
// El tamaño NO va en la firma, aunque la primera version lo intentara:
// `Content-Length` la pone el navegador y el codigo no puede tocarla, asi
// que firmarla era prometer una comprobacion imposible de cumplir. Se
// valida antes de firmar, que es donde se puede.
//
// La clave lleva un uuid al azar y NO lleva el id de la cuenta. El id de
// la cuenta no es publico —es justo lo que la migracion 0004 saco de la
// vista publica— y estas direcciones si lo son.
//
// ------------------------------------------------------------
// SECRETOS (Supabase -> Edge Functions -> Secrets)
// ------------------------------------------------------------
//
//   R2_CUENTA          el id de cuenta de Cloudflare
//   R2_CUBO            el nombre del cubo
//   R2_CLAVE_ID        Access Key ID del token de R2
//   R2_CLAVE_SECRETA   Secret Access Key del token de R2
//   R2_PUBLICO         de donde se LEEN los archivos ya subidos,
//                      p. ej. https://cdn.sharee.fun
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { cors, preflight, origenValido, cuerpoEsJson } from '../_compartido/cors.ts';

/** Lo que se acepta, y con que extension se guarda cada cosa.
 *
 *  Lista blanca y no lista negra: lo que no este aqui no entra. Un cubo
 *  publico donde se pueda dejar un `.html` es una pagina de sharee que
 *  escribe cualquiera. */
const TIPOS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Donde va cada cosa dentro del cubo. */
const CARPETAS: Record<string, string> = {
  fondo: 'fondos',
  poster: 'posters',
};

/**
 * Cuanto vale lo que se sube.
 *
 * Un año, e `immutable`. No es optimismo: la clave de cada archivo lleva un
 * uuid al azar, asi que una direccion concreta NUNCA cambia de contenido —
 * cambiar de fondo crea otro archivo con otro nombre. Cuando el contenido
 * de una URL no puede cambiar, cualquier caducidad que no sea «para
 * siempre» es trabajo tirado: revalidaciones que siempre contestan lo
 * mismo.
 *
 * `immutable` va aparte de `max-age` y dice algo mas: que ni siquiera al
 * recargar la pagina hace falta preguntar. Sin el, un F5 vuelve a pedirlo
 * todo aunque no haya caducado.
 *
 * R2 pone `max-age=14400` —cuatro horas— si no se le dice nada. bandi.lol
 * sirve sus fondos con un año, y se le nota: medido, llevaba DIECISIETE
 * DIAS en la cache del borde sin tocar su servidor una sola vez.
 */
const CACHE = 'public, max-age=31536000, immutable';

/* El tope de verdad, el que se firma. 64 MB da de sobra para un bucle de
   fondo decente —guns.lol sirve 8 MB a 1080p y bandi.lol 16 MB a 1440p— y
   deja el gratis de R2 (10 GB) lejos. */
const MAX_BYTES = 64 * 1024 * 1024;

/** Quien pide. Sin sesion no se sube: si no, el cubo es de todos. */
async function quien(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return null;

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

/**
 * El id de cuenta, saque de donde lo saque quien configura esto.
 *
 * El panel de R2 enseña el dato dentro de un campo que se llama «S3 API» y
 * que contiene la direccion ENTERA:
 *
 *     https://ec6f2d48....r2.cloudflarestorage.com/sharee
 *
 * Lo normal es copiar ese campo tal cual, porque es lo que hay para
 * copiar. Y pegado tal cual, la direccion salia doblada:
 *
 *     https://https://ec6f...cloudflarestorage.com/sharee.r2.clou...
 *
 * El navegador la bloqueaba por CSP —bien hecho— y el mensaje hablaba de
 * politicas de seguridad, que no tiene nada que ver con el problema. Una
 * hora de buscar donde no era.
 *
 * Asi que se acepta de las dos formas y, si aun asi no tiene pinta de id
 * de cuenta, se dice EXACTAMENTE eso en vez de construir una direccion
 * invalida y dejar que falle tres saltos mas alla.
 */
function idDeCuenta(crudo: string): string {
  const t = crudo.trim();
  const conDominio = t.match(/([0-9a-f]{32})\.r2\.cloudflarestorage\.com/i);
  if (conDominio) return conDominio[1].toLowerCase();
  const suelto = t.replace(/^https?:\/\//i, '').split('/')[0].split('.')[0];
  return /^[0-9a-f]{32}$/i.test(suelto) ? suelto.toLowerCase() : '';
}

function falta(): string[] {
  return ['R2_CUENTA', 'R2_CUBO', 'R2_CLAVE_ID', 'R2_CLAVE_SECRETA', 'R2_PUBLICO']
    .filter((n) => !Deno.env.get(n));
}

Deno.serve(async (req: Request) => {
  const CORS = cors(req);

  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }
  if (!origenValido(req)) return new Response(null, { status: 403, headers: CORS });
  if (!cuerpoEsJson(req)) return new Response(null, { status: 415, headers: CORS });

  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  /* Falla hacia cerrado y DICIENDO cual falta. Un 500 mudo por un secreto
     sin poner se investiga durante media hora. */
  const sinPoner = falta();
  if (sinPoner.length) {
    return json({ error: `R2 sin configurar: falta ${sinPoner.join(', ')}` }, 503);
  }

  const usuario = await quien(req);
  if (!usuario) return new Response(null, { status: 401, headers: CORS });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS });
  }

  const carpeta = CARPETAS[String(cuerpo.tipo ?? '')];
  if (!carpeta) return json({ error: 'Tipo de archivo desconocido.' }, 400);

  const contentType = String(cuerpo.contentType ?? '').toLowerCase().split(';')[0].trim();
  const ext = TIPOS[contentType];
  if (!ext) return json({ error: `No se admiten archivos ${contentType || 'sin tipo'}.` }, 400);

  const tamano = Number(cuerpo.tamano);
  if (!isFinite(tamano) || tamano <= 0 || tamano > MAX_BYTES) {
    return json({ error: `El archivo debe pesar menos de ${MAX_BYTES / 1048576} MB.` }, 400);
  }

  const cuenta = idDeCuenta(Deno.env.get('R2_CUENTA') as string);
  if (!cuenta) {
    return json({
      error:
        'R2_CUENTA no parece un id de cuenta. Son 32 caracteres (0-9, a-f). ' +
        'Sale en el campo «S3 API» del cubo, entre https:// y .r2.cloudflarestorage.com ' +
        '— y tambien vale pegar ese campo entero.',
    }, 503);
  }
  const cubo = (Deno.env.get('R2_CUBO') as string).trim().replace(/^\/+|\/+$/g, '');
  /* Y el dominio publico igual de tolerante: con o sin barra al final, y
     con `https://` puesto si se olvido. Una barra de mas aqui se convierte
     en una direccion con `//` en medio guardada en el perfil de alguien,
     que funciona hasta el dia que deja de funcionar. */
  let publico = (Deno.env.get('R2_PUBLICO') as string).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(publico)) publico = 'https://' + publico;

  const clave = `${carpeta}/${crypto.randomUUID()}.${ext}`;

  const cliente = new AwsClient({
    accessKeyId: Deno.env.get('R2_CLAVE_ID') as string,
    secretAccessKey: Deno.env.get('R2_CLAVE_SECRETA') as string,
    service: 's3',
    region: 'auto',
  });

  const destino = new URL(`https://${cuenta}.r2.cloudflarestorage.com/${cubo}/${clave}`);
  /* Diez minutos. Lo justo para una subida lenta desde un movil, y no
     tanto como para que un permiso filtrado sirva mañana. */
  destino.searchParams.set('X-Amz-Expires', '600');

  /* Tal cual lo documenta Cloudflare: un `Request` ya montado, y solo
     `Content-Type` dentro de la firma.

     Aqui iba tambien `content-length`, para que un permiso pedido para
     ocho megas no sirviera para subir dos gigas. La idea era buena y la
     ejecucion no: `Content-Length` es una cabecera PROHIBIDA para el
     codigo — la pone el navegador y JavaScript no puede tocarla—, asi que
     acababa en `X-Amz-SignedHeaders` prometiendo una comprobacion que del
     otro lado nadie podia cumplir igual. Un permiso que no se puede usar
     no protege de nada.

     Lo que si queda: el tamaño se valida arriba antes de firmar, y la
     clave lleva un uuid, asi que nadie pisa el archivo de otro. */
  const peticion = new Request(destino.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Cache-Control': CACHE },
  });
  const firmada = await cliente.sign(peticion, { aws: { signQuery: true } });

  return json({
    /* Se devuelven las DOS cabeceras firmadas para que el navegador mande
       exactamente estas y no las que le parezcan: van dentro de la firma, y
       una sola letra distinta es un 403. */
    cacheControl: CACHE,
    subirA: firmada.url,
    /* Lo que se guarda en el perfil. Del dominio publico, no del punto de
       escritura: por ahi se lee gratis y con la cache de Cloudflare
       delante. */
    url: `${publico}/${clave}`,
    contentType,
    tamano,
  });
});
