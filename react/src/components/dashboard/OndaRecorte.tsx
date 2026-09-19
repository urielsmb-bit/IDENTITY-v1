import { useMemo, useRef } from 'react';

/**
 * La ventana que se arrastra por la canción.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LAS BARRAS NO SON EL AUDIO. Y HACE FALTA DECIRLO.
 * ────────────────────────────────────────────────────────────────────────
 *
 * La referencia era el recortador de Instagram, que pinta la forma de onda
 * de verdad. Eso aquí NO se puede: el audio vive dentro de un `iframe` de
 * YouTube, de otro origen, y el navegador no deja leer ni una muestra.
 * Instagram puede porque el archivo es suyo.
 *
 * Así que estas barras son un dibujo. Se pidieron igualmente, y se hacen,
 * pero quede escrito lo que implica: **si alguien busca el estribillo
 * mirando dónde suben, le está mintiendo el dibujo**. Para eso está el
 * botón de escuchar, que es lo único que dice la verdad.
 *
 * Dos cosas para que mientan lo menos posible:
 *
 *   · Las alturas salen del identificador del vídeo, no de `Math.random()`.
 *     Una canción tiene SIEMPRE la misma onda: si cambiara en cada
 *     repintado quedaría claro que es mentira, pero también sería
 *     imposible orientarse con ella, y mareando encima.
 *   · No se dibujan picos exagerados. Una onda muy dramática invita a
 *     leerla; una pareja invita a usar la ventana, que es lo que sí
 *     funciona.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LO QUE SÍ ES DE VERDAD
 * ────────────────────────────────────────────────────────────────────────
 *
 * La ventana. Se agarra por el centro para moverla entera, o por un borde
 * para estirarla, y las posiciones son segundos reales de la canción. Eso
 * es lo que hace bueno al recortador de Instagram —no la onda— y eso sí se
 * puede hacer igual.
 */

/** Cuántas barras se pintan. */
const BARRAS = 48;

/**
 * Alturas estables a partir del identificador.
 *
 * Un hash cualquiera sirve: lo único que se le pide es que el mismo vídeo
 * dé siempre lo mismo y que dos vídeos distintos no se parezcan.
 */
function alturasDe(id: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < BARRAS; i++) {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    /* Entre 0,35 y 1: ninguna barra desaparece —una fila con huecos parece
       un fallo de pintado— y ninguna llega al extremo. */
    out.push(0.35 + (h % 1000) / 1000 * 0.65);
  }
  return out;
}

function mmss(s: number): string {
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

export function OndaRecorte({
  videoId,
  total,
  inicio,
  duracion,
  onChange,
}: {
  videoId: string;
  /** Lo que dura la canción, en segundos. Lo dice YouTube. */
  total: number;
  inicio: number;
  /** 0 significa entera. */
  duracion: number;
  onChange: (r: { inicio: number; duracion: number }) => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const alturas = useMemo(() => alturasDe(videoId || 'sharee'), [videoId]);

  /* Con `duracion` en cero la ventana es la canción entera: así se ve desde
     el primer momento que lo que hay es una ventana, y arrastrarla es la
     forma de recortar. */
  const largo = duracion > 0 ? duracion : total;
  const fin = Math.min(total, inicio + largo);

  const pct = (s: number) => (total > 0 ? (s / total) * 100 : 0);

  /**
   * Un gesto, tres significados según por dónde agarres.
   *
   * Se captura el puntero para que el arrastre siga siendo tuyo aunque te
   * salgas de la barra: sin eso, subir el ratón tres píxeles a mitad de
   * gesto suelta la ventana donde estuviera.
   */
  const agarrar = (que: 'mover' | 'izq' | 'der') => (e: React.PointerEvent) => {
    if (total <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    /* La captura es una MEJORA, no un requisito, y estaba antes de
       enganchar los oyentes: si lanzaba, el arrastre entero se abortaba sin
       que nadie se enterara. Y lanza —`NotFoundError`— cuando el puntero ya
       no esta activo al llegar aqui, que pasa si se suelta entre el
       `pointerdown` y este codigo.

       Sin captura el arrastre funciona igual mientras no te salgas del
       elemento; con ella funciona tambien fuera. Perder lo segundo es
       aceptable; perder las dos por una excepcion, no. */
    try { el.setPointerCapture(e.pointerId); } catch { /* seguimos sin ella */ }

    const x0 = e.clientX;
    const i0 = inicio;
    const l0 = largo;

    const mover = (m: PointerEvent) => {
      const caja = pista.current?.getBoundingClientRect();
      if (!caja || caja.width <= 0) return;
      const delta = Math.round(((m.clientX - x0) / caja.width) * total);

      if (que === 'mover') {
        /* La ventana no se sale ni se encoge al empujarla contra un
           extremo: se para. Encogerla al llegar al final seria cambiar lo
           que dura sin que nadie lo haya pedido. */
        const i = Math.min(Math.max(0, i0 + delta), Math.max(0, total - l0));
        onChange({ inicio: i, duracion: duracion > 0 ? l0 : 0 });
        return;
      }
      if (que === 'izq') {
        /* Un segundo de minimo: por debajo la ventana desaparece y ya no
           hay de donde agarrarla para deshacerlo. */
        const i = Math.min(Math.max(0, i0 + delta), i0 + l0 - 1);
        onChange({ inicio: i, duracion: i0 + l0 - i });
        return;
      }
      const l = Math.min(Math.max(1, l0 + delta), total - i0);
      onChange({ inicio: i0, duracion: l });
    };

    const soltar = () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  };

  /* Y con el teclado, que es la mitad de lo que hace que esto sea un mando
     y no un dibujo con el que se puede jugar con el raton. */
  const teclas = (que: 'mover' | 'izq' | 'der') => (e: React.KeyboardEvent) => {
    const paso = e.shiftKey ? 10 : 1;
    let d = 0;
    if (e.key === 'ArrowRight') d = paso;
    else if (e.key === 'ArrowLeft') d = -paso;
    else return;
    e.preventDefault();
    if (que === 'mover') {
      onChange({
        inicio: Math.min(Math.max(0, inicio + d), Math.max(0, total - largo)),
        duracion: duracion > 0 ? largo : 0,
      });
    } else if (que === 'izq') {
      const i = Math.min(Math.max(0, inicio + d), inicio + largo - 1);
      onChange({ inicio: i, duracion: inicio + largo - i });
    } else {
      onChange({ inicio, duracion: Math.min(Math.max(1, largo + d), total - inicio) });
    }
  };

  return (
    <div className="onda">
      <div className="onda__pista" ref={pista}>
        {alturas.map((a, i) => {
          const s = (i / BARRAS) * total;
          const dentro = s >= inicio && s < fin;
          return (
            <i
              key={i}
              className={`onda__b${dentro ? ' is-dentro' : ''}`}
              style={{ height: `${Math.round(a * 100)}%` }}
            />
          );
        })}

        <div
          className="onda__ventana"
          style={{ left: `${pct(inicio)}%`, width: `${pct(fin - inicio)}%` }}
        >
          <span
            className="onda__asa onda__asa--izq"
            role="slider"
            tabIndex={0}
            aria-label="Dónde empieza"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={inicio}
            aria-valuetext={mmss(inicio)}
            onPointerDown={agarrar('izq')}
            onKeyDown={teclas('izq')}
          />
          <span
            className="onda__cuerpo"
            role="slider"
            tabIndex={0}
            aria-label="Mover el trozo"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, total - largo)}
            aria-valuenow={inicio}
            aria-valuetext={`De ${mmss(inicio)} a ${mmss(fin)}`}
            onPointerDown={agarrar('mover')}
            onKeyDown={teclas('mover')}
          />
          <span
            className="onda__asa onda__asa--der"
            role="slider"
            tabIndex={0}
            aria-label="Cuánto dura"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={largo}
            aria-valuetext={mmss(largo)}
            onPointerDown={agarrar('der')}
            onKeyDown={teclas('der')}
          />
        </div>
      </div>

      <div className="onda__pie">
        <span>{mmss(inicio)}</span>
        <b>{duracion > 0 ? `${mmss(largo)} de trozo` : 'canción entera'}</b>
        <span>{mmss(fin)}</span>
      </div>
    </div>
  );
}
