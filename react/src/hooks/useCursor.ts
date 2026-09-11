import { useEffect, useRef, useState, type RefObject } from 'react';
import { cursor as createCursor } from '@/lib/effects';
import { ponerCursorNativo, type CursorNativo } from '@/lib/cursorNativo';

/**
 * El cursor propio del perfil. Hay uno solo en toda la página.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CON IMAGEN, EL PUNTERO ES EL DEL SISTEMA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un `<div>` que persigue al ratón va siempre, como mínimo, un fotograma por
 * detrás de tu mano: el puntero de verdad lo pinta el sistema operativo
 * fuera de la página, y el nuestro tiene que esperar a que la página se
 * componga. Eso no se arregla afinando el seguimiento —ya estaba afinado, se
 * escribía en el propio evento desde `pointerrawupdate`—: se arregla no
 * dibujándolo nosotros.
 *
 * Así que cuando hay imagen se usa `cursor: url(...)`, que es el puntero de
 * verdad. Retraso cero, y además sigue funcionando encima de los paneles del
 * editor y aunque la pestaña esté ocupada.
 *
 * El `<div>` sigue existiendo para lo que el sistema no sabe hacer: las
 * formas que reaccionan —el aro que crece al pasar por un enlace, el temblor
 * del glitch, el halo— y la ESTELA. La estela no sufre el problema del
 * retraso porque se queda donde pasaste: ir un fotograma por detrás es
 * justamente lo que tiene que hacer.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y NO SE RECONSTRUYE AL ARRASTRAR
 * ────────────────────────────────────────────────────────────────────────
 *
 * El segundo efecto de abajo cambia tamaño y estela sobre lo que ya existe.
 * Antes todo colgaba de un solo efecto, así que cada paso de un deslizador
 * desmontaba el cursor entero —hasta ciento sesenta y ocho nodos de chispa
 * borrados y creados otra vez— entre dos movimientos del ratón.
 */
export function useCursor(
  type: string,
  enabled = true,
  opciones: {
    img?: string; size?: number | null;
    trail?: number | null; trailFx?: string;
    /**
     * Donde se deja ver.
     *
     * Sin esto el cursor manda en toda la pagina, que es lo correcto en un
     * perfil publico —la pagina ES el perfil— pero no en el editor, donde
     * la mitad de la pantalla son mandos que no son del perfil. Se pasa la
     * referencia y no el nodo: al montar el efecto todavia no hay nodo.
     */
    ambitoRef?: RefObject<HTMLElement | null>;
  } = {},
): boolean {
  const { img = '', size = null, trail = null, trailFx = '', ambitoRef } = opciones;

  /** Si el puntero del sistema se hizo cargo. */
  const [nativo, setNativo] = useState(false);
  const vivoRef = useRef<ReturnType<typeof createCursor>>(null);

  /* ── 1 · el puntero del sistema ──────────────────────────── */
  useEffect(() => {
    if (!enabled || !img) {
      setNativo(false);
      return;
    }
    let vivo = true;
    let puesto: CursorNativo | null = null;
    const destino = ambitoRef?.current ?? document.documentElement;

    void ponerCursorNativo(img, size, destino).then((c) => {
      if (!vivo) {
        c?.quitar();
        return;
      }
      puesto = c;
      setNativo(!!c);
    });

    return () => {
      vivo = false;
      puesto?.quitar();
      setNativo(false);
    };
  }, [enabled, img, size, ambitoRef]);

  /* ── 2 · el `<div>`, para lo que el sistema no sabe hacer ── */
  const soloEstela = nativo;
  const hacenFalta = enabled && (
    /* Con el puntero del sistema puesto, esto solo sigue vivo si hay estela
       que dejar. Sin estela no hay nada que dibujar y no se monta nada. */
    soloEstela ? (trail ?? 0) > 0 : (type !== 'default' || !!img)
  );

  useEffect(() => {
    if (!hacenFalta) return;

    const c = createCursor(type, {
      img, size, trail, trailFx, soloEstela,
      ambito: ambitoRef ? ambitoRef.current : null,
    });
    vivoRef.current = c;
    return () => {
      c?.destruir();
      vivoRef.current = null;
    };
    /* `img` entra aquí como booleano: pasar de tener imagen a no tenerla
       cambia si hay algo que dibujar siquiera, y eso es montar o desmontar.
       Cambiar una imagen POR OTRA se resuelve en el efecto de abajo. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hacenFalta, type, !!img, soloEstela, ambitoRef]);

  /* ── 3 · lo que se toca con un deslizador ────────────────── */
  useEffect(() => {
    vivoRef.current?.actualizar({
      img, size, trail, trailFx, soloEstela,
      ambito: ambitoRef ? ambitoRef.current : null,
    });
  }, [img, size, trail, trailFx, soloEstela, ambitoRef]);

  return nativo;
}
