import { useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTitulo } from '@/hooks/useTitulo';
import { markdownAHtml, traerDocumento } from '@/lib/markdown';

const DOCS: Record<string, { file: string; title: string }> = {
  '/terminos': { file: 'sharee_TERMINOS.md', title: 'Términos del servicio' },
  '/privacidad': { file: 'sharee_PRIVACIDAD.md', title: 'Política de privacidad' },
  '/copyright': { file: 'sharee_COPYRIGHT.md', title: 'Derechos de autor y DMCA' },
};

/* El analizador vivia aqui. Ahora es `lib/markdown.ts`, porque la ayuda
   pinta los mismos ficheros y dos copias del mismo analizador acaban
   soportando cosas distintas. De paso gano tres cosas que aqui
   faltaban: enlaces, listas envueltas en `<ul>`, y negrita y codigo
   dentro de titulos y de listas —donde antes salian los asteriscos a
   la vista—. */

export default function LegalPage() {
  const location = useLocation();
  const docInfo = DOCS[location.pathname] || DOCS['/terminos']!;
  /* Los tres documentos se llamaban igual en la pestana. Con dos abiertos
     para compararlos no habia forma de saber cual era cual. */
  useTitulo(`${docInfo.title} · sharee`);
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    traerDocumento(`/${docInfo.file}`)
      .then((md) => {
        setHtml(markdownAHtml(md));
        setLoading(false);
      })
      .catch(() => {
        setHtml('<p>No se pudo cargar el documento.</p>');
        setLoading(false);
      });
  }, [docInfo.file]);

  return (
    <div className="legal-page wrap" style={{ maxWidth: '800px', paddingTop: '40px', paddingBottom: '80px' }}>
      {/* Navigation tabs */}
      <nav style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', flexWrap: 'wrap' }}>
        <Link
          to="/terminos"
          className={`btn btn--sm ${location.pathname === '/terminos' ? 'btn--primary' : 'btn--quiet'}`}
        >
          Términos
        </Link>
        <Link
          to="/privacidad"
          className={`btn btn--sm ${location.pathname === '/privacidad' ? 'btn--primary' : 'btn--quiet'}`}
        >
          Privacidad
        </Link>
        <Link
          to="/copyright"
          className={`btn btn--sm ${location.pathname === '/copyright' ? 'btn--primary' : 'btn--quiet'}`}
        >
          Copyright & DMCA
        </Link>
      </nav>

      {loading ? (
        <div className="cargando" aria-busy="true" />
      ) : (
        <article
          className="legal-content"
          style={{ lineHeight: '1.7', fontSize: 'var(--t3)', color: 'var(--text-primary)' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
