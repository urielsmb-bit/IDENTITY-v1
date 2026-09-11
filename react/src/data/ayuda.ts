/**
 * El índice del centro de ayuda.
 *
 * Cada artículo es un `.md` en `public/ayuda/`. Aquí sólo está el índice:
 * qué artículos hay, cómo se llaman y en qué grupo van. Escribir uno nuevo
 * es escribir un fichero y añadir una línea aquí — sin tocar componentes,
 * sin compilar nada nuevo.
 *
 * Vive en una ruta (`/ayuda`) y no en un subdominio como hace guns.lol
 * (`help.guns.lol`). Un subdominio pide DNS, un segundo despliegue y su
 * propia copia de la barra, del pie y de los estilos, para acabar en el
 * mismo sitio. Y `ayuda` está en `nombres_reservados` desde la migración
 * fundacional, así que nadie puede tener un perfil que choque con la ruta.
 */

export interface ArticuloAyuda {
  /** El trozo de la dirección: `/ayuda/<slug>`, y el fichero `<slug>.md`. */
  slug: string;
  titulo: string;
  /** Una línea de qué contesta, para la lista. */
  resumen: string;
}

export interface GrupoAyuda {
  id: string;
  titulo: string;
  desc: string;
  articulos: ArticuloAyuda[];
}

export const AYUDA: GrupoAyuda[] = [
  {
    id: 'empezar',
    titulo: 'Empezar',
    desc: 'De no tener nada a tener un perfil que se puede compartir.',
    articulos: [
      {
        slug: 'crear-tu-perfil',
        titulo: 'Crear tu perfil',
        resumen: 'Elegir tu nombre, montar la página y publicarla.',
      },
      {
        slug: 'plantillas',
        titulo: 'Las plantillas',
        resumen: 'Las cinco de arranque, la galería y qué cambia cada una.',
      },
      {
        slug: 'compartir-tu-enlace',
        titulo: 'Compartir tu enlace',
        resumen: 'Cómo se ve tu perfil al pegarlo en Discord o WhatsApp.',
      },
    ],
  },
  {
    id: 'personalizar',
    titulo: 'Personalizar',
    desc: 'Las piezas, el fondo, la música y lo que hace que sea tuyo.',
    articulos: [
      {
        slug: 'las-piezas',
        titulo: 'Las piezas de tu perfil',
        resumen: 'Encender, apagar, ordenar y ajustar cada trozo.',
      },
      {
        slug: 'el-fondo',
        titulo: 'El fondo',
        resumen: 'Color, degradado, imagen o vídeo, y qué tope tiene cada uno.',
      },
      {
        slug: 'la-musica',
        titulo: 'La música',
        resumen: 'Poner una pista y qué se puede reproducir de verdad.',
      },
      {
        slug: 'discord',
        titulo: 'Conectar Discord',
        resumen: 'El estado en vivo, qué permisos pide y por qué.',
      },
    ],
  },
  {
    id: 'cuenta',
    titulo: 'Tu cuenta',
    desc: 'Entrar, las insignias, tus cifras y cómo irte.',
    articulos: [
      {
        slug: 'insignias',
        titulo: 'Las insignias',
        resumen: 'Cuáles hay, cómo se ganan y por qué no puedes ponértelas.',
      },
      {
        slug: 'analiticas',
        titulo: 'Tus analíticas',
        resumen: 'Qué se cuenta, qué no se guarda y por qué.',
      },
      {
        slug: 'premium',
        titulo: 'Qué trae Premium',
        resumen: 'Exactamente qué se abre al tenerlo, y qué es gratis.',
      },
      {
        slug: 'borrar-tu-cuenta',
        titulo: 'Borrar tu cuenta',
        resumen: 'Cómo se hace, qué se va y qué no se puede deshacer.',
      },
    ],
  },
  {
    id: 'problemas',
    titulo: 'Problemas',
    desc: 'Lo que más se pregunta cuando algo no va como esperabas.',
    articulos: [
      {
        slug: 'problemas',
        titulo: 'Cuando algo no va',
        resumen: 'La música que no arranca, la tarjeta vieja, el vídeo que no sube.',
      },
    ],
  },
];

/** Todos los artículos en una lista, para buscar por slug. */
export const ARTICULOS: (ArticuloAyuda & { grupo: GrupoAyuda })[] = AYUDA.flatMap((g) =>
  g.articulos.map((a) => ({ ...a, grupo: g })),
);

export function articuloPorSlug(slug: string) {
  return ARTICULOS.find((a) => a.slug === slug) ?? null;
}
