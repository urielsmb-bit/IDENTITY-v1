
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

/**
 * DÓNDE SE ESCRIBEN `--fx-lx` Y `--fx-ly`, Y POR QUÉ IMPORTA TANTO.
 *
 * Esto se escribía en `document.documentElement`. Medido en el perfil
 * publicado, con 227 nodos:
 *
 *     escribir una propiedad NORMAL en el root ....... 0,1 ms
 *     escribir una CUSTOM PROPERTY en el root ....... 4,6 ms
 *     la misma custom property en `.fxn` ............ 0,0 ms
 *
 * Cincuenta veces más cara, y —esto es lo que lo explica— cuesta
 * exactamente lo mismo con una propiedad que NO USA NADIE. No es
 * recalcular a quién afecta: es que una custom property en el root
 * invalida el mapa de herencia del documento ENTERO, y el navegador tiene
 * que reconstruirlo nodo a nodo.
 *
 * A treinta pasos por segundo eso son 138 ms de cada segundo gastados en
 * contabilidad de herencia, sin pintar un solo píxel de más. Con la
 * aceleración por hardware apagada, que es cuando el presupuesto de
 * fotograma ya va justo, es la diferencia entre ir fino y dar tirones al
 * mover el ratón.
 *
 * Así que se escribe en la portadora de cada efecto —el `<span class="fxn">`,
 * que es de quien cuelga el `.fxn__c` que las lee— y no en el documento.
 * Son siete nodos en vez de doscientos veintisiete.
 */
const portadoras = new Set<HTMLElement>();

/**
 * Las `<fePointLight>` del documento, recordadas.
 *
 * `querySelectorAll` recorre el árbol entero, y esto se llamaba en cada
 * paso: treinta recorridos por segundo para encontrar los mismos seis
 * elementos, que solo cambian cuando un nombre entra o sale.
 */
let lucesCache: SVGElement[] | null = null;

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

function luces(): SVGElement[] | null {
  if (typeof document === 'undefined') return null;
  if (!lucesCache) {
    lucesCache = Array.from(
      document.querySelectorAll<SVGElement>('fePointLight[data-fx-luz]'),
    );
  }
  return lucesCache;
}

function escribirEn(el: HTMLElement, x: number, y: number) {
  el.style.setProperty('--fx-lx', x.toFixed(4));
  el.style.setProperty('--fx-ly', y.toFixed(4));
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
     y el brillo de la obsidiana miran al MISMO sitio.

     En la portadora de cada efecto, NO en el documento: ver `portadoras`. */
  if (portadoras.size) {
    for (const el of portadoras) escribirEn(el, x, y);
  } else {
    /* Sin portadora registrada no hay a quién escribirle, y dejarlo sin
       escribir apagaría el efecto. Pasa con quien llame a `usarLuz()` sin
       elemento, que es lo que hacía todo el mundo antes. */
    escribirEn(document.documentElement, x, y);
  }
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
/**
 * EL RITMO SE CALIBRA SOLO, Y POR ESO NO HAY ESCALONES.
 *
 * Aquí hubo un escalón fijo —treinta pasos por segundo en calidad alta,
 * dieciocho en media— y se quitó con razón: «una luz que persigue al ratón
 * a saltos se nota». Un número decidido de antemano se equivoca en las dos
 * direcciones, porque adivina la máquina en vez de mirarla.
 *
 * Lo que cuesta de verdad no es este bucle: es lo que dispara. Los tres
 * materiales iluminados son cadenas de filtro SVG que Chrome calcula en la
 * CPU píxel a píxel, y mover la luz obliga a rehacer la cadena entera.
 * Medido, con la misma medida que tiene un nombre en pantalla:
 *
 *     sin filtro ...................................  0,8 ms
 *     turbulencia + desplazamiento .................  6,2 ms
 *     + iluminación difusa .........................  6,1 ms
 *     + iluminación especular ...................... 11,5 ms
 *     las dos juntas, que es lo que hay ............ 18,6 ms
 *
 * Dieciocho coma seis milisegundos no caben en los dieciséis coma siete de
 * un fotograma a sesenta. En una máquina con aceleración por hardware el
 * resto de la página va por otro camino y no se nota; sin ella, cada paso
 * de luz se come el fotograma entero y lo que se ve es el tirón.
 *
 * Así que en vez de elegir un número, se mide si la máquina LLEGA. El
 * intervalo real entre pasos dice la verdad sin tener que atribuirla a
 * nadie: si se pidieron 33 ms y llegan 33, todo bien; si llegan 55, es que
 * pintar lo que hay cuesta más de lo que cabe, y apretar más solo hace
 * cola.
 *
 * En una máquina que llega esto devuelve 33 siempre y NO CAMBIA NADA: el
 * aspecto es exactamente el de antes. En una que no llega, la luz se
 * espacia hasta donde esa máquina pueda sostenerla, que es justo lo que se
 * pidió —fluidez por encima de efectos caros— y lo contrario de dar
 * tirones.
 */
const PASO_MIN = 33;
const PASO_MAX = 100;
/** Lo que de verdad han tardado los últimos pasos. */
let retrasos: number[] = [];
let pasoActual = PASO_MIN;
/** El instante del paso anterior, para que la persecución vaya por tiempo. */
let anteriorCuadro = 0;

/**
 * Qué hueco pedir la próxima vez, visto lo que tardó la anterior.
 *
 * Aparte y exportada porque es la única parte de todo esto que se puede
 * comprobar sin un navegador: el resto necesita `requestAnimationFrame`, y
 * un bucle que solo corre cuando la pestaña está delante no se prueba.
 */
export function siguientePaso(mediana: number, actual: number): number {
  /* Un margen del 35 %: por debajo de eso es ruido del propio navegador y
     no un problema de la máquina. */
  if (mediana > actual * 1.35) {
    return Math.min(PASO_MAX, Math.round(actual * 1.3));
  }
  if (mediana < actual * 1.1 && actual > PASO_MIN) {
    /* Y se vuelve, porque la causa puede irse: otra pestaña que soltó la
       CPU, una ventana que se hizo pequeña, un vídeo que acabó. */
    return Math.max(PASO_MIN, Math.round(actual / 1.2));
  }
  return actual;
}

function anotarRitmo(real: number) {
  /* El primero tras despertar no cuenta: viene de estar dormida y mide la
     siesta, no lo que cuesta pintar. */
  if (real > PASO_MAX * 4) return;
  retrasos.push(real);
  if (retrasos.length < 8) return;

  const ord = [...retrasos].sort((a, b) => a - b);
  retrasos = [];
  pasoActual = siguientePaso(ord[Math.floor(ord.length / 2)]!, pasoActual);
}

function paso(): number {
  return pasoActual;
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
  return true;
}

function cuadro(t: number) {
  /* Si el presupuesto se ha caido al suelo con la pagina ya abierta, la luz
     se para donde este. Se mira aqui y no solo al apuntarse porque el nivel
     se decide midiendo, o sea despues. */
  /* Ya no hay nivel en el que la luz se quede quieta. */

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
  /* Lo que ha tardado DE VERDAD este paso. Si sale mucho mayor que lo que
     se pidió, es que pintar lo que hay encima —la cadena de filtro— no cabe
     en ese hueco, y `anotarRitmo` ensancha el siguiente. */
  if (ultimoCuadro) anotarRitmo(t - ultimoCuadro);
  ultimoCuadro = t;

  /* Sin puntero reciente, la luz sigue su órbita. Las dos vueltas no duran
     lo mismo —diecinueve segundos y catorce— para que el recorrido no sea
     una elipse que se repite, sino una figura que tarda minutos en cerrar. */
  if (t - ultimoPuntero > PACIENCIA && puedeOrbitar()) {
    objX = 0.5 + Math.cos(t / 19000) * 0.42;
    objY = 0.3 + Math.sin(t / 14000) * 0.22;
  }

  /* Persigue, no salta. Es lo que hace que el cambio entre «te sigue» y
     «va sola» no se vea, y además le da peso: la luz parece tener inercia.

     EL 7,5 % ES POR CADA 33 ms, NO POR PASO. Escrito como estaba —un tanto
     por ciento fijo cada vez que pasa por aquí— la luz tarda el triple en
     llegar si los pasos se espacian el triple, y entonces sí se nota: se
     queda atrás del ratón. Convertido a tiempo, la luz recorre el mismo
     camino en los mismos milisegundos dé los pasos que dé, que es lo que
     mantiene el movimiento igual en una máquina que aprieta y en una que
     no. */
  const dt = Math.min(PASO_MAX * 2, Math.max(1, t - (anteriorCuadro || t - PASO_MIN)));
  anteriorCuadro = t;
  const k = 1 - Math.pow(1 - 0.075, dt / PASO_MIN);
  const dx = objX - actX;
  const dy = objY - actY;
  actX += dx * k;
  actY += dy * k;
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
  /* Las medidas a medias no valen para el siguiente arranque: entre una vez
     y otra puede haber pasado cualquier cosa. El ritmo aprendido sí se
     queda, que la máquina es la misma. */
  retrasos = [];
  anteriorCuadro = 0;
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
export function usarLuz(portadora?: HTMLElement | null): () => void {
  /**
   * Con «menos movimiento» o con el presupuesto en el suelo, la luz se
   * COLOCA y no se mueve nunca más.
   *
   * Y esto no es un ahorro pequeño escondido en uno grande: es el ahorro
   * grande. Los efectos de nombre son cadenas de filtro SVG —turbulencia,
   * desplazamiento, iluminación difusa y especular, desenfoque: 57
   * primitivas entre todos— y Chrome NO las acelera por tarjeta gráfica,
   * las calcula la CPU píxel a píxel.
   *
   * Mientras la luz se mueve, esa cadena entera se vuelve a calcular en
   * cada paso: treinta veces por segundo. Quieta, se calcula UNA vez y el
   * navegador se la guarda.
   *
   * Lo que se pierde: que el brillo te siga. Lo que se queda: el relieve,
   * que es lo que hace que unas letras parezcan hielo o metal en vez de
   * texto pintado. La diferencia entre las dos cosas es enorme, y no es la
   * que se pierde.
   */
  /* La lista de `<fePointLight>` cambia cuando entra o sale un nombre, que
     es exactamente aquí. Se olvida lo recordado y se vuelve a buscar en el
     siguiente paso. */
  lucesCache = null;
  if (portadora) {
    portadoras.add(portadora);
    /* Y se le pone YA la posición de ahora. El bucle solo escribe cuando la
       luz se mueve medio píxel, así que un nombre que aparece con la luz
       parada —o mucho después de que se durmiera— se quedaría sin variables
       hasta que alguien moviera el ratón, con el efecto a medio pintar. */
    escribirEn(portadora, actX, actY);
  }

  if (QUIETO) {
    /* Quieta, pero PUESTA. Sin esto la luz se queda en el cero por defecto
       de la `<fePointLight>` —la esquina— y el material sale plano y feo
       justo para quien ha pedido que nada se mueva. */
    escritoX = escritoY = NaN;
    aplicar(0.34, 0.2);
    return () => {
      if (portadora) portadoras.delete(portadora);
      lucesCache = null;
    };
  }
  apuntados += 1;
  if (apuntados === 1) arrancar();
  return () => {
    if (portadora) portadoras.delete(portadora);
    lucesCache = null;
    apuntados -= 1;
    if (apuntados <= 0) {
      apuntados = 0;
      parar();
    }
  };
}
