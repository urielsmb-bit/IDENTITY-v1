import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useCompraPremium, type FaseCompra } from '@/hooks/useCompraPremium';
import { BADGES } from '@/data/badges';
import { PRECIO_PREMIUM, LO_QUE_TRAE_PREMIUM } from '@/data/premium';

const TEXTO_BOTON: Record<FaseCompra, string> = {
  nada: 'Comprar',
  abriendo: 'Abriendo el pago…',
  abierto: 'Termina el pago en la ventana de Tebex',
  activando: 'Pago recibido. Activando tu Premium…',
  hecho: '',
  tarda: 'Pago recibido. Activando tu Premium…',
};

/**
 * «Mejorar a Premium», encima de lo que estés haciendo.
 *
 * Una ventana y no una página, como en guns.lol: se abre desde el menú del
 * editor y desde cada candado de una opción de pago, y al cerrarla sigues
 * justo donde estabas. Antes cada candado llevaba a `/pricing` y te sacaba
 * del editor en el peor momento, que es cuando estabas decidiendo.
 *
 * NO es un `<dialog>` modal, y es a propósito. Un `<dialog>` abierto con
 * `showModal()` va a la capa superior del navegador y deja INERTE todo lo
 * demás, incluida la capa que pone Tebex al abrir el pago: saldría detrás y
 * no se podría pulsar. Esta es una capa fija corriente, y la de Tebex queda
 * encima.
 */
export function MejorarPremium() {
  const abierto = useUIStore((s) => s.premiumAbierto);
  const cerrar = useUIStore((s) => s.cerrarPremium);
  const c = useCompraPremium();
  const cerrarRef = useRef<HTMLButtonElement>(null);

  /* Mientras se paga no se cierra con Esc ni pulsando fuera: se perdería
     el «activando…» y quien acaba de pagar no sabría si ha funcionado. */
  const pagando = c.fase === 'abriendo' || c.fase === 'abierto' || c.fase === 'activando';

  useEffect(() => {
    if (!abierto) return;
    cerrarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pagando) cerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, pagando, cerrar]);

  if (!abierto) return null;

  let accion: ReactNode;
  if (!c.tienda) {
    accion = (
      <button type="button" className="btn btn--quiet mpr__btn" disabled>
        Todavía no está a la venta
      </button>
    );
  } else if (!c.hayUsuario) {
    accion = (
      <Link to="/entrar" className="btn btn--primary mpr__btn" onClick={cerrar}>
        Entra para conseguirlo
      </Link>
    );
  } else if (!c.perfilId) {
    accion = (
      <Link to="/dashboard" className="btn btn--primary mpr__btn" onClick={cerrar}>
        Crea tu perfil primero
      </Link>
    );
  } else if (c.deporVida) {
    accion = (
      <>
        <button type="button" className="btn btn--quiet mpr__btn" disabled>
          Ya es tuyo, para siempre
        </button>
        {c.fase === 'hecho' && (
          <p className="mpr__ok">Listo: ya puedes usar todo lo de Premium. Gracias por apoyar sharee.</p>
        )}
      </>
    );
  } else {
    accion = (
      <button
        type="button"
        className="btn btn--primary mpr__btn"
        onClick={c.comprar}
        disabled={c.fase !== 'nada'}
      >
        {TEXTO_BOTON[c.fase]}
      </button>
    );
  }

  return (
    <div
      className="mpr"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mpr-titulo"
      onClick={(e: MouseEvent) => {
        if (e.target === e.currentTarget && !pagando) cerrar();
      }}
    >
      <div className="mpr__caja">
        <div className="mpr__cab">
          <span id="mpr-titulo">Mejorar a Premium</span>
          <button
            ref={cerrarRef}
            type="button"
            className="mpr__x"
            onClick={cerrar}
            disabled={pagando}
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mpr__tarjeta">
          <div className="mpr__marca">
            <span className="mpr__rombo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: BADGES.premium!.icon }} />
            Premium
          </div>

          <div className="mpr__precio">
            <b>{PRECIO_PREMIUM}</b>
            <span>/de por vida</span>
          </div>
          <p className="mpr__lema">Paga una vez. Consérvalo para siempre.</p>

          {c.diasPrueba !== null && !c.deporVida && (
            <p className="mpr__prueba">
              Tienes la semana de prueba: te {c.diasPrueba === 1 ? 'queda 1 día' : `quedan ${c.diasPrueba} días`}.
              Comprándolo, lo que has montado se queda para siempre.
            </p>
          )}

          <ul className="mpr__l">
            {LO_QUE_TRAE_PREMIUM.map((f) => (
              <li key={f}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <div className="mpr__acc">{accion}</div>

          {c.fase === 'tarda' && (
            <p className="mpr__nota">
              Tu pago está hecho, pero el aviso de Tebex está tardando. El diamante
              aparecerá solo en unos minutos; si no, escríbenos a hello@sharee.fun.
            </p>
          )}
          {c.fallo && (
            <p className="mpr__fallo" role="alert">{c.fallo}</p>
          )}
          {c.tienda && !c.deporVida && c.fase === 'nada' && (
            <p className="mpr__nota">Pago único y seguro con Tebex: tarjeta, PayPal y más.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Un enlace a Premium que, en vez de irse a `/pricing`, abre la ventana.
 *
 * Sigue siendo un `<a href="/pricing">` de verdad: se ve igual que los
 * enlaces que sustituye, un lector de pantalla lo anuncia igual, y abrirlo
 * en otra pestaña sigue llevando a la página de planes. Solo el clic
 * normal se queda aquí.
 */
export function EnlacePremium({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const abrir = useUIStore((s) => s.abrirPremium);
  return (
    <a
      href="/pricing"
      className={className}
      title={title}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        abrir();
      }}
    >
      {children}
    </a>
  );
}
