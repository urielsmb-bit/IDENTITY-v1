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
export const config = { runtime: 'edge' };

const NOMBRE_SITIO = 'IDENTITY';

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

/** Una linea, sin saltos y sin pasarse de largo: es para una tarjeta. */
function linea(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/* El cascaron no cambia dentro de un despliegue, asi que se pide una vez
   por instancia y se reutiliza. Un despliegue nuevo estrena instancias, o
   sea que esto no puede quedarse con el HTML de una version vieja. */
let cascaron: string | null = null;

async function traerCascaron(origen: string): Promise<string | null> {
  if (cascaron) return cascaron;
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch(`${origen}/index.html`, {
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) {
        cascaron = await r.text();
        return cascaron;
      }
    } catch {
      /* se reintenta una vez y ya */
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

  let ap: Record<string, unknown>;
  try {
    /* La vista publica, no la tabla: es la que existe para que la lea
       cualquiera, y a proposito no expone el dueño de cada perfil. */
    const r = await fetch(
      `${SUPA}/rest/v1/perfiles_publicos` +
        `?select=username,apariencia&username=eq.${encodeURIComponent(usuario)}&limit=1`,
      {
        headers: { apikey: CLAVE, authorization: `Bearer ${CLAVE}` },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!r.ok) return respuesta(html, 60);
    const filas = (await r.json()) as Array<{ apariencia?: Record<string, unknown> }>;
    if (!filas?.[0]) return respuesta(html, 300);
    ap = filas[0].apariencia ?? {};
  } catch {
    return respuesta(html, 60);
  }

  const nombre = linea(ap.name, 60) || usuario;
  const oficio = linea(ap.title, 60);
  const bio = linea(ap.bio, 160);

  const titulo = `${nombre} (@${usuario}) · ${NOMBRE_SITIO}`;
  const descripcion = bio || oficio || `El perfil de @${usuario} en ${NOMBRE_SITIO}.`;

  /* Solo vale un avatar que este en la red. `media:` apunta al almacen del
     propio navegador —esa foto nunca sale de su maquina—, asi que como
     imagen de una tarjeta no existe. */
  const avatar = String(ap.avatarUrl ?? '');
  const imagen = /^https:\/\//i.test(avatar) ? avatar.slice(0, 500) : '';

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

  /* Se SUSTITUYEN el titulo y la descripcion del cascaron. Añadir los nuevos
     sin quitar los viejos deja dos de cada, y cual gana lo decide cada robot
     por su cuenta: la mitad enseñaria el titulo generico. */
  const salida = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
    .replace('</head>', `  ${etiquetas}\n</head>`);

  return respuesta(salida, 300);
}
