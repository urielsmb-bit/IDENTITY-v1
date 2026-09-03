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

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<Metric>('views');

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
    return [...allProfiles].sort((a, b) => {
      if (metric === 'rating') return (b.nota ?? 0) - (a.nota ?? 0);
      return (b.views || 0) - (a.views || 0);
    });
  }, [allProfiles, metric]);

  const top1 = rankedProfiles[0];
  const top2 = rankedProfiles[1];
  const top3 = rankedProfiles[2];
  const rest = rankedProfiles.slice(3);

  const getMetricValue = (p: Profile) => {
    if (metric === 'rating') {
      return p.numNotas ? `${(p.nota ?? 0).toFixed(1)} ★` : 'sin votos';
    }
    return `${num(p.views || 0)} visitas`;
  };

  return (
    <div className="leaderboard-page wrap" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Ranking Global</h1>
        <p className="t-meta" style={{ fontSize: '1.1rem' }}>
          Los perfiles más destacados de IDENTITY.
        </p>

        {/* Metric Switcher */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            type="button"
            className={`btn btn--sm ${metric === 'views' ? 'btn--primary' : 'btn--quiet'}`}
            onClick={() => setMetric('views')}
          >
            👁 Visitas
          </button>
          <button
            type="button"
            className={`btn btn--sm ${metric === 'rating' ? 'btn--primary' : 'btn--quiet'}`}
            onClick={() => setMetric('rating')}
          >
            ⭐ Calificación
          </button>
        </div>
      </header>

      {/* Podium Top 3 (Positions 2 - 1 - 3) */}
      {rankedProfiles.length >= 3 && (
        <div className="podium" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '24px', marginBottom: '48px', flexWrap: 'wrap' }}>
          {/* #2 */}
          {top2 && (
            <Link
              to={`/u/${top2.username}`}
              className="podium__item podium__item--2"
              style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit', padding: '24px 16px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', minWidth: '180px' }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#C0C0C0', marginBottom: '8px' }}>🥈 #2</div>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                {top2.avatarUrl ? <img src={safeMedia(top2.avatarUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (top2.emoji || '◈')}
              </div>
              <div style={{ fontWeight: 600 }}>{top2.name || top2.username}</div>
              <div className="t-meta" style={{ fontSize: '0.85rem' }}>@{top2.username}</div>
              <div style={{ marginTop: '8px', fontWeight: 700, color: 'var(--p-primary, #A855F7)' }}>{getMetricValue(top2)}</div>
            </Link>
          )}

          {/* #1 */}
          {top1 && (
            <Link
              to={`/u/${top1.username}`}
              className="podium__item podium__item--1"
              style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit', padding: '32px 20px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.05))', border: '2px solid rgba(255,215,0,0.4)', transform: 'translateY(-16px)', minWidth: '200px' }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#FFD700', marginBottom: '8px' }}>👑 #1</div>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 12px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>
                {top1.avatarUrl ? <img src={safeMedia(top1.avatarUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (top1.emoji || '◈')}
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{top1.name || top1.username}</div>
              <div className="t-meta" style={{ fontSize: '0.85rem' }}>@{top1.username}</div>
              <div style={{ marginTop: '8px', fontWeight: 700, color: '#FFD700', fontSize: '1.1rem' }}>{getMetricValue(top1)}</div>
            </Link>
          )}

          {/* #3 */}
          {top3 && (
            <Link
              to={`/u/${top3.username}`}
              className="podium__item podium__item--3"
              style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit', padding: '20px 16px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', minWidth: '180px' }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#CD7F32', marginBottom: '8px' }}>🥉 #3</div>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                {top3.avatarUrl ? <img src={safeMedia(top3.avatarUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (top3.emoji || '◈')}
              </div>
              <div style={{ fontWeight: 600 }}>{top3.name || top3.username}</div>
              <div className="t-meta" style={{ fontSize: '0.85rem' }}>@{top3.username}</div>
              <div style={{ marginTop: '8px', fontWeight: 700, color: 'var(--p-primary, #A855F7)' }}>{getMetricValue(top3)}</div>
            </Link>
          )}
        </div>
      )}

      {/* List of remaining ranked profiles */}
      <div className="ranking-list" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {rest.map((p, idx) => (
          <Link
            key={p.username}
            to={`/u/${p.username}`}
            className="ranking-row"
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span style={{ width: '32px', fontWeight: 700, color: 'var(--text-muted, #888)' }}>
              #{idx + 4}
            </span>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.avatarUrl ? (
                <img src={safeMedia(p.avatarUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                p.emoji || '◈'
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.name || p.username}</div>
              <div className="t-meta" style={{ fontSize: '0.85rem' }}>@{p.username} {p.title && `· ${p.title}`}</div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--p-primary, #A855F7)' }}>
              {getMetricValue(p)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
