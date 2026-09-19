import { useEffect, useRef, useState } from 'react';
import { Deslizador } from './Controles';
import { reproductorYouTube } from '@/lib/music';

/**
 * Desde qué segundo suena la canción, y cuánto.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE NO HAY FORMA DE ONDA
 * ────────────────────────────────────────────────────────────────────────
 *
 * La referencia era el recortador de Instagram, que pinta la onda del audio
 * y te deja arrastrar una ventana encima. Eso no se puede hacer aquí, y no
 * por falta de ganas: el audio vive dentro de un `iframe` de YouTube, de
 * otro origen, y el navegador no deja leer ni una muestra. Instagram puede
 * porque el archivo es suyo.
 *
 * Lo que sí se puede es lo que la onda servía para elegir —desde dónde y
 * cuánto— con la duración de verdad de la canción como tope. Eso es esto.
 *
 * ────────────────────────────────────────────────────────────────────────
 * DE DONDE SALE LA DURACION
 * ────────────────────────────────────────────────────────────────────────
 *
 * Del propio YouTube, que es el único que la sabe. Se crea un reproductor
 * escondido y mudo solo para preguntársela, y se destruye al salir. No se
 * guarda en el perfil a propósito: es un dato de YouTube y cambia si el
 * vídeo se reemplaza; guardarlo seria quedarse con una copia que puede
 * dejar de ser cierta sin que nadie se entere.
 *
 * Mientras no ha llegado, los deslizadores se quedan quietos en vez de
 * fingir un tope: uno que se mueve solo a mitad de gesto es peor que uno
 * que todavia no está.
 */

function mmss(s: number): string {
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

export function RecorteMusica({
  videoId,
  inicio,
  duracion,
  onChange,
}: {
  videoId: string;
  inicio: number;
  duracion: number;
  /** `duracion` en 0 significa entera. */
  onChange: (r: { inicio: number; duracion: number }) => void;
}) {
  const [total, setTotal] = useState(0);
  const [probando, setProbando] = useState(false);
  const hueco = useRef<HTMLDivElement>(null);
  const repro = useRef<ReturnType<typeof reproductorYouTube> | null>(null);
  const parar = useRef<number>(0);

  useEffect(() => {
    setTotal(0);
    if (!videoId || !hueco.current) return;
    let vivo = true;

    const p = reproductorYouTube(hueco.current, videoId, {
      alListo: () => {
        if (!vivo) return;
        /* La duración tarda un instante en estar aunque el reproductor
           diga que está listo. Se pregunta un par de veces antes de darse
           por vencido en vez de asumir que no la hay. */
        let intentos = 0;
        const mirar = () => {
          if (!vivo) return;
          const d = Math.floor(p?.duracion?.() || 0);
          if (d > 0) { setTotal(d); return; }
          if (++intentos < 10) window.setTimeout(mirar, 300);
        };
        mirar();
      },
    });
    repro.current = p;

    return () => {
      vivo = false;
      window.clearTimeout(parar.current);
      try { p?.destroy?.(); } catch { /* ya no estaba */ }
      repro.current = null;
    };
  }, [videoId]);

  /* Oírlo es la única forma de saber si el trozo es el bueno. Suena el
     recorte y se para solo al final, que es exactamente lo que hará el
     perfil. */
  const probar = () => {
    const p = repro.current;
    if (!p) return;
    window.clearTimeout(parar.current);
    if (probando) { try { p.pause(); } catch { /* da igual */ } setProbando(false); return; }
    try {
      p.fijarInicio(inicio);
      p.buscar(inicio);
      p.play();
    } catch { return; }
    setProbando(true);
    const dura = duracion > 0 ? duracion : Math.max(1, total - inicio);
    parar.current = window.setTimeout(() => {
      try { p.pause(); } catch { /* da igual */ }
      setProbando(false);
    }, dura * 1000);
  };

  const listo = total > 0;
  const finReal = duracion > 0 ? Math.min(total, inicio + duracion) : total;

  return (
    <div className="f">
      <div ref={hueco} style={{ display: 'none' }} aria-hidden="true" />

      {!videoId && <p className="f__d">Pon primero un enlace de YouTube.</p>}

      {videoId && !listo && (
        <p className="f__d">Preguntando a YouTube cuánto dura…</p>
      )}

      {videoId && listo && (
        <>
          <Deslizador
            label="Empieza en"
            desc={`De ${mmss(0)} a ${mmss(total)}. Lo que se oye al entrar en tu perfil.`}
            value={Math.min(inicio, total - 1)}
            min={0}
            max={Math.max(1, total - 1)}
            onChange={(n) => {
              /* El trozo no puede salirse de la cancion: si el inicio se
                 mete tan adentro que ya no cabe lo que dura, se acorta lo
                 que dura en vez de dejar un recorte imposible. */
              const cabe = total - n;
              onChange({ inicio: n, duracion: duracion > 0 ? Math.min(duracion, cabe) : 0 });
            }}
          />

          <Deslizador
            label="Cuánto suena"
            desc={
              duracion > 0
                ? `Vuelve a ${mmss(inicio)} al llegar a ${mmss(finReal)}.`
                : 'Entera. Muévelo para recortarla.'
            }
            value={duracion}
            min={0}
            max={Math.max(1, total - inicio)}
            onChange={(n) => onChange({ inicio, duracion: n })}
          />

          <div className="f__fila">
            <button type="button" className="btn btn--sm" onClick={probar}>
              {probando ? 'Parar' : 'Escuchar el trozo'}
            </button>
            {duracion > 0 && (
              <button
                type="button"
                className="btn btn--sm btn--quiet"
                onClick={() => onChange({ inicio: 0, duracion: 0 })}
              >
                Canción entera
              </button>
            )}
          </div>

          <p className="f__d" style={{ marginTop: 8 }}>
            {duracion > 0
              ? `Suena de ${mmss(inicio)} a ${mmss(finReal)} y vuelve a empezar.`
              : `Suena entera: ${mmss(total)}.`}
          </p>
        </>
      )}
    </div>
  );
}
