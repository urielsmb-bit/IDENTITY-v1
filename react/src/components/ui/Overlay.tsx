import { useEffect, useRef, type ReactNode } from 'react';

interface OverlayProps {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  /** Una línea de qué es esta pieza. */
  desc?: string;
  children: ReactNode;
}

/* AQUI HABIA UN `bloqueado` QUE APAGABA EL PANEL ENTERO.
   La idea era buena a medias: se abria igual, para poder mirar. Pero apagaba
   los veinte mandos de dentro porque dos de ellos fueran de pago, asi que un
   perfil gratis no se podia ni centrar, ni agrandar, ni meter en una caja —y
   ninguna de esas tres cosas es un lujo, son las que separan un perfil
   presentable de uno roto—.
   Ahora cada mando sabe si se paga (`<Pro>` en Controles.tsx, y la lista en
   `premium.ts`), asi que el panel se abre entero y dentro solo estan
   apagados los que de verdad lo son. Un aviso en la cabecera diciendo «esto
   es de Premium» sobre un panel donde el 90% se puede tocar seria mentira. */

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
          {abierto && children}
        </div>
      </div>
    </dialog>
  );
}
