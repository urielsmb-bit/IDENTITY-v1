import { Link } from 'react-router-dom';
import type { Profile } from '@/types';
import { getBadge } from '@/data/badges';
import { insigniasGanadas } from '@/lib/insignias';
import { num } from '@/lib/utils';
import { avatarDe } from '@/lib/avatar';

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
  const cara = avatarDe(p);
  /* Las filas de `descubrir` traen las visitas, asi que las de antiguedad
     y visitas se calculan igual que en el perfil. Lo que no traen es lo
     que concede el equipo: en la tarjeta pequena se puede vivir sin ello. */
  const badges = insigniasGanadas({
    creado: p.joined,
    vistas: p.views,
  }).slice(0, 3);

  return (
    /* Lleva `pf` y el `data-theme` de su dueño a proposito. La seccion se
       llama «Gente que ya lo hizo» y promete enseñar lo que ha hecho la
       gente, pero todas las tarjetas salian iguales salvo un tinte
       flojisimo: no se veia que nadie hubiera diseñado nada, que era lo
       unico que habia que ver.

       Con la clase y el atributo, los colores de la tarjeta salen de la
       misma hoja que el perfil de verdad. Nada que copiar y nada que se
       quede viejo: si alguien cambia de tema, su tarjeta cambia sola. */
    <Link
      className="pf pcard"
      data-theme={p.theme || 'dark'}
      to={`/${p.username}`}
      style={
        {
          '--pc-tint': tint,
          '--pc-ring': p.accent || 'transparent',
        } as React.CSSProperties
      }
    >
      <span
        className="pcard__av"
        style={cara.url ? undefined : { background: cara.color, color: '#fff' }}
      >
        {cara.url ? (
          <img src={cara.url} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">{cara.signo}</span>
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
      </span>
    </Link>
  );
}
