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
    nombre: 'Cristal',
    descripcion: 'Cristal esmerilado, nombre con halo y los iconos encendidos. La que más brilla.',
    bloques: ['avatar', 'name', 'handle', 'bio', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'glass',
      sWidthPct: 46,          // ≈420px: estrecha, como las de guns
      sOpacity: 7,            // casi transparente: manda el fondo
      sBlur: 30,              // y por eso el desenfoque tiene que ser fuerte
      sBorderOn: true,
      sBorderW: 1,
      radius: 22,
      gap: 13,
      pad: null,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 104,
      avBorder: true,
      avGlow: true,
      blockStyle: 'inherit',
      /* Los iconos encendidos, no planos: es lo que hace que una tarjeta
         oscura no se vea apagada. */
      socialStyle: 'glow',
      glowName: true,
      glowSocials: true,
      badgeStyle: 'icons',
      musicStyle: 'compact',
      iconSize: 22,
      font: 'inter',
      fontDisplay: 'space',
    },
    cajas: {
      name: { size: 108 },
      handle: { size: 92 },
      bio: { size: 95, mt: 2 },
    },
  },
  {
    id: 'compacta',
    nombre: 'Sobria',
    descripcion: 'Sólida, estrecha y sin un solo brillo. Todo en gris, del tamaño de una tarjeta de visita.',
    bloques: ['avatar', 'name', 'handle', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'solid',
      sWidthPct: 34,          // ≈313px: cabe entera en cualquier telefono
      sOpacity: 90,
      sBlur: 0,
      sBorderOn: true,
      sBorderW: 1,
      radius: 24,
      gap: 9,
      pad: 18,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 76,
      avBorder: false,
      avGlow: false,
      blockStyle: 'inherit',
      /* Ni halos ni color de marca: esta plantilla es la contraria de
         «Cristal» a proposito, para que elegir signifique algo. */
      socialStyle: 'icons',
      monoIcons: true,
      glowName: false,
      glowSocials: false,
      badgeStyle: 'icons',
      musicStyle: 'minimal',
      iconSize: 17,
      font: 'inter',
      fontDisplay: 'inter',
    },
    cajas: {
      name: { size: 84 },
      handle: { size: 88 },
      bio: { size: 90 },
      meta: { size: 90 },
      views: { size: 88 },
      socials: { mt: 4 },
    },
  },
  {
    id: 'retrato',
    nombre: 'Ficha',
    descripcion: 'La foto a un lado y el texto al otro, en serif. Se lee como la ficha de un libro.',
    bloques: ['avatar', 'name', 'handle', 'meta', 'bio', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'glass',
      sWidthPct: 62,          // ≈570px: las dos columnas caben sin montarse
      sOpacity: 11,
      sBlur: 18,
      sBorderOn: true,
      sBorderW: 1,
      radius: 12,             // esquinas casi rectas: mas documento que app
      gap: 12,
      pad: null,
      align: 'left',
      avPos: 'side',
      avShape: 'rounded',
      avSize: 100,
      avBorder: false,
      avGlow: false,
      blockStyle: 'inherit',
      socialStyle: 'icons',
      glowName: false,
      glowSocials: false,
      badgeStyle: 'plain',
      musicStyle: 'compact',
      iconSize: 19,
      font: 'manrope',
      /* Serif solo en el nombre. Es lo unico que hace que esto se lea como
         una ficha y no como otra tarjeta mas. */
      fontDisplay: 'serif',
    },
    cajas: {
      bio: { align: 'left' },
      meta: { align: 'left' },
      socials: { align: 'left' },
      badges: { align: 'left' },
      views: { align: 'left' },
      name: { size: 96 },
    },
  },
  {
    id: 'minima',
    nombre: 'Mínima',
    descripcion: 'Sin caja: el nombre enorme flotando sobre tu fondo. Cuanto mejor sea la imagen, mejor queda.',
    bloques: ['avatar', 'name', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'none',
      sWidthPct: 50,
      sBorderOn: false,
      radius: 0,
      gap: 22,
      pad: 0,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 88,
      avBorder: false,
      avGlow: true,
      blockStyle: 'transparent',
      socialStyle: 'icons',
      glowName: true,
      glowSocials: true,
      badgeStyle: 'icons',
      musicStyle: 'transparent',
      iconSize: 25,
      font: 'inter',
      /* Anton. Sin caja detras, el nombre ES la composicion: con una
         tipografia de texto normal esto se queda en un perfil desnudo en
         vez de en una portada. */
      fontDisplay: 'display',
    },
    cajas: {
      name: { size: 145 },
      bio: { size: 95, mt: 2 },
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
      sWidthPct: 70,          // ≈645px, dentro del tope seguro de movil
      sOpacity: 8,
      sBlur: 24,
      sBorderOn: true,
      sBorderW: 1,
      radius: 20,
      gap: 10,
      pad: null,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 96,
      avBorder: true,
      avGlow: false,
      blockStyle: 'glass',
      socialStyle: 'boxed',
      glowName: false,
      glowSocials: false,
      badgeStyle: 'boxed',
      musicStyle: 'card',
      iconSize: 20,
      font: 'inter',
      fontDisplay: 'space',
    },
    /* Cada bloque con su caja, todas del mismo ancho y el mismo radio: es
       lo que hace que se lean como una rejilla y no como cinco cosas
       sueltas. El ancho es 100 —el de la tarjeta— para que ninguna
       sobresalga en una pantalla estrecha. */
    cajas: {
      name: { size: 96 },
      bio: { s: 'glass', w: 100, pad: 12, rad: 12, size: 92 },
      socials: { s: 'glass', w: 100, pad: 13, rad: 12 },
      badges: { s: 'glass', w: 100, pad: 11, rad: 12 },
      music: { s: 'glass', w: 100, pad: 13, rad: 12 },
      discord: { s: 'glass', w: 100, pad: 13, rad: 12 },
      views: { s: 'glass', w: 100, pad: 9, rad: 12, size: 90 },
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
