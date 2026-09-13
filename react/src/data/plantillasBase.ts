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

/**
 * Todo lo que NO es una posicion, apagado.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE EXISTE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Las plantillas traian apariencia ademas de composicion: cristal
 * esmerilado, halo en el nombre, borde brillante en el avatar, iconos
 * encendidos, tipografias decorativas. Y el perfil en blanco traia lo
 * mismo, mas particulas de estrellas y el tema `cyberpunk`, que tiñe las
 * superficies de cian.
 *
 * El resultado se vio en una persona de verdad: pregunto como se quitaba
 * el color azul verdoso del bloque de musica, y no encontraba el mando
 * porque nunca lo habia puesto. Y no lo habria encontrado: ese tinte sale
 * de `--p-surface` del tema, y el unico color que se puede cambiar desde
 * el editor es el acento, que pisa otra variable.
 *
 * Una plantilla de arranque tiene que decir DONDE van las cosas. Como se
 * ven lo decide su dueño, y para decidirlo hace falta partir de nada — no
 * de un diseño ajeno que hay que ir desarmando a ciegas.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y POR QUE VA AQUI Y NO SOLO EN EL PERFIL EN BLANCO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Una plantilla se aplica ENCIMA de lo que ya hay. Si solo se quitan los
 * brillos de las plantillas pero no se apagan, quien venga de un diseño
 * anterior se los queda puestos y la plantilla nueva sale contaminada con
 * restos de la vieja. Por eso esto se reparte a todas: cada una deja el
 * aspecto en cero y encima pone SU composicion.
 *
 * `createBlankProfile` usa esta misma constante. Son el mismo «estado de
 * fabrica» y tienen que seguir siendolo: dos listas separadas se
 * separarian mas cada mes.
 */
export const APARIENCIA_APAGADA = {
  /* El tema: el base. Sus superficies son blanco con alfa, sin tinte de
     color, asi que ningun bloque nace con un color que nadie eligio. */
  theme: 'dark',

  /* La tarjeta: solida y lisa. Ni cristal, ni desenfoque, ni borde. */
  surface: 'solid',
  sOpacity: null,
  /* Cero y no nulo: estos dos no admiten vacio, y el cero ES su apagado
     —sin desenfoque y sin grosor de borde—. */
  sBlur: 0,
  sBorderOn: false,
  sBorderW: 0,
  sColor: '',
  sBorderColor: '',

  /* Los bloques heredan la tarjeta en vez de traer su propio material. */
  blockStyle: 'inherit',

  /* El avatar: sin borde y sin halo. */
  avBorder: false,
  avGlow: false,

  /* Iconos y bloques, en su version lisa. */
  socialStyle: 'icons',
  badgeStyle: 'plain',
  musicStyle: 'compact',
  monoIcons: false,

  /* Nada encendido: ni halos, ni degradado, ni efecto en el nombre. */
  glowName: false,
  glowSocials: false,
  gradient: false,
  nameFx: 'none',

  /* Ni particulas ni inclinacion: dos cosas que se mueven solas y que
     nadie pidio. Las particulas ademas son de pago, asi que arrancaban
     encendidas para quien no puede apagarlas al vencer su prueba. */
  particles: 'none',
  tilt: false,

  /* Tipografia neutra. `space` y `display` —Space Grotesk y Anton— son
     decisiones de diseño, no un punto de partida. */
  font: 'inter',
  fontDisplay: 'inter',

  /* Y los que se cuelan por ser «pequeños»: el halo de las insignias, el
     ruido de la tarjeta, el latido del avatar. Cada uno por separado no
     parece nada; juntos son un perfil que llega decorado de fabrica y en
     el que hay que ir apagando cosas de una en una para llegar a cero. */
  glowBadges: false,
  noise: false,
  avatarFx: 'none',
} as const satisfies Partial<Profile>;

export const PLANTILLAS_BASE: PlantillaBase[] = [
  {
    id: 'clasica',
    nombre: 'Columna',
    descripcion: 'Una columna estrecha y centrada: la foto arriba y todo lo demás debajo, en fila.',
    bloques: ['avatar', 'name', 'handle', 'bio', 'socials'],
    ajustes: {
      ...SEGURO,
      ...APARIENCIA_APAGADA,
      sWidthPct: 46,  // y por eso el desenfoque tiene que ser fuerte
      radius: 22,
      gap: 13,
      pad: null,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 104,
      iconSize: 22,
    },
    cajas: {
      name: { size: 108 },
      handle: { size: 92 },
      bio: { size: 95, mt: 2 },
    },
  },
  {
    id: 'compacta',
    nombre: 'Estrecha',
    descripcion: 'La más angosta, con los bloques muy juntos. Del tamaño de una tarjeta de visita.',
    bloques: ['avatar', 'name', 'handle', 'socials'],
    ajustes: {
      ...SEGURO,
      ...APARIENCIA_APAGADA,
      sWidthPct: 34,  // ≈313px: cabe entera en cualquier telefono
      radius: 24,
      gap: 9,
      pad: 18,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 76,
      iconSize: 17,
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
    descripcion: 'La foto a un lado y el nombre junto a ella, alineado a la izquierda. Ancha.',
    bloques: ['avatar', 'name', 'handle', 'discord', 'socials', 'music', 'views'],
    ajustes: {
      ...SEGURO,
      ...APARIENCIA_APAGADA,
      sWidthPct: 64,  // ≈589px: la cabecera necesita sitio para dos columnas
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
      iconSize: 26,
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
    nombre: 'Sin caja',
    descripcion: 'Sin tarjeta: la foto, el nombre y poco más, sueltos sobre tu fondo.',
    bloques: ['avatar', 'name', 'discord', 'socials'],
    ajustes: {
      ...SEGURO,
      ...APARIENCIA_APAGADA,
      /* La unica de las cinco que toca `surface`, y no es una excepcion a
         la regla: que HAYA o no tarjeta es una decision de composicion, y
         sin ella esta plantilla deja de ser lo que es. Lo que no se toca
         es de que esta hecha —cristal, brillo, contorno—, que si es
         apariencia. */
      surface: 'none',
      sWidthPct: 50,
      radius: 0,
      gap: 18,
      pad: 0,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 108,
      iconSize: 26,
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
    nombre: 'Ancha',
    descripcion: 'La más ancha, con sitio de sobra para música, Discord, insignias y muchas redes.',
    bloques: ['avatar', 'name', 'handle', 'bio', 'socials', 'badges', 'views'],
    ajustes: {
      ...SEGURO,
      ...APARIENCIA_APAGADA,
      sWidthPct: 70,  // ≈645px, dentro del tope seguro de movil
      radius: 20,
      gap: 10,
      pad: null,
      align: 'center',
      avPos: 'center',
      avShape: 'circle',
      avSize: 96,
      iconSize: 20,
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
