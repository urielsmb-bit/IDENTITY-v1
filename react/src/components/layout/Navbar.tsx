import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Main navigation bar — mirrors the original `<header class="nav">` from index.html.
 * Shows session-aware buttons (Entrar / Salir) once auth state is known.
 */
export function Navbar() {
  const location = useLocation();
  const { session, signOut, initialized } = useAuthStore();
  const [shadow, setShadow] = useState(false);

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
    await signOut();
  };

  return (
    <header className={`nav${shadow ? ' nav--shadow' : ''}`} id="nav">
      <Link className="nav__mark" to="/" aria-label="IDENTITY — inicio">
        <span className="nav__glyph" aria-hidden="true" />
        <span>IDENTITY</span>
      </Link>

      <nav className="nav__links" aria-label="Principal">
        <Link to="/top" className={isActive('/top') ? 'on' : ''}>
          Ranking
        </Link>
        <Link to="/templates" className={isActive('/templates') ? 'on' : ''}>
          Plantillas
        </Link>
        <Link to="/pricing" className={isActive('/pricing') ? 'on' : ''}>
          Precios
        </Link>
      </nav>

      <div className="nav__end">
        {initialized && (
          <span className="nav__sesion" id="navSesion">
            {session ? (
              <button
                className="btn btn--quiet btn--sm"
                onClick={handleSignOut}
              >
                Salir
              </button>
            ) : (
              <Link className="btn btn--quiet btn--sm" to="/entrar">
                Entrar
              </Link>
            )}
          </span>
        )}
        {/* Analiticas solo con sesion: la pagina es de TU perfil, y sin
            cuenta no hay nada que enseñar. Estaba construida y no la
            enlazaba nadie: solo se llegaba escribiendo la direccion. */}
        {session && (
          <Link
            className={`btn btn--quiet btn--sm nav__hide-sm${isActive('/analytics') ? ' on' : ''}`}
            to="/analytics"
          >
            Analíticas
          </Link>
        )}
        <Link className="btn btn--quiet btn--sm nav__hide-sm" to="/dashboard">
          Panel
        </Link>
        <Link className="btn btn--primary btn--sm" to="/dashboard">
          Crear mi perfil
        </Link>
      </div>
    </header>
  );
}
