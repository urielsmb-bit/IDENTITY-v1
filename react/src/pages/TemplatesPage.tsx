import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { THEMES } from '@/data/themes';
import { useProfileStore } from '@/stores/profileStore';
import { useToast } from '@/hooks/useToast';
import type { Profile } from '@/types';

const TEMPLATE_PREVIEWS: Record<string, Partial<Profile>> = {
  cyberpunk: {
    theme: 'cyberpunk',
    accent: '#22D3EE',
    surface: 'glass',
    particles: 'matrix',
    avatarFx: 'glitch',
    font: 'space',
    fontDisplay: 'display',
    layoutMode: 'stack',
  },
  gaming: {
    theme: 'gaming',
    accent: '#ED4245',
    surface: 'solid',
    particles: 'embers',
    avatarFx: 'pulse',
    font: 'chakra',
    fontDisplay: 'display',
    layoutMode: 'stack',
  },
  anime: {
    theme: 'anime',
    accent: '#EC4899',
    surface: 'glass',
    particles: 'bubbles',
    avatarFx: 'ring',
    font: 'inter',
    fontDisplay: 'inter',
    layoutMode: 'stack',
  },
  minimal: {
    theme: 'minimal',
    accent: '#FFFFFF',
    surface: 'none',
    particles: 'none',
    avatarFx: 'none',
    font: 'inter',
    fontDisplay: 'inter',
    layoutMode: 'stack',
  },
  luxury: {
    theme: 'luxury',
    accent: '#D4AF6E',
    surface: 'glass',
    particles: 'none',
    avatarFx: 'none',
    font: 'serif',
    fontDisplay: 'serif',
    layoutMode: 'stack',
  },
  retro: {
    theme: 'retro',
    accent: '#F97316',
    surface: 'solid',
    particles: 'none',
    avatarFx: 'none',
    font: 'pixel',
    fontDisplay: 'pixel',
    layoutMode: 'stack',
  },
  hacker: {
    theme: 'hacker',
    accent: '#3BA55D',
    surface: 'solid',
    particles: 'matrix',
    avatarFx: 'glitch',
    font: 'mono',
    fontDisplay: 'mono',
    layoutMode: 'stack',
  },
  win98: {
    theme: 'win98',
    accent: '#008080',
    surface: 'solid',
    particles: 'none',
    avatarFx: 'none',
    font: 'pixel',
    fontDisplay: 'pixel',
    layoutMode: 'stack',
  },
  gta: {
    theme: 'gta',
    accent: '#FF007F',
    surface: 'glass',
    particles: 'embers',
    avatarFx: 'pulse',
    font: 'chakra',
    fontDisplay: 'display',
    layoutMode: 'stack',
  },
  minecraft: {
    theme: 'minecraft',
    accent: '#68B44A',
    surface: 'solid',
    particles: 'snow',
    avatarFx: 'none',
    font: 'pixel',
    fontDisplay: 'pixel',
    layoutMode: 'stack',
  },
  glass: {
    theme: 'glass',
    accent: '#A855F7',
    surface: 'glass',
    particles: 'stars',
    avatarFx: 'ring',
    font: 'manrope',
    fontDisplay: 'display',
    layoutMode: 'stack',
  },
  neon: {
    theme: 'neon',
    accent: '#00FFCC',
    surface: 'glow',
    particles: 'stars',
    avatarFx: 'ring',
    font: 'space',
    fontDisplay: 'display',
    layoutMode: 'stack',
  },
  dark: {
    theme: 'dark',
    accent: '#8A2BE2',
    surface: 'solid',
    particles: 'stars',
    avatarFx: 'none',
    font: 'inter',
    fontDisplay: 'inter',
    layoutMode: 'stack',
  },
  discord: {
    theme: 'discord',
    accent: '#5865F2',
    surface: 'solid',
    particles: 'none',
    avatarFx: 'none',
    font: 'inter',
    fontDisplay: 'inter',
    layoutMode: 'stack',
  },
};

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'favs'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleApplyTemplate = (themeId: string) => {
    const tpl = TEMPLATE_PREVIEWS[themeId];
    if (!tpl) return;

    const mine = useProfileStore.getState().mine();
    if (mine) {
      useProfileStore.getState().save({
        ...mine,
        ...tpl,
      });
      toast(`¡Plantilla ${themeId} aplicada a tu perfil!`);
      navigate('/dashboard');
    } else {
      toast('Crea un perfil primero en el panel');
      navigate('/dashboard');
    }
  };

  const displayedThemes = THEMES.filter((t) => {
    if (activeTab === 'favs') return favorites.includes(t.id);
    return true;
  });

  return (
    <div className="templates-page wrap" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: 'var(--tf-page)', marginBottom: '8px' }}>Plantillas de Diseño</h1>
        <p className="t-meta" style={{ fontSize: 'var(--t4)' }}>
          Elige un estilo base prediseñado y aplícalo a tu perfil con un solo clic.
        </p>

        <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'all' ? 'btn--primary' : 'btn--quiet'}`}
            onClick={() => setActiveTab('all')}
          >
            Todas ({THEMES.length})
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'favs' ? 'btn--primary' : 'btn--quiet'}`}
            onClick={() => setActiveTab('favs')}
          >
            Favoritas ({favorites.length})
          </button>
        </div>
      </header>

      {/* Grid of Templates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {displayedThemes.map((t) => {
          const isFav = favorites.includes(t.id);
          const tpl = TEMPLATE_PREVIEWS[t.id];

          return (
            <div
              key={t.id}
              className="panel"
              style={{
                padding: '24px',
                borderRadius: '16px',
                background: 'var(--card-bg, rgba(255,255,255,0.03))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: 'var(--t5)', margin: 0 }}>{t.name}</h3>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', fontSize: 'var(--t4)', cursor: 'pointer' }}
                    onClick={() => toggleFavorite(t.id)}
                    title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  >
                    {isFav ? '❤️' : '🤍'}
                  </button>
                </div>

                <div className="pf tpl__mini" data-theme={tpl?.theme || t.id} aria-hidden="true">
                  {/* Antes aqui habia un emoji de paleta sobre un degradado:
                      un dibujo de una previa, no una previa. No enseñaba
                      NADA de la plantilla, que es justo lo unico que se
                      viene a ver a esta pagina.

                      Esto no es un dibujo: lleva la clase `pf` y el mismo
                      `data-theme` que el perfil de verdad, asi que los
                      colores que salen son los que te vas a llevar,
                      sacados de la misma hoja. Si algun dia se cambia la
                      paleta de un tema, esta miniatura cambia sola. */}
                  <span className="tpl__mini-av" />
                  <span className="tpl__mini-l tpl__mini-l--a" />
                  <span className="tpl__mini-l tpl__mini-l--b" />
                </div>

                <div style={{ fontSize: 'var(--t3)', marginBottom: '20px' }}>
                  <div className="t-meta">Acento: <span style={{ color: tpl?.accent, fontWeight: 700 }}>{tpl?.accent}</span></div>
                  <div className="t-meta">Superficie: <strong>{tpl?.surface}</strong></div>
                  <div className="t-meta">Partículas: <strong>{tpl?.particles}</strong></div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn--primary"
                style={{ width: '100%' }}
                onClick={() => handleApplyTemplate(t.id)}
              >
                Usar plantilla
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
