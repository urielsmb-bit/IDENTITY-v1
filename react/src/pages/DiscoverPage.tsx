import { useState, useMemo } from 'react';
import { ProfileCard } from '@/components/discover/ProfileCard';
import { useDiscoverProfiles } from '@/hooks/useProfile';
import { useProfileStore } from '@/stores/profileStore';
import type { Profile } from '@/types';

type Orden = 'trending' | 'new' | 'popular';

const FILTERS = [
  { id: 'all', name: 'Todos' },
  { id: 'gaming', name: 'Gaming', tag: 'gaming' },
  { id: 'developer', name: 'Developers', tag: 'developer' },
  { id: 'creator', name: 'Creators', tag: 'creator' },
  { id: 'design', name: 'Designers', tag: 'design' },
  { id: 'music', name: 'Música', tag: 'music' },
];

export default function DiscoverPage() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Orden>('trending');

  const { data: remoteProfiles = [] } = useDiscoverProfiles({ order: sort });
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

  const filteredProfiles = useMemo(() => {
    let result = allProfiles;

    // Filter by tag
    if (filter !== 'all') {
      result = result.filter(
        (p) =>
          p.tags?.includes(filter) ||
          p.title?.toLowerCase().includes(filter.toLowerCase()),
      );
    }

    // Search query
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (q) {
      result = result.filter(
        (p) =>
          p.username.toLowerCase().includes(q) ||
          p.name?.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q),
      );
    }

    // Sorting
    return [...result].sort((a, b) => {
      if (sort === 'popular') return (b.views || 0) - (a.views || 0);
      if (sort === 'new') {
        return (
          new Date(b.joined || 0).getTime() - new Date(a.joined || 0).getTime()
        );
      }
      /* Tendencia: visitas y nota, que son las dos cosas que se miden.
         Antes sumaba `level * 50 + likes * 10`, y como nadie sube de nivel
         ni da likes, esos dos sumandos valian lo mismo para todo el mundo:
         el orden acababa siendo el de visitas con pasos de mas. */
      const puntos = (x: Profile) =>
        (x.views || 0) + (x.numNotas ? (x.nota ?? 0) * (x.numNotas || 0) * 4 : 0);
      return puntos(b) - puntos(a);
    });
  }, [allProfiles, filter, query, sort]);

  const hayFiltro = filter !== 'all' || query.trim() !== '';
  const limpiar = () => {
    setFilter('all');
    setQuery('');
  };

  return (
    <div className="wrap disc">
      <header className="disc__head">
        <h1 className="t-h1">Descubrir</h1>
        <p className="disc__d">Explora perfiles creados por la comunidad de IDENTITY.</p>

        <div className="disc__busca">
          <input
            type="search"
            className="inp disc__q"
            placeholder="Buscar por nombre, @usuario o bio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar perfiles"
          />
          <select
            className="sel disc__orden"
            value={sort}
            onChange={(e) => setSort(e.target.value as Orden)}
            aria-label="Ordenar por"
          >
            <option value="trending">🔥 Trending</option>
            <option value="popular">👁 Más vistos</option>
            <option value="new">✨ Nuevos</option>
          </select>
        </div>

        <div className="tabs disc__tabs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`pill${filter === f.id ? ' is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Cuántos hay: sin esto no se sabe si el filtro ha hecho algo. */}
        <p className="disc__n" aria-live="polite">
          {filteredProfiles.length === 0
            ? 'Ningún perfil'
            : `${filteredProfiles.length} ${filteredProfiles.length === 1 ? 'perfil' : 'perfiles'}`}
          {hayFiltro && (
            <button type="button" className="lnk disc__limpia" onClick={limpiar}>
              Quitar filtros
            </button>
          )}
        </p>
      </header>

      <div className="grid-p">
        {filteredProfiles.length === 0 ? (
          <p className="empty">
            No hay ningún perfil que encaje con esta búsqueda.
            <br />
            Prueba con otro nombre o <b>quita los filtros</b>.
          </p>
        ) : (
          filteredProfiles.map((p) => <ProfileCard key={p.username} profile={p} />)
        )}
      </div>
    </div>
  );
}
