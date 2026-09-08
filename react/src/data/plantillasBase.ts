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
    descripcion: 'La foto a un lado y el nombre al lado, ancha. La musica y Discord van en su propia cajita.',
    bloques: ['avatar', 'name', 'handle', 'discord', 'socials', 'music', 'views'],
    ajustes: {
      ...SEGURO,
      surface: 'glass',
      sWidthPct: 64,          // ≈589px: la cabecera necesita sitio para dos columnas
      sOpacity: 10,
      sBlur: 26,
      sBorderOn: true,
      sBorderW: 1,
      radius: 26,
      gap: 16,
      pad: 22,
      /* Texto a la izquierda y foto al lado: la cabecera se lee en
         horizontal —foto, nombre, @usuario— en vez de en una columna
         centrada. Es lo unico que distingue de verdad a esta plantilla. */
      align: 'left',
      avPos: 'side',
      avShape: 'circle',
      avSize: 84,
      avBorder: true,
      avGlow: false,
      /* Las cajas de dentro —Discord, la musica— en cristal, pero el
         nombre y las redes sueltos: si TODO lleva caja, la cabecera deja
         de leerse como cabecera y la tarjeta se vuelve una lista. */
      blockStyle: 'glass',
      socialStyle: 'glow',
      glowName: false,
      glowSocials: true,
      badgeStyle: 'icons',
      musicStyle: 'compact',
      iconSize: 26,
      font: 'inter',
      fontDisplay: 'space',
    },
    cajas: {
      /* Los bloques de la cabecera se ciñen al hueco que deja la foto, asi
         que el nombre grande no parte: son dos o tres palabras. */
      name: { size: 108 },
      handle: { size: 104 },
      bio: { align: 'left', size: 95 },
      meta: { align: 'left' },
      badges: { align: 'left' },
      discord: { rad: 16 },
      music: { rad: 16 },
      /* Las redes SI van centradas, aunque el resto vaya a la izquierda:
         son la fila de abajo, y una fila de iconos pegada a un lado deja
         un hueco muerto que se lee como un fallo. */
      socials: { align: 'center', mt: 6 },
      /* Las visitas, pequeñas y al otro extremo: es un dato de servicio,
         no contenido. */
      views: { align: 'right', size: 84 },
    },
  },
  {
    id: 'minima',
    nombre: 'Mínima',
    descripcion: 'Sin caja: la foto, el nombre y poco mas, sueltos sobre tu fondo. Cuanto mejor sea la imagen, mejor queda.',
    bloques: ['avatar', 'name', 'discord', 'socials'],
    ajustes: {
      ...SEGURO,
      surface: 'none',
      sWidthPct: 50,
      sBorderOn: false,
      radius: 0,
      gap: 18,
      pad: 0,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 108,
      avBorder: false,
      avGlow: true,
      /* Las piezas que SI llevan caja —Discord, la musica— se quedan con
         la suya, en cristal. Con `transparent` se disolvian en el fondo:
         sin tarjeta detras que las contenga, un widget sin caja no se lee
         como una pieza, se lee como texto suelto encima de la foto. */
      blockStyle: 'glass',
      socialStyle: 'glow',
      glowName: true,
      glowSocials: true,
      badgeStyle: 'icons',
      musicStyle: 'compact',
      iconSize: 26,
      font: 'inter',
      /* Bold ancha, no una display condensada: el nombre manda por tamaño
         y por peso, y una condensada a este cuerpo se lee como un cartel
         y le quita el sitio a todo lo demas. */
      fontDisplay: 'space',
    },
    cajas: {
      name: { size: 124 },
      bio: { size: 95, mt: 2 },
      /* Mas anchas que su contenido a proposito: pegadas al texto, sin
         tarjeta detras que las sostenga, las cajas se leen como una
         etiqueta suelta en vez de como una pieza del perfil. */
      discord: { w: 70, rad: 18 },
      music: { w: 70, rad: 18 },
      socials: { mt: 4 },
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
