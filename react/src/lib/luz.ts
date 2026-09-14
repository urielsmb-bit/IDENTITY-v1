import { cadaCuanto, esBaja } from './calidad';

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
/** El temporizador de la espera entre pasos, si lo hay. */
let dormido = 0;
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
  /* Y si se habia dormido, se la despierta. Sin esto, mover el raton
     actualizaria el objetivo y no lo pintaria nadie: la luz se quedaria
     clavada para siempre en cuanto parara una vez. */
  if (!latido && !dormido && apuntados > 0 && !QUIETO) latido = requestAnimationFrame(cuadro);
}

/**
 * Cuánto se puede quedar quieta antes de dormirse, en milisegundos.
 *
 * La luz persigue su objetivo con inercia -un 7,5 % de lo que le falta en
 * cada paso- así que nunca llega del todo: matemáticamente sigue
 * acercándose para siempre. Ese «para siempre» era literal, y por eso este
 * bucle no se dormía nunca.
 *
 * Por debajo de una diezmilésima de pantalla el movimiento ya no existe:
 * en un monitor de 2000 px son 0,2 px. Ahí se para, y el puntero la
 * despierta.
 */
const QUIETA = 0.0001;

/**
 * Cada cuánto se recalcula, en milisegundos.
 *
 * Nunca más de treinta veces por segundo: lo que el ojo lee aquí es la
 * INERCIA -la luz parece pesar- y eso no mejora con más fotogramas. En
 * calidad baja se espacia todavía más, porque el presupuesto manda.
 */
function paso(): number {
  return Math.max(33, cadaCuanto());
}

/**
 * Si la luz sigue dando vueltas sola cuando nadie toca el ratón.
 *
 * Es ambiente, y es bonito, pero también es la definición de tarea de
 * fondo permanente: sin esto el bucle no se para NUNCA. En una máquina que
 * va justa, ese gasto continuo se lo está quitando a lo que la persona sí
 * está mirando. En alta y media se queda; en baja la luz se para donde
 * esté y el puntero la vuelve a despertar.
 */
function puedeOrbitar(): boolean {
  return !esBaja();
}

function cuadro(t: number) {
  /* Pedir el siguiente fotograma LO PRIMERO -como estaba- convertía esto en
     un bucle permanente a 60 Hz que trabajaba a 30: despertaba al navegador
     sesenta veces por segundo para no hacer nada en la mitad, y no paraba
     jamás aunque nadie tocara el ratón y la luz llevara minutos quieta.
     Ahora el siguiente fotograma se pide al final, y solo si queda algo que
     mover. */
  const falta = paso() - (t - ultimoCuadro);
  if (falta > 0) {
    /* Igual que en las particulas: se espera lo que falta en vez de pedir
       otro fotograma para descartarlo. A treinta por segundo en una
       pantalla de sesenta, eso es la mitad de los despertares. */
    latido = 0;
    dormido = window.setTimeout(() => {
      dormido = 0;
      latido = requestAnimationFrame(cuadro);
    }, Math.max(1, falta));
    return;
  }
  ultimoCuadro = t;

  /* Sin puntero reciente, la luz sigue su órbita. Las dos vueltas no duran
     lo mismo —diecinueve segundos y catorce— para que el recorrido no sea
     una elipse que se repite, sino una figura que tarda minutos en cerrar. */
  if (t - ultimoPuntero > PACIENCIA && puedeOrbitar()) {
    objX = 0.5 + Math.cos(t / 19000) * 0.42;
    objY = 0.3 + Math.sin(t / 14000) * 0.22;
  }

  /* Persigue, no salta. Es lo que hace que el cambio entre «te sigue» y
     «va sola» no se vea, y además le da peso: la luz parece tener inercia. */
  const dx = objX - actX;
  const dy = objY - actY;
  actX += dx * 0.075;
  actY += dy * 0.075;
  aplicar(actX, actY);

  /* ¿Queda algo que hacer? Solo si la luz aún se está moviendo hacia algún
     sitio, o si el puntero está reciente y puede volver a moverla. Si no,
     se para: la despierta `alMover`. */
  const enMovimiento = Math.abs(dx) > QUIETA || Math.abs(dy) > QUIETA;
  const orbitando = t - ultimoPuntero > PACIENCIA && puedeOrbitar();
  if (enMovimiento || orbitando) latido = requestAnimationFrame(cuadro);
  else latido = 0;
}

function arrancar() {
  if (latido || typeof window === 'undefined') return;
  window.addEventListener('pointermove', alMover, { passive: true });
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  latido = requestAnimationFrame(cuadro);
}

function parar() {
  if (dormido) { clearTimeout(dormido); dormido = 0; }
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
