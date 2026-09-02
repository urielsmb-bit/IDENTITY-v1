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
    const map = new Map<string, Profile>();
    for (const p of localProfiles) {
      if (p.username) map.set(p.username, p);
    }
    for (const p of remoteProfiles) {
      if (p.username && !map.has(p.username)) {
        map.set(p.username, p as Profile);
      }
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
      // trending: score based on views + level + likes
      const scoreA = (a.views || 0) + (a.level || 1) * 50 + (a.likes || 0) * 10;
      const scoreB = (b.views || 0) + (b.level || 1) * 50 + (b.likes || 0) * 10;
      return scoreB - scoreA;
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
