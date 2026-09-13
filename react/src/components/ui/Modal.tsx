import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  /** Frase corta bajo el título: qué va a pasar. */
  desc?: string;
  /** Tiñe el borde y el título de rojo. Para lo que no se deshace. */
  peligro?: boolean;
  children?: ReactNode;
  /** Botones del pie. El de cerrar se pone solo. */
  acciones?: ReactNode;
  /**
   * Que dice el boton de cerrar. «Cancelar» por defecto, que es lo que
   * toca cuando esto pregunta algo.
   *
   * Se puede cambiar porque no todos los dialogos preguntan. En uno que
   * ANUNCIA —«tienes una semana de Premium»— un «Cancelar» al lado de
   * «Reclamar» se lee como que cerrando renuncias al regalo, y no es
   * verdad: la semana ya esta dada, cierres como cierres.
   */
  cerrarTexto?: string;
}

/**
 * Ventana de confirmación.
 *
 * Es un `<dialog>` de verdad, no un `<div>` con posición fija. La diferencia
 * no es estética: `showModal()` trae gratis y bien hecho lo que a mano sale
 * mal casi siempre —el foco encerrado dentro, Esc para cerrar, el resto de
 * la página marcado como inerte para lectores de pantalla y el fondo
 * oscurecido con `::backdrop`—. Escribir todo eso a mano son cien líneas
 * que además nadie prueba con teclado.
 */
export function Modal({
  abierto,
  alCerrar,
  titulo,
  desc,
  peligro,
  children,
  acciones,
  cerrarTexto = 'Cancelar',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // `showModal()` sobre uno ya abierto lanza excepción; de ahí el guardia.
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={`mdl${peligro ? ' mdl--peligro' : ''}`}
      /* Esc dispara `cancel` y luego `close`: escuchando `close` se cubren
         los tres caminos de salida (Esc, botón y clic fuera) con uno solo. */
      onClose={alCerrar}
      onClick={(e) => {
        // El backdrop no es un elemento: los clics en él llegan al propio
        // <dialog>, mientras que los de dentro llegan a .mdl__caja.
        if (e.target === ref.current) alCerrar();
      }}
    >
      <div className="mdl__caja">
        <h3 className="mdl__t">{titulo}</h3>
        {desc && <p className="mdl__d">{desc}</p>}
        {children && <div className="mdl__cuerpo">{children}</div>}
        <div className="mdl__pie">
          <button type="button" className="btn btn--quiet" onClick={alCerrar}>
            {cerrarTexto}
          </button>
          {acciones}
        </div>
      </div>
    </dialog>
  );
}
