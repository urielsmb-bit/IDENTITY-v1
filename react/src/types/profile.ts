export interface SocialLink {
  net: string;
  url: string;
  label: string;
  /** Solo para `net: 'custom'`: id de la red cuyo glifo se toma prestado,
   *  o un emoji. Vacio = el icono generico de enlace. */
  icon?: string;
}

export interface LinkItem {
  title: string;
  url: string;
  desc: string;
  icon: string;
}

export interface ProjectItem {
  title: string;
  desc: string;
  url: string;
  tag: string;
  img: string;
}

export interface GalleryItem {
  url: string;
  alt: string;
  caption: string;
}

export interface BlockPos {
  col: number;
  span: number;
  align: 'stretch' | 'start' | 'center' | 'end';
  /** Lienzo libre. Donde se suelta, se queda: no hay reflujo ni "se va
   *  donde cabe", y puede solaparse con otra pieza.
   *
   *  `x` y `w` van en % del ancho de la caja, para que el diseño acompañe
   *  al ancho de la tarjeta. `y` va en PÍXELES: el alto del lienzo no es
   *  fijo, así que un % de él se desplazaba en cuanto el lienzo cambiaba
   *  de altura. */
  x?: number;
  y?: number;
  w?: number;
}

export interface BlockStyle {
  s?: string;
  /** Tipo de animacion de entrada. '' = la del perfil, 'none' = ninguna. */
  anim?: string;
  /** De donde entra: up | down | left | right */
  animDir?: string;
  /** Duracion en ms (100..3000) */
  animMs?: number | null;
  /** Retraso en ms (0..3000) */
  animDelay?: number | null;
  /** Cuanto se nota, en % (0..200). 100 = el valor de referencia. */
  animI?: number | null;
  /** Curva: id de ANIM_EASINGS */
  animE?: string;
  font?: string;
  color?: string;
  halo?: string;
  /** Intensidad del resplandor en %. 100 = el de siempre; 0 lo apaga. */
  hi?: number | null;
  /** Caja del texto: none | uppercase | lowercase | capitalize */
  case?: string;
  /** Espaciado entre letras, en centésimas de em (-20..60) */
  lsp?: number | null;
  /** Tamaño del texto como porcentaje de su tamaño de diseño (50..250) */
  size?: number | null;
  /** Alineación propia de la pieza: left | center | right */
  align?: string;
  /** Margen superior en px, para separar la pieza de la anterior */
  mt?: number | null;
  w?: number | null;
  pad?: number | null;
  rad?: number | null;
  op?: number | null;
  bd?: number | null;
  blur?: number | null;
  glow?: number | null;
  /** Color del relleno de la caja. Vacio = el del tema. */
  scolor?: string;
  /** Color del borde de la caja. Vacio = el del tema. */
  bdcolor?: string;
  /** Grosor del borde en px. */
  bdw?: number | null;
}

export interface AudioTrack {
  title: string;
  artist: string;
  length: string;
  cover: string;
  src: 'manual' | 'youtube' | 'spotify';
  yt: string;
  preview: string;
  url: string;
  embed: string;
}

export interface ProfileAudio {
  provider: string;
  src: 'manual' | 'youtube' | 'spotify';
  title: string;
  artist: string;
  cover: string;
  yt: string;
  ytUrl: string;
  tracks: AudioTrack[];
}

export interface Profile {
  /* sharee */
  username: string;
  name: string;
  title: string;
  location: string;
  pronouns: string;
  emoji: string;
  age: number | null;
  avatarUrl: string;
  bio: string;
  about: string;
  joined: string;

  /* appearance */
  theme: string;
  accent: string;
  colText: string;
  colBg: string;
  colIcon: string;
  align: string;
  surface: string;
  avShape: string;
  /** Posición del avatar: left | center | right | side */
  avPos: string;
  avatarFx: string;
  socialStyle: string;
  musicStyle: string;
  badgeStyle: string;
  blockStyle: string;
  layoutMode: string;
  stackPos: string;
  widthMode: string;
  hoverFx: string;
  enterFx: string;
  /** Los mismos ajustes que tiene cada pieza, pero para la superficie. */
  enterDir?: string;
  enterMs?: number | null;
  enterDelay?: number | null;
  enterI?: number | null;
  enterE?: string;
  nameWeight: string;
  nameCase: string;
  cursor: string;
  /** Imagen propia del cursor. Si esta puesta, manda sobre el tipo. */
  cursorImg?: string;
  /** Lado de la imagen en px (12..96) */
  cursorSize?: number | null;
  /** Cuantas motas van detras (0..12). 0 = sin estela. */
  cursorTrail?: number | null;
  /** Que clase de estela: id de TRAIL_FX. */
  cursorTrailFx?: string;
  /** Color de la estela. Sin el, el de fabrica de esa estela. */
  cursorTrailColor?: string;
  /** Tamaño y brillo de la estela, en %. */
  cursorTrailInt?: number | null;
  /** Hacia donde se van las motas al nacer. */
  cursorTrailDir?: string;
  particles: string;
  font: string;
  fontDisplay: string;

  /* numbers */
  avSize: number;
  stackWidth: number;
  gap: number;
  radius: number;
  iconSize: number;
  /** Tamaño de las insignias, en px. Manda sobre la pastilla entera:
   *  el icono, el texto y el relleno van en `em` sobre esto. */
  badgeSize?: number;
  /** Hueco entre insignias, en px. */
  badgeGap?: number;
  nameSize: number;
  bioSize: number;
  sBlur: number;
  sGlow: number;
  /** Grosor del borde de la superficie, en px */
  sBorderW: number;
  /** Ancho de la superficie en %. null = usar `stackWidth` en px (perfiles antiguos) */
  sWidthPct: number | null;

  /** Alto minimo de la superficie en px. null = el que pida el contenido. */
  sHeightPx: number | null;
  bgOpacity: number;
  bgBlur: number;

  /** Zoom del fondo en %. 100 = tal cual; por encima se acerca y recorta. */
  bgScale: number;
  bgDim: number;
  vignette: number;
  nameSpacing: number;
  lineHeight: number;
  pad: number | null;
  sOpacity: number | null;
  sBorder: number | null;
  blockRadius: number | null;
  views: number;

  /** Color de relleno de la superficie. Vacío = el del tema */
  sColor: string;
  /** Color del borde de la superficie. Vacío = el del tema */
  sBorderColor: string;

  /* booleans */
  /** Dibujar borde en la superficie. Ausente cuenta como true. */
  sBorderOn: boolean;
  avBorder: boolean;
  avGlow: boolean;
  monoIcons: boolean;
  bgFixed: boolean;
  gradient: boolean;
  /**
   * DEPRECADO: lo sustituye `nameFx`.
   *
   * Se queda porque las filas que ya existen lo traen y el saneado lo lee
   * para traducirlo. Nada lo escribe ni lo mira aparte de esa traduccion.
   */
  animatedName: boolean;
  /** Que efecto lleva el nombre. Ver `data/efectosNombre.ts`. */
  nameFx: string;
  /** Intensidad del efecto, en %. 100 es como lo trae de fabrica. */
  fxInt?: number;
  /** Velocidad del efecto, en %. 200 es el doble de rapido. */
  fxVel?: number;
  glowName: boolean;
  glowSocials: boolean;
  glowBadges: boolean;
  noise: boolean;
  tilt: boolean;
  gate: boolean;
  /** Lo que se lee en la pantalla de entrada. Vacio = el texto por defecto. */
  gateText?: string;
  verified: boolean;
  discoverable: boolean;
  showStats: boolean;
  /**
   * Contar cuántas veces pulsan tus enlaces.
   *
   * Estaba en el validador y en ningún sitio más — ni en este tipo, ni en
   * la interfaz, ni en la base. Un campo que se guardaba y no hacía nada.
   * Ahora enciende el contador de `clics`, que cuenta pulsaciones por
   * enlace y por día y no guarda quién pulsó.
   *
   * Sin valor = sí. Apagarlo es tu decisión, no la nuestra.
   */
  trackClick?: boolean;
  /** Id numerico de Discord (17-20 digitos) para el widget de presencia. */
  discordId?: string;
  /**
   * Lo que la cuenta de Discord dice de si misma, copiado al enlazarla.
   *
   * Esto NO viene de Lanyard: viene del propio inicio de sesion con Discord,
   * asi que existe siempre que hayas conectado la cuenta. Es lo que permite
   * que el widget se pinte sin depender de un servicio de terceros; Lanyard,
   * cuando esta, solo le añade lo que esta pasando en vivo.
   *
   * Se guarda en el perfil porque quien lo visita no tiene tu sesion de la
   * que sacarlo.
   */
  discordUser?: string;
  discordName?: string;
  discordAvatar?: string;
  /** Poner el marco de Nitro alrededor del avatar del perfil.
   *  Sin valor = si, cuando la cuenta tiene uno. */
  discordDeco?: boolean;
  /**
   * La imagen del marco, copiada de Discord al enlazar la cuenta.
   *
   * Se guarda porque el marco NO viene de Lanyard: viene del usuario de
   * Discord, y a ese solo se le puede preguntar con el token del propio
   * inicio de sesion, que dura lo que dura la vuelta del enlace. Quien
   * visita el perfil no tiene ese token, asi que si no estuviera aqui el
   * marco solo se veria estando en el servidor de Lanyard.
   */
  discordDecoUrl?: string;
  /**
   * La etiqueta de servidor de Discord: esas dos a cuatro letras que se
   * llevan al lado del nombre, con su escudito.
   *
   * Se guardan por lo mismo que el marco: NO vienen en la presencia —van
   * en el usuario, no en el estado— asi que la unica forma de saberlas es
   * preguntarselo a Discord con el token del enlace, y quien visita tu
   * perfil no lo tiene.
   */
  discordTag?: string;
  discordTagIcono?: string;

  /* background */
  bgType: 'none' | 'color' | 'gradient' | 'image' | 'video';
  bgValue: string;

  /** Proporcion (ancho/alto) del video de fondo, leida de Vimeo al pegar
   *  el enlace. Sin ella hay que dar por hecho 16:9, y un video en otro
   *  formato sale con franjas en vez de cubrir la pantalla. */
  bgRatio?: number;

  /** El primer fotograma del video de fondo, como imagen.
   *
   *  Un video tarda en llegar aunque pese poco -hay que pedirlo, abrirlo y
   *  decodificarlo- y mientras tanto detras de la tarjeta no hay nada. Esto
   *  es lo que se ve en ese hueco: treinta kilobytes que el navegador pinta
   *  enseguida y que el video sustituye cuando puede. */
  bgPoster?: string;

  /** Alto del lienzo libre en px. Se toma del diseño al entrar en él: con
   *  un alto fijo, la tarjeta se recentraba sola y todo el conjunto daba un
   *  salto al cambiar de modo. */
  canvasH: number | null;

  /** Orden de los bloques, de arriba abajo. Vacío = el orden natural.
   *  Se aplica con la propiedad `order` de CSS, así que no hace falta
   *  reordenar el marcado. */
  blockOrder: string[];

  /** Bloques apagados. Se guarda lo oculto, no lo visible: un bloque
   *  nuevo aparece solo en los perfiles que ya existen. */
  blocksOff: string[];

  /**
   * Insignias que has ganado pero prefieres no enseñar.
   *
   * Igual que `blocksOff`, guarda lo OCULTO y no lo visible: la que ganes
   * mañana sale sola, sin tener que volver aquí a encenderla. Ganarlas no
   * es opcional —las calcula el servidor— pero enseñarlas sí.
   */
  badgesOff?: string[];

  /**
   * Plantilla de arranque elegida: un id de `PLANTILLAS_BASE`.
   *
   * Vacío = todavía no ha elegido ninguna, y por eso al entrar al editor lo
   * primero que ve es la pantalla para elegirla. `'personal'` = el diseño ya
   * no es el de ninguna plantilla, que es lo normal en cuanto alguien lo
   * trabaja, y también lo que se le pone a los perfiles anteriores a que las
   * plantillas existieran para no plantarles una bienvenida encima.
   *
   * No manda sobre nada: el aspecto sigue estando en los campos de siempre.
   * Esto solo recuerda de dónde salió.
   */
  base?: string;

  /* collections */
  socials: SocialLink[];
  links: LinkItem[];
  projects: ProjectItem[];
  gallery: GalleryItem[];
  tags: string[];

  /* block maps */
  pos: Record<string, BlockPos>;
  bstyle: Record<string, BlockStyle>;

  /* complex objects */
  audio?: ProfileAudio;

  /* internal marks */
  _id?: string;
  _actualizado?: string;
  _parcial?: boolean;
  _sucio?: boolean;
}
