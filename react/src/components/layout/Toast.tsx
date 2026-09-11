import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';

/**
 * El aviso flotante de abajo.
 *
 * Dos cosas que estaban rotas, y las dos en silencio:
 *
 * 1. NO SE VEÍA. La hoja de estilos saca el aviso con `.toast.on`, y aquí
 *    se ponía `toast--visible`, que no existe en ninguna hoja. O sea que
 *    el aviso se pintaba con el `transform:translate(-50%,140%)` de
 *    reposo: en una ventana de 800 px de alto quedaba de 794 a 838, seis
 *    píxeles asomando por el borde de abajo. Los veinticuatro sitios que
 *    avisan de algo —«Guardado», «No se pudo guardar en la nube»,
 *    «Sesión cerrada»— llevaban desde entonces hablando solos.
 *
 * 2. NO SE ANUNCIABA. Un `aria-live` solo lo vigila un lector de pantalla
 *    si ya estaba en la página ANTES de que cambie su contenido. Esto se
 *    montaba con el mensaje ya dentro y se desmontaba al irse, así que
 *    para un lector de pantalla no cambiaba nada: aparecía y desaparecía
 *    una caja entera. La caja se queda siempre; lo que cambia es el texto.
 *
 * Y de paso, la animación de entrada. Un elemento recién insertado no
 * transiciona —no hay estado anterior desde el que salir— así que el aviso
 * habría aparecido de golpe. Estando ya puesto, lo que se enciende es la
 * clase, y ahí sí desliza.
 */
export function Toast() {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.clearToast);

  /* El último mensaje se guarda aquí y NO se borra al esconderlo: mientras
     el aviso se desliza hacia abajo se tiene que seguir leyendo. Vaciarlo
     a la vez que se va dejaría medio segundo de caja vacía saliendo. */
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setTexto(toast.message);
    setAviso(!!toast.warn);
    const t = setTimeout(clearToast, 2600);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    <div
      className={`toast${aviso ? ' toast--warn' : ''}${toast ? ' on' : ''}`}
      id="toast"
      role="status"
      aria-live="polite"
    >
      {texto}
    </div>
  );
}
