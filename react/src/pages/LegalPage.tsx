import { useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

const DOCS: Record<string, { file: string; title: string }> = {
  '/terminos': { file: 'IDENTITY_TERMINOS.md', title: 'Términos del servicio' },
  '/privacidad': { file: 'IDENTITY_PRIVACIDAD.md', title: 'Política de privacidad' },
  '/copyright': { file: 'IDENTITY_COPYRIGHT.md', title: 'Derechos de autor y DMCA' },
};

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c] || c;
  });
}

function parseMarkdownToHtml(md: string): string {
  // Clean developer notes
  let cleaned = md.split(/\n#{1,3} Notas para ti/)[0] || '';
  cleaned = cleaned.replace(
    /^(#{1,4})\s+[^\n]*(?:para ti|borrar antes de publicar)[^\n]*\n[\s\S]*?(?=^#{1,4}\s|(?![\s\S]))/gim,
    '',
  );
  cleaned = cleaned.replace(/^> \*\*(?:Nota para ti|Borrador|Ojo con esto)[\s\S]*?(?=\n\n)/gim, '');

  const lines = cleaned.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trimEnd() ?? '';

    // Headers
    if (/^#\s+/.test(line)) {
      out.push(`<h1>${esc(line.replace(/^#\s+/, ''))}</h1>`);
    } else if (/^##\s+/.test(line)) {
      out.push(`<h2>${esc(line.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^###\s+/.test(line)) {
      out.push(`<h3>${esc(line.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^>\s+/.test(line)) {
      out.push(`<blockquote>${esc(line.replace(/^>\s+/, ''))}</blockquote>`);
    } else if (/^[-*]\s+/.test(line)) {
      out.push(`<li>${esc(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (line.trim().length > 0) {
      const formatted = esc(line)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      out.push(`<p>${formatted}</p>`);
    }
  }

  return out.join('');
}

export default function LegalPage() {
  const location = useLocation();
  const docInfo = DOCS[location.pathname] || DOCS['/terminos']!;
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/${docInfo.file}`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Not found'))))
      .then((md) => {
        setHtml(parseMarkdownToHtml(md));
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
