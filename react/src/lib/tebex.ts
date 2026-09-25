import { CONFIG } from '@/config';

/**
 * Comprar Premium de por vida con Tebex.
 *
 * Tres pasos, todos desde el navegador y todos con el token PÚBLICO de la
 * tienda, que no deja hacer nada más que esto:
 *
 *   1. crear una cesta, con el perfil que compra en `custom`;
 *   2. meter en ella el paquete de Premium;
 *   3. abrir el pago de Tebex encima de la página.
 *
 * Lo que NO decide esto es si se ha pagado. El evento «payment:complete»
 * de la ventana de Tebex solo sirve para decir «estamos activándolo»: el
 * diamante lo da la base cuando llega el aviso firmado de Tebex a la
 * función `tebex-webhook`. Si lo diera esto, cualquiera se lo daría
 * llamando al evento desde la consola.
 */

const API = 'https://headless.tebex.io/api';
const GUION = 'https://js.tebex.io/v/1.js';

/** ¿Está conectada la tienda? Sin token o sin paquete, no se vende. */
export function hayTienda(): boolean {
  return !!(CONFIG.TEBEX_TOKEN && CONFIG.TEBEX_PAQUETE);
}

interface TebexCheckout {
  init(opciones: Record<string, unknown>): void;
  launch(): void;
  on(evento: string, fn: () => void): void;
}
interface TebexGlobal {
  checkout: TebexCheckout;
}

let cargando: Promise<TebexGlobal> | null = null;
/** Los avisos de la compra abierta ahora mismo. */
let enCurso: AlComprar = {};
let enganchado = false;

/** El guion de Tebex, solo cuando alguien va a comprar: nadie más lo
 *  descarga. Y una sola vez aunque se pulse el botón dos veces. */
function cargarTebex(): Promise<TebexGlobal> {
  const ya = (window as unknown as { Tebex?: TebexGlobal }).Tebex;
  if (ya) return Promise.resolve(ya);
  if (cargando) return cargando;
  cargando = new Promise((resolver, fallar) => {
    const s = document.createElement('script');
    s.src = GUION;
    s.async = true;
    s.onload = () => {
      const t = (window as unknown as { Tebex?: TebexGlobal }).Tebex;
      if (t) resolver(t);
      else fallar(new Error('El pago de Tebex no ha cargado.'));
    };
    s.onerror = () => {
      cargando = null;
      fallar(new Error('No se ha podido cargar el pago. ¿Tienes un bloqueador de anuncios?'));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

async function pedir(url: string, cuerpo: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

export interface AlComprar {
  /** Tebex dice que se ha pagado. Todavía no hay diamante: llega con el
   *  aviso, unos segundos después. */
  alPagar?: () => void;
  /** Se cerró la ventana, pagando o sin pagar. */
  alCerrar?: () => void;
}

/**
 * Abre el pago de Premium para un perfil.
 *
 * `perfilId` es el identificador del perfil en la base: es lo que vuelve
 * en el aviso y dice a quién darle el diamante. Va en la cesta Y en el
 * paquete, porque Tebex promete devolver los dos pero solo documenta el
 * del paquete.
 */
export async function comprarPremium(perfilId: string, usuario: string, eventos: AlComprar = {}): Promise<void> {
  if (!hayTienda()) throw new Error('Premium todavía no está a la venta.');
  const custom = { perfil: perfilId, usuario };
  const origen = window.location.origin;

  const r = await pedir(`${API}/accounts/${CONFIG.TEBEX_TOKEN}/baskets`, {
    complete_url: `${origen}/dashboard?premium=gracias`,
    cancel_url: `${origen}/pricing`,
    complete_auto_redirect: false,
    custom,
  });
  if (!r.ok) throw new Error('No se ha podido empezar la compra. Inténtalo en un momento.');
  const ident: unknown = (await r.json())?.data?.ident;
  if (typeof ident !== 'string' || !ident) throw new Error('Tebex no ha devuelto la cesta.');

  const paquete = { package_id: Number(CONFIG.TEBEX_PAQUETE), quantity: 1, custom };
  /* La documentación de Tebex no deja claro si esta ruta lleva el token
     delante o no: se prueba la corta y, si no existe, la larga. */
  let rp = await pedir(`${API}/baskets/${ident}/packages`, paquete);
  if (rp.status === 404) {
    rp = await pedir(`${API}/accounts/${CONFIG.TEBEX_TOKEN}/baskets/${ident}/packages`, paquete);
  }
  if (!rp.ok) throw new Error('No se ha podido añadir Premium a la compra.');

  const tebex = await cargarTebex();
  tebex.checkout.init({
    ident,
    theme: 'dark',
    locale: 'es_ES',
    colors: [{ name: 'primary', color: '#a855f7' }],
  });
  /* Los avisos se enganchan UNA vez y llaman a los de la compra en curso.
     Engancharlos en cada compra los acumularía: a la tercera, «pagado» se
     dispararía tres veces. */
  enCurso = eventos;
  if (!enganchado) {
    tebex.checkout.on('payment:complete', () => enCurso.alPagar?.());
    tebex.checkout.on('close', () => enCurso.alCerrar?.());
    enganchado = true;
  }
  tebex.checkout.launch();
}
