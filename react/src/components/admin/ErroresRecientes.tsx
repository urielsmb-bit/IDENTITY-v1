import { useCallback, useEffect, useState } from 'react';
import * as admin from '@/lib/admin';

/** «hace 5 min», «hace 3 h», «hace 2 días». Para saber de un vistazo si un
 *  fallo sigue pasando o es de la semana pasada. */
function hace(fecha: string): string {
  const s = Math.max(0, (Date.now() - new Date(fecha).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** El navegador en dos palabras. El agente entero no se lee. */
function navegadorCorto(ua: string | null): string {
  if (!ua) return '';
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return [nav, so].filter(Boolean).join(' · ');
}

/**
 * Los fallos que le han salido a la gente, para quien administra.
 *
 * Una fila por fallo, con cuantas veces ha pasado y cuando fue la ultima:
 * lo que se viene a decidir aqui es QUE arreglar primero, y eso lo dicen el
 * contador y la fecha, no la pila. La pila esta detras, al abrir la fila.
 */
export function ErroresRecientes() {
  const [lista, setLista] = useState<admin.ErrorRegistrado[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setFallo(null);
    try {
      setLista(await admin.erroresRecientes());
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="grupo adm-err">
      <div className="adm-err__cab">
        <h2 className="grupo__t">Errores de la web</h2>
        <button type="button" className="btn btn--sm btn--ghost" onClick={cargar} disabled={cargando}>
          {cargando ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>
      <p className="adm__grupo-d">
        Lo que le ha fallado a la gente en los últimos 30 días. El mismo fallo
        cuenta una vez con su contador. Se borran solos pasado ese plazo.
      </p>

      {fallo && (
        <p className="adm-err__aviso">
          No se han podido leer. Si todavía no has ejecutado{' '}
          <code>supabase/APLICAR_0029_errores.sql</code>, es eso. ({fallo})
        </p>
      )}

      {lista && lista.length === 0 && !fallo && (
        <p className="adm-err__vacio">Ninguno. Todo en orden.</p>
      )}

      {lista && lista.length > 0 && (
        <ul className="adm-err__l">
          {lista.map((e, i) => (
            <li key={`${e.visto}-${i}`}>
              <details className="adm-err__it">
                <summary>
                  <span className="adm-err__veces" title="Veces que ha pasado">
                    ×{e.veces}
                  </span>
                  <span className="adm-err__msj">{e.mensaje}</span>
                  <span className="adm-err__meta">
                    {hace(e.visto)}
                    {e.donde ? ` · ${e.donde}` : ''}
                  </span>
                </summary>
                <dl className="adm-err__dl">
                  <dt>Primera vez</dt>
                  <dd>{new Date(e.creado).toLocaleString('es')}</dd>
                  <dt>Dónde</dt>
                  <dd>{e.origen === 'frontera' ? 'Lo atrapó la página' : e.origen === 'promesa' ? 'Una promesa sin atrapar' : 'Sin atrapar'}</dd>
                  <dt>Navegador</dt>
                  <dd title={e.navegador ?? ''}>{navegadorCorto(e.navegador) || '—'}</dd>
                  <dt>Cuenta</dt>
                  <dd>{e.usuario ? `@${e.usuario}` : 'Sin sesión'}</dd>
                </dl>
                {e.pila && <pre className="adm-err__pila">{e.pila}</pre>}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
