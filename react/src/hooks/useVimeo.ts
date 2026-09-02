import { useEffect, useRef, useState } from 'react';
import { esVimeo, infoVimeo, type InfoVimeo } from '@/lib/vimeo';

type Estado = 'quieto' | 'cargando' | 'listo' | 'error';

/**
 * Lee de Vimeo la ficha del vídeo pegado en el editor.
 *
 * Se escribe en el campo letra a letra, así que la petición se retrasa medio
 * segundo y se cancela la anterior: sin eso, escribir una URL de treinta
 * caracteres lanzaba treinta llamadas, y la última en responder no tenía por
 * qué ser la del texto actual.
 *
 * `alLeer` recibe la ficha cuando llega. Vive en una referencia a propósito:
 * si entrara en las dependencias del efecto, una función escrita en línea en
 * el render volvería a disparar la petición en cada tecla.
 */
export function useVimeo(url: string, alLeer?: (info: InfoVimeo) => void) {
  const [info, setInfo] = useState<InfoVimeo | null>(null);
  const [estado, setEstado] = useState<Estado>('quieto');
  const alLeerRef = useRef(alLeer);
  alLeerRef.current = alLeer;

  useEffect(() => {
    if (!esVimeo(url)) {
      setInfo(null);
      setEstado('quieto');
      return;
    }

    const ctrl = new AbortController();
    setEstado('cargando');

    const t = setTimeout(() => {
      infoVimeo(url, ctrl.signal)
        .then((d) => {
          if (ctrl.signal.aborted) return;
          if (!d) {
            setEstado('error');
            return;
          }
          setInfo(d);
          setEstado('listo');
          alLeerRef.current?.(d);
        })
        .catch((e) => {
          // Abortar es lo normal aquí: significa que se siguió escribiendo.
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setEstado('error');
        });
    }, 500);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [url]);

  return { info, estado };
}
