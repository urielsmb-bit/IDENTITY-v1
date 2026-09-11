import '@/styles/panels.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AYUDA, ARTICULOS, articuloPorSlug } from '@/data/ayuda';
import { markdownAHtml, traerDocumento } from '@/lib/markdown';
import { useTitulo } from '@/hooks/useTitulo';

/**
 * El centro de ayuda.
 *
 * Vive en una ruta y no en un subdominio. `help.sharee.fun` pediría DNS,
 * un segundo despliegue y su propia copia de la barra, del pie y de los
 * estilos, para acabar exactamente en el mismo sitio. Y `ayuda` está en
 * `nombres_reservados` desde la migración fundacional, así que ningún
 * perfil puede chocar con la ruta.
 *
 * Los artículos son ficheros `.md` en `public/ayuda/`. Escribir uno es
 * escribir markdown y añadir una línea a `data/ayuda.ts`: sin tocar este
 * componente, sin compilar nada nuevo. Esa es la única forma de que una
 * ayuda siga estando escrita dentro de seis meses.
 */

const LUPA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

/** Sin tildes y en minúscula, para que «analiticas» encuentre «analíticas». */
function plano(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ── La barra lateral, igual en el índice y en un artículo ───────────
function Lateral({ activo }: { activo?: string }) {
  return (
    <nav className="ayu__lat" aria-label="Secciones de la ayuda">
      <Link className={`ayu__lat-raiz${activo ? '' : ' on'}`} to="/ayuda">
        Inicio
      </Link>
      {AYUDA.map((g) => (
        <div className="ayu__grupo" key={g.id}>
          <span className="ayu__grupo-t">{g.titulo}</span>
          <ul>
            {g.articulos.map((a) => (
              <li key={a.slug}>
                <Link
                  className={a.slug === activo ? 'on' : undefined}
                  to={`/ayuda/${a.slug}`}
                  aria-current={a.slug === activo ? 'page' : undefined}
                >
                  {a.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// ── El índice ──────────────────────────────────────────────────────
function Indice() {
  useTitulo('Ayuda · sharee');
  const [busca, setBusca] = useState('');

  /* Busca en el título y en el resumen. No en el texto de los artículos:
     eso obligaría a bajarse los doce ficheros para teclear una letra, y
     con doce artículos el título ya los distingue. */
  const encontrados = useMemo(() => {
    const q = plano(busca.trim());
    if (!q) return null;
    return ARTICULOS.filter(
      (a) => plano(a.titulo).includes(q) || plano(a.resumen).includes(q),
    );
  }, [busca]);

  return (
    <>
      <header className="ayu__enc">
        <h1>¿En qué te echamos una mano?</h1>
        <p>
          Cómo montar tu perfil, qué hace cada ajuste, y qué mirar cuando algo
          no va como esperabas.
        </p>

        <div className="ayu__busca">
          <span aria-hidden="true">{LUPA}</span>
          <input
            type="search"
            className="inp"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar en la ayuda…"
            aria-label="Buscar en la ayuda"
            autoComplete="off"
          />
        </div>
      </header>

      {encontrados ? (
        <section className="ayu__sec">
          <h2>
            {encontrados.length === 0
              ? 'Nada con esas palabras'
              : `${encontrados.length} ${encontrados.length === 1 ? 'resultado' : 'resultados'}`}
          </h2>
          {encontrados.length === 0 ? (
            <p className="ayu__vacio">
              Prueba con otra palabra. Si lo que buscas no está, es que no lo
              hemos escrito todavía — y eso también es útil saberlo.
            </p>
          ) : (
            <div className="ayu__rejilla">
              {encontrados.map((a) => (
                <Tarjeta key={a.slug} slug={a.slug} titulo={a.titulo} resumen={a.resumen} />
              ))}
            </div>
          )}
        </section>
      ) : (
        AYUDA.map((g) => (
          <section className="ayu__sec" key={g.id}>
            <h2>{g.titulo}</h2>
            <p className="ayu__sec-d">{g.desc}</p>
            <div className="ayu__rejilla">
              {g.articulos.map((a) => (
                <Tarjeta key={a.slug} slug={a.slug} titulo={a.titulo} resumen={a.resumen} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}

function Tarjeta({ slug, titulo, resumen }: { slug: string; titulo: string; resumen: string }) {
  return (
    <Link className="ayu__tarjeta" to={`/ayuda/${slug}`}>
      <b>{titulo}</b>
      <span>{resumen}</span>
    </Link>
  );
}

// ── Un artículo ────────────────────────────────────────────────────
function Articulo({ slug }: { slug: string }) {
  const meta = articuloPorSlug(slug);
  const navegar = useNavigate();
  const [html, setHtml] = useState('');
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'nada'>('cargando');
  const cuerpo = useRef<HTMLElement>(null);
  const [enEstaPagina, setEnEstaPagina] = useState<{ id: string; texto: string }[]>([]);

  useTitulo(meta ? `${meta.titulo} · Ayuda · sharee` : 'Ayuda · sharee');

  useEffect(() => {
    if (!meta) {
      setEstado('nada');
      return;
    }
    let vivo = true;
    setEstado('cargando');
    traerDocumento(`/ayuda/${meta.slug}.md`)
      .then((md) => {
        if (!vivo) return;
        setHtml(markdownAHtml(md));
        setEstado('listo');
      })
      .catch(() => {
        if (vivo) setEstado('nada');
      });
    return () => {
      vivo = false;
    };
  }, [meta]);

  /* «En esta página»: los `h2` del artículo, ya pintados. Se leen del DOM
     en vez de volver a analizar el markdown — es la misma lista, y así no
     hay dos sitios que puedan decir cosas distintas. */
  useEffect(() => {
    if (estado !== 'listo') return;
    const raiz = cuerpo.current;
    if (!raiz) return;
    const hs = [...raiz.querySelectorAll('h2')];
    setEnEstaPagina(
      hs.map((h, i) => {
        const id = `s${i}-${plano(h.textContent ?? '').replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
        h.id = id;
        return { id, texto: h.textContent ?? '' };
      }),
    );
  }, [estado, html]);

  if (!meta || estado === 'nada') {
    return (
      <div className="ayu__vacio-pag">
        <h1>Ese artículo no está</h1>
        <p>Puede que lo hayamos movido, o que todavía no lo hayamos escrito.</p>
        <button type="button" className="btn btn--quiet" onClick={() => navegar('/ayuda')}>
          Ver toda la ayuda
        </button>
      </div>
    );
  }

  return (
    <>
      <nav className="ayu__miga" aria-label="Dónde estás">
        <Link to="/ayuda">Ayuda</Link>
        <span aria-hidden="true">›</span>
        <span>{meta.grupo.titulo}</span>
      </nav>

      {estado === 'cargando' ? (
        <div className="cargando" aria-busy="true" />
      ) : (
        <div className="ayu__doc">
          <article
            className="legal-content"
            ref={cuerpo}
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {enEstaPagina.length > 1 && (
            <aside className="ayu__enesta" aria-label="En esta página">
              <b>En esta página</b>
              <ul>
                {enEstaPagina.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`}>{h.texto}</a>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}

      <footer className="ayu__pie-art">
        <p>
          ¿Esto no contesta lo que buscabas? Dínoslo y lo escribimos: una
          pregunta que se repite es una página que falta.
        </p>
      </footer>
    </>
  );
}

// ── La página ──────────────────────────────────────────────────────
export default function AyudaPage() {
  const { articulo } = useParams<{ articulo?: string }>();

  /* Cada artículo empieza por arriba. Sin esto, saltar de uno largo a otro
     te deja a media página de un texto que no has empezado a leer. */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [articulo]);

  return (
    <div className="ayu">
      <Lateral activo={articulo} />
      <main className="ayu__main">
        {articulo ? <Articulo slug={articulo} /> : <Indice />}
      </main>
    </div>
  );
}
