import { useState, useMemo } from 'react';
import { BLOQUES_APAGADOS_POR_DEFECTO } from '@/data/bloques';
import { useNavigate, Link } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useDiscoverProfiles } from '@/hooks/useProfile';
import { useToast } from '@/hooks/useToast';
import { CarruselPerfiles } from '@/components/landing/CarruselPerfiles';
import { ProfileCard } from '@/components/discover/ProfileCard';
import { slug, num, safeMedia } from '@/lib/utils';
import type { Profile } from '@/types';

const INITIAL_DEMO: Profile = {
  username: 'demo',
  name: 'Uriel Ambrosio',
  title: 'Diseñador & Desarrollador',
  location: 'Medellín, CO',
  pronouns: 'él/he',
  emoji: '⚡',
  age: 24,
  avatarUrl: '',
  bio: 'Construyendo experiencias digitales inmersivas y productos web modernos. Amante del diseño minimalista y los sintetizadores.',
  about: 'Diseñador de producto y programador frontend. Especializado en interfaces web, animación interactiva y sistemas de diseño.',
  joined: '2025-01-15T00:00:00Z',
  theme: 'cyberpunk',
  accent: '#A855F7',
  colText: '',
  colBg: '',
  colIcon: '',
  align: 'center',
  surface: 'glass',
  avShape: 'rounded',
  avPos: 'center',
  avatarFx: 'pulse',
  socialStyle: 'icons',
  musicStyle: 'compact',
  badgeStyle: 'icons',
  blockStyle: 'glass',
  layoutMode: 'stack',
  stackPos: 'center',
  widthMode: 'fixed',
  hoverFx: 'lift',
  enterFx: 'rise',
  nameWeight: '700',
  nameCase: 'none',
  cursor: 'default',
  particles: 'stars',
  font: 'space',
  fontDisplay: 'display',
  avSize: 112,
  stackWidth: 460,
  gap: 16,
  radius: 18,
  iconSize: 20,
  nameSize: 0,
  bioSize: 0,
  sBlur: 22,
  sGlow: 40,
  sBorderW: 1,
  sWidthPct: null,
  sHeightPx: null,
  bgScale: 100,
  sColor: '',
  sBorderColor: '',
  sBorderOn: true,
  bgOpacity: 100,
  bgBlur: 0,
  bgDim: 30,
  vignette: 40,
  nameSpacing: 0,
  lineHeight: 0,
  pad: null,
  sOpacity: null,
  sBorder: null,
  blockRadius: null,
  level: 8,
  xp: 750,
  xpMax: 1000,
  views: 14200,
  likes: 380,
  avBorder: true,
  avGlow: true,
  monoIcons: false,
  bgFixed: true,
  fxMagnet: true,
  fxGlow: true,
  fxParallax: true,
  gradient: true,
  animatedName: true,
  glowName: true,
  glowSocials: true,
  glowBadges: true,
  noise: true,
  tilt: true,
  gate: false,
  verified: true,
  premium: true,
  discoverable: true,
  showStats: true,
  showRate: true,
  discordWidget: false,
  trackClick: true,
  bgType: 'gradient',
  bgValue: 'linear-gradient(135deg, #0d0c22 0%, #1e1b4b 50%, #0f172a 100%)',
  socials: [
    { net: 'github', url: 'https://github.com', label: 'GitHub' },
    { net: 'x', url: 'https://x.com', label: 'X' },
    { net: 'discord', url: 'https://discord.com', label: 'Discord' },
    { net: 'spotify', url: 'https://spotify.com', label: 'Spotify' },
  ],
  links: [
    {
      title: 'Portfolio & Proyectos',
      url: 'https://github.com',
      desc: 'Explora mis últimos proyectos de código abierto',
      icon: '🚀',
    },
    {
      title: 'Mi música favorita',
      url: 'https://spotify.com',
      desc: 'Playlist curated de synthwave y electrónica',
      icon: '🎧',
    },
  ],
  projects: [
    {
      title: 'IDENTITY Web',
      desc: 'Plataforma de perfiles web personalizables y modernos',
      url: '#',
      tag: 'React / TS',
      img: '',
    },
  ],
  gallery: [],
  live: [],
  fields: [],
  tags: ['developer', 'design'],
  badges: ['staff', 'verified', 'premium'],
  blocksOff: [...BLOQUES_APAGADOS_POR_DEFECTO],
  blockOrder: [],
  canvasH: null,
  pos: {},
  bstyle: {},
  bcontent: {},
  audio: {
    provider: 'youtube',
    src: 'manual',
    title: 'Resonance',
    artist: 'HOME',
    cover: '',
    yt: '',
    ytUrl: '',
    tracks: [],
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [claimName, setClaimName] = useState('');
  // La demo se queda con el tema y el acento con los que nace: sus
  // selectores se cambiaron por los tres perfiles mas vistos.
  const demoTheme = INITIAL_DEMO.theme;
  const demoAccent = INITIAL_DEMO.accent;

  const profilesMap = useProfileStore((s) => s.profiles);
  const profiles = useMemo(() => Object.values(profilesMap), [profilesMap]);

  /**
   * Los tres más vistos, bajo la demo.
   *
   * Se pide al servidor ordenado por visitas; si no hay servidor —o todavía
   * no ha contestado— se ordenan los que haya en local. Asi el hueco nunca
   * se queda vacio mientras carga.
   */
  // Se piden seis: tres para la lista de mas vistos y el resto para que el
  // carrusel tenga por donde girar.
  const { data: masVistos = [] } = useDiscoverProfiles({ order: 'popular', limit: 6 });
  const porVistas = useMemo(() => {
    const fuente = masVistos.length > 0 ? (masVistos as Profile[]) : profiles;
    return [...fuente]
      .filter((x) => x.username && x.discoverable !== false)
      .sort((a, b) => (b.views || 0) - (a.views || 0));
  }, [masVistos, profiles]);

  const top3 = useMemo(() => porVistas.slice(0, 3), [porVistas]);


  const demoProfile = useMemo<Profile>(() => {
    return {
      ...INITIAL_DEMO,
      theme: demoTheme,
      accent: demoAccent,
      gate: false,
      cursor: 'default',
    };
  }, [demoTheme, demoAccent]);

  /** Lo que gira en la portada. Sin perfiles todavia, la demo de siempre. */
  const delCarrusel = useMemo(
    () => (porVistas.length > 0 ? porVistas.slice(0, 6) : [demoProfile]),
    [porVistas, demoProfile],
  );

  const totalViews = useMemo(() => {
    return profiles.reduce((acc, p) => acc + (p.views || 0), 24500);
  }, [profiles]);

  const featuredProfiles = useMemo(() => {
    if (profiles.length > 0) return profiles.slice(0, 8);
    return [demoProfile];
  }, [profiles, demoProfile]);

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = slug(claimName);
    if (!clean) {
      toast('Escribe un nombre de usuario', true);
      return;
    }
    navigate(`/dashboard?claim=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="rise">
          <span className="hero__eyebrow">
            <i className="dot" />
            <b>{profiles.length || 120} perfiles</b> creados esta semana
          </span>

          <h1 className="hero__h">
            Tu identidad,
            <br />
            <em>en línea.</em>
          </h1>

          <p className="hero__p">
            Crea un perfil que se sienta como tú. No una lista de enlaces: un sitio
            completo.
          </p>

          <form className="claim" id="claimForm" onSubmit={handleClaimSubmit}>
            <span className="claim__pre">identity.gg/</span>
            <input
              type="text"
              placeholder="tunombre"
              maxLength={24}
              value={claimName}
              onChange={(e) => setClaimName(e.target.value)}
              aria-label="Elige tu nombre de usuario"
              autoComplete="off"
              spellCheck="false"
            />
            <button className="btn btn--primary btn--sm" type="submit">
              Crear
            </button>
          </form>

          <div className="hero__cta">
            <Link className="btn btn--ghost" to="/discover">
              Explorar perfiles
            </Link>
          </div>

          <div className="hero__proof">
            <div className="hero__faces" aria-hidden="true">
              <span>⚡</span>
              <span>🎨</span>
              <span>🎮</span>
              <span>💎</span>
              <span>🚀</span>
            </div>
            <p className="t-meta" style={{ margin: 0 }}>
              {num(totalViews)} visitas servidas en total
            </p>
          </div>
        </div>

        {/* Live Demo with theme / accent switches */}
        <div className="demo rise d2">
          <CarruselPerfiles perfiles={delCarrusel} />

          {/* Donde estaban los selectores de tema y acento: los tres
              perfiles con más visitas. Enseñar perfiles de gente convence
              más que enseñar una paleta. */}
          {top3.length > 0 && (
            <ol className="top3">
              {top3.map((t, i) => (
                <li key={t.username}>
                  <Link className="top3__it" to={`/u/${t.username}`}>
                    <span className="top3__n" aria-hidden="true">{i + 1}</span>
                    <span className="top3__av">
                      {t.avatarUrl ? (
                        <img src={safeMedia(t.avatarUrl)} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">
                          {t.emoji || (t.name || t.username || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="top3__txt">
                      <span className="top3__name">{t.name || t.username}</span>
                      <span className="top3__at">@{t.username}</span>
                    </span>
                    <span className="top3__v">{num(t.views || 0)} visitas</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Featured Rail */}
      <section className="band wrap">
        <div className="band__head">
          <div>
            <h2 className="t-h2">Gente que ya lo hizo</h2>
            <p>Cada uno de estos perfiles usa el mismo editor que vas a usar tú.</p>
          </div>
          <Link className="btn btn--ghost btn--sm" to="/discover">
            Ver todos
          </Link>
        </div>
        <div className="rail">
          {featuredProfiles.map((p, idx) => (
            <ProfileCard key={p.username || idx} profile={p} />
          ))}
        </div>
      </section>

      {/* Profile of the Day */}
      <section className="band wrap">
        <div className="band__head">
          <div>
            <h2 className="t-h2">Perfil del día</h2>
            <p>
              Rota cada 24 horas. Aparecer aquí es la forma más rápida de que te
              vean.
            </p>
          </div>
        </div>
        <article className="potd">
          <div className="potd__av">
            {demoProfile.avatarUrl ? (
              <img src={safeMedia(demoProfile.avatarUrl)} alt="" />
            ) : (
              demoProfile.emoji || '⚡'
            )}
          </div>
          <div>
            <div className="potd__name">{demoProfile.name}</div>
            <div className="potd__why">
              @{demoProfile.username} · {demoProfile.title}
            </div>
            <div className="t-meta" style={{ marginTop: '6px' }}>
              {num(demoProfile.views)} visitas · nivel {demoProfile.level}
            </div>
          </div>
          <Link
            className="btn btn--primary potd__cta"
            to={`/u/${demoProfile.username}`}
          >
            Visitar perfil
          </Link>
        </article>
      </section>

      {/* Call to action footer banner */}
      <section className="close-band">
        <h2>Deja de explicar quién eres.</h2>
        <p>Muéstralo. Un enlace, todo tu mundo.</p>
        <Link className="btn btn--primary btn--lg" to="/dashboard">
          Crear mi perfil
        </Link>
      </section>

      {/* Footer */}
      <footer className="foot">
        <span>IDENTITY</span>
        <Link to="/discover">Descubrir</Link>
        <Link to="/top">Ranking</Link>
        <Link to="/pricing">Precios</Link>
        <Link to="/terminos">Términos</Link>
        <Link to="/privacidad">Privacidad</Link>
        <span className="foot__sep">Hecho con React + TypeScript</span>
      </footer>
    </div>
  );
}
