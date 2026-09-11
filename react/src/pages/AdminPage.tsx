import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BADGES, COLOR_RAREZA, NOMBRE_RAREZA, type FuenteInsignia } from '@/data/badges';
import * as admin from '@/lib/admin';
import { useToast } from '@/hooks/useToast';
import { useTitulo } from '@/hooks/useTitulo';
import { avatarDe } from '@/lib/avatar';
import { safeMedia } from '@/lib/utils';

/**
 * El panel de quien reparte.
 *
 * Antes esto era abrir el editor SQL de Supabase y escribir un INSERT a
 * mano. Funcionaba, pero pedía tener delante la clave de servicio —la llave
 * de todo el proyecto— para poner una pegatina en un perfil, y no dejaba
 * rastro de quién la había puesto.
 *
 * Lo que protege esto NO es que la página esté escondida. Cualquiera puede
 * abrir la consola del navegador y llamar a la misma función. Lo que lo para
 * es `es_admin()`, que se comprueba DENTRO de la función de la base: sin
 * fila en `privado.roles` no se escribe nada, venga la llamada de donde
 * venga. La página se esconde porque enseñar botones que no van a funcionar
 * es una mala interfaz, no porque esconderla sirva de cerradura.
 */

/** Cómo se agrupan las diecisiete. El orden es el de uso. */
const GRUPOS: { titulo: string; desc: string; fuentes: FuenteInsignia[] }[] = [
  {
    titulo: 'Las que damos nosotros',
    desc: 'Equipo, concursos, verificación. No hay otra forma de conseguirlas.',
    fuentes: ['servidor'],
  },
  {
    titulo: 'Las del plan',
    desc: 'Mientras no haya cobro conectado, estas se dan aquí a mano.',
    fuentes: ['plan'],
  },
  {
    titulo: 'Las que necesitan otra cosa',
    desc: 'Dependen de una integración que todavía no existe. Se dan a mano.',
    fuentes: ['externo'],
  },
  {
    titulo: 'Las que se calculan solas',
    desc: 'Salen de las cifras del perfil sin que nadie las dé. Concederlas aquí sirve sólo para arreglar un caso raro.',
    fuentes: ['perfil'],
  },
];

export default function AdminPage() {
  useTitulo('Insignias · sharee');
  const { toast } = useToast();

  const [admite, setAdmite] = useState<boolean | null>(null);
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [perfil, setPerfil] = useState<Awaited<ReturnType<typeof admin.buscarPerfil>>>(null);
  const [tiene, setTiene] = useState<admin.ConcesionAdmin[]>([]);
  const [nota, setNota] = useState('');
  const [ocupada, setOcupada] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    admin.soyAdmin().then((v) => {
      if (vivo) setAdmite(v);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const cargar = useCallback(
    async (username: string) => {
      const concedidas = await admin.insigniasDeAdmin(username).catch(() => []);
      setTiene(concedidas);
    },
    [],
  );

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuscando(true);
    setPerfil(null);
    setTiene([]);
    try {
      const p = await admin.buscarPerfil(texto);
      if (!p) {
        toast(`No hay ningún perfil que se llame «${texto.trim()}»`, true);
        return;
      }
      setPerfil(p);
      await cargar(p.username);
    } finally {
      setBuscando(false);
    }
  };

  const alternar = async (id: string, puesta: boolean) => {
    if (!perfil) return;
    setOcupada(id);
    try {
      if (puesta) {
        await admin.retirarInsignia(perfil.username, id, nota);
        toast(`«${BADGES[id]?.label ?? id}» retirada de @${perfil.username}`);
      } else {
        await admin.concederInsignia(perfil.username, id, nota);
        toast(`«${BADGES[id]?.label ?? id}» concedida a @${perfil.username}`);
      }
      await cargar(perfil.username);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo cambiar', true);
    } finally {
      setOcupada(null);
    }
  };

  if (admite === null) {
    return <div className="cargando" aria-busy="true" />;
  }

  /* Sin permiso no se explica por qué: quien llega aquí sin serlo no tiene
     que enterarse de que existe un panel ni de cómo se entra en él. */
  if (!admite) {
    return (
      <div className="wrap page--corta" style={{ textAlign: 'center', padding: '120px 20px' }}>
        <h1 style={{ fontSize: 'var(--t6)', marginBottom: '12px' }}>Aquí no hay nada</h1>
        <p className="t-meta" style={{ marginBottom: '28px' }}>
          Esta página no es para tu cuenta.
        </p>
        <Link className="btn btn--quiet" to="/dashboard">
          Ir a mi panel
        </Link>
      </div>
    );
  }

  const puestas = new Set(tiene.map((c) => c.insignia));
  const cara = perfil
    ? avatarDe({ username: perfil.username, name: perfil.name, avatarUrl: perfil.avatarUrl })
    : null;

  return (
    <div className="wrap adm">
      <header className="adm__enc">
        <h1 className="dash__h2">Repartir insignias</h1>
        <p className="dash__sub">
          Se conceden a un perfil, no a una cuenta. Todo lo que se da y se
          quita queda anotado con tu nombre y la fecha.
        </p>
      </header>

      <form className="adm__buscar" onSubmit={buscar}>
        <span className="adm__pre">sharee.fun/</span>
        <input
          className="inp"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="nombre de usuario"
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
          aria-label="Nombre de usuario"
        />
        <button type="submit" className="btn btn--primary" disabled={buscando || !texto.trim()}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {perfil && cara && (
        <>
          <div className="adm__quien">
            <span
              className="adm__cara"
              style={cara.url ? undefined : { background: cara.color, color: '#fff' }}
            >
              {cara.url ? <img src={safeMedia(cara.url)} alt="" /> : <span>{cara.signo}</span>}
            </span>
            <div className="adm__quien-t">
              <b>{perfil.name || perfil.username}</b>
              <Link to={`/${perfil.username}`} target="_blank" rel="noopener noreferrer">
                @{perfil.username}
              </Link>
            </div>
            <span className="adm__cuenta">
              {puestas.size} {puestas.size === 1 ? 'concedida' : 'concedidas'}
            </span>
          </div>

          {/* La nota viaja con cada cambio. No es obligatoria, y debería
              serlo casi siempre: dentro de un año, «Winner» sin nota no
              dice si fue un premio o un dedazo. */}
          <label className="adm__nota">
            <span className="eti">Por qué (queda anotado)</span>
            <input
              className="inp"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ganó el concurso de septiembre"
              maxLength={140}
            />
          </label>

          {GRUPOS.map((g) => {
            const ids = Object.keys(BADGES).filter((id) =>
              g.fuentes.includes(BADGES[id]!.fuente),
            );
            if (!ids.length) return null;
            return (
              <section className="grupo" key={g.titulo}>
                <h3 className="grupo__t">{g.titulo}</h3>
                <p className="adm__grupo-d">{g.desc}</p>
                <div className="bgrid">
                  {ids.map((id) => {
                    const b = BADGES[id]!;
                    const puesta = puestas.has(id);
                    const info = tiene.find((c) => c.insignia === id);
                    return (
                      <button
                        type="button"
                        key={id}
                        className={`bcard${puesta ? ' is-on' : ''}`}
                        style={{ '--rare': COLOR_RAREZA[b.rare] } as React.CSSProperties}
                        disabled={ocupada === id}
                        onClick={() => alternar(id, puesta)}
                        title={`${NOMBRE_RAREZA[b.rare]} · ${b.how}`}
                      >
                        <span
                          className="bcard__i"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: b.icon }}
                        />
                        <span className="bcard__c">
                          <span className="bcard__n">
                            <span>{b.label}</span>
                            <i className="bcard__r" aria-label={NOMBRE_RAREZA[b.rare]} />
                          </span>
                          <span className="bcard__d">
                            {puesta && info?.nota ? info.nota : b.how}
                          </span>
                          {puesta && (
                            <span className="adm__desde">
                              Desde{' '}
                              {new Date(info?.concedida ?? '').toLocaleDateString('es', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

      <p className="adm__pie">
        Nombrar a otra persona para que pueda repartir no se hace aquí: se
        hace con una línea de SQL, y es a propósito. Conceder una insignia es
        decoración; dar la capacidad de concederlas a cualquiera no. Las dos
        cosas no merecen la misma facilidad. Está explicado al final de{' '}
        <code>supabase/migrations/0023_roles_y_concesion.sql</code>.
      </p>
    </div>
  );
}
