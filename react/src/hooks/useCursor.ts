import { useEffect, useRef, useState, type RefObject } from 'react';
import { cursor as createCursor } from '@/lib/effects';
import {
  cursorDeImagen, formaNativa, aplicarForma, FORMAS_NATIVAS,
  type CursorNativo, type FormaCursor,
} from '@/lib/cursorNativo';
import { crearEstela, type Estela, type OpcionesEstela } from '@/lib/estela';

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
 * El `<div>` queda como RESPALDO y hace falta: si la imagen viene de otro
 * dominio sin permiso para leerla, el lienzo se contamina y no se puede
 * sacar el `data:` que necesita el cursor del sistema. Ahí vuelve, y
 * funciona siempre.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA ESTELA VA APARTE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Son dos cosas distintas y por eso ya no cuelgan una de la otra: el puntero
 * tiene que estar exactamente donde tu mano, y la estela tiene que quedarse
 * DONDE PASASTE. Juntarlas obligaba a la estela a montarse y desmontarse
 * cada vez que cambiabas el cursor, y al cursor a cargar con ciento sesenta
 * y ocho nodos que no eran suyos.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y NO SE RECONSTRUYE AL ARRASTRAR
 * ────────────────────────────────────────────────────────────────────────
 *
 * Los efectos de abajo cambian tamaño, color y cantidad sobre lo que ya
 * existe. Antes todo colgaba de un solo efecto, así que cada paso de un
 * deslizador desmontaba el cursor entero entre dos movimientos del ratón.
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
    /** Color de la estela. Sin el, el de fabrica de la estela elegida. */
    trailColor?: string;
    /** Tamaño y brillo de la estela, en %. */
    trailInt?: number | null;
    /** Hacia donde se van las motas. */
    trailDir?: string;
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
    trailColor = '', trailInt = null, trailDir = 'seguimiento',
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

  /* ── 2 · el `<div>`, solo si el sistema no pudo ──────────── */
  const hacenFalta = enabled && !nativo && (type !== 'default' || !!img);

  useEffect(() => {
    if (!hacenFalta) return;
    const c = createCursor(type, {
      img, size, ambito: ambitoRef ? ambitoRef.current : null,
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
  }, [hacenFalta, type, !!img, ambitoRef]);

  useEffect(() => {
    vivoRef.current?.actualizar({
      img, size, ambito: ambitoRef ? ambitoRef.current : null,
    });
  }, [img, size, ambitoRef]);

  /* ── 3 · la estela ──────────────────────────────────────────
     Va por su cuenta y en un LIENZO, no colgando del cursor. Son dos cosas
     distintas: el puntero tiene que estar exactamente donde tu mano, y la
     estela tiene que quedarse donde pasaste. Juntarlas obligaba a la estela
     a montarse y desmontarse cada vez que cambiabas el cursor, y al cursor a
     cargar con ciento sesenta y ocho nodos que no eran suyos. */
  const estelaRef = useRef<Estela | null>(null);
  const hayEstela = enabled && (trail ?? 0) > 0;

  const ajustes = (): OpcionesEstela => ({
    fx: trailFx || 'chispas',
    cantidad: trail ?? 0,
    color: trailColor || undefined,
    intensidad: trailInt ?? 100,
    direccion: (trailDir as OpcionesEstela['direccion']) || 'seguimiento',
    ambito: ambitoRef ? ambitoRef.current : null,
  });

  useEffect(() => {
    if (!hayEstela) return;
    const e = crearEstela(ajustes());
    estelaRef.current = e;
    return () => {
      e?.destruir();
      estelaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayEstela, ambitoRef]);

  /* Cambiar de estela, de color o de cantidad NO vuelve a montar el lienzo:
     se le dicen los valores nuevos y sigue. Es lo que permite arrastrar un
     deslizador sin que cada paso tire el rastro entero. */
  useEffect(() => {
    estelaRef.current?.actualizar(ajustes());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailFx, trail, trailColor, trailInt, trailDir, ambitoRef]);

  return nativo;
}
