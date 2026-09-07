/**
 * Las cinco plantillas con las que se empieza un perfil.
 *
 * Antes se empezaba delante de un editor con seis secciones y ciento y pico
 * mandos, y la primera decision que habia que tomar —«¿de que ancho va la
 * tarjeta?»— es justo la que nadie sabe contestar el primer dia. El
 * resultado eran perfiles rotos: cajas al 100% con el nombre partido en
 * cuatro lineas, o bloques colocados a mano que en un movil se montaban
 * unos encima de otros.
 *
 * Una plantilla es una COMPOSICION completa y ya medida: el ancho, los
 * huecos, la forma de la caja y el tamaño de cada bloque. Se elige una y ya
 * no hay nada que ajustar para que se vea bien; lo que se hace despues es
 * ENCENDER los bloques que se quieren, y la plantilla los coloca.
 *
 * Lo que NO son: un motor de maquetacion aparte. Cada plantilla es una
 * combinacion de campos que ya existian en el perfil. Guardar ademas un
 * «modo plantilla» habria creado dos fuentes de verdad para lo mismo; lo
 * unico que se guarda de mas es `base`, el id de la elegida, y solo para
 * saber cual pintar como activa y para no enseñar la bienvenida dos veces.
 */
import type { BlockStyle, Profile } from '@/types';

export interface PlantillaBase {
  id: string;
  nombre: string;
  /** Una linea: para quien es. */
  descripcion: string;
  /** Aspecto de la tarjeta. Solo campos de APARIENCIA: nunca contenido. */
  ajustes: Partial<Profile>;
  /**
   * La caja de cada bloque, ya medida.
   *
   * Se escribe para TODOS los bloques que la plantilla contempla, esten
   * encendidos o no: asi, cuando alguien encienda uno mas tarde, ya sale con
   * su tamaño puesto en vez de aparecer con el de fabrica y desentonar.
   */
  cajas: Record<string, BlockStyle>;
  /** Con que bloques arranca. El resto quedan apagados, no borrados. */
  bloques: string[];
}

/**
 * Lo que toda plantilla fija, quiera o no.
 *
 * Estos campos son la diferencia entre un diseño que aguanta en un telefono
 * y uno que se parte. `stack` deja que los bloques fluyan en columna —el
 * modo libre guarda coordenadas absolutas, y unas coordenadas pensadas para
 * 660px de ancho en una pantalla de 360 se solapan—; `fixed` le da a la
 * vista publica un ancho de DISEÑO del que sacar la escala con la que
 * encoger el conjunto entero; y `pos`, `canvasH` y `sHeightPx` vacios
 * borran cualquier resto de una colocacion a mano anterior.
 *
 * Va aparte y se reparte a las cinco para que no se pueda olvidar en una.
 */
const SEGURO = {
  layoutMode: 'stack',
  widthMode: 'fixed',
  stackPos: 'center',
  sHeightPx: null,
  canvasH: null,
  pos: {},
} as const satisfies Partial<Profile>;

export const PLANTILLAS_BASE: PlantillaBase[] = [
  {
    id: 'clasica',
    nombre: 'Clásica',
    descripcion: 'Tarjeta de cristal centrada. La de toda la vida, y la que mejor le sienta a casi todo.',
    bloques: ['avatar', 'name', 'handle', 'bio', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'glass',
      sWidthPct: 50,          // ≈460px de diseño
      sOpacity: 9,
      sBlur: 22,
      sBorderOn: true,
      sBorderW: 1,
      radius: 18,
      gap: 16,
      pad: null,              // el que calcula el CSS a partir del ancho
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 112,
      blockStyle: 'inherit',
      socialStyle: 'icons',
      badgeStyle: 'plain',
      musicStyle: 'compact',
      iconSize: 20,
    },
    cajas: {},
  },
  {
    id: 'compacta',
    nombre: 'Compacta',
    descripcion: 'Estrecha y apretada, del tamaño de una tarjeta de visita. Para un nombre, dos líneas y tus redes.',
    bloques: ['avatar', 'name', 'handle', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'solid',
      sWidthPct: 36,          // ≈330px: cabe entera en cualquier telefono
      sOpacity: 88,
      sBlur: 0,
      sBorderOn: true,
      sBorderW: 1,
      radius: 20,
      gap: 11,
      pad: 20,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 84,
      blockStyle: 'inherit',
      socialStyle: 'icons',
      badgeStyle: 'icons',
      musicStyle: 'minimal',
      iconSize: 18,
    },
    /* Todo un punto por debajo: en una caja estrecha el nombre de fabrica
       se parte en dos lineas y la biografia se come la tarjeta. */
    cajas: {
      name: { size: 86 },
      handle: { size: 92 },
      bio: { size: 92 },
      meta: { size: 92 },
      socials: { mt: 4 },
      views: { size: 90 },
    },
  },
  {
    id: 'retrato',
    nombre: 'Retrato',
    descripcion: 'La foto a un lado y el texto al otro, alineado a la izquierda. Se lee como una ficha.',
    bloques: ['avatar', 'name', 'handle', 'meta', 'bio', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'glass',
      sWidthPct: 62,          // ≈570px: las dos columnas caben sin montarse
      sOpacity: 10,
      sBlur: 20,
      sBorderOn: true,
      sBorderW: 1,
      radius: 16,
      gap: 13,
      pad: null,
      align: 'left',
      avPos: 'side',
      avShape: 'rounded',
      avSize: 104,
      blockStyle: 'inherit',
      socialStyle: 'icons',
      badgeStyle: 'plain',
      musicStyle: 'compact',
      iconSize: 20,
    },
    /* La cabecera ya va a la izquierda por `align`, pero las piezas que son
       una FILA —redes, insignias, visitas— se colocan con su propia
       variable y se quedaban centradas debajo de un texto que no lo esta. */
    cajas: {
      bio: { align: 'left' },
      meta: { align: 'left' },
      socials: { align: 'left' },
      badges: { align: 'left' },
      views: { align: 'left' },
    },
  },
  {
    id: 'minima',
    nombre: 'Mínima',
    descripcion: 'Sin caja: el nombre y poco más, flotando sobre tu fondo. Cuanto mejor sea la imagen, mejor queda.',
    bloques: ['avatar', 'name', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'none',
      sWidthPct: 46,
      sBorderOn: false,
      radius: 0,
      gap: 20,
      pad: 0,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 96,
      blockStyle: 'transparent',
      socialStyle: 'icons',
      badgeStyle: 'icons',
      musicStyle: 'transparent',
      iconSize: 22,
    },
    /* Sin caja detras, el nombre puede permitirse ser mas grande; y la
       biografia, un punto mas pequeña para no cruzar el fondo entero. */
    cajas: {
      name: { size: 118 },
      bio: { size: 96, mt: 2 },
    },
  },
  {
    id: 'vitrina',
    nombre: 'Vitrina',
    descripcion: 'Ancha, y cada bloque en su propia cajita. Para quien tiene música, Discord, insignias y muchas redes.',
    bloques: ['avatar', 'name', 'handle', 'bio', 'socials', 'badges', 'views'],
    ajustes: {
      ...SEGURO,
      surface: 'glass',
      sWidthPct: 72,          // ≈660px, el tope antes de que se vea vacia
      sOpacity: 8,
      sBlur: 26,
      sBorderOn: true,
      sBorderW: 1,
      radius: 22,
      gap: 12,
      pad: null,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 104,
      blockStyle: 'glass',
      socialStyle: 'boxed',
      badgeStyle: 'boxed',
      musicStyle: 'card',
      iconSize: 20,
    },
    /* Cada bloque con su caja, todas del mismo ancho y el mismo radio: es lo
       que hace que se lean como una rejilla y no como cinco cosas sueltas
       que se quedaron ahi. El ancho es 100 —el de la tarjeta— para que
       ninguna sobresalga de su columna en una pantalla estrecha. */
    cajas: {
      socials: { s: 'glass', w: 100, pad: 14, rad: 14 },
      badges: { s: 'glass', w: 100, pad: 12, rad: 14 },
      music: { s: 'glass', w: 100, pad: 14, rad: 14 },
      discord: { s: 'glass', w: 100, pad: 14, rad: 14 },
      views: { s: 'glass', w: 100, pad: 10, rad: 14, size: 92 },
    },
  },
];

/** Acceso por id, para no recorrer la lista en cada render. */
export const PLANTILLA_BASE_POR_ID: Record<string, PlantillaBase> = Object.fromEntries(
  PLANTILLAS_BASE.map((p) => [p.id, p]),
);

/**
 * Lo que vale el campo `base` cuando el diseño ya no es el de ninguna
 * plantilla: o porque se creo antes de que existieran, o porque su dueño lo
 * ha ido tocando. No es un error ni algo que haya que arreglar; es el estado
 * normal de un perfil trabajado, y sirve para NO plantarle encima una
 * pantalla de bienvenida a quien ya tiene su perfil hecho.
 */
export const BASE_PERSONALIZADA = 'personal';

/** Valores legales del campo `base`. El vacio es «todavia no ha elegido». */
export const BASES_VALIDAS: string[] = [
  '',
  BASE_PERSONALIZADA,
  ...PLANTILLAS_BASE.map((p) => p.id),
];
