import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useDiscoverProfiles } from '@/hooks/useProfile';
import { safeMedia, num } from '@/lib/utils';
import type { Profile } from '@/types';

/* Visitas y nota, y nada mas. «Nivel» y «likes» eran campos que nadie
   incrementaba —todo el mundo salia con Nv 1 y 0 likes—, asi que ordenar
   por ellos daba una clasificacion sin sentido. */
type Metric = 'views' | 'rating';

/**
 * Ranking.
 *
 * Una TABLA, no un podio. El podio de antes daba tres tarjetas grandes con
 * oro, plata y bronce y una lista deslavazada debajo: ocupaba media
 * pantalla para enseñar tres nombres, y con cuatro perfiles en total
 * dejaba una fila. Una clasificacion se lee comparando, y para comparar
 * hacen falta las cifras alineadas en una columna.
 *
 * Aqui tambien se encuentra gente: esta pagina absorbe lo que hacia
 * «Descubrir», que enseñaba lo mismo sin orden ninguno.
 */
export default function LeaderboardPage() {
  const [metric, setMetric] = useState<Metric>('views');
  const [busca, setBusca] = useState('');

  const { data: remoteProfiles = [] } = useDiscoverProfiles({ limit: 100 });
  const profilesMap = useProfileStore((s) => s.profiles);
  const localProfiles = useMemo(() => Object.values(profilesMap), [profilesMap]);

  const allProfiles = useMemo<Profile[]>(() => {
    /* El servidor manda. Antes era al reves —lo local primero y el
       servidor solo si faltaba— y eso hacia que cualquier perfil guardado
       en este navegador TAPARA su fila del servidor: sus visitas, su nota,
       su nombre, su avatar. Por eso los contadores salian siempre a cero
       aunque la base ya tuviera el numero bueno.
       Lo local se queda solo para lo que el servidor todavia no conoce:
       tu borrador sin publicar. */
    const map = new Map<string, Profile>();
    for (const p of remoteProfiles) {
      if (p.username) map.set(p.username, p as Profile);
    }
    for (const p of localProfiles) {
      if (p.username && !map.has(p.username)) map.set(p.username, p);
    }
    return Array.from(map.values()).filter((p) => p.discoverable !== false);
  }, [localProfiles, remoteProfiles]);

  const rankedProfiles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const v = q
      ? allProfiles.filter((p) =>
          `${p.name ?? ''} ${p.username} ${p.title ?? ''}`.toLowerCase().includes(q),
        )
      : allProfiles;
    return [...v].sort((a, b) => {
      if (metric === 'rating') return (b.nota ?? 0) - (a.nota ?? 0);
      return (b.views || 0) - (a.views || 0);
    });
  }, [allProfiles, metric, busca]);

  /* El puesto sale del orden SIN buscar: si filtras por un nombre, el
     numero que ves sigue siendo el suyo de verdad y no un 1 recien
     inventado por la busqueda. */
  const puestos = useMemo(() => {
    const m = new Map<string, number>();
    [...allProfiles]
      .sort((a, b) =>
        metric === 'rating' ? (b.nota ?? 0) - (a.nota ?? 0) : (b.views || 0) - (a.views || 0),
      )
      .forEach((p, i) => m.set(p.username, i + 1));
    return m;
  }, [allProfiles, metric]);

  const valor = (p: Profile) =>
    metric === 'rating'
      ? p.numNotas
        ? (p.nota ?? 0).toFixed(1)
        : '—'
      : num(p.views || 0);

  return (
    <div className="wrap rank">
      <header className="rank__cab">
        <span className="sec__eti">Ranking</span>
        <h1 className="t-h1">Los perfiles más vistos</h1>
        <p className="sec__sub">
          Ordenados por visitas de verdad. Aquí también se encuentra gente: si
          buscas a alguien, escribe su nombre.
        </p>

        <div className="rank__mandos">
          <div className="rank__tabs" role="tablist" aria-label="Ordenar por">
            <button
              type="button"
              role="tab"
              aria-selected={metric === 'views'}
              className={`rank__tab${metric === 'views' ? ' on' : ''}`}
              onClick={() => setMetric('views')}
            >
              Visitas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metric === 'rating'}
              className={`rank__tab${metric === 'rating' ? ' on' : ''}`}
              onClick={() => setMetric('rating')}
            >
              Nota
            </button>
          </div>

          <label className="search rank__buscar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar a alguien"
              aria-label="Buscar un perfil"
            />
          </label>
        </div>
      </header>

      {rankedProfiles.length === 0 ? (
        <p className="rank__vacio">
          {busca.trim()
            ? 'Nadie con ese nombre.'
            : 'Todavía no hay perfiles que ordenar.'}
        </p>
      ) : (
        <div className="rank__tabla">
          {/* Cabecera de columnas. Es la que dice que esto es una tabla y no
              una lista de tarjetas, y sin ella la cifra de la derecha no se
              sabe de que es. */}
          <div className="rank__th" aria-hidden="true">
            <span>#</span>
            <span>Perfil</span>
            <span className="rank__thv">{metric === 'rating' ? 'Nota' : 'Visitas'}</span>
          </div>

          <ol className="rank__l">
            {rankedProfiles.map((p) => {
              const puesto = puestos.get(p.username) ?? 0;
              return (
                <li key={p.username}>
                  <Link className={`rank__f${puesto <= 3 ? ' es-top' : ''}`} to={`/u/${p.username}`}>
                    {/* El puesto en mono tabular: es lo que hace que la
                        columna quede recta al pasar de 9 a 10. */}
                    <span className="rank__n">{puesto}</span>

                    <span className="rank__av">
                      {p.avatarUrl ? (
                        <img src={safeMedia(p.avatarUrl)} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">
                          {p.emoji || (p.name || p.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <span className="rank__id">
                      <span className="rank__nom">{p.name || p.username}</span>
                      <span className="rank__at">@{p.username}</span>
                    </span>

                    <span className="rank__v">{valor(p)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
