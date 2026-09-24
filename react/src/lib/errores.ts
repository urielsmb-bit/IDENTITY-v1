import { CONFIG } from '@/config';

/**
 * Los fallos que le salen a la gente, avisados a la base.
 *
 * Hasta ahora un error en el navegador de alguien moria alli: `Frontera`
 * pintaba «algo ha ido mal» y nadie mas se enteraba. Esto lo manda a
 * `registrar_error` (APLICAR_0029), que lo guarda agrupado y con topes.
 *
 * Se manda lo que la politica de privacidad (1.5) dice que se guarda: que
 * fallo, en que pagina —solo la ruta, sin `?` ni `#`— y el navegador. La
 * cuenta no se manda: la pone el servidor desde la sesion, asi nadie puede
 * cargarle un fallo a otro.
 *
 * Sin el SDK de Supabase, con `fetch` a secas, igual que `lib/publico`:
 * esto corre en TODAS las paginas, incluido el perfil que abre cualquiera,
 * y no puede arrastrar 215 kB para mandar tres lineas.
 *
 * Y nunca lanza. Un aviso de error que falla no puede ser otro error.
 */

export type Origen = 'error' | 'promesa' | 'frontera';

/** Como mucho estos avisos por visita. Un bucle que revienta cien veces
 *  por segundo es UN fallo, no cien. */
const TOPE_POR_VISITA = 5;

let enviados = 0;
const yaAvisados = new Set<string>();

/**
 * Lo que no es un fallo de sharee y solo mete ruido:
 *
 *  - lo que revienta dentro de una EXTENSION del navegador (traductores,
 *    bloqueadores): su codigo corre en la pagina pero no es nuestro;
 *  - «Script error.» a secas: un guion de otro dominio que no dice nada;
 *  - el aviso de `ResizeObserver`, que es inofensivo y salta en todas partes;
 *  - los cortes de red de quien visita y las peticiones canceladas;
 *  - los trozos de codigo de una version anterior: eso lo arregla la
 *    recarga de `main.tsx`, no es una averia.
 */
export function esRuido(mensaje: string, pila: string): boolean {
  if (/(chrome|moz|safari(-web)?)-extension:\/\//i.test(pila)) return true;
  if (/^script error\.?$/i.test(mensaje.trim())) return true;
  if (/resizeobserver loop/i.test(mensaje)) return true;
  if (/^(TypeError: )?(failed to fetch|load failed|networkerror)/i.test(mensaje)) return true;
  if (/^AbortError\b|operation was aborted|user aborted|signal is aborted/i.test(mensaje)) return true;
  if (/dynamically imported module|importing a module script failed/i.test(mensaje)) return true;
  return false;
}

/** El error, sea lo que sea lo que llegue: con `throw 'texto'` o con una
 *  promesa rechazada con un objeto cualquiera, no hay `Error` que leer. */
export function aTexto(e: unknown): { mensaje: string; pila: string } {
  if (e instanceof Error) {
    const nombre = e.name && e.name !== 'Error' ? `${e.name}: ` : '';
    return { mensaje: `${nombre}${e.message}`.slice(0, 300), pila: (e.stack ?? '').slice(0, 2000) };
  }
  let mensaje: string;
  try {
    mensaje = typeof e === 'string' ? e : JSON.stringify(e);
  } catch {
    mensaje = String(e);
  }
  return { mensaje: String(mensaje ?? '').slice(0, 300), pila: '' };
}

/**
 * La sesion, si la hay, sin cargar el SDK.
 *
 * Supabase la guarda en `localStorage` bajo `sb-<proyecto>-auth-token`. Si
 * ha caducado se manda la clave anonima: con un token caducado el servidor
 * contesta 401 y el aviso se perderia entero, y un fallo sin cuenta sirve
 * mucho mas que ningun fallo.
 */
function tokenDeSesion(): string | null {
  try {
    const proyecto = new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0];
    const crudo = localStorage.getItem(`sb-${proyecto}-auth-token`);
    if (!crudo) return null;
    const s = JSON.parse(crudo) as { access_token?: string; expires_at?: number };
    if (!s.access_token || !s.expires_at) return null;
    return s.expires_at * 1000 > Date.now() + 30_000 ? s.access_token : null;
  } catch {
    return null;
  }
}

/** Manda un fallo. Se puede llamar desde cualquier sitio y cuantas veces
 *  haga falta: repetidos, ruido y exceso se descartan aqui mismo. */
export function avisarError(e: unknown, origen: Origen = 'error'): void {
  try {
    if (import.meta.env.DEV || !CONFIG.hayBackend()) return;
    if (enviados >= TOPE_POR_VISITA) return;

    const { mensaje, pila } = aTexto(e);
    if (!mensaje || esRuido(mensaje, pila)) return;

    const clave = `${mensaje}|${pila.split('\n')[1] ?? ''}`;
    if (yaAvisados.has(clave)) return;
    yaAvisados.add(clave);
    enviados++;

    const base = CONFIG.SUPABASE_URL.replace(/\/+$/, '');
    void fetch(`${base}/rest/v1/rpc/registrar_error`, {
      method: 'POST',
      /* `keepalive`: si el fallo es justo al salir de la pagina, el aviso
         sale igual en vez de cancelarse con ella. */
      keepalive: true,
      headers: {
        apikey: CONFIG.SUPABASE_KEY,
        authorization: `Bearer ${tokenDeSesion() ?? CONFIG.SUPABASE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_mensaje: mensaje,
        p_pila: pila || null,
        p_donde: window.location.pathname,
        p_origen: origen,
        p_navegador: navigator.userAgent,
      }),
    }).catch(() => {});
  } catch {
    /* Nunca lanza. */
  }
}

let vigilando = false;

/** Escucha los fallos que no atrapa nadie. Una vez, al arrancar. Los que
 *  atrapa `Frontera` los avisa ella: en produccion no llegan hasta aqui. */
export function vigilarErrores(): void {
  if (vigilando || typeof window === 'undefined') return;
  vigilando = true;
  window.addEventListener('error', (ev) => {
    avisarError(ev.error ?? ev.message, 'error');
  });
  window.addEventListener('unhandledrejection', (ev) => {
    avisarError(ev.reason, 'promesa');
  });
}

/** Solo para las pruebas: vuelve a empezar la cuenta de la visita. */
export function _reiniciarParaPruebas(): void {
  enviados = 0;
  yaAvisados.clear();
}
