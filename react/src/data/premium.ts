import type { ControlId } from './bloques';
import { FONTS } from './themes';

/**
 * Qué pide el plan y qué no. En un solo sitio.
 *
 * Antes esto no existía como dato: la regla era «todo lo que hay detrás de
 * un engranaje», escrita cuatro veces como `bloqueado={!premium}` sobre un
 * panel entero. Eso tiene dos problemas y los dos se notan.
 *
 * El de producto: un perfil gratis no se podía ni centrar, ni agrandar, ni
 * meter en una caja. Ninguna de esas tres cosas es un lujo — son las que
 * separan un perfil presentable de uno roto — y cobrarlas no convierte a
 * nadie, solo hace que quien no puede pagar se vaya. La versión gratuita
 * tiene que dejar hacer algo de lo que uno se sienta orgulloso; si no, no
 * hay a quién venderle nada.
 *
 * El técnico: la frontera repartida por el código en condiciones sueltas no
 * se puede leer de un vistazo, no se puede probar, y mover una función de
 * lado obliga a buscarla. Aquí es una lista. Mover algo es editar una línea,
 * y la interfaz se entera sola.
 *
 * LA REGLA, en una frase: **gratis es que tu perfil se vea bien; de pago es
 * que se vea tuyo.** Colocar, dimensionar, escribir y colorear son gratis.
 * Brillar, moverse, y las letras raras, no.
 */

// ── Controles de bloque que pide el plan ─────────────────────
/**
 * Son SEIS de los cuarenta y tantos que hay. A propósito.
 *
 * La tentación es cobrar por grupos enteros —«la tipografía es de pago»—
 * porque es más fácil de explicar. Pero un bloque al que no puedes cambiar
 * el tamaño de letra no es un bloque limitado: es uno roto. Lo que se cobra
 * aquí es lo que ADORNA, nunca lo que COMPONE.
 */
export const CONTROLES_PRO: ReadonlySet<ControlId> = new Set<ControlId>([
  /* El resplandor entero: el interruptor, su color y su intensidad. Es el
     efecto más visible del editor y el que más veces se copia de un perfil
     ajeno —«¿cómo hace que le brille el nombre?»—, así que es exactamente
     lo que hay que cobrar. */
  'halo',

  /* Los dos del nombre. Viven solo aquí y solo aquí tienen sentido: un
     barrido de luz recorriendo un párrafo de biografía es ilegible, y un
     degradado en «Desde septiembre de 2026» es ruido. Que sean del nombre
     y de nada más los hace especiales en vez de repetidos. */
  'degradadoNombre',
  'animarNombre',

  /* De la caja, solo lo que brilla. El tipo de caja, el relleno, las
     esquinas, el ancho y el borde son maquetación y van gratis; el
     desenfoque del cristal y el halo de la caja son adorno. */
  'desenfoque',
  'brillo',

  /* Y el del avatar, por lo mismo: su forma, su tamaño, su sitio y su
     borde son gratis; que brille, no. */
  'brilloAvatar',
]);

export function controlEsPro(id: ControlId): boolean {
  return CONTROLES_PRO.has(id);
}

// ── Funciones sueltas, fuera del editor de bloques ───────────
/**
 * Lo que no es un control de bloque pero sí una capacidad.
 *
 * Cada una es una línea del plan y una línea de la página de precios: si
 * algo está aquí, se cobra; si se cobra, está aquí.
 */
export type FuncionPro =
  | 'rejilla'
  | 'fuentesDeco'
  | 'entrada'
  | 'particulas'
  | 'fondoVideo'
  | 'cursorPropio'
  | 'estela'
  | 'tilt';

/** Por qué se cobra cada una, en una frase, para el aviso de la interfaz. */
export const MOTIVO_PRO: Record<FuncionPro, string> = {
  rejilla:
    'Colocar cada pieza donde quieras, arrastrándola. Es la diferencia entre un perfil de plantilla y uno que no tiene nadie más.',
  fuentesDeco: 'Veintisiete letras que no se parecen a las de nadie.',
  entrada: 'Cómo entra tu perfil cuando alguien lo abre.',
  particulas: 'Estrellas, nieve, brasas o Matrix cayendo detrás de todo.',
  fondoVideo: 'Un vídeo de fondo en vez de una imagen.',
  cursorPropio: 'Tu propia imagen como puntero.',
  estela: 'Las motas que el puntero deja al pasar.',
  tilt: 'La tarjeta sigue al ratón, en tres dimensiones.',
};

// ── Las fuentes ──────────────────────────────────────────────
/**
 * Diez de texto gratis, veintisiete decorativas de pago.
 *
 * La división ya estaba en el catálogo (`grupo: 'deco'`) y no había que
 * inventarla: las diez primeras vienen de Google Fonts y son las que hacen
 * legible un perfil; las veintisiete de abajo son woff2 nuestros, pesan un
 * megabyte largo entre todas y son justo las que alguien quiere cuando ve
 * un perfil ajeno y piensa «esa letra».
 *
 * Se marcan una a una dentro del selector en vez de cerrar la tipografía
 * entera. Cerrar el grupo dejaría a un perfil gratis sin poder cambiar el
 * tamaño de su propio nombre, que no es una limitación: es un fallo.
 */
const IDS_DECO: ReadonlySet<string> = new Set(
  FONTS.filter((f) => f.grupo === 'deco').map((f) => f.id),
);

export function fuenteEsPro(id: string): boolean {
  return IDS_DECO.has(id);
}

/** Cuántas hay de cada, para poder decirlo sin contarlas a mano. */
export const CUENTA_FUENTES = {
  libres: FONTS.length - IDS_DECO.size,
  pro: IDS_DECO.size,
};
