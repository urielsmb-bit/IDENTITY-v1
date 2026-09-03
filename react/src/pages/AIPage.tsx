import { useState, useMemo } from 'react';
import { BLOQUES_APAGADOS_POR_DEFECTO } from '@/data/bloques';
import { useNavigate } from 'react-router-dom';
import { ProfileView } from '@/components/profile/ProfileView';
import { useProfileStore } from '@/stores/profileStore';
import { useToast } from '@/hooks/useToast';
import type { Profile } from '@/types';

const RULES = [
  { k: ['cyberpunk', 'neon', 'futurista', 'futuro', 'tech', 'hacker', 'matrix', 'cyber'],
    theme: 'cyberpunk', particles: 'matrix', cursor: 'dot', layout: 'card3d', fx: 'glitch', accent: '#22D3EE' },
  { k: ['gaming', 'gamer', 'juego', 'juegos', 'fivem', 'gta', 'rp', 'roleplay', 'fps', 'valorant'],
    theme: 'gaming', particles: 'embers', cursor: 'ring', layout: 'gamecard', fx: 'pulse', accent: '#ED4245' },
  { k: ['anime', 'manga', 'kawaii', 'otaku', 'waifu', 'cosplay'],
    theme: 'anime', particles: 'bubbles', cursor: 'glow', layout: 'card3d', fx: 'ring', accent: '#EC4899' },
  { k: ['minimal', 'minimalista', 'limpio', 'simple', 'sobrio', 'elegante'],
    theme: 'minimal', particles: 'none', cursor: 'default', layout: 'minimal', fx: 'none', accent: '#FFFFFF' },
  { k: ['lujo', 'luxury', 'premium', 'oro', 'dorado', 'exclusivo', 'trading', 'inversion'],
    theme: 'luxury', particles: 'none', cursor: 'ring', layout: 'card3d', fx: 'none', accent: '#D4AF6E' },
  { k: ['retro', 'vintage', '80', '90', 'noventa', 'ochenta', 'viejo', 'clasico'],
    theme: 'retro', particles: 'none', cursor: 'default', layout: 'card3d', fx: 'none', accent: '#F97316' },
  { k: ['hacker', 'terminal', 'linux', 'consola', 'seguridad', 'ctf', 'bug'],
    theme: 'hacker', particles: 'matrix', cursor: 'dot', layout: 'minimal', fx: 'glitch', accent: '#3BA55D' },
  { k: ['windows', '98', 'nostalgia', 'pixel', 'pixelado'],
    theme: 'win98', particles: 'none', cursor: 'default', layout: 'card3d', fx: 'none', accent: '#008080' },
  { k: ['minecraft', 'bloques', 'builder', 'survival'],
    theme: 'minecraft', particles: 'snow', cursor: 'default', layout: 'card3d', fx: 'none', accent: '#68B44A' },
  { k: ['discord', 'comunidad', 'servidor', 'mod', 'moderador'],
    theme: 'discord', particles: 'none', cursor: 'default', layout: 'card3d', fx: 'none', accent: '#5865F2' },
  { k: ['vice city', 'vice', 'miami', 'palmera', 'synthwave', 'vaporwave'],
    theme: 'gta', particles: 'embers', cursor: 'blade', layout: 'gamecard', fx: 'pulse', accent: '#FF007F' },
  { k: ['vidrio', 'glass', 'cristal', 'transparente', 'blur'],
    theme: 'glass', particles: 'stars', cursor: 'glow', layout: 'glass', fx: 'ring', accent: '#A855F7' },
  { k: ['oscuro', 'dark', 'negro', 'noche', 'sobrio'],
    theme: 'dark', particles: 'stars', cursor: 'default', layout: 'card3d', fx: 'none', accent: '#8A2BE2' }
];

const ROLES = [
  { k: ['developer', 'programador', 'dev', 'codigo', 'programo'], t: 'Developer', tag: 'developer' },
  { k: ['streamer', 'directo', 'twitch', 'kick'], t: 'Streamer', tag: 'streamer' },
  { k: ['gamer', 'jugador', 'gaming', 'fivem', 'roleplay', 'rp'], t: 'Gamer', tag: 'gaming' },
  { k: ['disenador', 'designer', 'diseno', 'ux', 'ui'], t: 'Designer', tag: 'design' },
  { k: ['artista', 'ilustrador', 'dibujo', 'arte'], t: 'Artista', tag: 'art' },
  { k: ['editor', 'video', 'montaje'], t: 'Editor de video', tag: 'creator' },
  { k: ['musico', 'productor', 'beats', 'musica'], t: 'Productor musical', tag: 'music' },
  { k: ['trader', 'trading', 'inversion', 'mercados'], t: 'Trader', tag: 'trading' },
  { k: ['fotografo', 'foto'], t: 'Fotógrafo', tag: 'creator' }
];

const EXAMPLES = [
  'Soy desarrollador frontend en Medellín, me gusta el estilo cyberpunk con neón morado y partículas de matriz.',
  'Streamer de Valorant y GTA RP, diseño gaming con brasas y rojo intenso.',
  'Diseñadora minimalista, interfaz limpia de vidrio en modo oscuro con acentos dorados.',
  'Músico y productor de synthwave, estilo retro 80s con tonos rosa y cian.'
];

function generateProfileFromPrompt(promptText: string): Partial<Profile> {
  const norm = promptText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let matchedRule = RULES[0]!;
  let maxScore = -1;

  for (const r of RULES) {
    let score = 0;
    for (const word of r.k) {
      if (norm.includes(word)) score += word.length;
    }
    if (score > maxScore) {
      maxScore = score;
      matchedRule = r;
    }
  }

  let matchedRole = 'Creador Digital';
  for (const role of ROLES) {
    if (role.k.some((w) => norm.includes(w))) {
      matchedRole = role.t;
      break;
    }
  }

  return {
    theme: matchedRule.theme,
    particles: matchedRule.particles,
    cursor: matchedRule.cursor,
    layoutMode: matchedRule.layout,
    avatarFx: matchedRule.fx,
    accent: matchedRule.accent,
    title: matchedRole,
    bio: promptText.trim(),
  };
}

export default function AIPage() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]!);
  const navigate = useNavigate();
  const { toast } = useToast();

  const generated = useMemo(() => {
    return generateProfileFromPrompt(prompt);
  }, [prompt]);

  const previewProfile = useMemo<Profile>(() => {
    return {
      username: 'ai_preview',
      name: 'Tu Nombre',
      title: generated.title || 'Creador Digital',
      location: 'Tu Ciudad',
      pronouns: '',
      emoji: '✨',
      age: null,
      avatarUrl: '',
      bio: generated.bio || prompt,
      about: '',
      joined: new Date().toISOString(),
      theme: generated.theme || 'cyberpunk',
      accent: generated.accent || '#A855F7',
      colText: '',
      colBg: '',
      colIcon: '',
      align: 'center',
      surface: 'glass',
      avShape: 'rounded',
      avPos: 'center',
      avatarFx: generated.avatarFx || 'pulse',
      socialStyle: 'icons',
      musicStyle: 'compact',
      badgeStyle: 'icons',
      blockStyle: 'glass',
      layoutMode: generated.layoutMode || 'stack',
      stackPos: 'center',
      widthMode: 'fixed',
      hoverFx: 'lift',
      enterFx: 'rise',
      nameWeight: '700',
      nameCase: 'none',
      cursor: 'default',
      particles: generated.particles || 'none',
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
      views: 0,
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
      verified: false,
      discoverable: true,
      showStats: true,
      showRate: true,
      bgType: 'none',
      bgValue: '',
      socials: [
        { net: 'github', url: 'https://github.com', label: 'GitHub' },
        { net: 'x', url: 'https://x.com', label: 'X' },
        { net: 'discord', url: 'https://discord.com', label: 'Discord' },
      ],
      links: [],
      projects: [],
      gallery: [],
      live: [],
      fields: [],
      tags: [],
      blocksOff: [...BLOQUES_APAGADOS_POR_DEFECTO],
      blockOrder: [],
      canvasH: null,
      pos: {},
      bstyle: {},
      bcontent: {},
    };
  }, [generated, prompt]);

  const handleApply = () => {
    const mine = useProfileStore.getState().mine();
    if (mine) {
      useProfileStore.getState().save({
        ...mine,
        ...generated,
      });
      toast('¡Perfil actualizado con la configuración generada!');
      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="ai-page wrap" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Generador Inteligente</h1>
        <p className="t-meta" style={{ fontSize: '1.1rem' }}>
          Describe cómo quieres que se sienta tu perfil y el generador ajustará el tema, colores y efectos.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
        {/* Controls Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
              Describe tu estilo
            </label>
            <textarea
              className="input"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Desarrollador en Medellín, tema cyberpunk oscuro con acentos violeta..."
              style={{ resize: 'vertical', width: '100%' }}
            />

            <div style={{ marginTop: '16px' }}>
              <span className="t-meta" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
                Prueba con estos ejemplos:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn btn--quiet btn--sm"
                    style={{ textAlign: 'left', fontSize: '0.8rem', padding: '8px 12px' }}
                    onClick={() => setPrompt(ex)}
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              style={{ width: '100%', marginTop: '20px' }}
              onClick={handleApply}
            >
              Aplicar a mi perfil
            </button>
          </div>

          {/* Generated breakdown */}
          <div className="panel" style={{ padding: '20px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.02))', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Parámetros deducidos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
              <div><span className="t-meta">Tema:</span> <strong>{generated.theme}</strong></div>
              <div><span className="t-meta">Acento:</span> <span style={{ color: generated.accent, fontWeight: 700 }}>{generated.accent}</span></div>
              <div><span className="t-meta">Partículas:</span> <strong>{generated.particles}</strong></div>
              <div><span className="t-meta">Efecto:</span> <strong>{generated.avatarFx}</strong></div>
            </div>
          </div>
        </div>

        {/* Live Preview Column */}
        <div>
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border, rgba(255,255,255,0.08))', background: 'var(--bg, #050505)' }}>
            <ProfileView profile={previewProfile} preview={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
