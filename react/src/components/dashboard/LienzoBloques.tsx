import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Profile, BlockPos } from '@/types';

/** Movimiento por debajo del cual un arrastre cuenta como clic. */
const UMBRAL_CLIC = 4;

/** A cuánto del centro el imán tira. En % del ancho de la superficie: a ojo
 *  no se acierta nunca, y sin imán centrar es imposible con el ratón. */
const IMAN = 1.4;

interface Caja {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Desplazamiento en curso, en píxeles crudos del ratón. */
interface Gesto {
  id: string;
  modo: 'mover' | 'ancho';
  dx: number;
  dy: number;
  /** true mientras el imán del centro tiene cogida a la pieza */
  centrada?: boolean;
}

interface LienzoBloquesProps {
  profile: Profile;
  update: (partial: Partial<Profile>) => void;
  /** Se llama al pulsar una pieza sin arrastrarla */
  onAbrirBloque: (id: string) => void;
  seleccionado?: string | null;
  children: React.ReactNode;
}

const posDe = (p: Profile, id: string): BlockPos =>
  p.pos?.[id] ?? { col: 1, span: 12, align: 'stretch' };

/**
 * Capa de manipulación sobre la vista previa.
 *
 * Dibuja un tirador encima de cada pieza para moverla y redimensionarla con
 * el ratón. Funciona como un editor de diseño: la pieza se queda EXACTAMENTE
 * donde se suelta, aunque tape a otra. Nada de reflujo ni de "se va donde
 * cabe": eso es lo que hace una rejilla, y aquí no se quiere.
 *
 * Las coordenadas se guardan en % de la caja, no en píxeles, para que el
 * diseño aguante en pantallas de otro tamaño.
 */
export function LienzoBloques({
  profile,
  update,
  onAbrirBloque,
  seleccionado,
  children,
}: LienzoBloquesProps) {
  const contRef = useRef<HTMLDivElement>(null);
  const [cajas, setCajas] = useState<Caja[]>([]);
  /** Tamaño de la caja del lienzo, para pasar píxeles a %. */
  const cajaRef = useRef({ w: 0, h: 0 });
  const [gesto, setGesto] = useState<Gesto | null>(null);
  /** Mientras se arrastra no se remide: el reflujo constante daba tirones. */
  const gestoRef = useRef<Gesto | null>(null);

  const medir = useCallback(() => {
    if (gestoRef.current) return;
    const cont = contRef.current;
    const pila = cont?.querySelector('.pf-stack');
    if (!cont || !pila) return;

    const rCont = cont.getBoundingClientRect();
    const rPila = pila.getBoundingClientRect();
    cajaRef.current = { w: rPila.width, h: rPila.height };

    const items = Array.from(pila.querySelectorAll<HTMLElement>('[data-bloque]'));
    setCajas(
      items.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.bloque ?? '',
          x: r.left - rCont.left,
          y: r.top - rCont.top,
          w: r.width,
          h: r.height,
        };
      }),
    );
  }, []);

  useLayoutEffect(() => {
    medir();
  }, [medir, profile]);

  useEffect(() => {
    const cont = contRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(medir);
    ro.observe(cont);
    window.addEventListener('resize', medir);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [medir]);

  /** Escribe la posición de una pieza sin pisar la de las demás. */
  const setPos = useCallback(
    (id: string, parcial: Partial<BlockPos>) => {
      const actual = posDe(profile, id);
      update({ pos: { ...(profile.pos ?? {}), [id]: { ...actual, ...parcial } } });
    },
    [profile, update],
  );

  function iniciar(e: React.PointerEvent, id: string, modo: 'mover' | 'ancho') {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const xInicio = e.clientX;
    const yInicio = e.clientY;
    const inicio = posDe(profile, id);
    let movido = false;
    let raf = 0;
    let dx = 0;
    let dy = 0;

    // Todo el trabajo se hace una vez por fotograma: el ratón dispara
    // muchos más eventos de los que la pantalla puede dibujar, y atender a
    // todos era lo que hacía que el arrastre se sintiera pesado.
    const pintar = () => {
      raf = 0;
      const g: Gesto = { id, modo, dx, dy, centrada: gestoRef.current?.centrada };
      gestoRef.current = g;
      setGesto(g);

      const caja = cajaRef.current;
      if (!caja.w || !caja.h) return;

      if (modo === 'ancho') {
        // El ancho en % de la caja, con un mínimo para que no desaparezca.
        const w = Math.min(100, Math.max(5, (inicio.w ?? 100) + (dx / caja.w) * 100));
        setPos(id, { w: Math.round(w * 10) / 10 });
        return;
      }

      // Movimiento libre en los dos ejes a la vez. Sin ajuste a rejilla y
      // sin reordenar nada: la pieza acaba donde la deja el ratón, aunque
      // caiga encima de otra.
      //
      // Se acota a los mismos topes que el validador. Sin esto se podía
      // arrastrar una pieza a -33% y al recargar aparecía en -20: el diseño
      // cambiaba solo entre sesiones.
      const lim = (v: number, min: number, max: number) =>
        Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;

      // El centro de la superficie. La pieza ocupa `w`, así que sobra
      // (100 - w) y la mitad va a cada lado. Cerca de ahí el imán la coge:
      // centrar a ojo con el ratón no sale exacto nunca.
      const xLibre = (inicio.x ?? 0) + (dx / caja.w) * 100;
      const xCentro = (100 - (inicio.w ?? 100)) / 2;
      const imantada = Math.abs(xLibre - xCentro) <= IMAN;
      if (imantada !== !!g.centrada) {
        const g2: Gesto = { ...g, centrada: imantada };
        gestoRef.current = g2;
        setGesto(g2);
      }

      setPos(id, {
        x: imantada ? Math.round(xCentro * 10) / 10 : lim(xLibre, -20, 120),
        // La vertical va en píxeles: el alto del lienzo no es fijo y un %
        // de él desplazaba las piezas en cuanto cambiaba de altura.
        y: Math.round(Math.min(6000, Math.max(-400, (inicio.y ?? 0) + dy))),
      });
    };

    const mover = (ev: PointerEvent) => {
      dx = ev.clientX - xInicio;
      dy = ev.clientY - yInicio;
      if (Math.abs(dx) > UMBRAL_CLIC || Math.abs(dy) > UMBRAL_CLIC) movido = true;
      if (!raf) raf = requestAnimationFrame(pintar);
    };

    const soltar = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      if (raf) cancelAnimationFrame(raf);
      gestoRef.current = null;
      setGesto(null);
      // Al soltar hay que volver a medir: durante el arrastre se saltó.
      requestAnimationFrame(medir);

      const quieto =
        Math.abs(ev.clientX - xInicio) <= UMBRAL_CLIC &&
        Math.abs(ev.clientY - yInicio) <= UMBRAL_CLIC;
      if (!movido && quieto) onAbrirBloque(id);
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }

  return (
    <div className={`lienzo${gesto ? ' is-arrastrando' : ''}`} ref={contRef}>
      {children}

      <div className="lienzo__capa" aria-hidden="true">
        {/* El eje solo aparece cuando el imán tiene cogida la pieza: una
            guía permanente sería ruido en una vista previa. */}
        {gesto?.centrada && <span className="lienzo__eje" />}
        {cajas.map((c) => {
          const pos = posDe(profile, c.id);
          const g = gesto?.id === c.id ? gesto : null;
          const activo = !!g || seleccionado === c.id;

          // El tirador acompaña al ratón en crudo; la pieza de debajo va
          // saltando de columna. Al soltar, la transición lo devuelve a su
          // sitio en vez de teletransportarlo.
          const estilo: React.CSSProperties = {
            left: c.x,
            top: c.y,
            width: c.w,
            height: c.h,
          };
          if (g?.modo === 'mover') {
            estilo.transform = `translate(${g.dx}px, ${g.dy}px)`;
          } else if (g?.modo === 'ancho') {
            estilo.width = Math.max(24, c.w + g.dx);
          }

          return (
            <div
              key={c.id}
              className={`tirador${activo ? ' is-on' : ''}${g ? ' is-libre' : ''}`}
              style={estilo}
              onPointerDown={(e) => iniciar(e, c.id, 'mover')}
            >
              <span className="tirador__n">
                {c.id} · {Math.round(pos.w ?? 100)}%
              </span>
              <span
                className="tirador__ancho"
                onPointerDown={(e) => iniciar(e, c.id, 'ancho')}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
