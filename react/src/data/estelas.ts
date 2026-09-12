/**
 * Las estelas del cursor.
 *
 * ────────────────────────────────────────────────────────────────────────
 * UNA ESTELA ES UN DATO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Igual que los efectos del nombre: quince estelas y un solo motor. Cada
 * fila describe CÓMO se comporta una partícula —de qué forma es, cuánto
 * vive, hacia dónde deriva, si gira, si crece, si orbita— y el motor de
 * `lib/estela.ts` la dibuja. Añadir la dieciseisava es una fila.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CADA UNA TIENE SU COLOR
 * ────────────────────────────────────────────────────────────────────────
 *
 * Antes todas salían del acento del perfil, así que las seis se veían
 * iguales y elegir entre ellas era elegir entre seis maneras de mover lo
 * mismo. Una chispa es ámbar, una burbuja es agua, la niebla es gris: el
 * color no es decoración, es la mitad de lo que hace que se reconozcan.
 *
 * El color de aquí es el de FÁBRICA. En los ajustes se puede cambiar, y
 * entonces manda el elegido. Ninguna es morada por defecto.
 */

/** De qué está hecha cada mota. */
export type FormaMota =
  | 'punto'      // círculo con halo
  | 'estrella'   // cuatro puntas
  | 'linea'      // un trazo en la dirección del avance
  | 'burbuja'    // aro con un reflejo
  | 'humo'       // manchón blando que crece
  | 'triangulo'  // geometría dura
  | 'cristal'    // rombo afilado
  | 'petalo'     // elipse que cae girando
  | 'anillo';    // aro que se abre

export interface DefEstela {
  id: string;
  nombre: string;
  /** Qué hace, en una línea, para la tarjeta. */
  desc: string;
  /** Su color de fábrica. Se puede cambiar en los ajustes. */
  color: string;
  forma: FormaMota;

  // ── cuántas y cuándo ──────────────────────────────────────
  /** Cada cuántos píxeles recorridos suelta. Menos = más tupido. */
  paso: number;
  /** Cuántas suelta de golpe. */
  brote: number;
  /** Cuánto vive una mota, en ms. */
  vida: number;

  // ── dónde nace ────────────────────────────────────────────
  /** Cuánto se abre de lado al nacer, en px. */
  dispersa: number;
  /** Tamaño, de mínimo a máximo, en px. */
  tam: [number, number];

  // ── cómo se mueve ─────────────────────────────────────────
  /** Velocidad inicial [de lado, vertical]. Negativo sube. */
  deriva: [number, number];
  /** Lo que tira hacia abajo por cuadro. */
  gravedad?: number;
  /** Cuánto frena por cuadro. 1 = no frena. */
  roce?: number;
  /** Vueltas por segundo. */
  giro?: number;
  /** Crece (>1) o encoge (<1) a lo largo de su vida. */
  crece?: number;
  /** Da vueltas alrededor de donde nació, en px de radio. */
  orbita?: number;
  /** Se mueve en zigzag: [amplitud en px, ciclos por vida]. */
  onda?: [number, number];
  /** Cuántos grados de tono recorre a lo largo de su vida. */
  tono?: number;
  /** Hereda la velocidad del ratón, de 0 a 1. */
  arrastre?: number;

  // ── cómo se ve ────────────────────────────────────────────
  /**
   * LA CINTA: una tira continua de luz por donde pasaste.
   *
   * Es lo que separa «puntos que te siguen» de «una línea de energía». Un
   * rastro de motas sueltas se lee como partículas por muchas que pongas;
   * una tira que se estrecha hacia la cola se lee como movimiento.
   *
   * No es más caro, es MENOS: un trazo por pasada en vez de cien círculos.
   *
   *   ancho  lo gruesa que es en la cabeza, en px
   *   largo  cuántas posiciones del ratón recuerda
   *   capas  pasadas de brillo: la ancha y tenue, la media, y el filo
   */
  cinta?: { ancho: number; largo: number; capas?: number };
  /**
   * El halo de cada mota.
   *
   * Una segunda pasada más ancha y muy tenue debajo de la mota. Es lo que
   * hace que una chispa parezca que ilumina en vez de ser un recorte de
   * papel de color. Multiplica el radio.
   */
  brillo?: number;
  /** Se suma a lo que hay debajo en vez de taparlo. Lo que da el brillo. */
  aditivo?: boolean;
  /** Opacidad de salida. */
  alfa?: number;
  pro?: boolean;
}

/**
 * Las quince.
 *
 * El orden importa: las cuatro primeras son las que más se van a elegir, y
 * son las que salen sin desplazar la lista.
 */
export const ESTELAS: readonly DefEstela[] = [
  {
    id: 'aura',
    nombre: 'Aura',
    desc: 'Una estela etérea que se adapta a tu movimiento.',
    color: '#7fd8ff',
    forma: 'punto',
    paso: 6, brote: 1, vida: 900,
    dispersa: 7, tam: [3, 9],
    deriva: [0.25, -0.12], roce: 0.94, crece: 1.7,
    arrastre: 0.25, aditivo: true, alfa: 0.4, brillo: 2.6,
    cinta: { ancho: 22, largo: 26, capas: 3 },
    pro: true,
  },
  {
    id: 'estelar',
    nombre: 'Estelar',
    desc: 'Partículas de luz que brillan y se desvanecen.',
    color: '#ffe9a8',
    forma: 'estrella',
    paso: 7, brote: 1, vida: 1100,
    dispersa: 16, tam: [2, 6],
    deriva: [0.5, -0.3], roce: 0.97, giro: 0.4, crece: 0.4,
    aditivo: true, alfa: 0.95, brillo: 3.2,
    pro: true,
  },
  {
    id: 'flux',
    nombre: 'Flux',
    desc: 'Líneas de energía que siguen tu cursor con fluidez.',
    color: '#4da3ff',
    forma: 'linea',
    paso: 9, brote: 1, vida: 620,
    dispersa: 3, tam: [3, 8],
    deriva: [0, 0], roce: 0.9, arrastre: 0.75,
    aditivo: true, alfa: 0.6, brillo: 2.2,
    cinta: { ancho: 11, largo: 30, capas: 3 },
    pro: true,
  },
  {
    id: 'burbujas',
    nombre: 'Burbujas',
    desc: 'Esferas dinámicas que rebotan suavemente.',
    color: '#8fe3ff',
    forma: 'burbuja',
    paso: 12, brote: 1, vida: 1700,
    dispersa: 18, tam: [4, 13],
    deriva: [0.3, -0.55], roce: 0.99, onda: [9, 1.6], crece: 1.2,
    alfa: 0.75,
    pro: true,
  },
  {
    id: 'neblina',
    nombre: 'Neblina',
    desc: 'Una estela de humo que se disipa con elegancia.',
    color: '#c9d4e0',
    forma: 'humo',
    paso: 7, brote: 1, vida: 1500,
    dispersa: 12, tam: [10, 26],
    deriva: [0.2, -0.25], roce: 0.97, crece: 2.2, giro: 0.1,
    alfa: 0.14,
    cinta: { ancho: 44, largo: 22, capas: 1 },
    pro: true,
  },
  {
    id: 'chispas',
    nombre: 'Chispas',
    desc: 'Partículas doradas que siguen tu movimiento.',
    color: '#ffb545',
    forma: 'estrella',
    paso: 4, brote: 1, vida: 950,
    dispersa: 13, tam: [1.5, 4.5],
    deriva: [0.7, -0.5], gravedad: 0.035, roce: 0.98, crece: 0.35,
    aditivo: true, alfa: 1, brillo: 3,
  },
  {
    id: 'geometrico',
    nombre: 'Geométrico',
    desc: 'Formas en movimiento que crean un efecto futurista.',
    color: '#3ee0c0',
    forma: 'triangulo',
    paso: 11, brote: 1, vida: 1250,
    dispersa: 20, tam: [4, 11],
    deriva: [0.35, -0.2], roce: 0.985, giro: 0.55, crece: 0.6,
    alfa: 0.85,
    pro: true,
  },
  {
    id: 'liquido',
    nombre: 'Líquido',
    desc: 'Un rastro fluido que parece estar vivo.',
    color: '#ff5fa8',
    forma: 'punto',
    paso: 8, brote: 1, vida: 780,
    dispersa: 4, tam: [4, 11],
    deriva: [0, 0.1], roce: 0.88, arrastre: 0.55, crece: 0.25,
    aditivo: true, alfa: 0.45, brillo: 2.4,
    cinta: { ancho: 26, largo: 20, capas: 2 },
    pro: true,
  },
  {
    id: 'fragmentos',
    nombre: 'Fragmentos',
    desc: 'Pequeños cristales que se desprenden al moverte.',
    color: '#ff7ad9',
    forma: 'cristal',
    paso: 9, brote: 2, vida: 1000,
    dispersa: 22, tam: [3, 8],
    deriva: [1.1, -0.35], gravedad: 0.05, roce: 0.98, giro: 0.8,
    aditivo: true, alfa: 0.9, brillo: 2.4,
    pro: true,
  },
  {
    id: 'iris',
    nombre: 'Iris',
    desc: 'Un efecto cambiante con colores que se mezclan.',
    color: '#ff4d6d',
    forma: 'punto',
    paso: 7, brote: 1, vida: 1000,
    dispersa: 6, tam: [4, 11],
    deriva: [0.2, -0.2], roce: 0.93, crece: 0.8,
    cinta: { ancho: 16, largo: 34, capas: 3 },
    /* Lo suyo es el color, no la forma: cada mota recorre media rueda de
       tono mientras vive, así que la estela sale degradada de principio a
       fin en vez de ser de un color. */
    tono: 190, arrastre: 0.35, aditivo: true, alfa: 0.7,
    pro: true,
  },
  {
    id: 'glitch',
    nombre: 'Glitch',
    desc: 'Distorsión digital que sigue tu cursor.',
    color: '#ff2d55',
    forma: 'linea',
    paso: 6, brote: 2, vida: 420,
    dispersa: 26, tam: [5, 16],
    deriva: [1.6, 0], roce: 1, tono: 150,
    aditivo: true, alfa: 0.85, brillo: 2,
    pro: true,
  },
  {
    id: 'orbita',
    nombre: 'Órbita',
    desc: 'Anillos y puntos que rotan alrededor del cursor.',
    color: '#9db4ff',
    forma: 'punto',
    paso: 10, brote: 1, vida: 1400,
    dispersa: 2, tam: [2, 5],
    deriva: [0, 0], orbita: 26, roce: 1,
    aditivo: true, alfa: 0.9, brillo: 3.4,
    pro: true,
  },
  {
    id: 'ondas',
    nombre: 'Ondas',
    desc: 'Ondas de partículas que se expanden con el movimiento.',
    color: '#5ad1ff',
    forma: 'anillo',
    paso: 22, brote: 1, vida: 1200,
    dispersa: 0, tam: [6, 10],
    deriva: [0, 0], roce: 1, crece: 5,
    alfa: 0.55,
    pro: true,
  },
  {
    id: 'petalos',
    nombre: 'Pétalos',
    desc: 'Hojas y pétalos que flotan tras tu cursor.',
    color: '#ff8fa3',
    forma: 'petalo',
    paso: 16, brote: 1, vida: 2200,
    dispersa: 20, tam: [6, 13],
    deriva: [0.3, 0.25], gravedad: 0.012, roce: 0.995,
    giro: 0.25, onda: [16, 2.2],
    alfa: 0.85,
    pro: true,
  },
  {
    id: 'cristal',
    nombre: 'Cristal',
    desc: 'Fragmentos de cristal que brillan con la luz.',
    color: '#bfe9ff',
    forma: 'cristal',
    paso: 8, brote: 1, vida: 1300,
    dispersa: 16, tam: [4, 10],
    deriva: [0.4, -0.15], roce: 0.99, giro: 0.35, crece: 0.5,
    aditivo: true, alfa: 0.8, brillo: 2.6,
    pro: true,
  },
];

const POR_ID = new Map(ESTELAS.map((e) => [e.id, e]));

export function estela(id: string | undefined | null): DefEstela | undefined {
  return id ? POR_ID.get(id) : undefined;
}

/** Los ids válidos, para el saneado. Sale de la tabla, no de una copia. */
export const IDS_ESTELA: readonly string[] = ESTELAS.map((e) => e.id);

/**
 * Estelas que ya no existen y a dónde va cada una.
 *
 * Las seis de antes eran las mismas motas con distinta física. Las que no
 * tienen heredera directa se mandan a la que más se le parece: quien tenga
 * «Polvo» puesto verá algo, no nada.
 */
export const ESTELAS_MUDADAS: Readonly<Record<string, string>> = {
  puntos: 'aura',
  polvo: 'neblina',
  fuego: 'chispas',
  nieve: 'petalos',
};
