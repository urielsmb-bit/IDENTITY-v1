/**
 * Las etiquetas de un perfil, puestas en el servidor.
 *
 * IDENTITY es una sola pagina que se rellena en el navegador. Eso significa
 * que lo que sale por el cable es SIEMPRE el mismo cascaron de 1.4 kB, con
 * el mismo titulo para todo el mundo y sin una sola etiqueta `og:`.
 *
 * En otra web seria un detalle de posicionamiento. Aqui no: el producto ES
 * el enlace. Cuando alguien pega su perfil en Discord, en WhatsApp, en
 * Twitter o en Telegram, lo que decide si lo abren es la tarjeta de vista
 * previa — y esa tarjeta la arma un robot que NO ejecuta JavaScript. Lee el
 * HTML tal como llega y se va. Con el cascaron a secas, todos los perfiles
 * de IDENTITY se veian iguales: sin nombre, sin foto, sin nada.
 *
 * Esto se pone delante de `/u/<usuario>`, pregunta a la vista publica —la
 * misma que lee el navegador, con las mismas politicas— y devuelve el mismo
 * HTML de siempre con el titulo y las etiquetas ya puestas. El perfil no se
 * pinta aqui: solo se anuncia. La aplicacion arranca despues igual que antes.
 *
 * Si algo falla se devuelve el cascaron sin tocar. Una vista previa pobre es
 * un problema; una pagina que no carga es otro mucho mayor.
 */
/* Los textos NO se arman aqui. Salen del mismo sitio que los de la
   previsualizacion del editor, para que no puedan decir cosas distintas:
   una previa que miente es peor que no tener ninguna.
   Import relativo y no `@/`: el runtime del borde no tiene alias. Y CON
   extension, aunque el fichero sea `.ts`: esta funcion no la compila Vite
   —que resuelve con `moduleResolution: bundler` y no la necesita— sino
   Vercel, con las reglas de ESM de Node, donde un import relativo sin
   extension es un error. Salia en rojo en cada despliegue desde que este
   fichero dejo de armar sus propios textos. */
import {
  NOMBRE_SITIO, linea, tituloTarjeta, descripcionTarjeta, imagenTarjeta,
} from '../src/lib/tarjeta.js';

export const config = { runtime: 'edge' };

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/**
 * Escapar aqui no es higiene, es la diferencia entre una etiqueta y un
 * agujero. El nombre y la biografia los escribe cualquiera; metidos en un
 * atributo sin escapar, un `">` cierra la etiqueta y lo que venga detras se
 * ejecuta en el dominio de IDENTITY para todo el que abra ese perfil.
 */
function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}

/* El cascaron no cambia dentro de un despliegue, asi que se pide una vez por
   instancia y se reutiliza. */
let cascaron: string | null = null;

/**
 * De donde se pide el cascaron.
 *
 * `VERCEL_URL` es la direccion propia de ESTE despliegue, y esa es la
 * gracia: el dominio de siempre apunta a lo que este publicado ahora
 * mismo, que durante el minuto que dura una publicacion puede ser la
 * version anterior. Una instancia recien nacida en ese minuto se guardaba
 * el HTML viejo y lo servia el resto de su vida — la pagina cargaba, pero
 * con los archivos de la version de antes.
 *
 * Pidiendoselo a su propio despliegue, el HTML y la funcion son siempre de
 * la misma version. Si esa direccion no responde —puede estar protegida—
 * se cae al dominio normal, que es lo que habia antes: peor, pero no roto.
 */
function origenes(publico: string): string[] {
  const propio = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  return propio && propio !== publico ? [propio, publico] : [publico];
}

async function traerCascaron(publico: string): Promise<string | null> {
  if (cascaron) return cascaron;
  for (const origen of origenes(publico)) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const r = await fetch(`${origen}/index.html`, {
          signal: AbortSignal.timeout(3000),
        });
        if (r.ok) {
          const texto = await r.text();
          // Un HTML sin el punto de montaje no es el cascaron: es una
          // pagina de error o una pantalla de proteccion del despliegue.
          if (texto.includes('id="root"')) {
            cascaron = texto;
            return cascaron;
          }
        }
      } catch {
        /* se reintenta una vez por origen y se pasa al siguiente */
      }
    }
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origen = url.origin;

  const html = await traerCascaron(origen);
  if (!html) {
    /* Sin cascaron no hay pagina que servir. Se manda otra vez a la misma
       ruta con una marca que `vercel.json` usa para NO volver a entrar aqui:
       asi lo sirve el CDN como antes de existir esta funcion, en vez de
       quedarse dando vueltas. */
    const salida = new URL(url.pathname, origen);
    salida.searchParams.set('_o', '1');
    return Response.redirect(salida.toString(), 302);
  }

  const respuesta = (cuerpo: string, segundos: number) =>
    new Response(cuerpo, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        /* Se guarda en el borde, no en el navegador: un perfil muy
           compartido deja de consultar la base en cada visita, y un cambio
           en el perfil se ve en minutos y no cuando caduque un navegador. */
        'cache-control': `public, max-age=0, s-maxage=${segundos}, stale-while-revalidate=86400`,
      },
    });

  /* El nombre de usuario se limpia antes de tocar nada: va a una consulta y
     va al HTML, y en los dos sitios lo que no sea un nombre de usuario no
     tiene por que pasar. */
  const usuario = (url.searchParams.get('u') || '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 32);
  if (!usuario) return respuesta(html, 60);

  const SUPA = process.env.VITE_SUPABASE_URL || '';
  const CLAVE = process.env.VITE_SUPABASE_KEY || '';
  if (!SUPA || !CLAVE) return respuesta(html, 60);

  /* Las mismas columnas que pide el navegador. No es capricho: la fila se
     manda entera dentro del HTML para que la aplicacion no tenga que
     volver a pedirla, y si aqui faltara una columna el perfil llegaria
     distinto segun por donde entres —sin visitas, sin nota—. */
  const CAMPOS = 'id,username,apariencia,creado,actualizado,vistas,nota,num_notas';

  let fila: Record<string, unknown>;
  try {
    /* La vista publica, no la tabla: es la que existe para que la lea
       cualquiera, y a proposito no expone el dueño de cada perfil. */
    const r = await fetch(
      `${SUPA}/rest/v1/perfiles_publicos` +
        `?select=${CAMPOS}&username=eq.${encodeURIComponent(usuario)}&limit=1`,
      {
        headers: { apikey: CLAVE, authorization: `Bearer ${CLAVE}` },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!r.ok) return respuesta(html, 60);
    const filas = (await r.json()) as Array<Record<string, unknown>>;
    if (!filas?.[0]) return respuesta(html, 300);
    fila = filas[0];
  } catch {
    return respuesta(html, 60);
  }

  const ap = (fila.apariencia as Record<string, unknown>) ?? {};

  /* Los tres, de `tarjeta.ts`. La previsualizacion del editor llama a estas
     mismas funciones, asi que lo que te enseña antes de compartir es
     literalmente lo que va a leer Discord. */
  const datos = {
    username: usuario,
    name: linea(ap.name, 60),
    title: linea(ap.title, 60),
    bio: linea(ap.bio, 160),
  };
  const titulo = tituloTarjeta(datos);
  const descripcion = descripcionTarjeta(datos);
  const imagen = imagenTarjeta(ap.avatarUrl);

  const enlace = `${origen}/u/${usuario}`;

  const etiquetas = [
    `<title>${esc(titulo)}</title>`,
    `<meta name="description" content="${esc(descripcion)}" />`,
    `<link rel="canonical" href="${esc(enlace)}" />`,
    `<meta property="og:site_name" content="${NOMBRE_SITIO}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:url" content="${esc(enlace)}" />`,
    `<meta property="og:title" content="${esc(titulo)}" />`,
    `<meta property="og:description" content="${esc(descripcion)}" />`,
    imagen ? `<meta property="og:image" content="${esc(imagen)}" />` : '',
    /* `summary` y no `summary_large_image`: un avatar es cuadrado, y pedir
       tarjeta ancha lo deja recortado o con franjas a los lados. */
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(titulo)}" />`,
    `<meta name="twitter:description" content="${esc(descripcion)}" />`,
    imagen ? `<meta name="twitter:image" content="${esc(imagen)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n  ');

  /**
   * Y la fila entera, para que el navegador no la vuelva a pedir.
   *
   * Ver un perfil eran cuatro pasos en fila india —HTML, JavaScript,
   * consulta a Supabase, pintar— y los tres primeros no se solapan: cada
   * uno espera al anterior. El tercero sobra: la fila ya esta aqui, se
   * consulto para escribir las etiquetas de arriba. Mandarla no cuesta ni
   * una peticion mas y le ahorra al visitante una ida y vuelta completa a
   * otro dominio antes de ver nada.
   *
   * Va escapado el `<`, que es lo unico que puede romper esto: un `</script`
   * dentro del JSON cerraria la etiqueta ahi mismo y lo que siguiera —una
   * biografia, un nombre— pasaria a ser HTML de la pagina.
   *
   * Y con tope. Un perfil con muchos bloques puede ocupar bastante, y a
   * partir de cierto tamaño meterlo en el HTML retrasa lo que venia a
   * adelantar: pasado el limite, que lo pida por la red como siempre.
   */
  const TOPE_PRECARGA = 48 * 1024;
  let precarga = '';
  try {
    const json = JSON.stringify(fila);
    if (json.length <= TOPE_PRECARGA) {
      precarga =
        `\n  <script id="perfil-precargado" type="application/json">` +
        json.replace(/</g, '\\u003c') +
        `</script>`;
    }
  } catch {
    /* Fila que no se deja convertir: se pide por la red y ya. */
  }

  /* Se SUSTITUYE lo que ya trae el cascaron. Añadir los nuevos sin quitar
     los viejos deja dos de cada, y cual gana lo decide cada robot por su
     cuenta: la mitad enseñaria el titulo generico.

     Y eso llego a pasar. El cascaron no tenia etiquetas `og:` cuando esto
     se escribio; se le pusieron unas por defecto despues —para que la
     portada tambien tuviera tarjeta— y desde entonces cada perfil salia
     con DOS `og:title`: el suyo y «IDENTITY — Tu identidad, en linea».
     Por eso ahora se barren todas las `og:` y `twitter:` en vez de sólo
     las dos que habia el primer dia. */
  const salida = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
    .replace(/<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*/gi, '')
    .replace('</head>', `  ${etiquetas}${precarga}\n</head>`);

  return respuesta(salida, 300);
}
