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

/**
 * Lo que hace IDENTITY. Todo esto existe y funciona hoy: no hay una sola
 * linea aqui prometiendo algo sin construir.
 *
 * El texto va corto a proposito —dos lineas— porque en una rejilla de
 * seis, un parrafo de cuatro lineas no se lee: se salta.
 *
 * Los iconos son de trazo y del mismo grosor que los del editor, para
 * que no parezcan traidos de otro sitio.
 */
const RASGOS = [
  {
    t: 'Lo colocas tú',
    d: 'Arrastra cada pieza donde quieras. El editor te enseña el resultado mientras lo tocas.',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M17.5 14.5v7M14 18h7" />
      </svg>
    ),
  },
  {
    t: 'Fondo de foto o de vídeo',
    d: 'Con desenfoque, opacidad y viñeta a tu gusto. Y partículas encima si te apetece.',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="8.5" cy="9.5" r="1.6" />
        <path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4" />
      </svg>
    ),
  },
  {
    t: 'Se conecta a lo que ya usas',
    d: 'Tu estado de Discord en vivo, tu música, tus redes y tus proyectos. Sin pegar enlaces sueltos.',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
        <path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5" />
      </svg>
    ),
  },
  {
    t: 'Plantillas de gente real',
    d: 'Coge el diseño de otro perfil de un clic. Se copia cómo se ve, nunca su contenido.',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="3" width="13" height="13" rx="2.5" />
        <path d="M16 19.5A2.5 2.5 0 0 1 13.5 22h-8A2.5 2.5 0 0 1 3 19.5v-8A2.5 2.5 0 0 1 5.5 9" />
      </svg>
    ),
  },
  {
    t: 'Sabes quién te ve',
    d: 'Cuántos vuelven, a qué hora te descubren y de qué país. Sin guardar la dirección de nadie.',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 20V10M9 20V4M15 20v-7M21 20v-11" />
      </svg>
    ),
  },
  {
    t: 'Se ve igual en todas partes',
    d: 'Tu composición no se recoloca en el móvil: se encoge entera y conserva su forma.',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="14" height="11" rx="2" />
        <rect x="16" y="9" width="6" height="11" rx="1.6" />
      </svg>
    ),
  },
];

/**
 * Las cifras de la banda, en el orden en que se enseñan.
 *
 * Ninguna esta escrita a mano: la clave apunta a lo que devuelve la vista
 * `cifras_publicas`, o sea la base. Y cada una SE CALLA si esta en cero
 * —de ahi que sea una lista y no cuatro bloques copiados—: una portada
 * que dice «0 plantillas» esta peor que una que no lo dice.
 *
 * La referencia que se pidio pone la cifra en el titular («mas de
 * 2.270.000 personas usan...»). Aqui no: con cuatro perfiles, «mas de 4
 * personas usan IDENTITY» hunde la pagina en vez de levantarla. El
 * numero vive en su tarjeta, que se lee bien hoy y mejor cuando crezca.
 */
const CIFRAS_VISIBLES = [
  {
    k: 'perfiles' as const,
    uno: 'perfil creado',
    varios: 'perfiles creados',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    k: 'visitas' as const,
    uno: 'visita servida',
    varios: 'visitas servidas',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.6-6.4 10-6.4S22 12 22 12s-3.6 6.4-10 6.4S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
  {
    k: 'plantillas' as const,
    uno: 'plantilla publicada',
    varios: 'plantillas publicadas',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="3" width="13" height="13" rx="2.5" />
        <path d="M16 19.5A2.5 2.5 0 0 1 13.5 22h-8A2.5 2.5 0 0 1 3 19.5v-8A2.5 2.5 0 0 1 5.5 9" />
      </svg>
    ),
  },
  {
    k: 'usosPlantillas' as const,
    uno: 'vez aplicada',
    varios: 'veces aplicadas',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
];

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
          <header className="cifras__cab">
            <h2 className="t-h2">Todo lo tuyo, en un enlace</h2>
            <p className="cifras__sub">
              Un perfil que se ve como tú quieras, con tus redes, tu música y lo
              que estés haciendo. Gratis, y tuyo desde el primer minuto.
            </p>
          </header>

          <ul className="cifras__l">
            {CIFRAS_VISIBLES.map(({ k, uno, varios, icono }) => {
              const v = cifras[k];
              if (!v) return null;
              return (
                <li className="cifra" key={k}>
                  <span className="cifra__i" aria-hidden="true">{icono}</span>
                  <span className="cifra__n">{num(v)}</span>
                  <span className="cifra__t">{v === 1 ? uno : varios}</span>
                </li>
              );
            })}
          </ul>

          {/* El formulario otra vez, aqui abajo. Quien ha llegado leyendo
              hasta las cifras ya no tiene el de arriba a la vista, y
              hacerle subir a buscarlo es la forma mas tonta de perderlo. */}
          <form className="claim cifras__claim" onSubmit={handleClaimSubmit}>
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

        {/* Cada una con su icono y su texto corto.

            Antes eran seis parrafos largos de gris del mismo peso, sin
            caja ni icono. Lo escribi asi para no llenar la pagina de
            cajas, y salio peor: sin nada donde posar el ojo no se leia
            ninguno. Y una pagina que vende algo VISUAL no puede estar
            contada solo con palabras.

            La caja es la misma que usa el resto del producto —la de las
            plantillas, la de analiticas—, asi que aqui no es adorno: es
            coherencia. */}
        <div className="qhace__rej">
          {RASGOS.map((r) => (
            <article className="rasgo" key={r.t}>
              <span className="rasgo__i" aria-hidden="true">{r.icono}</span>
              <h3 className="rasgo__t">{r.t}</h3>
              <p>{r.d}</p>
            </article>
          ))}
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
