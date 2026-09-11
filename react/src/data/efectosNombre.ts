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

export interface DefEfectoNombre {
  id: string;
  nombre: string;
  /** Qué hace, en una línea, para la tarjeta y el buscador. */
  desc: string;
  /**
   * `basico` son los de siempre; `avanzado` es la familia nueva.
   *
   * No es una etiqueta de precio —eso es `pro`—, es de qué CLASE es el
   * efecto. Dieciocho tarjetas seguidas sin separar son un muro; en dos
   * grupos con su título se leen.
   */
  grupo: 'basico' | 'avanzado';
  /**
   * Cuántas copias del texto necesita, de 0 a 3.
   *
   * El componente pinta ese armazón y nada más; lo que cada capa hace lo
   * decide el CSS. Asi ningun efecto tiene que inventarse su propio HTML,
   * que es de donde salen los componentes de trescientas lineas con un
   * `if` por efecto.
   */
  capas?: 0 | 1 | 2 | 3;
  /**
   * Si RELLENA las letras: el texto queda transparente y el color sale de
   * un fondo recortado a su forma.
   *
   * Importa fuera de aquí: sobre letras transparentes un `text-shadow` se
   * ve POR DEBAJO del relleno y sale un manchón, así que la sombra y el
   * resplandor tienen que dibujarse con `drop-shadow`, que sigue la
   * silueta. El perfil lo decide con esto.
   */
  rellena?: boolean;
  /**
   * Si la corrupción procedural tiene que programarle pulsos.
   *
   * Es el único que necesita un reloj: lo suyo es ser IMPREDECIBLE, y unos
   * fotogramas de CSS siempre caen en el mismo sitio.
   */
  pulsos?: boolean;
  /** Valores de partida de sus mandos. */
  ajustes?: AjustesEfecto;
  pro?: boolean;
}

/**
 * ────────────────────────────────────────────────────────────────────────
 * LOS DIECIOCHO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Cinco libres y trece de pago. El corte no es por lo difícil que sea cada
 * uno, es por lo que hace cada uno:
 *
 *   · Los LIBRES no cambian la materia del nombre. Late, flota, se escribe
 *     o cruza un color: sigue siendo tu nombre con tu letra y tu color, y
 *     un perfil sin pagar no se ve roto ni a medias.
 *
 *   · Los de PAGO cambian de qué está HECHO el nombre. De cristal, de luz
 *     líquida, de un holograma, de algo que se come la luz de alrededor.
 *     Eso ya no es tu nombre bien puesto: es tu nombre y de nadie más, que
 *     es lo que se cobra.
 *
 * «Arcoíris» y «Máquina de escribir» eran de pago hasta hoy y bajan a
 * libres. Nadie pierde nada —quien pagaba los sigue teniendo— y el plan se
 * queda con trece efectos en vez de cuatro, así que el trato mejora por los
 * dos lados.
 */
export const EFECTOS_NOMBRE: readonly DefEfectoNombre[] = [
  // ── Básicos ────────────────────────────────────────────────
  { id: 'none',  nombre: 'Ninguno', desc: 'Tu nombre, quieto.', grupo: 'basico' },
  /* Estos dos no declaran ajustes y es a propósito: no montan armazón, así
     que no hay ningún elemento suyo donde escribirlos y su único número vive
     en su regla de CSS. Declararlo aquí además sería tenerlo en dos sitios, y
     dos sitios con el mismo número acaban siempre con números distintos.
     Los dos mandos comunes sí los respetan: llegan desde la raíz del perfil. */
  { id: 'pulse', nombre: 'Latido', desc: 'Crece y encoge, muy poco, sin parar.', grupo: 'basico' },
  { id: 'float', nombre: 'Flotar', desc: 'Sube y baja despacio, como si no pesara.', grupo: 'basico' },
  {
    id: 'maquina',
    nombre: 'Máquina de escribir',
    desc: 'Se escribe letra a letra, se borra y vuelve a empezar.',
    grupo: 'basico',
  },
  {
    id: 'arcoiris',
    nombre: 'Arcoíris',
    desc: 'Los siete colores cruzando el nombre sin parar.',
    grupo: 'basico',
    rellena: true,
  },

  // ── Avanzados ──────────────────────────────────────────────
  {
    id: 'sweep',
    nombre: 'Barrido de luz',
    desc: 'Un brillo recorre las letras. Con degradado propio mueve el tuyo.',
    grupo: 'avanzado',
    rellena: true,
    pro: true,
  },
  {
    id: 'aura',
    nombre: 'Resplandor avanzado',
    desc: 'Luz con volumen: dos halos de distinto color y distinto ritmo, no una sombra plana.',
    grupo: 'avanzado',
    capas: 2,
    ajustes: { blur: 0.17, glow: 0.34, op: 0.5 },
    pro: true,
  },
  {
    id: 'desfase',
    nombre: 'Desfase',
    desc: 'Tres copias casi invisibles derivando a distinta velocidad. Profundidad, no temblor.',
    grupo: 'avanzado',
    capas: 3,
    ajustes: { desp: 0.038, op: 0.15 },
    pro: true,
  },
  {
    id: 'eco',
    nombre: 'Eco',
    desc: 'El nombre se expande hacia fuera en ondas que se apagan, una detrás de otra.',
    grupo: 'avanzado',
    capas: 3,
    ajustes: { esc: 0.085, op: 0.4 },
    pro: true,
  },
  {
    id: 'prisma',
    nombre: 'Prisma vivo',
    desc: 'La luz se descompone y se recompone al pasar por las letras. Lento, no un arcoíris.',
    grupo: 'avanzado',
    capas: 3,
    rellena: true,
    ajustes: { crom: 0.014, op: 0.62 },
    pro: true,
  },
  {
    id: 'holograma',
    nombre: 'Holograma',
    desc: 'Capas transparentes, líneas de barrido finísimas y una luz que se mueve por dentro.',
    grupo: 'avanzado',
    capas: 3,
    rellena: true,
    ajustes: { crom: 0.013, op: 0.9, ruido: 0.3 },
    pro: true,
  },
  {
    id: 'interferencia',
    nombre: 'Interferencia',
    desc: 'Una banda recorre el nombre de arriba abajo y deforma solo lo que toca.',
    grupo: 'avanzado',
    capas: 2,
    ajustes: { desp: 0.055, dist: 1.07 },
    pro: true,
  },
  {
    id: 'neon',
    nombre: 'Neón líquido',
    desc: 'El color corre por dentro de las letras como si fuera líquido, y el brillo lo sigue.',
    grupo: 'avanzado',
    capas: 2,
    rellena: true,
    ajustes: { blur: 0.2, op: 0.55 },
    pro: true,
  },
  {
    id: 'cristal',
    nombre: 'Cristal',
    desc: 'Vidrio de verdad: grosor, un reflejo que cruza y la luz que se dobla al atravesarlo.',
    grupo: 'avanzado',
    capas: 3,
    rellena: true,
    ajustes: { op: 0.26, desp: 0.022 },
    pro: true,
  },
  {
    id: 'corrupcion',
    nombre: 'Corrupción',
    desc: 'Quieto casi siempre. De vez en cuando un trozo se desencaja y vuelve. Nunca igual.',
    grupo: 'avanzado',
    capas: 2,
    pulsos: true,
    ajustes: { desp: 0.07 },
    pro: true,
  },
  {
    id: 'entropia',
    nombre: 'Entropía',
    desc: 'Las letras respiran: se deforman un poquito, como algo vivo. Casi no se ve, y se nota.',
    grupo: 'avanzado',
    ajustes: { dist: 1.4 },
    pro: true,
  },
  {
    id: 'materia',
    nombre: 'Materia oscura',
    desc: 'En vez de dar luz, se la come. Las letras abren un hueco negro a su alrededor.',
    grupo: 'avanzado',
    capas: 2,
    rellena: true,
    ajustes: { blur: 0.3, op: 0.85 },
    pro: true,
  },
  {
    id: 'singularidad',
    nombre: 'Singularidad',
    desc: 'El espacio se curva alrededor del nombre. Distorsión mínima y un filo de color.',
    grupo: 'avanzado',
    capas: 3,
    ajustes: { dist: 1.2, crom: 0.009, op: 0.5 },
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
 * «Fallo de señal» era la primera version de esto: dos copias en rojo y azul
 * temblando sin parar. «Corrupción» es lo mismo hecho bien —quieta casi todo
 * el rato y rompiendo cuando no lo esperas—, asi que quien tuviera aquel se
 * queda con este y no con nada.
 */
export const EFECTOS_MUDADOS: Readonly<Record<string, string>> = {
  glitch: 'corrupcion',
};

export const EFECTOS_POR_GRUPO = [
  { grupo: 'basico' as const, titulo: 'Básicos', items: EFECTOS_NOMBRE.filter((e) => e.grupo === 'basico') },
  { grupo: 'avanzado' as const, titulo: 'Avanzados', items: EFECTOS_NOMBRE.filter((e) => e.grupo === 'avanzado') },
];
