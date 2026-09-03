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
  /* identity */
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
  particles: string;
  font: string;
  fontDisplay: string;

  /* numbers */
  avSize: number;
  stackWidth: number;
  gap: number;
  radius: number;
  iconSize: number;
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
  /** Nota media. La calcula el servidor; no se guarda en el perfil. */
  nota?: number | null;
  numNotas?: number;

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
  animatedName: boolean;
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
  showRate: boolean;
  /** Id numerico de Discord (17-20 digitos) para el widget de presencia. */
  discordId?: string;
  /** Poner el marco de Nitro alrededor del avatar del perfil.
   *  Sin valor = si, cuando la cuenta tiene uno. */
  discordDeco?: boolean;

  /* background */
  bgType: 'none' | 'color' | 'gradient' | 'image' | 'video';
  bgValue: string;

  /** Proporcion (ancho/alto) del video de fondo, leida de Vimeo al pegar
   *  el enlace. Sin ella hay que dar por hecho 16:9, y un video en otro
   *  formato sale con franjas en vez de cubrir la pantalla. */
  bgRatio?: number;

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
