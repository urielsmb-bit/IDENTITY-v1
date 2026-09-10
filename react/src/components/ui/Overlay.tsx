import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface OverlayProps {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  /** Una línea de qué es esta pieza. */
  desc?: string;
  /**
   * Se puede mirar pero no tocar: los ajustes de dentro son de pago.
   *
   * Se ABRE igual, y eso es lo importante. Un candado que no deja pasar no
   * vende nada: quien no ha pagado no llega a saber qué se está perdiendo, y
   * quien sí ha pagado tampoco entiende por qué. Aquí se ve la lista entera
   * de mandos, apagada, con lo que cuesta encenderla arriba del todo.
   */
  bloqueado?: boolean;
  children: ReactNode;
}

/**
 * Panel de ajustes que se abre encima.
 *
 * Es hermano de `Modal` y no el mismo componente a propósito: aquel es una
 * pregunta —dos frases y dos botones— y este es un formulario largo con su
 * propio scroll. Mezclarlos habría dado un componente con la mitad de sus
 * props apagadas en cada uso.
 *
 * Va por encima y no reemplazando el panel del editor porque ajustar una
 * pieza es un DESVÍO, no un sitio al que se va: se abre el avatar, se le
 * cambia el borde, se cierra y sigues donde estabas, con la lista de piezas
 * intacta detrás. Antes esto sustituía la sección entera, y volver era
 * encontrarte la lista desde arriba otra vez.
 *
 * Es un `<dialog>` de verdad. `showModal()` trae hecho —y bien— lo que a
 * mano sale mal casi siempre: el foco encerrado dentro, Esc para cerrar, el
 * resto de la página inerte para lectores de pantalla y el fondo oscurecido
 * con `::backdrop`.
 */
export function Overlay({
  abierto,
  alCerrar,
  titulo,
  desc,
  bloqueado = false,
  children,
}: OverlayProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // `showModal()` sobre uno ya abierto lanza excepción; de ahí el guardia.
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  /* Cada pieza empieza por arriba. Sin esto, abrir el avatar después de
     haber bajado dentro de la música te dejaba a media página de ajustes
     que no son los que acabas de pedir. */
  useEffect(() => {
    if (abierto) cuerpo.current?.scrollTo(0, 0);
  }, [abierto, titulo]);

  return (
    <dialog
      ref={ref}
      className="ovl"
      /* Esc dispara `cancel` y luego `close`: escuchando `close` se cubren
         los tres caminos de salida (Esc, la X y el clic fuera) con uno. */
      onClose={alCerrar}
      onClick={(e) => {
        // El backdrop no es un elemento: sus clics llegan al propio
        // <dialog>, mientras que los de dentro llegan a .ovl__caja.
        if (e.target === ref.current) alCerrar();
      }}
    >
      <div className="ovl__caja">
        <header className="ovl__enc">
          <div className="ovl__txt">
            <h2 className="ovl__t">{titulo}</h2>
            {desc && <p className="ovl__d">{desc}</p>}
          </div>
          <button type="button" className="ovl__x" onClick={alCerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {/* Solo mientras esta abierto. Un `<dialog>` cerrado sigue en el
            arbol —oculto, pero encontrable—, y eso hacia dos cosas mal: la
            guia apuntaba sus flechas a elementos de tamaño cero, y el
            editor de una pieza se montaba entero sin que nadie lo hubiera
            pedido. */}
        <div className="ovl__cuerpo" ref={cuerpo}>
          {abierto && bloqueado && (
            <div className="ovl__pro">
              <span className="ovl__pro-ic" aria-hidden="true">
                <svg viewBox="23 32 465 448" fill="currentColor">
                  <path d="M396.31 32H264l84.19 112.26L396.31 32zm-280.62 0l48.12 112.26L248 32H115.69zM256 74.67L192 160h128l-64-85.33zm166.95-23.61L376.26 160H488L422.95 51.06zm-333.9 0L23 160h112.74L89.05 51.06zM146.68 192H24l222.8 288h.53L146.68 192zm218.64 0L264.67 480h.53L488 192H365.32zm-35.93 0H182.61L256 400l73.39-208z" />
                </svg>
              </span>
              <div className="ovl__pro-txt">
                <strong>Esto es de Premium</strong>
                <p>
                  Míralo entero: está aquí para que veas qué desbloquea. Para
                  cambiarlo hace falta el plan.
                </p>
              </div>
              <Link className="btn btn--primary btn--sm" to="/pricing">
                Ver planes
              </Link>
            </div>
          )}

          {/* `fieldset disabled` apaga TODOS los campos de dentro de una vez,
              y ademas los saca del recorrido del teclado: hacerlo mando a
              mando seria pasar una prop por veinte componentes y olvidarla en
              el que se añada mañana. `pointer-events` remata lo que no es un
              campo -las muestras de color, las rejillas de iconos-, que un
              `disabled` no alcanza. */}
          {abierto &&
            (bloqueado ? (
              <fieldset className="ovl__mirar" disabled>
                {children}
              </fieldset>
            ) : (
              children
            ))}
        </div>
      </div>
    </dialog>
  );
}
