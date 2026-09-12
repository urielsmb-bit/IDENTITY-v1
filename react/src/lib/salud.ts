/* `CONFIG.hayBackend()` y no el `hasBackend` de `lib/supabase`: ese arrastra
   el SDK entero, y esta pantalla no necesita hablar con nadie autenticado. */
import { CONFIG } from '@/config';
import { esVimeo, infoVimeo } from '@/lib/vimeo';

/**
 * Las comprobaciones que responden a «¿por qué no funciona?».
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Todo lo que se rompió en este proyecto sin dar la cara se rompió igual:
 * una variable de entorno que se quedó apuntando al dominio anterior.
 *
 *   · `VIMEO_DOMINIOS` en la función de borde → los fondos de vídeo salían
 *     en negro, con un «Lo sentimos» de Vimeo que parecía culpa nuestra;
 *   · `ORIGENES_PERMITIDOS` → dejó de poder subirse nada, de contarse las
 *     visitas y de entrarse con Discord, las tres a la vez;
 *   · `VITE_VIMEO` sin poner → los vídeos iban al cubo, sin transcodificar
 *     y con un tope mucho más bajo.
 *
 * Ninguna rompió la página. La aplicación compila igual, arranca igual y se
 * ve igual: lo que desaparece es una función entera, en silencio, y el día
 * que alguien lo nota no lo relaciona con un cambio de hace tres semanas.
 *
 * Esto no arregla nada. Solo lo ENSEÑA, que es lo que faltaba: se mira una
 * vez después de cada mudanza y se acabó la tarde de depuración.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y SE COMPRUEBA DESDE EL NAVEGADOR
 * ────────────────────────────────────────────────────────────────────────
 *
 * A propósito, y es la mitad del valor. Estas cosas fallan por el ORIGEN
 * desde el que se piden —CORS, la lista de dominios de Vimeo, la CSP—, así
 * que una comprobación desde un servidor diría que todo está bien mientras
 * el visitante ve la página rota. Aquí pregunta el mismo navegador, desde el
 * mismo dominio y con las mismas reglas.
 */

export type Estado = 'bien' | 'mal' | 'aviso' | 'mirando';

export interface Prueba {
  id: string;
  nombre: string;
  estado: Estado;
  detalle: string;
  /** Qué hacer si sale mal. Sin esto, un diagnóstico es solo una queja. */
  arreglo?: string;
}

/** El origen desde el que se está mirando. Es la clave de casi todo. */
export const AQUI = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Una petición que no puede colgarse.
 *
 * Sin tope, una función de borde dormida deja la pantalla en «mirando…»
 * para siempre — y una pantalla de diagnóstico que se queda colgada es
 * exactamente el problema que venía a resolver.
 */
async function conTope(url: string, init: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ── 1 · lo que se quedó dentro de la compilación ──────────────── */

export function pruebasDeCompilacion(): Prueba[] {
  const pruebas: Prueba[] = [
    {
      id: 'backend',
      nombre: 'Backend configurado',
      estado: CONFIG.hayBackend() ? 'bien' : 'mal',
      detalle: CONFIG.hayBackend()
        ? CONFIG.SUPABASE_URL
        : 'Sin VITE_SUPABASE_URL o VITE_SUPABASE_KEY: la app trabaja en local y no guarda nada.',
      arreglo: 'Ponlas en .env.local y vuelve a compilar. En el despliegue automático son secretos de GitHub.',
    },
    {
      id: 'vimeo',
      nombre: 'Subida de vídeos a Vimeo',
      estado: CONFIG.VIMEO ? 'bien' : 'aviso',
      detalle: CONFIG.VIMEO
        ? 'Encendida. Los vídeos de fondo van a Vimeo.'
        : 'Apagada. Los vídeos van al cubo, sin transcodificar y con un tope mucho más bajo.',
      arreglo: 'VITE_VIMEO con cualquier valor, y volver a compilar.',
    },
  ];
  return pruebas;
}

/* ── 2 · lo que solo se sabe preguntando ───────────────────────── */

/** ¿Responde el REST público, y con la cabecera de origen correcta? */
export async function pruebaRest(): Promise<Prueba> {
  const base = { id: 'rest', nombre: 'Base de datos (REST)' };
  if (!CONFIG.hayBackend()) {
    return { ...base, estado: 'mal', detalle: 'No hay backend configurado.' };
  }
  try {
    const r = await conTope(
      `${CONFIG.SUPABASE_URL}/rest/v1/cifras_publicas?select=perfiles&limit=1`,
      { headers: { apikey: CONFIG.SUPABASE_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_KEY}` } },
    );
    if (!r.ok) {
      return {
        ...base, estado: 'mal',
        detalle: `Respondió ${r.status}.`,
        arreglo: 'Mira que el proyecto de Supabase no esté pausado.',
      };
    }
    return { ...base, estado: 'bien', detalle: 'Responde y deja leer las vistas públicas.' };
  } catch (e) {
    /* Un fallo de red aquí casi nunca es la red: es la CSP de este sitio o
       un bloqueador en el navegador de quien mira. Se dicen las dos, porque
       desde aquí no se distinguen. */
    return {
      ...base, estado: 'mal',
      detalle: `No se pudo ni preguntar: ${(e as Error).message}`,
      arreglo: 'Comprueba `connect-src` en la CSP del .htaccess, y prueba con los escudos del navegador bajados.',
    };
  }
}

/**
 * ¿Deja cada función de borde que este dominio la llame?
 *
 * ────────────────────────────────────────────────────────────────────────
 * NO SE MIRA LA CABECERA. SE INTENTA.
 * ────────────────────────────────────────────────────────────────────────
 *
 * `Access-Control-Allow-Origin` NO se puede leer desde JavaScript: el
 * navegador la usa por dentro para decidir y no se la enseña al script.
 * `r.headers.get(...)` devuelve `null` siempre — también cuando la cabecera
 * viene perfecta. Una comprobación hecha así diría que todo está roto
 * mientras todo funciona, que es peor que no comprobar nada.
 *
 * Lo que sí se puede es INTENTARLO y ver qué pasa. Si el origen no está
 * permitido, `fetch` no devuelve una respuesta con un código feo: revienta
 * con un `TypeError` y el script no llega a ver nada. O sea que llegar a
 * leer un código —el que sea— ya es la prueba de que el permiso está.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y SE LLAMA DE UNA FORMA QUE NO HACE NADA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Estas funciones borran cuentas y suben vídeos, así que la llamada va
 * hecha para que la rechacen: `POST` con el cuerpo vacío y SIN la cabecera
 * de sesión. Todas contestan 401 a eso. Pero contestar 401 exige haber
 * pasado antes por el preflight, que es justo lo que se quería saber.
 *
 * Un 401 aquí es la mejor noticia posible.
 */
export async function pruebaCors(nombre: string): Promise<Prueba> {
  const base = { id: `cors:${nombre}`, nombre: `Permiso de origen · ${nombre}` };
  if (!CONFIG.hayBackend()) return { ...base, estado: 'mal', detalle: 'No hay backend configurado.' };
  try {
    const r = await conTope(`${CONFIG.SUPABASE_URL}/functions/v1/${nombre}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    /* Se ha podido leer la respuesta: el permiso está. El código da igual. */
    return {
      ...base, estado: 'bien',
      detalle: `Acepta llamadas desde ${AQUI} (respondió ${r.status}).`,
    };
  } catch (e) {
    const motivo = (e as Error).name === 'AbortError'
      ? 'tardó demasiado en responder'
      : 'el navegador no dejó leer la respuesta';
    return {
      ...base, estado: 'mal',
      detalle: `No se pudo llamar: ${motivo}.`,
      arreglo: `Casi siempre es el origen. Ponlo y vuelve a mirar:\nnpx supabase secrets set ORIGENES_PERMITIDOS="${AQUI},https://sharee.fun,https://www.sharee.fun"\n\nSi el origen ya estaba, puede que la función no esté desplegada:\nnpx supabase functions deploy ${nombre}`,
    };
  }
}

/**
 * ¿Deja Vimeo incrustar ESTE vídeo en ESTE dominio?
 *
 * Es la pregunta exacta que costó media tarde. Vimeo la responde en
 * `domain_status_code`, dentro de la misma respuesta de la que ya se saca la
 * proporción: 200 es que sí, 403 es que no. Y la responde según el dominio
 * desde el que se pregunta, que es justo por lo que esto vive en el
 * navegador y no en un guion.
 */
export async function pruebaVimeo(url: string): Promise<Prueba> {
  const base = { id: 'vimeo-embed', nombre: 'Vimeo deja incrustar aquí' };
  if (!esVimeo(url)) {
    return { ...base, estado: 'aviso', detalle: 'Pega un enlace de Vimeo para comprobarlo.' };
  }
  try {
    const d = await infoVimeo(url);
    if (!d) {
      return {
        ...base, estado: 'mal',
        detalle: 'Vimeo no da la ficha de ese vídeo.',
        arreglo: 'Si es privado, pega el enlace completo con su código: vimeo.com/123456789/abc123def4',
      };
    }
    if (!d.embebible) {
      return {
        ...base, estado: 'mal',
        detalle: `«${d.titulo || 'ese vídeo'}» existe, pero no se puede incrustar en ${AQUI}. Saldría en negro.`,
        arreglo: `En Vimeo: el vídeo → Share → Embed → «Where can this be embedded?» → Anywhere, o añade ${new URL(AQUI).host}. Para los ya subidos: node scripts/vimeo-dominios.mjs ${new URL(AQUI).host}`,
      };
    }
    return { ...base, estado: 'bien', detalle: `«${d.titulo || 'sin título'}», proporción ${d.ratio}.` };
  } catch (e) {
    return {
      ...base, estado: 'mal',
      detalle: `No se pudo preguntar: ${(e as Error).message}`,
      arreglo: 'Mira que `vimeo.com` esté en `connect-src` de la CSP.',
    };
  }
}

/** Las fuentes del perfil, que vienen de un tercero y son del camino de pintado. */
export function pruebaFuentes(): Prueba {
  const base = { id: 'fuentes', nombre: 'Fuentes' };
  if (typeof document === 'undefined') return { ...base, estado: 'aviso', detalle: 'Sin navegador.' };
  const hoja = document.getElementById('hoja-fuentes') as HTMLLinkElement | null;
  if (!hoja) return { ...base, estado: 'aviso', detalle: 'No está la hoja de fuentes en el HTML.' };
  if (hoja.media === 'print') {
    return {
      ...base, estado: 'mal',
      detalle: 'La hoja sigue en `media="print"`: se descargó pero no se aplica.',
      arreglo: 'Lo cambia `src/lib/fuentes.ts` al arrancar. Si no pasó, mira si hubo un error de JavaScript antes.',
    };
  }
  return { ...base, estado: 'bien', detalle: 'Cargadas y aplicadas.' };
}

/**
 * Las funciones que LLAMA EL NAVEGADOR, y para qué sirve cada una.
 *
 * `discord-presencia` no está y no es un olvido: a esa la llama un cron con
 * un secreto propio, nunca un navegador. Exige sesión hasta en el preflight
 * —y hace bien— así que comprobarla desde aquí la daría siempre por rota.
 * Una comprobación que siempre sale en rojo se aprende a ignorar, y el día
 * que algo se rompa de verdad ya nadie mira esta pantalla.
 *
 * El navegador lee la presencia de la TABLA `presencia`, por REST, y eso ya
 * lo cubre la prueba de la base de datos.
 */
export const FUNCIONES: Array<[string, string]> = [
  ['vimeo-subida', 'subir fondos de vídeo'],
  ['registrar-vista', 'contar las visitas'],
  ['discord-entrar', 'entrar con Discord'],
  ['borrar-cuenta', 'borrar la cuenta'],
];
