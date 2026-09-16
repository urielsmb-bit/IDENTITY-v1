/**
 * Las doce herramientas del editor táctil.
 *
 * ────────────────────────────────────────────────────────────────────────
 * QUE ES ESTO Y QUE NO ES
 * ────────────────────────────────────────────────────────────────────────
 *
 * Es una capa de PRESENTACIÓN: dice por dónde se llega a cada cosa en un
 * teléfono. No declara controles ni guarda nada. Los controles siguen
 * declarados en `data/bloques.ts` y los sigue pintando `Controles.tsx`,
 * que es lo que hace que el editor de escritorio y el del móvil no puedan
 * discrepar: si mañana se añade un control, aparece en los dos sin tocar
 * este archivo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE DOCE Y NO SIETE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Se propuso reducirlas a siete metiendo Texto, Música, Avatar, Badges y
 * Animaciones dentro de Bloques. La respuesta del dueño de la página fue
 * la regla que manda sobre esto:
 *
 *     «El editor del celular debe poder hacer exactamente el mismo trabajo
 *      que el editor de PC. La diferencia debe ser la INTERFAZ, no las
 *      capacidades.»
 *
 * Y tiene razón. «No cabe» es un problema de presentación, y esconder una
 * función dentro de otra no es presentarla mejor: es hacerla más difícil
 * de encontrar para ahorrarle a la barra un desplazamiento que el dedo
 * hace solo.
 *
 * Que Texto y Bloques se solapen tampoco es un defecto: son dos caminos a
 * lo mismo. Texto es «quiero cambiar cómo se lee»; Bloques es «quiero
 * cambiar qué hay y en qué orden».
 */

export type IdHerramienta =
  | 'diseno' | 'perfil' | 'texto' | 'redes' | 'bloques' | 'musica'
  | 'fondo' | 'avatar' | 'badges' | 'animaciones' | 'efectos' | 'ajustes';

export interface Herramienta {
  id: IdHerramienta;
  /** Lo que se lee bajo el icono. Corto de verdad: bajo un icono de 44px
   *  no caben dos palabras sin partirse o encogerse hasta no leerse. */
  nombre: string;
  /** Para el lector de pantalla y para el título de la hoja, donde sí hay
   *  sitio para decirlo entero. */
  titulo: string;
  /** Tabler, trazo. Un `path` suelto: el `<svg>` lo pone quien lo pinta,
   *  así todos comparten tamaño, grosor y remates sin repetirlo doce
   *  veces. */
  icono: string;
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    id: 'diseno',
    nombre: 'Diseño',
    titulo: 'Diseño',
    icono: '<path d="M4 20 20 4"/><path d="M4 20h6"/><path d="M4 20v-6"/><path d="M14 4h6v6"/>',
  },
  {
    id: 'perfil',
    nombre: 'Perfil',
    titulo: 'Perfil',
    icono: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  },
  {
    id: 'texto',
    nombre: 'Texto',
    titulo: 'Texto',
    icono: '<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  },
  {
    id: 'redes',
    nombre: 'Redes',
    titulo: 'Redes y enlaces',
    icono: '<path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  },
  {
    id: 'bloques',
    nombre: 'Bloques',
    titulo: 'Bloques del perfil',
    icono: '<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><rect x="3.5" y="12" width="17" height="8" rx="1.5"/>',
  },
  {
    id: 'musica',
    nombre: 'Música',
    titulo: 'Música',
    icono: '<circle cx="7" cy="18" r="3"/><circle cx="18" cy="15.5" r="3"/><path d="M10 18V5l11-2v12.5"/>',
  },
  {
    id: 'fondo',
    nombre: 'Fondo',
    titulo: 'Fondo',
    icono: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4"/>',
  },
  {
    id: 'avatar',
    nombre: 'Avatar',
    titulo: 'Avatar',
    icono: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5a6 6 0 0 1 11 0"/>',
  },
  {
    id: 'badges',
    nombre: 'Badges',
    titulo: 'Badges',
    icono: '<path d="M12 2 3 8l9 14 9-14-9-6Z"/><path d="M3 8h18M9 8l3 14M15 8l-3 14"/>',
  },
  {
    id: 'animaciones',
    nombre: 'Animar',
    titulo: 'Animaciones',
    icono: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3.5 2"/><path d="M17 3.5 21 5l-1.5 4"/>',
  },
  {
    id: 'efectos',
    nombre: 'Efectos',
    titulo: 'Efectos',
    icono: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3"/>',
  },
  {
    id: 'ajustes',
    nombre: 'Ajustes',
    titulo: 'Ajustes',
    icono: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  },
];

export const HERRAMIENTA_POR_ID: Record<string, Herramienta> = Object.fromEntries(
  HERRAMIENTAS.map((h) => [h.id, h]),
);
