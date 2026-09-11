/**
 * Los efectos del nombre.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA IDEA: un efecto es un DATO, no un componente.
 * ────────────────────────────────────────────────────────────────────────
 *
 * Añadir un efecto nuevo son dos cosas y ninguna es código de React:
 *
 *   1. una fila en la tabla de abajo,
 *   2. un bloque de CSS en `styles/efectos.css` colgando de
 *      `[data-nameanim="<id>"]`.
 *
 * Todo lo demás sale solo: el armazon de capas que necesita, sus mandos, la
 * tarjeta del selector con su previa en vivo, el saneado del campo, el
 * buscador del editor y el reparto gratis/de pago. Un solo componente los
 * pinta a los dieciocho —`NombreEfecto`— y nunca hay que tocarlo.
 *
 * Esto no es abstracción por gusto. La version anterior tenia siete efectos
 * y ya habia dos que no se podian elegir porque estaban en el CSS y no en
 * ninguna lista. Con una sola lista eso no puede pasar: lo que no esta aqui
 * no existe, y lo que esta aqui sale en todas partes.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LOS MANDOS
 * ────────────────────────────────────────────────────────────────────────
 *
 * Cada efecto declara valores para los mandos que usa y el componente los
 * escribe como variables CSS sobre el nombre. El CSS los lee con un valor
 * de respaldo, asi que declarar es opcional siempre.
 *
 * De todos ellos, dos son COMUNES y los respetan los dieciocho:
 *
 *   --fx-int   intensidad. Multiplica desplazamientos, opacidades y
 *              desenfoques. 1 es lo normal.
 *   --fx-vel   velocidad. DIVIDE las duraciones, asi que 2 es el doble de
 *              rapido. Por eso en el CSS las duraciones se escriben
 *              `calc(9s / var(--fx-vel))` y no al reves: una duracion
 *              partida por un numero sigue siendo una duracion, y
 *              multiplicada por «lo lento que va» habria que invertir el
 *              mando en la interfaz, que es donde se cuelan los errores.
 *
 * Los demas son de cada efecto y estan aqui para que el sistema pueda
 * crecer sin tocar el componente: escala, direccion, desenfoque,
 * distorsion, opacidad, resplandor, desplazamiento, ruido, aberracion
 * cromatica y hasta dos colores.
 */

/** Los mandos, por su nombre corto. La variable CSS es `--fx-<mando>`. */
export type MandoEfecto =
  | 'int'
  | 'vel'
  | 'esc'
  | 'dir'
  | 'blur'
  | 'dist'
  | 'op'
  | 'glow'
  | 'desp'
  | 'ruido'
  | 'crom'
  | 'col'
  | 'col2';

export type AjustesEfecto = Partial<Record<MandoEfecto, number | string>>;

/**
 * ────────────────────────────────────────────────────────────────────────
 * LOS NIVELES
 * ────────────────────────────────────────────────────────────────────────
 *
 * `pro` dice si se paga. `nivel` dice OTRA COSA: cuánto hay dentro. Son
 * cuatro y no se solapan:
 *
 *   libre       Sencillos y bonitos. No cambian la materia del nombre:
 *               sigue siendo tu nombre con tu letra y tu color.
 *   premium     Varias capas trabajando juntas. Se nota que alguien lo
 *               pensó.
 *   premium+    Cambian de qué está HECHO el nombre: vidrio, luz líquida,
 *               un holograma.
 *   signature   Los que existen para que alguien diga «quiero ese». Tienen
 *               relieve, luz que vive en el espacio y reaccionan a ti.
 *
 * El salto de verdad está entre `premium+` y `signature`, y no es de
 * cantidad. Todo lo anterior es una IMAGEN: muy trabajada, pero se ve igual
 * hagas lo que hagas, y el ojo lo sabe sin poder explicarlo. Los `signature`
 * tienen una luz en algún sitio; si la mueves, cambia el brillo. Eso es la
 * diferencia entre un dibujo y un material.
 */
export type NivelEfecto = 'libre' | 'premium' | 'premium+' | 'signature';

export interface DefEfectoNombre {
  id: string;
  nombre: string;
  /** Qué hace, en una línea, para la tarjeta y el buscador. */
  desc: string;
  /** Cuánto hay dentro. Ver arriba; no es lo mismo que `pro`. */
  nivel: NivelEfecto;
  /**
   * Cuántas copias del texto necesita, de 0 a 3.
   *
   * El componente pinta ese armazón y nada más; lo que cada capa hace lo
   * decide el CSS. Así ningún efecto tiene que inventarse su propio HTML,
   * que es de donde salen los componentes de trescientas líneas con un `if`
   * por efecto.
   */
  capas?: 0 | 1 | 2 | 3;
  /**
   * Si RELLENA las letras: el texto queda transparente y el color sale de
   * un fondo recortado a su forma.
   *
   * Importa fuera de aquí: sobre letras transparentes un `text-shadow` se ve
   * POR DEBAJO del relleno y sale un manchón, así que la sombra y el
   * resplandor tienen que dibujarse con `drop-shadow`, que sigue la silueta.
   */
  rellena?: boolean;
  /**
   * Si le hace falta LA LUZ.
   *
   * Los materiales se iluminan desde un punto del espacio que se mueve —te
   * sigue, y cuando te estás quieto da una vuelta lenta por su cuenta—. Eso
   * lo lleva `lib/luz.ts`, y sólo se pone en marcha si hay alguien que la
   * necesite: esto es lo que lo dice.
   */
  luz?: boolean;
  /** Si se dibuja en un lienzo además de en el DOM. */
  lienzo?: boolean;
  /**
   * Si la corrupción procedural tiene que programarle pulsos.
   *
   * Es el único con reloj propio: lo suyo es ser IMPREDECIBLE, y unos
   * fotogramas de CSS siempre caen en el mismo sitio.
   */
  pulsos?: boolean;
  /** Valores de partida de sus mandos. */
  ajustes?: AjustesEfecto;
  pro?: boolean;
}

/**
 * ────────────────────────────────────────────────────────────────────────
 * EL CATÁLOGO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Cinco libres y diecinueve de pago. El corte no es por lo difícil que sea
 * cada uno, es por lo que hace:
 *
 *   · Los LIBRES no cambian la materia del nombre. Late, flota, se escribe
 *     o cruza un color: un perfil sin pagar no se ve roto ni a medias.
 *
 *   · Los de PAGO cambian de qué está HECHO. De obsidiana, de metal
 *     fundido, de hielo, de algo con un agujero dentro. Eso ya no es tu
 *     nombre bien puesto: es tu nombre y de nadie más.
 */
export const EFECTOS_NOMBRE: readonly DefEfectoNombre[] = [
  // ── Libres ─────────────────────────────────────────────────
  { id: 'none', nombre: 'Ninguno', desc: 'Tu nombre, quieto.', nivel: 'libre' },
  /* Estos dos no declaran ajustes y es a propósito: no montan armazón, así
     que no hay ningún elemento suyo donde escribirlos y su único número vive
     en su regla de CSS. Declararlo aquí sería tenerlo en dos sitios, y dos
     sitios con el mismo número acaban siempre con números distintos. Los dos
     mandos comunes sí los respetan: llegan desde la raíz del perfil. */
  { id: 'pulse', nombre: 'Latido', desc: 'Crece y encoge, muy poco, sin parar.', nivel: 'libre' },
  { id: 'float', nombre: 'Flotar', desc: 'Sube y baja despacio, como si no pesara.', nivel: 'libre' },
  {
    id: 'maquina',
    nombre: 'Máquina de escribir',
    desc: 'Se escribe letra a letra, se borra y vuelve a empezar.',
    nivel: 'libre',
  },
  {
    id: 'arcoiris',
    nombre: 'Arcoíris',
    desc: 'Los siete colores cruzando el nombre sin parar.',
    nivel: 'libre',
    rellena: true,
  },

  // ── Premium ────────────────────────────────────────────────
  {
    id: 'sweep',
    nombre: 'Barrido de luz',
    desc: 'Un brillo recorre las letras. Con degradado propio mueve el tuyo.',
    nivel: 'premium',
    rellena: true,
    pro: true,
  },
  {
    id: 'aura',
    nombre: 'Resplandor avanzado',
    desc: 'Luz con volumen: dos halos de distinto color y distinto ritmo, no una sombra plana.',
    nivel: 'premium',
    capas: 2,
    ajustes: { blur: 0.17, glow: 0.34, op: 0.5 },
    pro: true,
  },
  {
    id: 'desfase',
    nombre: 'Desfase',
    desc: 'Tres copias casi invisibles derivando a distinta velocidad. Profundidad, no temblor.',
    nivel: 'premium',
    capas: 3,
    ajustes: { desp: 0.038, op: 0.15 },
    pro: true,
  },
  {
    id: 'eco',
    nombre: 'Eco',
    desc: 'El nombre se expande hacia fuera en ondas que se apagan, una detrás de otra.',
    nivel: 'premium',
    capas: 3,
    ajustes: { esc: 0.085, op: 0.4 },
    pro: true,
  },
  {
    id: 'interferencia',
    nombre: 'Interferencia',
    desc: 'Una banda recorre el nombre de arriba abajo y deforma solo lo que toca.',
    nivel: 'premium',
    capas: 2,
    ajustes: { desp: 0.055, dist: 1.07 },
    pro: true,
  },
  {
    id: 'entropia',
    nombre: 'Entropía',
    desc: 'Las letras respiran: se deforman un poquito, como algo vivo. Casi no se ve, y se nota.',
    nivel: 'premium',
    ajustes: { dist: 1.4 },
    pro: true,
  },

  // ── Premium+ ───────────────────────────────────────────────
  {
    id: 'prisma',
    nombre: 'Prisma vivo',
    desc: 'La luz se descompone y se recompone al pasar por las letras. Lento, no un arcoíris.',
    nivel: 'premium+',
    capas: 3,
    rellena: true,
    ajustes: { crom: 0.014, op: 0.62 },
    pro: true,
  },
  {
    id: 'holograma',
    nombre: 'Holograma',
    desc: 'Capas transparentes, líneas de barrido finísimas y una luz que se mueve por dentro.',
    nivel: 'premium+',
    capas: 3,
    rellena: true,
    ajustes: { crom: 0.013, op: 0.9, ruido: 0.3 },
    pro: true,
  },
  {
    id: 'neon',
    nombre: 'Neón líquido',
    desc: 'El color corre por dentro de las letras como si fuera líquido, y el brillo lo sigue.',
    nivel: 'premium+',
    capas: 2,
    rellena: true,
    ajustes: { blur: 0.2, op: 0.55 },
    pro: true,
  },
  {
    id: 'cristal',
    nombre: 'Cristal',
    desc: 'Vidrio de verdad: grosor, un reflejo que cruza y la luz que se dobla al atravesarlo.',
    nivel: 'premium+',
    capas: 3,
    rellena: true,
    ajustes: { op: 0.26, desp: 0.022 },
    pro: true,
  },
  {
    id: 'caustica',
    nombre: 'Cáustica',
    desc: 'La luz que el agua dibuja en el fondo de una piscina, moviéndose sobre tus letras.',
    nivel: 'premium+',
    ajustes: { op: 0.75 },
    pro: true,
  },
  {
    id: 'corrupcion',
    nombre: 'Corrupción',
    desc: 'Quieto casi siempre. De vez en cuando un trozo se desencaja y vuelve. Nunca igual.',
    nivel: 'premium+',
    capas: 2,
    pulsos: true,
    ajustes: { desp: 0.07 },
    pro: true,
  },
  {
    id: 'materia',
    nombre: 'Materia oscura',
    desc: 'En vez de dar luz, se la come. Las letras abren un hueco negro a su alrededor.',
    nivel: 'premium+',
    capas: 2,
    rellena: true,
    ajustes: { blur: 0.3, op: 0.85 },
    pro: true,
  },
  {
    id: 'singularidad',
    nombre: 'Singularidad',
    desc: 'El espacio se curva alrededor del nombre. Distorsión mínima y un filo de color.',
    nivel: 'premium+',
    capas: 3,
    ajustes: { dist: 1.2, crom: 0.009, op: 0.5 },
    pro: true,
  },

  // ── Signature ──────────────────────────────────────────────
  // Aquí hay una luz de verdad en algún sitio. Muévela y cambia el brillo.
  {
    id: 'obsidiana',
    nombre: 'Obsidiana',
    desc: 'Vidrio volcánico pulido. El brillo recorre el canto y sigue a tu cursor.',
    nivel: 'signature',
    capas: 1,
    rellena: true,
    luz: true,
    ajustes: { op: 0.4 },
    pro: true,
  },
  {
    id: 'fundido',
    nombre: 'Fundido',
    desc: 'Metal recién sacado del fuego: la superficie ondula y el aire de alrededor tiembla.',
    nivel: 'signature',
    capas: 2,
    rellena: true,
    luz: true,
    ajustes: { op: 0.55, blur: 0.22 },
    pro: true,
  },
  {
    id: 'hielo',
    nombre: 'Hielo',
    desc: 'Lo que hay detrás se dobla al atravesarlo, y la luz fría se le queda dentro.',
    nivel: 'signature',
    capas: 2,
    luz: true,
    ajustes: { op: 0.45 },
    pro: true,
  },
  {
    id: 'abismo',
    nombre: 'Abismo',
    desc: 'Las letras son un agujero. Dentro hay profundidad, y se mueve cuando tú te mueves.',
    nivel: 'signature',
    capas: 1,
    rellena: true,
    /* No ilumina nada, pero sí necesita saber dónde está la luz: sus planos
       de profundidad se mueven con ella, y así el abismo mira al mismo sitio
       que el brillo de la obsidiana cuando los dos están en pantalla. */
    luz: true,
    ajustes: { op: 0.9 },
    pro: true,
  },
  {
    id: 'corriente',
    nombre: 'Corriente',
    desc: 'Energía recorriendo el contorno exacto de tus letras. Nunca hace el mismo camino.',
    nivel: 'signature',
    lienzo: true,
    pro: true,
  },
];

const POR_ID = new Map(EFECTOS_NOMBRE.map((e) => [e.id, e]));

export function efectoNombre(id: string | undefined | null): DefEfectoNombre | undefined {
  return id ? POR_ID.get(id) : undefined;
}

/** Si ese efecto deja las letras transparentes. Lo usa el perfil para elegir
 *  entre `text-shadow` y `drop-shadow`. */
export function rellenaElNombre(id: string | undefined | null): boolean {
  return !!efectoNombre(id)?.rellena;
}

export function efectoNombreEsPro(id: string | undefined | null): boolean {
  return !!efectoNombre(id)?.pro;
}

/** Los ids válidos, para el saneado. Sale de la tabla y no de una segunda
 *  lista escrita a mano, que es lo que se queda desactualizado. */
export const IDS_EFECTO: readonly string[] = EFECTOS_NOMBRE.map((e) => e.id);

/**
 * Efectos que ya no existen y a dónde va cada uno.
 *
 * «Fallo de señal» era la primera versión de la corrupción: dos copias en
 * rojo y azul temblando sin parar. La de ahora es lo mismo hecho bien
 * —quieta casi todo el rato y rompiendo cuando no lo esperas—, así que quien
 * tuviera aquélla se queda con ésta y no con nada.
 */
export const EFECTOS_MUDADOS: Readonly<Record<string, string>> = {
  glitch: 'corrupcion',
};

const TITULOS: Record<NivelEfecto, string> = {
  libre: 'Básicos',
  premium: 'Premium',
  'premium+': 'Premium +',
  signature: 'Signature',
};

const PIES: Record<NivelEfecto, string> = {
  libre: 'Sencillos y bonitos. Tu nombre sigue siendo tu nombre.',
  premium: 'Varias capas trabajando juntas.',
  'premium+': 'Cambian de qué está hecho el nombre.',
  signature: 'Tienen luz propia y reaccionan a ti.',
};

export const EFECTOS_POR_NIVEL = (['libre', 'premium', 'premium+', 'signature'] as const).map(
  (nivel) => ({
    nivel,
    titulo: TITULOS[nivel],
    pie: PIES[nivel],
    items: EFECTOS_NOMBRE.filter((e) => e.nivel === nivel),
  }),
);
