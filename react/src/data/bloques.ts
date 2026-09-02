/**
 * Qué se puede tocar en cada bloque.
 *
 * Escribir dieciséis formularios a mano garantiza que se desincronicen: se
 * añade un control a uno y se olvida en los otros quince. Aquí cada bloque
 * DECLARA qué grupos y qué controles tiene, y un único componente los pinta.
 * Añadir un control nuevo es tocar dos sitios, no dieciséis.
 *
 * No todos los bloques admiten lo mismo, y es a propósito: poner
 * "tipografía" en el widget de música o "texto" en las insignias serían
 * controles que no hacen nada.
 */

/** Cada control sabe leer y escribir su sitio en el perfil. */
export type ControlId =
  // contenido
  | 'texto'
  | 'visible'
  // tipografía
  | 'fuente'
  | 'caso'
  | 'espaciado'
  | 'tamano'
  // color
  | 'color'
  | 'opacidad'
  // resplandor
  | 'halo'
  // caja
  | 'superficie'
  | 'relleno'
  | 'radio'
  | 'ancho'
  | 'borde'
  | 'desenfoque'
  | 'brillo'
  // composición
  | 'anim'
  | 'alinear'
  | 'margen'
  // piezas con contenido propio
  | 'estiloRedes'
  | 'estiloInsignias'
  | 'listaRedes'
  | 'listaInsignias'
  | 'monoRedes'
  | 'enlaceMusica'
  | 'portadaMusica'
  | 'posAvatar'
  | 'formaAvatar'
  | 'centrar'
  | 'animacion'
  | 'heredarCaja'
  | 'discordId'
  | 'marcoDiscord';

export interface GrupoControles {
  titulo: string;
  controles: ControlId[];
}

export interface DefBloque {
  id: string;
  nombre: string;
  descripcion: string;
  /** SVG en linea. Constante local, nunca contenido de usuario. */
  icono: string;
  /** Campo del perfil que edita el control de texto, si el bloque lo tiene */
  campoTexto?: 'name' | 'username' | 'bio' | 'title' | 'about';
  grupos: GrupoControles[];
}

// ── Grupos reutilizables ────────────────────────────────────
// Se comparten para que dos bloques con la misma capacidad no acaben
// ofreciendo controles distintos por descuido.

const CAJA: GrupoControles = {
  titulo: 'Caja',
  controles: [
    'superficie', 'heredarCaja',
    'relleno', 'radio', 'ancho', 'borde', 'desenfoque', 'brillo',
  ],
};

const RESPLANDOR: GrupoControles = { titulo: 'Halo / Resplandor', controles: ['halo'] };
const COMPOSICION: GrupoControles = {
  titulo: 'Posición',
  controles: ['alinear', 'margen'],
};

/** El panel de entrada. Va aparte porque es el único control que trae su
 *  propia vista previa y su botón de repetir. */
const ENTRADA: GrupoControles = {
  titulo: 'Animación de entrada',
  controles: ['animacion'],
};
const TIPOGRAFIA: GrupoControles = {
  titulo: 'Tipografía',
  controles: ['fuente', 'tamano', 'caso', 'espaciado'],
};
const COLOR: GrupoControles = { titulo: 'Color', controles: ['color'] };

/** Redes e insignias no se pintan como un texto: cada pieza tiene su
 *  propia forma. La caja es opcional, y por defecto no la hay. */
const FORMA_REDES: GrupoControles = {
  titulo: 'Forma de los iconos',
  controles: ['estiloRedes', 'monoRedes', 'listaRedes'],
};
const FORMA_INSIGNIAS: GrupoControles = {
  titulo: 'Forma de las insignias',
  controles: ['estiloInsignias', 'listaInsignias'],
};

/** Para las líneas pequeñas: no piden fuente ni caja, pero sí poder
 *  agrandarlas o apretarlas. */
const TEXTO_FINO: GrupoControles = {
  titulo: 'Tipografía',
  controles: ['tamano', 'espaciado'],
};

const soloVisible: GrupoControles = { titulo: 'Contenido', controles: ['visible'] };
const conTexto = (): GrupoControles => ({ titulo: 'Texto', controles: ['texto', 'visible'] });

export const BLOQUES: DefBloque[] = [
  {
    id: 'avatar',
    nombre: 'Avatar',
    descripcion: 'La imagen o la inicial que encabeza el perfil.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
    // La imagen se sube en Perfil; su forma y su sitio se deciden aquí.
    // Sin alineación ni margen: el avatar manda sobre la cabecera entera
    // («Nombre al lado» recoloca el nombre y la bio), así que un margen
    // suyo movía cosas que no son suyas.
    grupos: [
      soloVisible,
      { titulo: 'Forma y sitio', controles: ['formaAvatar', 'posAvatar', 'marcoDiscord'] },
      RESPLANDOR,
      ENTRADA,
    ],
  },
  {
    id: 'name',
    nombre: 'Nombre',
    descripcion: 'Cómo se muestra tu nombre en el perfil.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/></svg>`,
    campoTexto: 'name',
    grupos: [conTexto(), TIPOGRAFIA, COLOR, RESPLANDOR, COMPOSICION, ENTRADA],
  },
  {
    id: 'handle',
    nombre: '@usuario',
    descripcion: 'Tu identificador único.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>`,
    campoTexto: 'username',
    grupos: [conTexto(), TIPOGRAFIA, COLOR, RESPLANDOR, COMPOSICION, ENTRADA],
  },
  {
    id: 'meta',
    nombre: 'Oficio y ubicación',
    descripcion: 'La línea de oficio, ciudad y pronombres.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    campoTexto: 'title',
    grupos: [conTexto(), TIPOGRAFIA, COLOR, COMPOSICION, ENTRADA],
  },
  {
    id: 'joined',
    nombre: 'Fecha de registro',
    descripcion: 'Desde cuándo tienes el perfil.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
    grupos: [soloVisible, TEXTO_FINO, COLOR, COMPOSICION, ENTRADA],
  },
  {
    id: 'discord',
    nombre: 'Widget de Discord',
    descripcion: 'Tu presencia de Discord en vivo.',
    icono: `<svg viewBox="1.96 4.26 20.03 15.53" fill="currentColor" aria-hidden="true"><path d="M14.82 4.26a10.14 10.14 0 0 0-.53 1.1a14.66 14.66 0 0 0-4.58 0a10.14 10.14 0 0 0-.53-1.1a16 16 0 0 0-4.13 1.3a17.33 17.33 0 0 0-3 11.59a16.6 16.6 0 0 0 5.07 2.59A12.89 12.89 0 0 0 8.23 18a9.65 9.65 0 0 1-1.71-.83a3.39 3.39 0 0 0 .42-.33a11.66 11.66 0 0 0 10.12 0q.21.18.42.33a10.84 10.84 0 0 1-1.71.84a12.41 12.41 0 0 0 1.08 1.78a16.44 16.44 0 0 0 5.06-2.59a17.22 17.22 0 0 0-3-11.59a16.09 16.09 0 0 0-4.09-1.35zM8.68 14.81a1.94 1.94 0 0 1-1.8-2a1.93 1.93 0 0 1 1.8-2a1.93 1.93 0 0 1 1.8 2a1.93 1.93 0 0 1-1.8 2zm6.64 0a1.94 1.94 0 0 1-1.8-2a1.93 1.93 0 0 1 1.8-2a1.92 1.92 0 0 1 1.8 2a1.92 1.92 0 0 1-1.8 2z"/></svg>`,
    grupos: [
      { titulo: 'Cuenta', controles: ['discordId', 'visible'] },
      CAJA,
      COMPOSICION,
      ENTRADA,
    ],
  },
  {
    id: 'bio',
    nombre: 'Biografía',
    descripcion: 'El párrafo que cuenta quién eres.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/></svg>`,
    campoTexto: 'bio',
    grupos: [conTexto(), TIPOGRAFIA, COLOR, COMPOSICION, ENTRADA],
  },
  {
    id: 'badges',
    nombre: 'Insignias',
    descripcion: 'Las insignias que has desbloqueado.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 3 8l9 14 9-14-9-6Z"/><path d="M3 8h18M9 8l3 14M15 8l-3 14"/></svg>`,
    grupos: [soloVisible, FORMA_INSIGNIAS, CAJA, RESPLANDOR, COMPOSICION, ENTRADA],
  },
  {
    id: 'socials',
    nombre: 'Redes',
    descripcion: 'Los iconos de tus redes enlazadas.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>`,
    grupos: [soloVisible, FORMA_REDES, CAJA, RESPLANDOR, COMPOSICION, ENTRADA],
  },
  {
    id: 'music',
    nombre: 'Música',
    descripcion: 'El reproductor de tu pista.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>`,
    // La pista se ponía sólo en «Fondo & Audio», o sea en otra sección:
    // se entraba a editar el bloque de música y no había música que poner.
    grupos: [
      { titulo: 'Pista', controles: ['enlaceMusica', 'portadaMusica', 'visible'] },
      CAJA,
      COMPOSICION,
      ENTRADA,
    ],
  },
  {
    id: 'views',
    nombre: 'Visitas',
    descripcion: 'El contador de visitas al perfil.',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    grupos: [soloVisible, TEXTO_FINO, COLOR, COMPOSICION, ENTRADA],
  },
];

/**
 * Con qué bloques arranca un perfil nuevo.
 *
 * Se empieza con lo imprescindible —avatar, nombre y @usuario— y el resto
 * apagado. Encender lo que quieres es una decisión; apagar catorce cosas que
 * no pediste es una tarea, y además el primer perfil salía lleno de cajas
 * vacías («0 visitas», «Nivel 1», estadísticas en cero) que no dicen nada.
 */
export const BLOQUES_VISIBLES_AL_EMPEZAR = ['avatar', 'name', 'handle'];

/** Los ids que van apagados en un perfil recién creado. */
export const BLOQUES_APAGADOS_POR_DEFECTO: string[] = BLOQUES
  .map((b) => b.id)
  .filter((id) => !BLOQUES_VISIBLES_AL_EMPEZAR.includes(id));

/** Acceso por id, para no recorrer la lista en cada render. */
export const BLOQUE_POR_ID: Record<string, DefBloque> = Object.fromEntries(
  BLOQUES.map((b) => [b.id, b]),
);
