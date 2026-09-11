/**
 * Los efectos del nombre.
 *
 * Antes esto era un interruptor de sí o no («Barrido de luz») y ya está. Pero
 * la hoja de estilos tenía TRES animaciones escritas —`sweep`, `pulse` y
 * `float`— y sólo una podía llegar a verse, porque un booleano no sabe decir
 * cuál de las tres. Dos efectos terminados, y nadie podía ponérselos.
 *
 * Con un nombre en vez de un sí/no, las tres se alcanzan y caben las que
 * vengan. El catálogo vive aquí y no repartido entre el editor, el validador
 * y el CSS: cuando una lista de opciones está en tres sitios, tarde o
 * temprano dicen cosas distintas.
 */

export interface DefEfectoNombre {
  id: string;
  nombre: string;
  /** Qué hace, en una línea, para la tarjeta y el buscador. */
  desc: string;
  /**
   * Si RELLENA las letras.
   *
   * Estos efectos pintan el color con un fondo recortado a la forma del texto
   * y dejan la letra transparente. Importa fuera de aquí: sobre letras
   * transparentes un `text-shadow` se ve POR DEBAJO del relleno y sale un
   * manchón, así que la sombra y el resplandor tienen que dibujarse con
   * `drop-shadow`, que sigue la silueta. El perfil lo decide con esto.
   */
  rellena?: boolean;
  /** Si necesita saber cuántas letras tiene el nombre (la máquina de escribir). */
  cuentaLetras?: boolean;
  pro?: boolean;
}

/**
 * Tres gratis y cuatro de pago.
 *
 * El reparto no quita nada a nadie: hoy `sweep` es de pago y sigue siéndolo,
 * y `pulse` y `float` no los tenía NADIE porque no se podían elegir. O sea
 * que quien no paga gana dos efectos que antes no existían para él, y quien
 * paga no pierde ninguno.
 *
 * Y hay un motivo para que los gratis sean los de movimiento y los de pago
 * los de color: un nombre que late o flota sigue siendo tu nombre con tu
 * color: se ve bien. Uno en arcoíris o escribiéndose solo se ve TUYO, que es
 * por lo que se paga.
 */
export const EFECTOS_NOMBRE: readonly DefEfectoNombre[] = [
  { id: 'none',   nombre: 'Ninguno',  desc: 'Tu nombre, quieto.' },
  { id: 'pulse',  nombre: 'Latido',   desc: 'Crece y encoge, muy poco, sin parar.' },
  { id: 'float',  nombre: 'Flotar',   desc: 'Sube y baja despacio, como si no pesara.' },
  {
    id: 'sweep',
    nombre: 'Barrido de luz',
    desc: 'Un brillo recorre las letras. Con degradado propio mueve el tuyo.',
    rellena: true,
    pro: true,
  },
  {
    id: 'arcoiris',
    nombre: 'Arcoíris',
    desc: 'Los siete colores cruzando el nombre sin parar.',
    rellena: true,
    pro: true,
  },
  {
    id: 'maquina',
    nombre: 'Máquina de escribir',
    desc: 'Se escribe letra a letra, se borra y vuelve a empezar.',
    cuentaLetras: true,
    pro: true,
  },
  {
    id: 'glitch',
    nombre: 'Fallo de señal',
    desc: 'El nombre se desencaja en rojo y azul un instante.',
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
