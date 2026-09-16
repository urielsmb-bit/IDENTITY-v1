import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * La hoja que sube desde abajo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE UNA HOJA Y NO UNA PANTALLA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Porque la regla del editor táctil es «veo algo, lo toco, lo edito, veo
 * el resultado». Una pantalla aparte rompe la última parte: sales del
 * perfil para cambiarlo y vuelves a ver qué pasó. Una hoja deja el lienzo
 * arriba, así que el cambio se ve mientras se hace.
 *
 * De ahí sale todo lo demás: nunca tapa del todo, se cierra arrastrando
 * hacia abajo, y tiene dos alturas —una que deja ver medio perfil y otra
 * para cuando hay mucho que tocar.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LO QUE HAY QUE VIGILAR EN UN DEDO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Tres gestos distintos viven a centímetros unos de otros: arrastrar la
 * hoja, desplazar su contenido y desplazar la página. Si se pelean, la
 * hoja se cierra cuando querías bajar una lista y la página se mueve
 * cuando querías cerrar la hoja.
 *
 * Se separan así:
 *
 *   · el tirador y la cabecera arrastran la hoja, y solo ellos. Llevan
 *     `touch-action: none` para que el navegador no intente desplazar con
 *     el mismo dedo.
 *   · el cuerpo se desplaza solo, con `overscroll-behavior: contain`, que
 *     es lo que evita que al llegar al final se lleve la página detrás.
 *   · el gesto se sigue con `setPointerCapture`, así que sale bien aunque
 *     el dedo se salga de la hoja a mitad de camino.
 */

/** Cuánto de la pantalla ocupa en cada postura. Ninguna llega al 100 %:
 *  una hoja que tapa el lienzo entero es una pantalla con animación. */
const ALTURAS = { media: 0.52, alta: 0.86 } as const;
export type Postura = keyof typeof ALTURAS;

/** Lo que hay que arrastrar para que cuente. Por debajo es un temblor de
 *  dedo al soltar, y cerrar la hoja por un temblor es de las cosas que más
 *  molestan de una interfaz táctil. */
const UMBRAL = 56;

export interface HojaInferiorProps {
  abierta: boolean;
  titulo: string;
  onCerrar: () => void;
  /** Para volver dentro de la hoja sin cerrarla: si se pasa, la cabecera
   *  enseña una flecha en vez del aspa. */
  onVolver?: () => void;
  children?: ReactNode;
}

export function HojaInferior({ abierta, titulo, onCerrar, onVolver, children }: HojaInferiorProps) {
  const [postura, setPostura] = useState<Postura>('media');
  /** Lo que el dedo lleva arrastrado ahora mismo. Vive aparte de la
   *  postura porque durante el gesto la hoja tiene que seguir al dedo al
   *  píxel, y solo al soltar se decide en qué postura cae. */
  const [arrastre, setArrastre] = useState(0);
  const hojaRef = useRef<HTMLDivElement>(null);
  const inicioRef = useRef(0);

  /* Al abrirse siempre empieza a media altura. Recordar la de la vez
     anterior suena bien y no lo es: abres «Fondo», la subes entera, abres
     «Perfil» y te tapa el perfil que venías a mirar. */
  useEffect(() => {
    if (abierta) {
      setPostura('media');
      setArrastre(0);
    }
  }, [abierta]);

  /* Escape cierra. En un teléfono no hay teclado, pero sí hay teclados
     externos y lectores de pantalla, y cuesta tres líneas. */
  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierta, onCerrar]);

  const alBajar = useCallback((e: React.PointerEvent) => {
    inicioRef.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const alMover = useCallback((e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) return;
    const d = e.clientY - inicioRef.current;
    /* Hacia arriba se frena a la cuarta parte. Sin eso, tirar hacia arriba
       desde la postura alta despega la hoja del borde y deja una franja
       vacía debajo. Frenado, se nota que hay tope sin dar un frenazo. */
    setArrastre(d < 0 && postura === 'alta' ? d / 4 : d);
  }, [postura]);

  const alSoltar = useCallback((e: React.PointerEvent) => {
    const d = arrastre;
    setArrastre(0);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ya soltado */ }
    if (d > UMBRAL) {
      /* Hacia abajo: de alta baja a media, y de media se cierra. Cerrar
         desde alta de un tirón se siente como si la hoja se escapara. */
      if (postura === 'alta') setPostura('media');
      else onCerrar();
      return;
    }
    if (d < -UMBRAL) setPostura('alta');
  }, [arrastre, postura, onCerrar]);

  if (!abierta) return null;

  const alto = `${Math.round(ALTURAS[postura] * 100)}svh`;

  return (
    <>
      {/* El velo no tapa: solo recoge el toque fuera para cerrar. Oscurecer
          el lienzo sería oscurecer justo lo que se está mirando. */}
      <button
        type="button"
        className="hoja__fuera"
        aria-label="Cerrar"
        onClick={onCerrar}
      />
      <section
        ref={hojaRef}
        className="hoja"
        role="dialog"
        aria-label={titulo}
        style={{
          height: alto,
          transform: arrastre ? `translateY(${Math.max(0, arrastre)}px)` : undefined,
          /* Sin transición mientras el dedo manda: con ella la hoja va un
             instante por detrás del dedo y se siente pegajosa. */
          transition: arrastre ? 'none' : undefined,
        }}
      >
        <header
          className="hoja__cab"
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <span className="hoja__tirador" aria-hidden="true" />
          <div className="hoja__fila">
            {onVolver ? (
              <button type="button" className="hoja__icono" onClick={onVolver} aria-label="Volver">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            ) : (
              <span className="hoja__icono hoja__icono--hueco" aria-hidden="true" />
            )}
            <h2 className="hoja__t">{titulo}</h2>
            <button type="button" className="hoja__icono" onClick={onCerrar} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="hoja__cuerpo">{children}</div>
      </section>
    </>
  );
}
