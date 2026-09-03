import { Link } from 'react-router-dom';
import type { Profile } from '@/types';
import { getBadge } from '@/data/badges';
import { insigniasGanadas } from '@/lib/insignias';
import { safeMedia, num } from '@/lib/utils';

interface ProfileCardProps {
  profile: Profile;
}

function hexA(hex: string | undefined, a: number) {
  const clean = String(hex || '#FFFFFF').replace('#', '');
  const full =
    clean.length === 3
      ? (clean[0] ?? '') +
        (clean[0] ?? '') +
        (clean[1] ?? '') +
        (clean[1] ?? '') +
        (clean[2] ?? '') +
        (clean[2] ?? '')
      : clean;
  const n = parseInt(full, 16);
  if (isNaN(n)) return `rgba(255,255,255,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function ProfileCard({ profile: p }: ProfileCardProps) {
  const tint = hexA(p.accent, 0.18);
  /* Las filas de `descubrir` traen visitas y notas, asi que aqui se
     calculan igual que en el perfil. Lo que no traen es lo que concede el
     equipo: en la tarjeta pequena se puede vivir sin ello. */
  const badges = insigniasGanadas({
    creado: p.joined,
    vistas: p.views,
    nota: p.nota,
    numNotas: p.numNotas,
  }).slice(0, 3);

  return (
    <Link
      className="pcard"
      to={`/u/${p.username}`}
      style={
        {
          '--pc-tint': tint,
          '--pc-ring': p.accent || 'transparent',
        } as React.CSSProperties
      }
    >
      <span className="pcard__av">
        {p.avatarUrl ? (
          <img src={safeMedia(p.avatarUrl)} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">
            {p.emoji || (p.name || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      <span className="pcard__name">
        {p.name || p.username}
        {p.verified && (
          <i className="pcard__v" title="Verificado">
            ✔
          </i>
        )}
      </span>

      <span className="pcard__at">@{p.username}</span>

      {p.title && <span className="pcard__role">{p.title}</span>}

      {badges.length > 0 && (
        <span className="pcard__bd">
          {badges.map((bId) => {
            const b = getBadge(bId);
            return b ? (
              <span
                key={bId}
                title={b.label}
                dangerouslySetInnerHTML={{ __html: b.icon }}
              />
            ) : null;
          })}
        </span>
      )}

      <span className="pcard__foot">
        <span className="pcard__views">{num(p.views || 0)} visitas</span>
        {/* La nota, si la hay. Antes aqui salia «Nv 1» en todas las
            tarjetas: nadie subia nunca de nivel. */}
        {p.numNotas ? <span>{(p.nota ?? 0).toFixed(1)} ★</span> : null}
      </span>
    </Link>
  );
}
