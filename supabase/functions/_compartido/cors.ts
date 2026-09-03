// ============================================================
// IDENTITY · CORS para las funciones de borde
//
// Las dos funciones tenían `Access-Control-Allow-Origin: '*'` como
// valor por defecto. Con `registrar-vista` eso no es un detalle:
//
//   Cualquier página de internet podía hacer que sus visitantes
//   contaran como visitas de un perfil de IDENTITY. Un <script>
//   escondido en un sitio con tráfico y cada persona que pasara
//   por allí sumaba una visita ÚNICA —única de verdad, porque son
//   IPs distintas— al perfil que quisiera quien lo puso.
//
// Y esas visitas únicas son las que ordenan Descubrir. O sea que
// el ranking se compraba con un iframe.
//
// Restringir el origen lo corta de raíz: la petición lleva
// `content-type: application/json`, así que el navegador la
// somete a comprobación previa y se niega a enviarla si el origen
// no está permitido.
//
// (No detiene a un script en un servidor, que no tiene navegador
// que le diga que no. Pero un servidor tiene UNA IP, y el conteo
// por huella lo reduce a una sola visita. El daño en volumen
// necesitaba justamente el navegador de mucha gente.)
//
// FALLA HACIA CERRADO: sin `ORIGENES_PERMITIDOS` configurado no se
// devuelve cabecera de origen, y el navegador rechaza. Antes el
// valor por defecto era `*`, que es fallar hacia abierto: olvidar
// una variable de entorno abría la puerta en vez de cerrarla.
// ============================================================

/** Lista blanca de orígenes, desde la variable de entorno.
 *  Se separan por comas:
 *    ORIGENES_PERMITIDOS="https://identity.vercel.app,http://localhost:8765"
 */
function permitidos(): string[] {
  const crudo = Deno.env.get('ORIGENES_PERMITIDOS')
    ?? Deno.env.get('ORIGEN_PERMITIDO')   // nombre anterior, por compatibilidad
    ?? '';
  return crudo.split(',').map((o) => o.trim()).filter(Boolean);
}

/** Cabeceras para una petición concreta. El origen se devuelve
 *  SOLO si está en la lista: nunca se refleja lo que venga.
 *
 *  Reflejar el origen recibido es el fallo clásico de CORS —
 *  equivale a `*` pero además permite credenciales. */
/* `authorization` va en el valor por defecto y no como anadido de cada
   funcion. TODA funcion de borde de Supabase la recibe —la manda el propio
   cliente con la clave publica, y con el JWT de la sesion cuando la hay—,
   asi que dejarla fuera del defecto significa que cada funcion nueva nace
   rota y no se nota hasta que falla el preflight en produccion. Paso
   exactamente eso con `registrar-vista` y `vimeo-subida`. */
export function cors(req: Request, metodos = 'POST, OPTIONS', cabeceras = 'content-type, authorization'): HeadersInit {
  const origen = req.headers.get('origin') ?? '';
  const lista = permitidos();

  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': cabeceras + ', apikey',
    'Access-Control-Allow-Methods': metodos,
    'Access-Control-Max-Age': '86400',
    /* Que una respuesta cacheada para un origen no se sirva a otro. */
    'Vary': 'Origin',
  };

  if (lista.length && lista.includes(origen)) {
    base['Access-Control-Allow-Origin'] = origen;
  } else if (!lista.length) {
    /* Sin configurar. Se avisa en el registro y NO se permite:
       mejor que la función deje de funcionar de forma visible a que
       quede abierta en silencio. */
    console.warn(
      '[cors] ORIGENES_PERMITIDOS sin configurar. No se permite ningun origen. ' +
      'Definela en Supabase -> Edge Functions -> Secrets, separando por comas.',
    );
  }

  return base;
}

/** Respuesta a la comprobación previa del navegador. */
export function preflight(req: Request, metodos?: string, cabeceras?: string): Response {
  return new Response(null, { status: 204, headers: cors(req, metodos, cabeceras) });
}

/** ¿Viene de un origen permitido?
 *  Una petición sin `Origin` no es de un navegador —curl, un
 *  servidor, una app— y CORS no la gobierna: ahí protege el token,
 *  no esta lista. */
export function origenValido(req: Request): boolean {
  const origen = req.headers.get('origin');
  if (!origen) return true;
  return permitidos().includes(origen);
}


/* ============================================================
   CSRF · exigir que el cuerpo venga como JSON

   La autenticacion de IDENTITY va por cabecera (Bearer + apikey),
   no por cookie, asi que un sitio ajeno no puede firmar una
   peticion en nombre de nadie: no puede leer el localStorage de la
   victima. Hasta ahi, CSRF no aplica.

   Queda una via que NO necesita cabeceras: un <form> cross-origin.
   Es una peticion "simple" —sin comprobacion previa— y el efecto
   ocurre aunque el navegador impida leer la respuesta. Con
   enctype="text/plain" se puede incluso fabricar un cuerpo que sea
   JSON valido:

     <form action="...registrar-vista?apikey=LA_PUBLICA"
           method="POST" enctype="text/plain">
       <input name='{"username":"victima","x":"' value='"}'>
     </form>

   Un formulario NO puede poner Content-Type: application/json —el
   navegador solo permite tres valores, y ese no esta— asi que
   exigirlo cierra la clase entera, sin depender de la cabecera
   Origin ni de que el portal filtre la apikey.

   Dos defensas para lo mismo: la lista de origenes y esta. Si una
   falla, la otra sigue.
   ============================================================ */
export function cuerpoEsJson(req: Request): boolean {
  const tipo = (req.headers.get('content-type') ?? '').toLowerCase();
  return tipo.split(';')[0].trim() === 'application/json';
}
