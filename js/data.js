/* ============================================================
   IDENTITY — catálogos y datos semilla
   Sin dependencias. Todo cuelga de window.ID
   ============================================================ */
(function () {
  'use strict';
  var ID = (window.ID = window.ID || {});

  /* ---- catálogos de personalización ----------------------- */

  ID.THEMES = [
    { id: 'cyberpunk', name: 'Cyberpunk' },
    { id: 'minimal',   name: 'Minimal'   },
    { id: 'anime',     name: 'Anime'     },
    { id: 'gaming',    name: 'Gaming'    },
    { id: 'glass',     name: 'Glass'     },
    { id: 'neon',      name: 'Neon'      },
    { id: 'luxury',    name: 'Luxury'    },
    { id: 'dark',      name: 'Dark'      },
    { id: 'retro',     name: 'Retro'     },
    { id: 'hacker',    name: 'Hacker'    },
    { id: 'win98',     name: 'Win 98'    },
    { id: 'gta',       name: 'GTA'       },
    { id: 'minecraft', name: 'Minecraft' },
    { id: 'discord',   name: 'Discord'   }
  ];

  ID.LAYOUTS = [
    { id: 'card3d',   name: 'Tarjeta 3D' },
    { id: 'gamecard', name: 'Game Card'  },
    { id: 'minimal',  name: 'Minimal'    },
    { id: 'glass',    name: 'Ancho'      }
  ];

  ID.PARTICLES = [
    { id: 'none',    name: 'Ninguno' },
    { id: 'stars',   name: 'Estrellas' },
    { id: 'snow',    name: 'Nieve' },
    { id: 'embers',  name: 'Brasas' },
    { id: 'matrix',  name: 'Matrix' },
    { id: 'bubbles', name: 'Burbujas' },
    { id: 'grid',    name: 'Rejilla' }
  ];

  ID.CURSORS = [
    { id: 'default', name: 'Normal' },
    { id: 'dot',     name: 'Punto'  },
    { id: 'ring',    name: 'Aro'    },
    { id: 'glow',    name: 'Halo'   },
    { id: 'blade',   name: 'Flecha' }
  ];

  ID.AVATAR_FX = [
    { id: 'none',   name: 'Ninguno' },
    { id: 'ring',   name: 'Órbita'  },
    { id: 'pulse',  name: 'Pulso'   },
    { id: 'glitch', name: 'Glitch'  }
  ];

  ID.STATUS_STATES = [
    { id: 'online',  name: 'En línea',  color: '#43B581' },
    { id: 'idle',    name: 'Ausente',   color: '#FAA61A' },
    { id: 'dnd',     name: 'No molestar', color: '#F04747' },
    { id: 'offline', name: 'Desconectado', color: '#747F8D' }
  ];

  /* ---- badges ---------------------------------------------
     `how` documenta la condición de desbloqueo. El motor real
     vive en store.js (ID.store.evaluateBadges).
     --------------------------------------------------------- */
  ID.BADGES = {
    early:     { icon: '🟣', label: 'Early User',  rare: 'rare',      how: 'Estar entre los primeros 1.000 perfiles.' },
    founder:   { icon: '👑', label: 'Founder',     rare: 'legendary', how: 'Otorgado a mano por el equipo.' },
    og:        { icon: '💠', label: 'OG',          rare: 'legendary', how: 'Cuenta con más de 1 año de antigüedad.' },
    premium:   { icon: '💎', label: 'Premium',     rare: 'rare',      how: 'Tener plan PRO o CREATOR activo.' },
    dev:       { icon: '⚡', label: 'Developer',   rare: 'common',    how: 'Enlazar una cuenta de GitHub.' },
    gamer:     { icon: '🎮', label: 'Gamer',       rare: 'common',    how: 'Enlazar Discord, Steam o Twitch.' },
    creator:   { icon: '🎨', label: 'Creator',     rare: 'common',    how: 'Publicar 3 proyectos o más.' },
    views10k:  { icon: '🏆', label: '10K Views',   rare: 'rare',      how: 'Alcanzar 10.000 visitas.' },
    views100k: { icon: '🚀', label: '100K Views',  rare: 'legendary', how: 'Alcanzar 100.000 visitas.' },
    streak100: { icon: '🔥', label: '100 Días',    rare: 'rare',      how: 'Cien días seguidos con el perfil activo.' },
    supporter: { icon: '💰', label: 'Supporter',   rare: 'rare',      how: 'Comprar un tema del marketplace.' },
    verified:  { icon: '✔️', label: 'Verificado',  rare: 'rare',      how: 'Verificar identidad con una red enlazada.' },
    beta:      { icon: '🧪', label: 'Beta',        rare: 'common',    how: 'Activar funciones en pruebas.' },
    artist:    { icon: '🖌️', label: 'Artista',     rare: 'rare',      how: 'Vender un tema propio en el marketplace.' },
    top10:     { icon: '🥇', label: 'Top 10',      rare: 'legendary', how: 'Entrar al top 10 del ranking global.' },
    rated9:    { icon: '⭐', label: 'Rated 9+',    rare: 'rare',      how: 'Nota media superior a 9 con 50+ votos.' }
  };

  /* El catálogo de redes vive en js/nets.js (son ~50 con icono propio). */



  /* ---- marketplace de temas (demo) -------------------------- */
  /* Vacio: los articulos que habia eran inventados. El mercado se
     llena con lo que publiquen los creadores. */
  ID.MARKET = [];

  ID.SEED = [];

  ID.LAYOUT_MODES = [
    { id: 'stack', name: 'En columna' },
    { id: 'free',  name: 'Libre (rejilla)' }
  ];

  ID.STACK_POS = [
    { id: 'center', name: 'Centro' },
    { id: 'left',   name: 'Izquierda' },
    { id: 'right',  name: 'Derecha' }
  ];

  ID.WIDTH_MODES = [
    { id: 'auto',  name: 'Ajustar al contenido' },
    { id: 'fixed', name: 'Ancho fijo' },
    { id: 'full',  name: 'Todo el ancho' }
  ];

  /* estilo de las cajas internas (estado, enlaces, música, stats…)
     independiente de la superficie principal */
  /* superficies que puede llevar un bloque por su cuenta */
  ID.BLOCK_SURFACES = [
    { id: 'inherit', name: 'Del perfil' },
    { id: 'none',    name: 'Sin caja' },
    { id: 'glass',   name: 'Vidrio' },
    { id: 'solid',   name: 'Solida' },
    { id: 'outline', name: 'Solo borde' },
    { id: 'glow',    name: 'Halo' }
  ];

  /* bloques que aceptan caja propia (el avatar no: es una figura) */
  ID.BLOQUES_CON_CAJA = ['identity', 'handle', 'meta', 'joined',
    'fields', 'status', 'discord',
    'live', 'bio', 'badges', 'socials', 'music', 'level', 'views', 'stats'];

  /* peso y caja del nombre: '' significa "lo que diga el tema" */
  ID.NAME_WEIGHTS = [
    { id: '',    name: 'Del tema' },
    { id: '300', name: 'Fina' },
    { id: '500', name: 'Media' },
    { id: '700', name: 'Fuerte' },
    { id: '900', name: 'Maxima' }
  ];

  ID.NAME_CASES = [
    { id: '',          name: 'Del tema' },
    { id: 'none',      name: 'Normal' },
    { id: 'uppercase', name: 'MAYUSCULAS' },
    { id: 'lowercase', name: 'minusculas' }
  ];

  /* Tipos que ganan algo al duplicarse: los que pueden llevar
     contenido propio. Duplicar el avatar o el nivel no aporta nada,
     seria la misma pieza dos veces. */
  ID.BLOQUES_DUPLICABLES = ['bio', 'socials'];

  /* animacion de entrada de una pieza suelta */
  ID.BLOCK_ANIMS = [
    { id: '',      name: 'Del perfil' },
    { id: 'none',  name: 'Ninguna' },
    { id: 'fade',  name: 'Aparecer' },
    { id: 'rise',  name: 'Subir' },
    { id: 'zoom',  name: 'Acercar' },
    { id: 'blur',  name: 'Enfocar' }
  ];

  ID.BLOCK_STYLES = [
    { id: 'inherit',     name: 'Del tema' },
    { id: 'transparent', name: 'Sin caja' },
    { id: 'glass',       name: 'Vidrio' },
    { id: 'solid',       name: 'Sólida' },
    { id: 'outline',     name: 'Sólo borde' }
  ];

  ID.HOVER_FX = [
    { id: 'lift',  name: 'Elevar' },
    { id: 'glow',  name: 'Brillar' },
    { id: 'scale', name: 'Crecer' },
    { id: 'none',  name: 'Ninguno' }
  ];

  ID.ENTER_FX = [
    { id: 'rise',    name: 'Subir' },
    { id: 'fade',    name: 'Aparecer' },
    { id: 'zoom',    name: 'Acercar' },
    { id: 'blur',    name: 'Enfocar' },
    { id: 'stagger', name: 'Escalonado' },
    { id: 'none',    name: 'Ninguna' }
  ];

  /* orden por defecto de los bloques del héroe (el usuario lo cambia) */
  ID.BLOCK_ORDER = ['avatar', 'identity', 'handle', 'meta', 'joined',
    'fields', 'status', 'discord', 'live',
    'bio', 'badges', 'socials', 'music', 'level', 'views', 'stats'];

  /* ---- sistema de composición v2 ---------------------------
     El perfil ya no obliga a usar una tarjeta: la superficie es
     una opción, los bloques se encienden y las secciones se
     reordenan. Estos catálogos alimentan el editor.
     --------------------------------------------------------- */

  ID.SURFACES = [
    { id: 'none',    name: 'Sin caja' },
    { id: 'glass',   name: 'Vidrio' },
    { id: 'solid',   name: 'Sólida' },
    { id: 'outline', name: 'Sólo borde' },
    { id: 'glow',    name: 'Halo' }
  ];

  ID.ALIGNS = [
    { id: 'center', name: 'Centro' },
    { id: 'left',   name: 'Izquierda' },
    { id: 'right',  name: 'Derecha' }
  ];

  ID.AV_SHAPES = [
    { id: 'circle',  name: 'Círculo' },
    { id: 'rounded', name: 'Redondeado' },
    { id: 'square',  name: 'Cuadrado' },
    { id: 'bare',    name: 'Sin máscara' }
  ];

  ID.SOCIAL_STYLES = [
    { id: 'icons', name: 'Iconos' },
    { id: 'boxed', name: 'En caja' },
    { id: 'glow',  name: 'Con halo' },
    { id: 'text',  name: 'Texto' }
  ];

  ID.MUSIC_STYLES = [
    { id: 'minimal',     name: 'Minimal' },
    { id: 'compact',     name: 'Compacto' },
    { id: 'card',        name: 'Tarjeta' },
    { id: 'transparent', name: 'Sólo controles' }
  ];

  ID.FONTS = [
    { id: 'inter',   name: 'Inter',    stack: "'Inter', system-ui, sans-serif" },
    { id: 'manrope', name: 'Manrope',  stack: "'Manrope', system-ui, sans-serif" },
    { id: 'space',   name: 'Space',    stack: "'Space Grotesk', system-ui, sans-serif" },
    { id: 'chakra',  name: 'Chakra',   stack: "'Chakra Petch', system-ui, sans-serif" },
    { id: 'serif',   name: 'Serif',    stack: "'Playfair Display', Georgia, serif" },
    { id: 'display', name: 'Display',  stack: "'Anton', Impact, sans-serif" },
    { id: 'mono',    name: 'Mono',     stack: "'JetBrains Mono', ui-monospace, monospace" },
    { id: 'pixel',   name: 'Pixel',    stack: "'Press Start 2P', 'Courier New', monospace" },
    { id: 'gothic',  name: 'Gótica',   stack: "'Pirata One', 'Playfair Display', serif" },
    { id: 'term',    name: 'Terminal', stack: "'VT323', ui-monospace, monospace" }
  ];

  /* bloques del héroe: el usuario enciende y apaga cada uno */
  ID.BLOCKS = [
    { id: 'avatar',  name: 'Avatar' },
    { id: 'name',    name: 'Nombre' },
    { id: 'handle',  name: '@usuario' },
    { id: 'meta',    name: 'Oficio y ubicación' },
    { id: 'joined',  name: 'Fecha de registro' },
    { id: 'fields',  name: 'Campos libres' },
    { id: 'status',  name: 'Estado' },
    { id: 'discord', name: 'Widget de Discord' },
    { id: 'live',    name: 'Actividad en vivo' },
    { id: 'bio',     name: 'Biografía' },
    { id: 'badges',  name: 'Badges' },
    { id: 'socials', name: 'Redes' },
    { id: 'music',   name: 'Música' },
    { id: 'level',   name: 'Nivel y XP' },
    { id: 'views',   name: 'Visitas (línea)' },
    { id: 'stats',   name: 'Estadísticas (caja)' }
  ];

  /* secciones que aparecen al hacer scroll */
  ID.PAGE_SECTIONS = [
    { id: 'about',    name: 'Sobre mí' },
    { id: 'links',    name: 'Enlaces' },
    { id: 'gallery',  name: 'Galería' },
    { id: 'projects', name: 'Proyectos' },
    { id: 'rate',     name: 'Califícame' }
  ];

  /* presets de composición: puntos de partida, no jaulas */
})();
