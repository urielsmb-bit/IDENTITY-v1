import { useEffect, useMemo, useState } from 'react';

/**
 * El nombre escribiendose LETRA A LETRA.
 *
 * La primera version era `clip-path` en CSS, recortando la caja de 100% a 0
 * en tantos pasos como letras. Se veia mal y por un motivo de fondo: un
 * recorte avanza por ANCHURA, y las letras no miden lo mismo. Una `i` y una
 * `m` ocupaban el mismo paso, asi que el corte caia en mitad de un glifo y lo
 * que aparecia eran trozos de bloque, no letras.
 *
 * Y en CSS puro no hay arreglo. Una letra por `<span>` con un retraso escalado
 * escribe bien, pero comparte fotogramas con las demas: los dos extremos de la
 * animacion —cuando aparece y cuando desaparece— quedan desplazados EN EL
 * MISMO SENTIDO. O sea que se escribe por la izquierda y se borra tambien por
 * la izquierda, que no es lo que hace una maquina de escribir. Contar letras
 * es trabajo de JavaScript.
 *
 * Sale una actualizacion por letra, y por eso esto es un componente propio y
 * diminuto: lo que se vuelve a pintar es este trozo, no el perfil entero.
 */

/**
 * Parte el texto en letras de verdad.
 *
 * `[...texto]` va por puntos de codigo, que ya es mucho mejor que `.length`
 * —que parte los emoji en dos—, pero sigue separando una bandera o un emoji
 * con tono de piel en sus piezas sueltas, y entonces la maquina escribe media
 * bandera. `Intl.Segmenter` agrupa lo que una persona ve como UN caracter.
 * Donde no exista, se cae a los puntos de codigo.
 */
/* `Intl.Segmenter` no esta en la libreria de tipos que compila este proyecto,
   asi que se describe aqui lo poco que se usa de el. Describirlo no lo crea:
   por eso debajo se comprueba que exista antes de llamarlo. */
interface Segmentador {
  segment(t: string): Iterable<{ segment: string }>;
}
type ConSegmentador = { Segmenter?: new (loc?: string, o?: { granularity: string }) => Segmentador };

function enLetras(texto: string): string[] {
  const Seg = (Intl as unknown as ConSegmentador).Segmenter;
  if (Seg) {
    try {
      const s = new Seg(undefined, { granularity: 'grapheme' });
      return Array.from(s.segment(texto), (t) => t.segment);
    } catch {
      /* Sin soporte real: abajo. */
    }
  }
  return [...texto];
}

/* Los tiempos. Borrar va mas rapido que escribir porque asi es como se
   escribe de verdad, y porque leer el nombre entero es lo que importa: la
   parte util del ciclo es la pausa con todo puesto. */
const PASO = 105;
const PASO_BORRADO = 45;
const ESPERA_ENTERO = 2200;
const ESPERA_VACIO = 600;

const QUIETO =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function NombreMaquina({ texto }: { texto: string }) {
  const letras = useMemo(() => enLetras(texto), [texto]);
  const total = letras.length;

  const [puestas, setPuestas] = useState(0);
  const [borrando, setBorrando] = useState(false);

  /* Si cambia el nombre —se esta escribiendo en el editor— vuelve a empezar.
     Sin esto, al escribir una letra mas la maquina se quedaria con el
     contador viejo y nunca llegaria al final. */
  useEffect(() => {
    setPuestas(0);
    setBorrando(false);
  }, [texto]);

  useEffect(() => {
    if (QUIETO) return;
    let t: number;
    if (!borrando) {
      t = window.setTimeout(
        puestas < total ? () => setPuestas(puestas + 1) : () => setBorrando(true),
        puestas < total ? PASO : ESPERA_ENTERO,
      );
    } else {
      t = window.setTimeout(
        puestas > 0 ? () => setPuestas(puestas - 1) : () => setBorrando(false),
        puestas > 0 ? PASO_BORRADO : ESPERA_VACIO,
      );
    }
    return () => window.clearTimeout(t);
  }, [puestas, borrando, total]);

  const visibles = QUIETO ? total : puestas;

  return (
    <span className="pf-tw">
      {/* EL HUECO. Es el nombre entero, invisible pero ocupando su sitio, y
          encima va el texto escrito hasta ahora en posicion absoluta.

          Sin esto el nombre cambia de ancho en cada letra: con el nombre
          centrado se descoloca a cada paso, y con lo que tenga debajo pegado
          empuja media pagina. Dieciocho veces por vuelta. Reservado el ancho
          desde el principio, no se mueve nada. */}
      <span className="pf-tw__hueco" aria-hidden="true">{texto}</span>
      <span className="pf-tw__txt" aria-hidden="true">
        {letras.slice(0, visibles).join('')}
        <i className="pf-tw__cur" />
      </span>
      {/* El nombre ENTERO, para quien lo escucha. Un lector de pantalla no ve
          una animacion: veria el nombre a medias en el momento en que le toque
          leerlo, y anunciaria «shar» como si asi se llamara alguien. */}
      <span className="pf-sr">{texto}</span>
    </span>
  );
}
