import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Pista } from '@/data/pistas';

/** Separación entre el ancla y la tarjeta. */
const AIRE = 12;
/** Margen mínimo contra los bordes de la ventana. */
const BORDE = 12;

interface Sitio {
  top: number;
  left: number;
  /** La tarjeta va encima del ancla: la flecha apunta hacia abajo. */
  arriba: boolean;
  /** No cupo ni arriba ni abajo y hubo que pegarla: la flecha no apuntaria
      a nada, asi que se esconde. */
  sinFlecha: boolean;
  /** Dónde cae la flecha dentro de la tarjeta, en px desde su izquierda. */
  flecha: number;
}

interface Props {
  candidatas: Pista[];
  aprendidas: number;
  total: number;
  onDescartar: (id: string) => void;
  onApagar: () => void;
}

/**
 * La tarjeta de la pista.
 *
 * Va con `position: fixed` y medida contra el rectángulo del ancla, no
 * dentro del panel: el panel del editor tiene scroll y `overflow` propio, y
 * una tarjeta metida ahí se cortaría por el borde justo cuando el ancla
 * está abajo del todo —que es la mitad de las veces—.
 */
export function Guia({ candidatas, aprendidas, total, onDescartar, onApagar }: Props) {
  const [pista, setPista] = useState<Pista | null>(null);
  const [sitio, setSitio] = useState<Sitio | null>(null);
  const cajaRef = useRef<HTMLDivElement>(null);

  /* De las candidatas, la primera que tenga su ancla puesta. Un ancla puede
     no existir todavía —hay controles que sólo aparecen con otra cosa
     encendida—, y en ese caso su pista espera su turno en vez de perderse. */
  useEffect(() => {
    const buscar = () => {
      const hay = candidatas.find((p) =>
        document.querySelector(`[data-guia="${p.ancla}"]`),
      );
      setPista(hay ?? null);
    };
    buscar();
    // Segundo intento: el panel puede estar todavía montándose.
    const t = setTimeout(buscar, 450);
    return () => clearTimeout(t);
  }, [candidatas]);

  /* Marcar el ancla y traerla a la vista. */
  useEffect(() => {
    if (!pista) return;
    const el = document.querySelector<HTMLElement>(`[data-guia="${pista.ancla}"]`);
    if (!el) return;
    el.classList.add('guia-foco');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return () => el.classList.remove('guia-foco');
  }, [pista]);

  /* Medir. En `useLayoutEffect` para que la tarjeta no se vea nunca en la
     esquina antes de saltar a su sitio. */
  useLayoutEffect(() => {
    if (!pista) {
      setSitio(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-guia="${pista.ancla}"]`);
    if (!el) return;

    const medir = () => {
      const r = el.getBoundingClientRect();
      const caja = cajaRef.current;
      const ancho = caja?.offsetWidth || 300;
      const alto = caja?.offsetHeight || 140;

      /* Debajo si cabe, encima si no. Y si no cabe en ninguno de los dos
         —ventanas muy bajas, anclas altas— se pega dentro de la ventana:
         una tarjeta descolocada se lee, una fuera de pantalla no. */
      let top = r.bottom + AIRE;
      let arriba = false;
      let sinFlecha = false;
      if (top + alto > window.innerHeight - BORDE) {
        const encima = r.top - alto - AIRE;
        if (encima > BORDE) {
          top = encima;
          arriba = true;
        } else {
          top = Math.max(BORDE, window.innerHeight - alto - BORDE);
          sinFlecha = true;
        }
      }

      // Alineada con el ancla, sin salirse de la ventana.
      const ideal = r.left;
      const left = Math.max(BORDE, Math.min(ideal, window.innerWidth - ancho - BORDE));

      // La flecha se queda sobre el ancla aunque la tarjeta se haya
      // desplazado para no salirse: si no, apuntaría al vacío.
      const centroAncla = r.left + Math.min(r.width, 120) / 2;
      const flecha = Math.max(16, Math.min(centroAncla - left, ancho - 16));

      setSitio({ top, left, arriba, flecha, sinFlecha });
    };

    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    if (cajaRef.current) ro.observe(cajaRef.current);
    // `true` para capturar también el scroll de los paneles interiores, que
    // no burbujea hasta window.
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [pista]);

  if (!pista) return null;

  return (
    <aside
      ref={cajaRef}
      className={`guia${sitio?.arriba ? ' guia--arriba' : ''}${
        sitio?.sinFlecha ? ' guia--pegada' : ''
      }`}
      style={{
        top: sitio ? `${sitio.top}px` : '-999px',
        left: sitio ? `${sitio.left}px` : '-999px',
        // La flecha se coloca con una variable para no repetir la regla.
        ['--flecha' as string]: `${sitio?.flecha ?? 24}px`,
        visibility: sitio ? 'visible' : 'hidden',
      }}
      aria-live="polite"
    >
      <div className="guia__cab">
        <span className="guia__punto" aria-hidden="true" />
        <h4 className="guia__t">{pista.titulo}</h4>
        <button
          type="button"
          className="guia__x"
          onClick={onApagar}
          title="No enseñarme más pistas"
          aria-label="No enseñarme más pistas"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p className="guia__d">{pista.texto}</p>

      <div className="guia__pie">
        <span className="guia__cuenta">
          {aprendidas} de {total}
        </span>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => onDescartar(pista.id)}
        >
          Entendido
        </button>
      </div>
    </aside>
  );
}
