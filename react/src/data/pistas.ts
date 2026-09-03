import type { Profile } from '@/types/profile';
import { BLOQUES_APAGADOS_POR_DEFECTO } from './bloques';

/**
 * Las pistas de la guía.
 *
 * No es un tour. Un tour se enseña entero el primer día, cuando todavía no
 * hay nada hecho y por tanto nada de lo que dice significa nada — y por eso
 * se salta. Esto es lo contrario: una sola pista cada vez, en la sección en
 * la que estás, y sólo cuando lo que propone tiene sentido AHORA.
 *
 * Cada pista sabe dos cosas de sí misma:
 *   · `cuando` — si toca enseñarla, mirando lo que la persona lleva hecho;
 *   · `hecha`  — si ya se hizo, y entonces se retira sola sin decir nada.
 *
 * Esa segunda es la que hace que la guía no moleste: en cuanto haces lo que
 * te propone, desaparece y aparece la siguiente. Se va desplegando al ritmo
 * al que montas el perfil, no al ritmo de un reloj.
 */
export interface Pista {
  id: string;
  /** Sección del editor donde vive. */
  seccion: string;
  /** Valor del `data-guia` del elemento al que se pega. */
  ancla: string;
  titulo: string;
  texto: string;
  /** ¿Tiene sentido enseñarla con este perfil? */
  cuando: (p: Profile) => boolean;
  /** ¿Ya está hecha? Entonces se da por aprendida y no vuelve. */
  hecha: (p: Profile) => boolean;
  /** Menor va antes dentro de la misma sección. */
  orden: number;
}

const hayFondo = (p: Profile) => (p.bgType || 'none') !== 'none';
const enLibre = (p: Profile) => (p.layoutMode || 'stack') === 'free';
const cuantasRedes = (p: Profile) => p.socials?.length ?? 0;
const nunca = () => false;
const siempre = () => true;

export const PISTAS: Pista[] = [
  /* ---------------- Perfil ---------------- */
  {
    id: 'avatar',
    seccion: 'overview',
    ancla: 'avatar',
    titulo: 'Empieza por tu cara',
    texto: 'Suelta una imagen aquí o pulsa para elegirla. Si subes un GIF se queda animado.',
    cuando: (p) => !p.avatarUrl,
    hecha: (p) => !!p.avatarUrl,
    orden: 1,
  },
  {
    id: 'fondo',
    seccion: 'overview',
    ancla: 'fondo',
    titulo: 'El fondo también puede ser vídeo',
    texto: 'Suelta un vídeo y se reproduce en bucle detrás de todo. Se aloja solo, tú no haces nada.',
    cuando: (p) => !!p.avatarUrl && !hayFondo(p),
    hecha: hayFondo,
    orden: 2,
  },
  {
    id: 'usuario',
    seccion: 'overview',
    ancla: 'usuario',
    titulo: 'Esta es tu dirección',
    texto: 'Es el enlace que vas a compartir. Puedes cambiarlo cuando quieras, pero los enlaces viejos dejan de valer.',
    cuando: (p) => !!p.avatarUrl,
    hecha: nunca,
    orden: 3,
  },

  /* ---------------- Bloques ---------------- */
  {
    id: 'bloques',
    seccion: 'blocks',
    ancla: 'bloques',
    titulo: 'Enciende sólo lo que uses',
    texto: 'El ojo de cada bloque lo muestra o lo esconde. Pulsa el bloque para abrir sus ajustes.',
    cuando: siempre,
    hecha: (p) =>
      (p.blocksOff?.length ?? 99) < BLOQUES_APAGADOS_POR_DEFECTO.length,
    orden: 1,
  },
  {
    id: 'discord-vivo',
    seccion: 'blocks',
    ancla: 'bloques',
    titulo: 'Tu Discord, en vivo',
    texto: 'Enciende el bloque de Discord y tu estado sale solo: a qué juegas, qué escuchas, si estás conectado.',
    /* El bloque encendido es `blocksOff` sin 'discord'. NO se mira
       `discordWidget`: ese campo existe en el tipo pero no lo lee nadie, asi
       que la pista no se habria retirado nunca. */
    cuando: (p) => !!p.discordId && !!p.blocksOff?.includes('discord'),
    hecha: (p) => !p.blocksOff?.includes('discord'),
    orden: 2,
  },

  /* ---------------- Diseño ---------------- */
  {
    id: 'formato',
    seccion: 'design',
    ancla: 'formato',
    titulo: 'Tres puntos de partida',
    texto: 'Elige el que más se te parezca y luego cámbialo entero. No te casas con ninguno.',
    cuando: siempre,
    hecha: nunca,
    orden: 1,
  },
  {
    id: 'libre',
    seccion: 'design',
    ancla: 'libre',
    titulo: 'Sácalo de la columna',
    texto: 'En modo libre arrastras cada bloque donde quieras en la vista previa, y tiras del borde para cambiarle el ancho.',
    cuando: (p) => !enLibre(p),
    hecha: enLibre,
    orden: 2,
  },
  {
    id: 'movimiento',
    seccion: 'design',
    ancla: 'movimiento',
    titulo: 'Que entre con estilo',
    texto: 'El perfil puede aparecer con animación al abrirse. Y cada bloque puede tener la suya, desde sus propios ajustes.',
    cuando: (p) => !!p.avatarUrl,
    hecha: (p) => !!p.enterFx && p.enterFx !== 'none',
    orden: 3,
  },
  {
    id: 'cursor',
    seccion: 'design',
    ancla: 'cursor',
    titulo: 'Hasta el cursor es tuyo',
    texto: 'Cámbiale la forma, súbele tu propia imagen o déjale una estela de chispas detrás.',
    cuando: (p) => enLibre(p) || (!!p.enterFx && p.enterFx !== 'none'),
    hecha: (p) => (p.cursor || 'default') !== 'default' || !!p.cursorImg,
    orden: 4,
  },
  {
    id: 'portada',
    seccion: 'design',
    ancla: 'portada',
    titulo: 'Una portada antes de entrar',
    texto: 'Pantalla negra hasta que hacen clic. Además es lo que permite que suene la música: los navegadores no dejan sonar nada sin un clic.',
    cuando: (p) => !!p.avatarUrl && hayFondo(p),
    hecha: (p) => !!p.gate,
    orden: 5,
  },

  /* ---------------- Redes ---------------- */
  {
    id: 'redes',
    seccion: 'links',
    ancla: 'redes',
    titulo: 'Pulsa un icono y ya está',
    texto: 'Se añade a tu perfil y sólo queda pegar tu dirección. Puedes ponerlos sueltos o dentro de cajas.',
    cuando: (p) => cuantasRedes(p) === 0,
    hecha: (p) => cuantasRedes(p) > 0,
    orden: 1,
  },
  {
    id: 'enlace-propio',
    seccion: 'links',
    ancla: 'enlace-propio',
    titulo: '¿No está la tuya?',
    texto: 'Un enlace propio acepta cualquier dirección, con el nombre que le pongas y hasta un icono que subas tú.',
    cuando: (p) => cuantasRedes(p) >= 1,
    hecha: (p) => !!p.socials?.some((s) => s.net === 'custom'),
    orden: 2,
  },

  /* ---------------- Insignias ---------------- */
  {
    id: 'insignias',
    seccion: 'badges',
    ancla: 'insignias',
    titulo: 'No se compran, se ganan',
    texto: 'Cada una dice qué hay que hacer para conseguirla. El color es lo rara que es.',
    cuando: siempre,
    hecha: nunca,
    orden: 1,
  },

  /* ---------------- Ajustes ---------------- */
  {
    id: 'privacidad',
    seccion: 'settings',
    ancla: 'privacidad',
    titulo: 'Tú decides quién te encuentra',
    texto: 'Puedes salir del buscador y del ranking y seguir teniendo tu enlace para quien tú quieras.',
    cuando: siempre,
    hecha: nunca,
    orden: 1,
  },
];

/** Cuántas pistas hay en total, para el contador de la guía. */
export const TOTAL_PISTAS = PISTAS.length;
