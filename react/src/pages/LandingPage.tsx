import { useState, useMemo, useEffect } from 'react';
import { BLOQUES_APAGADOS_POR_DEFECTO } from '@/data/bloques';
import { useNavigate, Link } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useDiscoverProfiles } from '@/hooks/useProfile';
import { useToast } from '@/hooks/useToast';
import { CarruselPerfiles } from '@/components/landing/CarruselPerfiles';
import { slug, num } from '@/lib/utils';
import type { Profile } from '@/types';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

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

  /* Las cifras de la portada salen de la base, no de aqui. `totalViews`
     de arriba solo sumaba los perfiles que el navegador tenia a mano
     —seis— asi que decia «16 visitas» cuando habia muchas mas. */
  const [cifras, setCifras] = useState<backend.Cifras | null>(null);
  useEffect(() => {
    if (!hasBackend()) return;
    let vivo = true;
    backend.cifrasPublicas()
      .then((c: backend.Cifras) => { if (vivo) setCifras(c); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

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
          {/* Solo si de verdad se ha apuntado alguien esta semana. Antes
              ponia `profiles.length || 120`: sin perfiles decia «120
              perfiles creados esta semana», que era inventado y ademas
              de los que se comprueban solos mirando Descubrir. */}
          {!!cifras?.nuevosSemana && (
            <span className="hero__eyebrow">
              <i className="dot" />
              <b>
                {cifras.nuevosSemana} {cifras.nuevosSemana === 1 ? 'perfil' : 'perfiles'}
              </b>{' '}
              {cifras.nuevosSemana === 1 ? 'creado' : 'creados'} esta semana
            </span>
          )}

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

        </div>

        {/* Live Demo with theme / accent switches */}
        <div className="demo rise d2">
          <CarruselPerfiles perfiles={delCarrusel} />

        </div>
      </section>

      {/* ---- Las cifras. Todas salen de la base y ninguna esta escrita a
              mano. Cada una se calla si esta en cero: una portada que
              dice «0 perfiles» esta peor que una que no lo dice. */}
      {!!cifras && (cifras.perfiles > 0 || cifras.visitas > 0) && (
        <section className="cifras wrap">
          <ul className="cifras__l">
            {cifras.perfiles > 0 && (
              <li className="cifra">
                <span className="cifra__n">{num(cifras.perfiles)}</span>
                <span className="cifra__t">
                  {cifras.perfiles === 1 ? 'perfil creado' : 'perfiles creados'}
                </span>
              </li>
            )}
            {cifras.visitas > 0 && (
              <li className="cifra">
                <span className="cifra__n">{num(cifras.visitas)}</span>
                <span className="cifra__t">visitas servidas</span>
              </li>
            )}
            {cifras.plantillas > 0 && (
              <li className="cifra">
                <span className="cifra__n">{num(cifras.plantillas)}</span>
                <span className="cifra__t">
                  {cifras.plantillas === 1 ? 'plantilla publicada' : 'plantillas publicadas'}
                </span>
              </li>
            )}
            {cifras.usosPlantillas > 0 && (
              <li className="cifra">
                <span className="cifra__n">{num(cifras.usosPlantillas)}</span>
                <span className="cifra__t">
                  {cifras.usosPlantillas === 1 ? 'vez aplicada' : 'veces aplicadas'}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ---- Lo que hace IDENTITY. Todo lo de aqui existe y funciona hoy:
              no hay una sola linea prometiendo algo sin construir. */}
      <section className="qhace wrap">
        <header className="qhace__cab">
          <h2 className="t-h2">No es una lista de enlaces</h2>
          <p className="qhace__sub">
            Es una página entera, tuya, con su fondo, su tipografía y sus piezas
            puestas donde tú quieras.
          </p>
        </header>

        <div className="qhace__rej">
          <article className="rasgo">
            <h3 className="rasgo__t">Lo colocas tú</h3>
            <p>
              Arrastra cada pieza donde la quieras o déjalas en columna. Cada una
              lleva su tamaño, su color y su animación, y el editor te enseña el
              resultado mientras lo tocas.
            </p>
          </article>

          <article className="rasgo">
            <h3 className="rasgo__t">Fondo de foto o de vídeo</h3>
            <p>
              Sube una imagen o un vídeo y ajusta el desenfoque, la opacidad y la
              viñeta. Con partículas encima si te apetece: nieve, brasas, matriz.
            </p>
          </article>

          <article className="rasgo">
            <h3 className="rasgo__t">Se conecta a lo que ya usas</h3>
            <p>
              Tu estado de Discord en vivo, tu música, tus redes, tus proyectos y
              tu galería. Sin ir pegando enlaces sueltos.
            </p>
          </article>

          <article className="rasgo">
            <h3 className="rasgo__t">Plantillas de gente real</h3>
            <p>
              Coge el diseño de otro perfil y aplícalo al tuyo de un clic. Se
              copia cómo se ve, nunca su contenido, y puedes publicar el tuyo
              para que lo use quien quiera.
            </p>
          </article>

          <article className="rasgo">
            <h3 className="rasgo__t">Sabes quién te ve</h3>
            <p>
              Personas distintas, cuántas vuelven, a qué hora te descubren y de
              qué país. Sin guardar la dirección de nadie: sólo el país, y en dos
              letras.
            </p>
          </article>

          <article className="rasgo">
            <h3 className="rasgo__t">Se ve igual en todas partes</h3>
            <p>
              Lo que compones no se recoloca en el móvil: se encoge entero y
              conserva su forma, desde un teléfono pequeño hasta un monitor
              ancho.
            </p>
          </article>
        </div>
      </section>

      {/* ---- Preguntas. `details` de verdad y no un acordeon a mano: trae
              el teclado, el buscar-en-pagina del navegador y los lectores
              de pantalla sin escribir una linea de guion. */}
      <section className="faq wrap">
        <h2 className="t-h2 faq__h">Preguntas</h2>

        <details className="faq__i">
          <summary>¿Cuánto cuesta?</summary>
          <p>
            Nada. Puedes crear tu perfil, personalizarlo entero y compartirlo sin
            pagar.
          </p>
        </details>

        <details className="faq__i">
          <summary>¿En qué se diferencia de una página de enlaces?</summary>
          <p>
            En que aquí decides cómo se ve todo: el fondo, la tipografía, la forma
            de la tarjeta y dónde va cada pieza. Una lista de enlaces te da una
            columna de botones; esto te da una página.
          </p>
        </details>

        <details className="faq__i">
          <summary>¿Puedo usar mi propio dominio?</summary>
          <p>
            Todavía no. Tu perfil vive en una dirección de IDENTITY, y ese enlace
            no cambia mientras conserves tu nombre de usuario.
          </p>
        </details>

        <details className="faq__i">
          <summary>¿Qué se guarda de quien me visita?</summary>
          <p>
            Ni su dirección IP ni su ciudad. Se guarda una huella cifrada para no
            contar diez veces a la misma persona, y el país en dos letras. Nada
            más.
          </p>
        </details>

        <details className="faq__i">
          <summary>¿Puedo borrar mi cuenta?</summary>
          <p>
            Sí, desde los ajustes, tú solo y sin pedir permiso. Se van el perfil,
            las visitas y los archivos que hayas subido.
          </p>
        </details>

        <details className="faq__i">
          <summary>¿Se ve bien en el móvil?</summary>
          <p>
            Sí, y sin recolocarse: la composición que hagas se mantiene igual y se
            escala para caber en la pantalla, sea la que sea.
          </p>
        </details>
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
