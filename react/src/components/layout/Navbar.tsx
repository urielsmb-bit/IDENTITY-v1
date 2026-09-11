import { RUTA_MARCA } from '@/data/marca';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { avatarDe } from '@/lib/avatar';

/**
 * Main navigation bar — mirrors the original `<header class="nav">` from index.html.
 * Shows session-aware buttons (Entrar / Salir) once auth state is known.
 */
export function Navbar() {
  const location = useLocation();
  const { session, signOut, initialized } = useAuthStore();
  const [shadow, setShadow] = useState(false);
  /** Tu perfil, para la foto del boton de cuenta. */
  const mio = useProfileStore((s) => s.mine());
  const [menu, setMenu] = useState(false);
  const cuenta = useRef<HTMLDivElement>(null);

  /* La cara del boton sale de `avatarDe`, igual que el perfil publico, el
     ranking y Descubrir: la que subiste, y si no has subido ninguna la de
     Discord, y si tampoco hay, tu inicial sobre tu color. Un solo sitio
     decide, asi que la foto de la barra no puede discrepar de la del
     perfil. */
  const cara = avatarDe(mio ?? {});

  // Add shadow on scroll (mirrors original navShadow())
  useEffect(() => {
    const onScroll = () => setShadow(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = useCallback(
    (route: string) => location.pathname === route,
    [location.pathname],
  );

  const handleSignOut = async () => {
    setMenu(false);
    await signOut();
  };

  /* Se cierra al pulsar fuera y con Escape. Las dos, no una: con el raton
     se sale pulsando en otro sitio y con el teclado no hay «otro sitio»
     donde pulsar. */
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => {
      if (!cuenta.current?.contains(e.target as Node)) setMenu(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [menu]);

  /* Cambiar de pagina cierra el menu. Sin esto se queda abierto encima de
     la pagina nueva, que es lo que pasa cuando el estado no sabe que el
     sitio ha cambiado debajo. */
  useEffect(() => setMenu(false), [location.pathname]);

  return (
    <header className={`nav${shadow ? ' nav--shadow' : ''}`} id="nav">
      <Link className="nav__mark" to="/" aria-label="sharee — inicio">
        {/* La marca, incrustada y no en un `<img>`: asi hereda el color del
            texto y no cuesta una peticion de red. */}
        <svg className="nav__glyph" viewBox="0 0 100 100" aria-hidden="true">
          <path fill="currentColor" fillRule="evenodd" d={RUTA_MARCA} />
        </svg>
        <span>sharee</span>
      </Link>

      <nav className="nav__links" aria-label="Principal">
        <Link to="/top" className={isActive('/top') ? 'on' : ''}>
          Ranking
        </Link>
        <Link to="/plantillas" className={isActive('/plantillas') ? 'on' : ''}>
          Plantillas
        </Link>
        <Link to="/pricing" className={isActive('/pricing') ? 'on' : ''}>
          Precios
        </Link>
      </nav>

      <div className="nav__end">
        {/* Con sesion, TODO lo de la cuenta cabe en un boton.

            Antes eran cuatro seguidos -Salir, Analiticas, Panel y «Crear
            mi perfil»-, y dos de ellos llevaban al mismo sitio. Cuatro
            botones no son cuatro opciones: son una fila que hay que leer
            entera para encontrar la que se busca. Aqui hay uno, con tu
            cara, y lo demas se despliega. */}
        {initialized && session ? (
          <div className="nav__cuenta" ref={cuenta}>
            <button
              type="button"
              className="nav__cuenta-btn"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-haspopup="menu"
            >
              <span
                className="nav__cara"
                style={cara.url ? undefined : { background: cara.color, color: '#fff' }}
              >
                {cara.url ? (
                  <img src={cara.url} alt="" />
                ) : (
                  <span aria-hidden="true">{cara.signo}</span>
                )}
              </span>
              <span className="nav__cuenta-t">Panel</span>
              <svg
                className="nav__chev"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {menu && (
              <div className="nav__menu" role="menu">
                {/* Quien eres, arriba del todo. No es decoracion: con una
                    cuenta enlazada por Discord y otra por correo es lo
                    unico que dice en cual estas antes de tocar nada. */}
                <div className="nav__menu-cab">
                  <span
                    className="nav__cara"
                    style={cara.url ? undefined : { background: cara.color, color: '#fff' }}
                  >
                    {cara.url ? (
                      <img src={cara.url} alt="" />
                    ) : (
                      <span aria-hidden="true">{cara.signo}</span>
                    )}
                  </span>
                  <b>{mio?.username ?? 'tu cuenta'}</b>
                </div>

                <Link role="menuitem" to="/dashboard">
                  Panel
                </Link>
                {mio && (
                  <Link role="menuitem" to={`/${mio.username}`}>
                    Mi página
                  </Link>
                )}
                {/* Analiticas solo con sesion: la pagina es de TU perfil, y
                    sin cuenta no hay nada que enseñar. */}
                <Link role="menuitem" to="/analytics">
                  Analíticas
                </Link>
                {/* En rojo y el ultimo. Es la unica de la lista que
                    deshace algo, y va separada del resto para que no se
                    pulse de paso. */}
                <button
                  role="menuitem"
                  type="button"
                  className="nav__menu-salir"
                  onClick={handleSignOut}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {initialized && (
              <Link className="btn btn--quiet btn--sm" to="/entrar">
                Entrar
              </Link>
            )}
            <Link className="btn btn--primary btn--sm" to="/dashboard">
              Crear mi perfil
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
