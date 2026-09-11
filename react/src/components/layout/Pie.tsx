import { Link } from 'react-router-dom';
import { RUTA_MARCA } from '@/data/marca';

/**
 * El pie del sitio.
 *
 * Era una fila de cinco enlaces que terminaba en «Hecho con React +
 * TypeScript». Eso es el pie de un proyecto, no el de un producto: a quien
 * acaba de leer la portada no le importa con qué está escrito, le importa
 * dónde se mira el ranking y dónde están los términos.
 *
 * LO QUE NO LLEVA, Y POR QUÉ. El pie que se copia de los grandes trae
 * «Centro de ayuda», «Changelog», «Estado del sistema», «Comparaciones»,
 * tres correos de contacto y un selector de idioma. Aquí no hay ninguna de
 * esas cosas: no hay centro de ayuda, no hay página de estado y el sitio
 * está solo en español. Un pie lleno de enlaces que no llevan a ninguna
 * parte no hace que un sitio parezca más grande — hace que parezca
 * abandonado, y encima el primero que los pulsa eres tú.
 *
 * Así que están las columnas que tienen contenido detrás, y el día que
 * exista un centro de ayuda se añade su enlace. No antes.
 */

interface Enlace {
  a: string;
  texto: string;
  /** Fuera del sitio: se abre en otra pestaña. */
  fuera?: boolean;
}

const COLUMNAS: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: 'Empezar',
    enlaces: [
      { a: '/dashboard', texto: 'Crear mi perfil' },
      { a: '/entrar', texto: 'Entrar' },
      { a: '/entrar?modo=registro', texto: 'Crear una cuenta' },
      { a: '/pricing', texto: 'Planes' },
    ],
  },
  {
    titulo: 'Mirar',
    enlaces: [
      { a: '/top', texto: 'Ranking' },
      { a: '/plantillas', texto: 'Plantillas' },
    ],
  },
  {
    titulo: 'Legal',
    enlaces: [
      { a: '/terminos', texto: 'Términos del servicio' },
      { a: '/privacidad', texto: 'Política de privacidad' },
      { a: '/copyright', texto: 'Copyright y DMCA' },
    ],
  },
];

export function Pie() {
  return (
    <footer className="pie">
      <div className="pie__in">
        <div className="pie__marca">
          <Link className="pie__logo" to="/" aria-label="sharee, ir al inicio">
            <svg className="pie__glifo" viewBox="0 0 100 100" aria-hidden="true">
              <path fill="currentColor" fillRule="evenodd" d={RUTA_MARCA} />
            </svg>
            <span>sharee</span>
          </Link>
          <p className="pie__lema">
            Un enlace con todo lo tuyo dentro: tus redes, tu música y tu cara,
            con la pinta que tú le des.
          </p>
        </div>

        <nav className="pie__cols" aria-label="Pie de página">
          {COLUMNAS.map((c) => (
            <div className="pie__col" key={c.titulo}>
              <h2 className="pie__t">{c.titulo}</h2>
              <ul>
                {c.enlaces.map((e) => (
                  <li key={e.a + e.texto}>
                    <Link to={e.a}>{e.texto}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="pie__abajo">
        {/* El año, del reloj. Escrito a mano se queda viejo el 1 de enero y
            nadie se acuerda hasta que un visitante lo ve. */}
        <span>© {new Date().getFullYear()} sharee</span>
        <span className="pie__punto" aria-hidden="true">
          ·
        </span>
        <span>Hecho para que tu enlace no se parezca al de nadie.</span>
      </div>
    </footer>
  );
}
