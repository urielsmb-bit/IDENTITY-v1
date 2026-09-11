import { useEffect, useRef, useState, type RefObject } from 'react';
import { cursor as createCursor } from '@/lib/effects';
import {
  cursorDeImagen, formaNativa, aplicarForma, FORMAS_NATIVAS,
  type CursorNativo, type FormaCursor,
} from '@/lib/cursorNativo';

/**
 * El cursor propio del perfil. Hay uno solo en toda la página.
 *
 * ────────────────────────────────────────────────────────────────────────
 * EL PUNTERO ES EL DEL SISTEMA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un `<div>` que persigue al ratón va siempre, como mínimo, un fotograma por
 * detrás de tu mano: el puntero de verdad lo pinta el sistema operativo
 * fuera de la página, y el nuestro tiene que esperar a que la página se
 * componga. Eso no se arregla afinando el seguimiento —ya estaba afinado, se
 * escribía en el propio evento desde `pointerrawupdate`—: se arregla no
 * dibujándolo nosotros.
 *
 * Así que se dibuja una vez en un lienzo —la imagen que hayas subido, o la
 * forma que hayas elegido— y se pone con `cursor: url(...)`. Retraso cero, y
 * además sigue funcionando encima de los paneles del editor y aunque la
 * pestaña esté ocupada.
 *
 * El `<div>` queda para dos cosas que el sistema no sabe hacer:
 *
 *   · el GLITCH, cuyo temblor se calcula a partir de la velocidad fotograma
 *     a fotograma. Un cursor del sistema es una imagen fija;
 *   · la ESTELA. Y ahí el retraso no importa: las chispas se quedan DONDE
 *     pasaste, así que ir un fotograma por detrás es lo que tienen que
 *     hacer.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y NO SE RECONSTRUYE AL ARRASTRAR
 * ────────────────────────────────────────────────────────────────────────
 *
 * El último efecto cambia tamaño y estela sobre lo que ya existe. Antes todo
 * colgaba de un solo efecto, así que cada paso de un deslizador desmontaba
 * el cursor entero —hasta ciento sesenta y ocho nodos de chispa borrados y
 * creados otra vez— entre dos movimientos del ratón.
 */
export function useCursor(
  type: string,
  enabled = true,
  opciones: {
    img?: string; size?: number | null;
    trail?: number | null; trailFx?: string;
    /** El acento del perfil, ya resuelto: en un lienzo no se puede leer una
     *  variable de CSS. */
    color?: string;
    /**
     * Donde se deja ver.
     *
     * Sin esto el cursor manda en toda la pagina, que es lo correcto en un
     * perfil publico —la pagina ES el perfil— pero no en el editor, donde
     * la mitad de la pantalla son mandos que no son del perfil. Se pasa la
     * referencia y no el nodo: al montar el efecto todavia no hay nodo.
     */
    ambitoRef?: RefObject<HTMLElement | null>;
    /** La raíz del perfil: donde se escriben las variables del cursor. */
    raizRef?: RefObject<HTMLElement | null>;
  } = {},
): boolean {
  const {
    img = '', size = null, trail = null, trailFx = '',
    color = '#ffffff', ambitoRef, raizRef,
  } = opciones;

  /** Si el puntero del sistema se hizo cargo. */
  const [nativo, setNativo] = useState(false);
  const vivoRef = useRef<ReturnType<typeof createCursor>>(null);

  /* ── 1 · el puntero del sistema ──────────────────────────── */
  useEffect(() => {
    const destino = raizRef?.current ?? ambitoRef?.current;
    /* El glitch no puede ser nativo: su temblor es por fotograma. */
    const puede = enabled && !!destino && (!!img || FORMAS_NATIVAS.has(type));
    if (!puede) {
      setNativo(false);
      return;
    }

    let vivo = true;
    let puesto: CursorNativo | null = null;

    const poner = (f: FormaCursor | null) => {
      if (!vivo || !f || !destino) return;
      puesto = aplicarForma(destino, f);
      setNativo(true);
    };

    if (img) {
      /* La imagen hay que cargarla y redibujarla, así que esto es asíncrono.
         Si el lienzo se contamina —otro dominio sin CORS— devuelve `null` y
         se queda el `<div>` de siempre, que funciona siempre. */
      void cursorDeImagen(img, size).then(poner);
    } else {
      poner(formaNativa(type, color));
    }

    return () => {
      vivo = false;
      puesto?.quitar();
      setNativo(false);
    };
  }, [enabled, img, size, type, color, ambitoRef, raizRef]);

  /* ── 2 · el `<div>`, para lo que el sistema no sabe hacer ── */
  const soloEstela = nativo;
  const hacenFalta = enabled && (
    soloEstela
      /* Con el puntero del sistema puesto, esto solo sigue vivo si hay
         estela que dejar. */
      ? (trail ?? 0) > 0
      : (type !== 'default' || !!img)
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
