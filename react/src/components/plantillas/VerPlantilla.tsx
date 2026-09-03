import { useEffect, useRef, useState } from 'react';
import type { Profile } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { ProfileView } from '@/components/profile/ProfileView';
import { aplicarPlantilla } from '@/lib/plantilla';

const ANCHO = 860;
const ALTO = 540;

/**
 * Ver una plantilla en grande, PUESTA SOBRE TI.
 *
 * La miniatura de la tarjeta enseña el perfil de quien la publico: sirve
 * para saber que hizo esa persona. Pero antes de aplicarsela a uno mismo
 * la pregunta es otra —«¿como me queda A MI?»— y esa no se responde
 * mirando el perfil de otro: tu nombre es mas largo, tu foto es otra y
 * tienes otros bloques.
 *
 * Asi que aqui la plantilla se aplica sobre el perfil de QUIEN MIRA. Es
 * exactamente lo que se llevaria al pulsar «Usar plantilla», sin haberlo
 * pulsado y sin tocarle nada a su perfil guardado: `aplicarPlantilla`
 * devuelve un objeto nuevo y no escribe en el almacen.
 *
 * Sin perfil propio todavia no hay nada sobre lo que probar, y entonces
 * se enseña el de su autor, que es mejor que un hueco.
 */
export function VerPlantilla({
  nombre,
  base,
  esMio,
  ajustes,
  onCerrar,
  onUsar,
}: {
  nombre: string;
  /** Sobre quien se prueba: tu perfil si lo tienes, si no el de su autor. */
  base: Profile;
  esMio: boolean;
  ajustes: Partial<Profile>;
  onCerrar: () => void;
  onUsar: () => void;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(0);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      const a = el.clientWidth;
      if (a > 0) setEscala(a / ANCHO);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <Modal
      abierto
      alCerrar={onCerrar}
      titulo={nombre}
      desc={esMio
        ? 'Así queda con tu información. Tu perfil no ha cambiado todavía.'
        : 'Sin perfil propio se prueba sobre el de su autor.'}
      acciones={
        <button className="btn btn--primary" onClick={onUsar}>
          Usar plantilla
        </button>
      }
    >
      <div
        className="tplver"
        ref={caja}
        /* El alto se deduce de la escala en vez de fijarlo: asi la caja
           mide exactamente lo que ocupa el perfil encogido y no queda
           una banda muerta debajo. */
        style={{ height: escala ? ALTO * escala : undefined }}
      >
        <div
          className="tplver__lienzo"
          style={{
            width: ANCHO,
            height: ALTO,
            transform: `scale(${escala})`,
            visibility: escala ? 'visible' : 'hidden',
          }}
        >
          <ProfileView profile={aplicarPlantilla(base, ajustes)} preview />
        </div>
      </div>

    </Modal>
  );
}
