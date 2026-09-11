import { useEffect, useState, type CSSProperties } from 'react';
import { efectoNombre, type DefEfectoNombre } from '@/data/efectosNombre';
import { NombreMaquina } from './NombreMaquina';

/**
 * El nombre, con el efecto que sea.
 *
 * Este componente NO sabe qué hace ningún efecto. Sabe pintar un armazón y
 * escribir unas variables; lo que ocurre después es cosa del CSS. Por eso no
 * tiene un `switch` con dieciocho ramas y no crece cuando se añade el
 * decimonoveno: un efecto nuevo es una fila en `efectosNombre.ts` y un bloque
 * en `styles/efectos.css`, y aquí no se toca nada.
 *
 * EL ARMAZÓN
 *
 *   <span class="fxn">          ← ancla y portadora de las variables
 *     <span class="fxn__b">     ← el texto de verdad, en el flujo
 *     <span class="fxn__c"><i>  ← copia 1, encima, fuera del flujo
 *     <span class="fxn__c"><i>  ← copia 2
 *     ...
 *
 * Cada copia son DOS elementos a propósito. El de fuera recorta o enmascara
 * y el de dentro se mueve, que es lo que hace falta para una banda que
 * recorre el nombre deformando solo lo que toca: si fueran uno, recortar y
 * moverse serían la misma caja y la banda se llevaría el texto con ella.
 *
 * Y sólo se monta cuando hace falta. Los efectos que no piden capas —los
 * cinco libres, el barrido, la entropía— salen con el texto pelado, igual
 * que antes de todo esto. Son los más usados: no van a pagar en nodos el
 * armazón que necesitan otros.
 */

/* Uno solo por carga, no uno por nombre: es una consulta al sistema, no algo
   que cambie entre un perfil y otro. */
const QUIETO =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Los pulsos de la corrupción.
 *
 * Es el único efecto con reloj propio, y tiene motivo: lo suyo es ser
 * IMPREDECIBLE. Unos fotogramas de CSS caen siempre en el mismo sitio, y a
 * la tercera vuelta ya sabes cuándo viene el fallo; entonces deja de ser un
 * fallo y pasa a ser una animación.
 *
 * No es un bucle: son dos `setTimeout` encadenados que despiertan unas diez
 * veces por minuto. Entre pulso y pulso no corre nada. Lo que se mueve
 * durante el pulso lo mueve el CSS, que para eso está.
 *
 * Tres variantes para que ni siquiera la rotura se repita.
 */
function usePulsos(activo: boolean): number {
  const [pulso, setPulso] = useState(0);

  useEffect(() => {
    if (!activo || QUIETO) return;
    let vivo = true;
    let t = 0;

    const programar = () => {
      t = window.setTimeout(() => {
        if (!vivo) return;
        setPulso(1 + Math.floor(Math.random() * 3));
        t = window.setTimeout(() => {
          if (!vivo) return;
          setPulso(0);
          programar();
        }, 170 + Math.random() * 170);
      }, 2400 + Math.random() * 4800);
    };

    programar();
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [activo]);

  return pulso;
}

/**
 * Los mandos, convertidos en variables CSS.
 *
 * Los de cada efecto salen de su fila del catálogo; encima van los dos
 * comunes, que son los que se tocan desde el editor. Los valores van SIN
 * unidad y el CSS los multiplica por `1em` donde toque: así un
 * desplazamiento de `.038` vale lo mismo en un nombre de 28px que en uno de
 * 44, y el efecto no se deshace al cambiar el tamaño.
 */
function variables(def: DefEfectoNombre | undefined, int: number, vel: number): CSSProperties {
  const v: Record<string, string> = {};
  if (def?.ajustes) {
    for (const [k, val] of Object.entries(def.ajustes)) v[`--fx-${k}`] = String(val);
  }
  v['--fx-int'] = String(int);
  v['--fx-vel'] = String(vel);
  return v as CSSProperties;
}

export function NombreEfecto({
  texto,
  efecto,
  intensidad = 1,
  velocidad = 1,
}: {
  texto: string;
  efecto?: string;
  /** Multiplica desplazamientos, opacidades y desenfoques. */
  intensidad?: number;
  /** Divide las duraciones: 2 es el doble de rápido. */
  velocidad?: number;
}) {
  const def = efectoNombre(efecto);
  const capas = def?.capas ?? 0;
  const pulso = usePulsos(!!def?.pulsos);

  /* La máquina de escribir cuenta letras y eso no lo hace una hoja de
     estilos. Tiene su propio componente desde antes y sigue teniéndolo. */
  if (efecto === 'maquina') return <NombreMaquina texto={texto} />;

  /* Sin capas ni pulsos no hace falta armazón: el CSS del efecto le cuelga
     directamente al nombre, como toda la vida. */
  if (capas === 0 && !def?.pulsos) return <>{texto}</>;

  return (
    <span
      className="fxn"
      data-pulso={pulso || undefined}
      style={variables(def, intensidad, velocidad)}
    >
      <span className="fxn__b">{texto}</span>
      {Array.from({ length: capas }, (_, i) => (
        <span key={i} className="fxn__c" data-c={i + 1} aria-hidden="true">
          <i>{texto}</i>
        </span>
      ))}
    </span>
  );
}
