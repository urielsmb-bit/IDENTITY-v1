import { useState, useMemo } from 'react';
import { BLOQUES_APAGADOS_POR_DEFECTO } from '@/data/bloques';
import { useNavigate, Link } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useDiscoverProfiles } from '@/hooks/useProfile';
import { useToast } from '@/hooks/useToast';
import { CarruselPerfiles } from '@/components/landing/CarruselPerfiles';
import { slug, num } from '@/lib/utils';
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
  views: 14200,
  avBorder: true,
  avGlow: true,
  monoIcons: false,
  bgFixed: true,
  gradient: true,
  animatedName: true,
  glowName: true,
  glowSocials: true,
  glowBadges: true,
  noise: true,
  tilt: true,
  gate: false,
  verified: true,
  discoverable: true,
  showStats: true,
  showRate: true,
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
  tags: ['developer', 'design'],
  blocksOff: [...BLOQUES_APAGADOS_POR_DEFECTO],
  blockOrder: [],
  canvasH: null,
  pos: {},
  bstyle: {},
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
    /* Empezaba en 24500. Ese numero no salia de ningun sitio: era un
       relleno para que la portada no dijera una cifra pequeña. O sea que
       la frase «visitas servidas en total» era mentira, y de las que se
       comprueban solas —cualquiera suma las visitas de los perfiles
       visibles y no le cuadra—. Ahora es la suma de verdad, y si no hay
       nada que contar la linea no se enseña. */
    return profiles.reduce((acc, p) => acc + (p.views || 0), 0);
  }, [profiles]);

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

          {/* Si no hay visitas que contar, no se dice ninguna cifra. No
              enseñar un dato es honesto; inventarlo, no. Los cinco emojis
              que habia al lado tampoco eran nadie: hacian de caras de
              gente que no existe. */}
          {totalViews > 0 && (
            <div className="hero__proof">
              <p className="t-meta" style={{ margin: 0 }}>
                {num(totalViews)} visitas servidas en total
              </p>
            </div>
          )}
        </div>

        {/* Live Demo with theme / accent switches */}
        <div className="demo rise d2">
          <CarruselPerfiles perfiles={delCarrusel} />

        </div>
      </section>

      {/* Featured Rail */}
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
