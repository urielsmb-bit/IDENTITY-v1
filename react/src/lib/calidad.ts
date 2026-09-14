/**
 * EL PRESUPUESTO · cuánta calidad visual cabe en esta máquina.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA REGLA
 * ────────────────────────────────────────────────────────────────────────
 *
 * «La máxima calidad visual que quepa dentro del presupuesto de este
 * aparato.» No es lo mismo que «apagar cosas cuando va lento»: apagar es
 * el último recurso, y antes hay tres escalones —menos densidad, menos
 * frecuencia, menos coste por pieza— que no se notan y ahorran mucho.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE FICHERO EXISTE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Había DOS sistemas haciendo esto a la vez y sin hablarse: el `equipo` de
 * `effects.ts` —que clasificaba por núcleos y memoria— y un `fluidez.ts`
 * posterior que medía fotogramas. Dos medidas, dos veredictos, ninguno
 * completo:
 *
 *   · `equipo` medía UNA vez, en el primer segundo, y no volvía a mirar.
 *     Nunca subía: una máquina que empezaba mal se quedaba mal para
 *     siempre, aunque el problema fuera la carga y no la máquina.
 *   · `fluidez` medía mejor pero solo encendía o apagaba: un interruptor
 *     donde hacía falta un mando.
 *   · Y `puede()`, la función que consultaba el presupuesto, solo se
 *     llamaba en DOS sitios de todo el proyecto. Las partículas —lo más
 *     caro que hay— no lo miraban nunca.
 *
 * Aquí se juntan en uno solo, con tres niveles y adaptación continua.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CÓMO SE DECIDE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Se arranca con una CONJETURA a partir de lo que el navegador cuenta de
 * la máquina —núcleos, memoria, si pide menos movimiento—, porque hay que
 * pintar algo antes de haber medido nada.
 *
 * Y a partir de ahí manda la MEDIDA, que es lo único que no miente. Los
 * números del navegador se equivocan en los dos sentidos: hay portátiles
 * de ocho núcleos sin aceleración por hardware que van peor que un móvil
 * de cuatro, y `deviceMemory` ni siquiera existe en Safari.
 *
 * Se mide la MEDIANA del tiempo entre fotogramas, no la media: un tirón
 * suelto —el recolector de basura, otra pestaña— dispara la media y no
 * dice nada de la máquina.
 *
 * Y se compara contra el ritmo REAL de la pantalla, no contra 60. Hay
 * pantallas de 120 Hz y portátiles que bajan a 30 con la batería baja. Lo
 * que importa es perder fotogramas, no un número absoluto.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO CAMBIA A CADA RATO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un sistema que sube y baja la calidad cada segundo es PEOR que uno que
 * se queda fijo en malo: el parpadeo se ve, y además cada cambio cuesta
 * —hay que reconstruir partículas, recalcular estilos—, así que adaptarse
 * demasiado rápido es una forma de gastar rendimiento intentando ahorrarlo.
 *
 * Tres frenos:
 *
 *   · BAJAR es rápido —dos ventanas malas seguidas— porque quien va a
 *     tirones lo está sufriendo AHORA.
 *   · SUBIR es lento —cuatro ventanas buenas seguidas— porque una racha
 *     buena puede ser casualidad, y devolver efectos para quitarlos otra
 *     vez es justo el parpadeo que se quiere evitar.
 *   · Y después de cada cambio hay una espera en la que no se toca nada,
 *     para que se note el efecto del cambio antes de juzgar otra vez.
 */

/** Los tres escalones. Más alto, más calidad. */
export const ALTA = 2;
export const MEDIA = 1;
export const BAJA = 0;

export type Nivel = typeof ALTA | typeof MEDIA | typeof BAJA;

/** Cuántos fotogramas mide cada ventana. A 60 Hz son unos dos segundos. */
const VENTANA = 120;

/**
 * Cuánto se puede tardar, en veces el ritmo de la pantalla, antes de bajar.
 * 1.5 a 60 Hz son 40 fps: a un tercio de fotogramas perdidos ya no se
 * disimula.
 */
const LIMITE_BAJAR = 1.5;

/**
 * Y cuánto hay que ir de sobrado para subir. Más estrecho que el de bajar
 * a propósito: si subir y bajar usaran el mismo número, la calidad
 * oscilaría eternamente alrededor de él.
 */
const LIMITE_SUBIR = 1.15;

/** Ventanas malas seguidas para bajar, y buenas seguidas para subir. */
const PARA_BAJAR = 2;
const PARA_SUBIR = 4;

/** Ventanas de calma tras un cambio, sin volver a juzgar. */
const CALMA = 2;

const CLAVE = 'sharee:calidad';
const CADUCA = 7 * 24 * 60 * 60 * 1000;

function menosMovimiento(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * La conjetura de partida.
 *
 * Solo para tener algo con lo que pintar el primer segundo. En cuanto hay
 * medida, manda la medida.
 */
function conjetura(): Nivel {
  if (menosMovimiento()) return BAJA;
  if (typeof navigator === 'undefined') return MEDIA;

  const nav = navigator as Navigator & { deviceMemory?: number };
  /* Ojo con los valores por defecto: `hardwareConcurrency` no existe en
     algunos navegadores y `deviceMemory` solo está en los de Chromium. Se
     supone gama media, que es el error menos malo en los dos sentidos. */
  const nucleos = nav.hardwareConcurrency || 4;
  const memoria = nav.deviceMemory || 4;

  /* `(update: slow)` es la pantalla, no el procesador: lectores de tinta
     electrónica y similares, donde animar no tiene ningún sentido. */
  const pantallaLenta =
    !!window.matchMedia && window.matchMedia('(update: slow)').matches;

  if (pantallaLenta || nucleos <= 2 || memoria <= 2) return BAJA;
  if (nucleos <= 4 || memoria <= 4) return MEDIA;
  return ALTA;
}

/** Lo que se recuerda de la última visita, para no empezar de cero. */
function recordado(): Nivel | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const v = JSON.parse(crudo) as { nivel?: unknown; cuando?: unknown };
    if (typeof v.nivel !== 'number' || typeof v.cuando !== 'number') return null;
    if (Date.now() - v.cuando > CADUCA) return null;
    if (v.nivel !== ALTA && v.nivel !== MEDIA && v.nivel !== BAJA) return null;
    return v.nivel;
  } catch {
    return null;
  }
}

function recordar(nivel: Nivel) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ nivel, cuando: Date.now() }));
  } catch {
    /* Sin almacén se vuelve a conjeturar en la siguiente visita. */
  }
}

/** Forzado a mano para poder probarlo: `?calidad=alta|media|baja`. */
function forzado(): Nivel | null {
  try {
    const v = new URLSearchParams(location.search).get('calidad');
    if (v === 'alta') return ALTA;
    if (v === 'media') return MEDIA;
    if (v === 'baja') return BAJA;
  } catch {
    /* Una URL rara no debe tumbar el arranque. */
  }
  return null;
}

const NOMBRES: Record<Nivel, string> = { [ALTA]: 'alta', [MEDIA]: 'media', [BAJA]: 'baja' };

let nivelActual: Nivel = MEDIA;
let fijado = false;
const avisos = new Set<(n: Nivel) => void>();

/** El nivel de ahora mismo. */
export function nivel(): Nivel {
  return nivelActual;
}

/** Atajos legibles, que `nivel() >= MEDIA` no se lee solo. */
export function esBaja(): boolean {
  return nivelActual === BAJA;
}
export function esAlta(): boolean {
  return nivelActual === ALTA;
}

/**
 * Cuánto de una cosa contable —partículas, motas de la estela— cabe.
 *
 * Se da como FACTOR y no como número absoluto para que cada efecto decida
 * su propia escala: doscientas estrellas y veinte motas de estela no se
 * recortan igual, y el que sabe cuántas necesita es él, no esto.
 *
 * En baja no es cero: un efecto que desaparece se nota mucho más que uno
 * que adelgaza, y la mitad de las partículas a la mitad de tamaño sigue
 * leyéndose como el mismo efecto.
 */
export function cuantas(alMaximo: number): number {
  if (nivelActual === ALTA) return alMaximo;
  if (nivelActual === MEDIA) return Math.max(1, Math.round(alMaximo * 0.55));
  return Math.max(1, Math.round(alMaximo * 0.28));
}

/**
 * Cada cuántos milisegundos conviene repintar un efecto secundario.
 *
 * No todo necesita ir a la velocidad de la pantalla. Una luz que persigue
 * al puntero a 30 fotogramas por segundo se ve igual de suave que a 60
 * —porque lo que se ve es la inercia, no los fotogramas— y cuesta la
 * mitad. A las partículas de fondo les pasa lo mismo.
 */
export function cadaCuanto(): number {
  if (nivelActual === ALTA) return 0; /* a la velocidad de la pantalla */
  if (nivelActual === MEDIA) return 22; /* ~45 por segundo */
  return 40; /* ~25 por segundo */
}

/** Avisa cuando el nivel cambia. Devuelve cómo dejar de escuchar. */
export function alCambiar(fn: (n: Nivel) => void): () => void {
  avisos.add(fn);
  return () => avisos.delete(fn);
}

function poner(n: Nivel, recordarlo: boolean) {
  if (n === nivelActual) return;
  nivelActual = n;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-calidad', NOMBRES[n]);
  }
  if (recordarlo) recordar(n);
  for (const fn of avisos) {
    try {
      fn(n);
    } catch {
      /* Un efecto que falle al reajustarse no debe frenar a los demás. */
    }
  }
}

/* ---- la medida continua ------------------------------------------------ */

let huecos: number[] = [];
let anterior = 0;
let malas = 0;
let buenas = 0;
let calma = 0;

/**
 * Se le da un fotograma. Lo llama el latido compartido de `effects.ts`, que
 * ya existe y ya está corriendo: medir NO monta un bucle propio.
 *
 * Eso importa más de lo que parece. Un medidor con su propio
 * `requestAnimationFrame` mantendría vivo el latido del navegador aunque no
 * hubiera nada que animar, y sería una tarea de fondo permanente montada
 * justamente para vigilar las tareas de fondo permanentes.
 */
export function unFotograma(ahora: number) {
  if (fijado) return;
  if (anterior) huecos.push(ahora - anterior);
  anterior = ahora;
  if (huecos.length < VENTANA) return;

  /* El más corto dice a cuánto aspira ESTA pantalla; la mediana, cómo va. */
  const corto = Math.min(...huecos);
  const ordenados = huecos.slice().sort((a, b) => a - b);
  const mediana = ordenados[Math.floor(ordenados.length / 2)] ?? 16.7;
  huecos = [];
  anterior = 0;

  /* Entre 6 ms (165 Hz) y 34 ms (30 Hz). Fuera de ahí la medida está rota
     -la pestaña se escondió a medias- y no se juzga con ella. */
  const ritmo = corto >= 6 && corto <= 34 ? corto : 16.7;

  if (calma > 0) {
    calma--;
    return;
  }

  if (mediana > ritmo * LIMITE_BAJAR) {
    malas++;
    buenas = 0;
    if (malas >= PARA_BAJAR && nivelActual > BAJA) {
      poner((nivelActual - 1) as Nivel, true);
      malas = 0;
      calma = CALMA;
    }
  } else if (mediana < ritmo * LIMITE_SUBIR) {
    buenas++;
    malas = 0;
    if (buenas >= PARA_SUBIR && nivelActual < ALTA) {
      poner((nivelActual + 1) as Nivel, true);
      buenas = 0;
      calma = CALMA;
    }
  } else {
    /* En tierra de nadie no se cuenta ni a favor ni en contra: es justo la
       franja donde va bien y no hace falta tocar nada. */
    malas = 0;
    buenas = 0;
  }
}

/** Arranca. Se llama una vez, lo antes posible. */
export function arrancarCalidad() {
  if (typeof document === 'undefined') return;

  const aMano = forzado();
  if (aMano !== null) {
    fijado = true;
    poner(aMano, false);
    /* `poner` no avisa si coincide con el nivel de partida, y aquí hay que
       dejar el atributo puesto sí o sí para que el CSS lo vea. */
    document.documentElement.setAttribute('data-calidad', NOMBRES[aMano]);
    return;
  }

  if (menosMovimiento()) {
    /* Quien pide menos movimiento no está pidiendo una medida: está
       pidiendo que no se mueva nada. No se mide ni se sube nunca. */
    fijado = true;
    poner(BAJA, false);
    document.documentElement.setAttribute('data-calidad', NOMBRES[BAJA]);
    return;
  }

  /* Lo de la última visita evita que quien ya estuvo aquí pague otra vez
     los primeros segundos con la calidad equivocada. Si se equivoca, la
     medida lo corrige en dos ventanas. */
  const inicial = recordado() ?? conjetura();
  nivelActual = inicial === ALTA ? MEDIA : inicial; /* ver abajo */
  /* Se entra UN escalón por debajo de lo que se cree, nunca en alta de
     salida. Arrancar es el momento más caro de la página -se descargan
     imágenes, se resuelven fuentes, React monta el árbol- y encender todos
     los efectos justo ahí es competir con lo único que importa, que es que
     la página aparezca. Si la máquina da para más, cuatro ventanas buenas
     la suben, y para entonces ya no hay nada más compitiendo. */
  document.documentElement.setAttribute('data-calidad', NOMBRES[nivelActual]);
}
