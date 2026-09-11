/**
 * La luz.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Todos los efectos de antes tienen el mismo techo: son una IMAGEN. Muy
 * trabajada, con capas y ruido, pero una imagen —se ve igual desde donde
 * sea y hagas lo que hagas—. Y el ojo, que lleva toda la vida mirando cosas
 * reales, lo sabe sin poder explicarlo: eso está pintado encima.
 *
 * Lo que separa un dibujo de un MATERIAL es que el material tiene relieve y
 * hay una luz en algún sitio. Si mueves la luz, cambia el brillo. Eso es lo
 * único que hay aquí, y es lo que convierte unas letras en obsidiana o en
 * metal recién sacado del fuego.
 *
 * La luz es UNA para toda la página y vive aquí. No una por nombre: si cada
 * nombre tuviera la suya, dos nombres en la misma pantalla estarían
 * iluminados desde sitios distintos, que es exactamente el detalle que hace
 * que una escena parezca falsa.
 *
 * ────────────────────────────────────────────────────────────────────────
 * EL BUCLE, Y POR QUÉ ESTE SÍ
 * ────────────────────────────────────────────────────────────────────────
 *
 * En este proyecto la norma es no tener bucles de JavaScript si el CSS
 * puede hacerlo. Aquí el CSS no puede: la posición de una `<fePointLight>`
 * es un atributo de SVG, no una propiedad, y no entra en unos fotogramas ni
 * lee una variable. Y la mitad de la gracia —que la luz te siga— no es una
 * animación: es una respuesta.
 *
 * Así que hay un bucle, uno solo para toda la página, y se porta bien:
 *
 *   · no arranca hasta que un efecto se apunta, y para cuando se va el
 *     último;
 *   · para también con la pestaña de fondo;
 *   · va a treinta por segundo, no a sesenta;
 *   · no escribe nada si la luz se ha movido menos de medio píxel;
 *   · con «menos movimiento» no arranca nunca: coloca la luz una vez en un
 *     sitio bonito y se acaba.
 *
 * ────────────────────────────────────────────────────────────────────────
 * SIN RATÓN
 * ────────────────────────────────────────────────────────────────────────
 *
 * En un móvil no hay puntero, y un efecto que sólo vive cuando lo tocas
 * está muerto para la mitad de quien lo mire. Así que la luz tiene ÓRBITA
 * PROPIA: da una vuelta lenta por su cuenta. El puntero no la coloca, la
 * ATRAE; y a los tres segundos y medio sin moverse, ella sigue su camino.
 *
 * El paso de una cosa a la otra no se ve porque la posición va suavizada:
 * la luz nunca salta, siempre persigue.
 */

/** Dónde está la luz, de 0 a 1 dentro de la ventana. */
let objX = 0.5;
let objY = 0.26;
let actX = 0.5;
let actY = 0.26;

let apuntados = 0;
let latido = 0;
let ultimoCuadro = 0;
let ultimoPuntero = -1e9;
/** Lo último que se escribió, para no escribir dos veces lo mismo. */
let escritoX = NaN;
let escritoY = NaN;

const QUIETO =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cuánto tiene que estarse quieto el puntero para que la luz siga sola. */
const PACIENCIA = 3500;

/**
 * De dónde a dónde se mueve la luz dentro del espacio del nombre.
 *
 * Son píxeles del elemento iluminado, con el origen en su esquina superior
 * izquierda. Un filtro compartido no sabe cómo de grande es cada nombre que
 * lo usa, así que el recorrido está pensado para un nombre corriente —entre
 * cien y trescientos de ancho y unos cuarenta de alto— y se sale por los
 * cuatro lados a propósito: una luz que sólo se mueve por DENTRO de las
 * letras nunca las deja a contraluz, y el contraluz es la mitad de lo que
 * hace que se vea el relieve.
 */
const X0 = -50;
const X1 = 290;
const Y0 = -55;
const Y1 = 95;
/**
 * Lo alto que vuela.
 *
 * Con la luz muy baja, al irse a un lado el brillo se sale del nombre y el
 * material se apaga del todo la mitad del recorrido. A sesenta la luz pasa
 * POR ENCIMA: siempre hay algo iluminado y lo que cambia es DÓNDE, que es
 * justo lo que se quiere ver.
 */
const Z = 60;

function luces(): NodeListOf<SVGElement> | null {
  if (typeof document === 'undefined') return null;
  return document.querySelectorAll<SVGElement>('fePointLight[data-fx-luz]');
}

function aplicar(x: number, y: number) {
  const px = X0 + x * (X1 - X0);
  const py = Y0 + y * (Y1 - Y0);
  /* Medio píxel de margen. Sin esto se reescribe el atributo sesenta veces
     por segundo con el mismo número redondeado, y cada escritura obliga al
     navegador a volver a calcular el filtro entero. */
  if (Math.abs(px - escritoX) < 0.5 && Math.abs(py - escritoY) < 0.5) return;
  escritoX = px;
  escritoY = py;

  const ls = luces();
  if (ls) {
    for (const l of ls) {
      l.setAttribute('x', px.toFixed(1));
      l.setAttribute('y', py.toFixed(1));
      l.setAttribute('z', String(Z));
    }
  }
  /* También como variables, para los efectos que no usan un filtro SVG sino
     capas de CSS: el abismo mueve sus planos con esto y así su profundidad
     y el brillo de la obsidiana miran al MISMO sitio. */
  const raiz = document.documentElement.style;
  raiz.setProperty('--fx-lx', x.toFixed(4));
  raiz.setProperty('--fx-ly', y.toFixed(4));
}

function alMover(e: PointerEvent) {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  objX = Math.min(1, Math.max(0, e.clientX / w));
  objY = Math.min(1, Math.max(0, e.clientY / h));
  ultimoPuntero = performance.now();
}

function cuadro(t: number) {
  latido = requestAnimationFrame(cuadro);
  if (t - ultimoCuadro < 33) return;
  ultimoCuadro = t;

  /* Sin puntero reciente, la luz sigue su órbita. Las dos vueltas no duran
     lo mismo —diecinueve segundos y catorce— para que el recorrido no sea
     una elipse que se repite, sino una figura que tarda minutos en cerrar. */
  if (t - ultimoPuntero > PACIENCIA) {
    objX = 0.5 + Math.cos(t / 19000) * 0.42;
    objY = 0.3 + Math.sin(t / 14000) * 0.22;
  }

  /* Persigue, no salta. Es lo que hace que el cambio entre «te sigue» y
     «va sola» no se vea, y además le da peso: la luz parece tener inercia. */
  actX += (objX - actX) * 0.075;
  actY += (objY - actY) * 0.075;
  aplicar(actX, actY);
}

function arrancar() {
  if (latido || typeof window === 'undefined') return;
  window.addEventListener('pointermove', alMover, { passive: true });
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  latido = requestAnimationFrame(cuadro);
}

function parar() {
  if (!latido) return;
  cancelAnimationFrame(latido);
  latido = 0;
  window.removeEventListener('pointermove', alMover);
  document.removeEventListener('visibilitychange', alCambiarVisibilidad);
}

function alCambiarVisibilidad() {
  /* Con la pestaña de fondo el navegador ya frena los `requestAnimationFrame`,
     pero no siempre del todo y no en todos. Parar a mano es una línea. */
  if (document.hidden) {
    cancelAnimationFrame(latido);
    latido = 0;
  } else if (apuntados > 0) {
    latido = requestAnimationFrame(cuadro);
  }
}

/**
 * Apuntarse a la luz. Devuelve la forma de darse de baja.
 *
 * Lo llama cada nombre que use un material iluminado. Mientras haya alguno,
 * la luz se mueve; cuando se va el último, se apaga el bucle.
 */
export function usarLuz(): () => void {
  if (QUIETO) {
    /* Quieta, pero PUESTA. Sin esto la luz se queda en el cero por defecto
       de la `<fePointLight>` —la esquina— y el material sale plano y feo
       justo para quien ha pedido que nada se mueva. */
    aplicar(0.34, 0.2);
    return () => {};
  }
  apuntados += 1;
  if (apuntados === 1) arrancar();
  return () => {
    apuntados -= 1;
    if (apuntados <= 0) {
      apuntados = 0;
      parar();
    }
  };
}
