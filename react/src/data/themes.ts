/**
 * Static catalogs for profile customization — migrated from data.js
 * Covers themes, layouts, particles, cursors, effects, surfaces,
 * fonts, block animations, and all visual configuration options.
 */

export interface CatalogItem {
  id: string;
  name: string;
}

export interface StatusState extends CatalogItem {
  color: string;
}

export interface FontItem extends CatalogItem {
  stack: string;
  /** 'deco' = woff2 propio en /public/fuentes; sin valor = de Google Fonts */
  grupo?: string;
}

// ── Themes ──────────────────────────────────────────────────
export const THEMES: CatalogItem[] = [
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
  { id: 'discord',   name: 'Discord'   },
];

// ── Layouts ─────────────────────────────────────────────────
export const LAYOUTS: CatalogItem[] = [
  { id: 'card3d',   name: 'Tarjeta 3D' },
  { id: 'gamecard', name: 'Game Card'  },
  { id: 'minimal',  name: 'Minimal'    },
  { id: 'glass',    name: 'Ancho'      },
];

// ── Particles ───────────────────────────────────────────────
export const PARTICLES: CatalogItem[] = [
  { id: 'none',    name: 'Ninguno'   },
  { id: 'stars',   name: 'Estrellas' },
  { id: 'snow',    name: 'Nieve'     },
  { id: 'embers',  name: 'Brasas'    },
  { id: 'matrix',  name: 'Matrix'    },
  { id: 'bubbles', name: 'Burbujas'  },
  { id: 'grid',    name: 'Rejilla'   },
];

// ── Cursors ─────────────────────────────────────────────────
export const CURSORS: CatalogItem[] = [
  { id: 'default', name: 'Normal' },
  { id: 'dot',     name: 'Punto'  },
  { id: 'ring',    name: 'Aro'    },
  { id: 'glow',    name: 'Halo'   },
  { id: 'blade',   name: 'Flecha' },
];

// ── Avatar Effects ──────────────────────────────────────────
export const AVATAR_FX: CatalogItem[] = [
  { id: 'none',   name: 'Ninguno' },
  { id: 'ring',   name: 'Órbita'  },
  { id: 'pulse',  name: 'Pulso'   },
  { id: 'glitch', name: 'Glitch'  },
];

// ── Status States ───────────────────────────────────────────
export const STATUS_STATES: StatusState[] = [
  { id: 'online',  name: 'En línea',     color: '#43B581' },
  { id: 'idle',    name: 'Ausente',      color: '#FAA61A' },
  { id: 'dnd',     name: 'No molestar',  color: '#F04747' },
  { id: 'offline', name: 'Desconectado', color: '#747F8D' },
];

// ── Layout Modes ────────────────────────────────────────────
export const LAYOUT_MODES: CatalogItem[] = [
  { id: 'stack', name: 'En columna'       },
  { id: 'free',  name: 'Libre (rejilla)' },
];

// ── Stack Position ──────────────────────────────────────────
export const STACK_POS: CatalogItem[] = [
  { id: 'center', name: 'Centro'    },
  { id: 'left',   name: 'Izquierda' },
  { id: 'right',  name: 'Derecha'   },
];

// ── Width Modes ─────────────────────────────────────────────
export const WIDTH_MODES: CatalogItem[] = [
  { id: 'auto',  name: 'Ajustar al contenido' },
  { id: 'fixed', name: 'Ancho fijo'           },
  { id: 'full',  name: 'Todo el ancho'        },
];

// ── Block Surfaces (individual block override) ──────────────
export const BLOCK_SURFACES: CatalogItem[] = [
  { id: 'inherit', name: 'Del perfil'  },
  { id: 'none',    name: 'Sin caja'    },
  { id: 'glass',   name: 'Vidrio'      },
  { id: 'solid',   name: 'Solida'      },
  { id: 'outline', name: 'Solo borde'  },
  { id: 'glow',    name: 'Halo'        },
];

// ── Profile Surfaces ────────────────────────────────────────
export const SURFACES: CatalogItem[] = [
  { id: 'none',    name: 'Sin caja'    },
  { id: 'glass',   name: 'Vidrio'      },
  { id: 'solid',   name: 'Sólida'      },
  { id: 'outline', name: 'Sólo borde'  },
  { id: 'glow',    name: 'Halo'        },
];

// ── Alignments ──────────────────────────────────────────────
export const ALIGNS: CatalogItem[] = [
  { id: 'center', name: 'Centro'    },
  { id: 'left',   name: 'Izquierda' },
  { id: 'right',  name: 'Derecha'   },
];

// ── Avatar Shapes ───────────────────────────────────────────
export const AV_SHAPES: CatalogItem[] = [
  { id: 'square',  name: 'Cuadrado'   },
  { id: 'rounded', name: 'Redondeado' },
  { id: 'circle',  name: 'Círculo'    },
  { id: 'bare',    name: 'Imagen'     },
];

// ── Posición del avatar dentro de la pila ───────────────────
/** Independiente de la alineación del texto: se puede querer el nombre
 *  centrado y el avatar pegado a un lado. */
export const AV_POS: CatalogItem[] = [
  { id: 'left',   name: 'Izquierda'      },
  { id: 'center', name: 'Centro'         },
  { id: 'right',  name: 'Derecha'        },
  { id: 'side',   name: 'Nombre al lado' },
];

// ── Badge Styles ────────────────────────────────────────────
/** Por defecto van sueltas: la caja es opcional, no al revés. */
export const BADGE_STYLES: CatalogItem[] = [
  { id: 'icons',   name: 'Solo iconos'     },
  { id: 'plain',   name: 'Icono y texto'   },
  { id: 'text',    name: 'Solo texto'      },
  { id: 'boxed',   name: 'Iconos en caja'  },
  { id: 'default', name: 'Con caja'        },
];

// ── Social Styles ───────────────────────────────────────────
export const SOCIAL_STYLES: CatalogItem[] = [
  { id: 'icons', name: 'Solo iconos' },
  { id: 'boxed', name: 'Con caja'    },
  { id: 'glow',  name: 'Con halo'    },
  { id: 'text',  name: 'Solo texto'  },
];

/** Tipos de estela del cursor. Cada uno cambia forma, deriva y duracion;
 *  el emisor es el mismo para todos. */
export const TRAIL_FX: CatalogItem[] = [
  { id: 'chispas',  name: 'Chispas'  },
  { id: 'puntos',   name: 'Puntos'   },
  { id: 'polvo',    name: 'Polvo'    },
  { id: 'burbujas', name: 'Burbujas' },
  { id: 'fuego',    name: 'Brasas'   },
  { id: 'nieve',    name: 'Nieve'    },
];

// ── Music Styles ────────────────────────────────────────────
export const MUSIC_STYLES: CatalogItem[] = [
  { id: 'minimal',     name: 'Minimal'        },
  { id: 'compact',     name: 'Compacto'       },
  { id: 'card',        name: 'Tarjeta'        },
  { id: 'transparent', name: 'Sólo controles' },
];

// ── Name Weight ─────────────────────────────────────────────
export const NAME_WEIGHTS: CatalogItem[] = [
  { id: '',    name: 'Del tema' },
  { id: '300', name: 'Fina'    },
  { id: '500', name: 'Media'   },
  { id: '700', name: 'Fuerte'  },
  { id: '900', name: 'Maxima'  },
];

// ── Name Case ───────────────────────────────────────────────
export const NAME_CASES: CatalogItem[] = [
  { id: '',          name: 'Del tema'    },
  { id: 'none',      name: 'Normal'      },
  { id: 'uppercase', name: 'MAYUSCULAS'  },
  { id: 'lowercase', name: 'minusculas'  },
];

// ── Block Entry Animations ──────────────────────────────────
export const BLOCK_ANIMS: CatalogItem[] = [
  { id: '',       name: 'Del perfil' },
  { id: 'none',   name: 'Ninguna'    },
  { id: 'fade',   name: 'Aparecer'   },
  // `rise` se queda por los perfiles ya guardados: es un deslizamiento
  // hacia arriba, o sea `slide` con la direccion puesta.
  { id: 'rise',   name: 'Subir'      },
  { id: 'slide',  name: 'Deslizar'   },
  { id: 'zoom',   name: 'Acercar'    },
  { id: 'blur',   name: 'Enfocar'    },
  { id: 'rotate', name: 'Girar'      },
  { id: 'bounce', name: 'Rebotar'    },
  { id: 'flip',   name: 'Voltear'    },
  { id: 'glitch', name: 'Glitch'     },
];

/** De donde entra la pieza. Solo lo usan `slide`, `bounce` y `flip`. */
export const ANIM_DIRS: CatalogItem[] = [
  { id: 'up',    name: 'Desde abajo'    },
  { id: 'down',  name: 'Desde arriba'   },
  { id: 'left',  name: 'Desde la derecha' },
  { id: 'right', name: 'Desde la izquierda' },
];

/** Curvas. El id es nuestro; el valor es la funcion de CSS. */
export const ANIM_EASINGS: CatalogItem[] = [
  { id: 'suave',   name: 'Suave'    },
  { id: 'lineal',  name: 'Lineal'   },
  { id: 'entrada', name: 'Acelera'  },
  { id: 'salida',  name: 'Frena'    },
  { id: 'muelle',  name: 'Muelle'   },
];

export const EASING_CSS: Record<string, string> = {
  suave:   'cubic-bezier(.16,1,.3,1)',
  lineal:  'linear',
  entrada: 'cubic-bezier(.55,.06,.68,.19)',
  salida:  'cubic-bezier(.22,.61,.36,1)',
  muelle:  'cubic-bezier(.34,1.56,.64,1)',
};

// ── Block Surface Styles ────────────────────────────────────
export const BLOCK_STYLES: CatalogItem[] = [
  { id: 'inherit',     name: 'Del tema'   },
  { id: 'transparent', name: 'Sin caja'   },
  { id: 'glass',       name: 'Vidrio'     },
  { id: 'solid',       name: 'Sólida'     },
  { id: 'outline',     name: 'Sólo borde' },
];

// ── Hover Effects ───────────────────────────────────────────
export const HOVER_FX: CatalogItem[] = [
  { id: 'lift',  name: 'Elevar'  },
  { id: 'glow',  name: 'Brillar' },
  { id: 'scale', name: 'Crecer'  },
  { id: 'none',  name: 'Ninguno' },
];

// ── Enter Effects ───────────────────────────────────────────
export const ENTER_FX: CatalogItem[] = [
  { id: 'fade',    name: 'Aparecer'   },
  { id: 'rise',    name: 'Subir'      },
  { id: 'slide',   name: 'Deslizar'   },
  { id: 'zoom',    name: 'Acercar'    },
  { id: 'blur',    name: 'Enfocar'    },
  { id: 'rotate',  name: 'Girar'      },
  { id: 'bounce',  name: 'Rebotar'    },
  { id: 'flip',    name: 'Voltear'    },
  // Solo de la superficie: entran sus piezas una detras de otra.
  { id: 'stagger', name: 'Escalonado' },
  { id: 'none',    name: 'Ninguna'    },
];

// ── Fonts ───────────────────────────────────────────────────
export const FONTS: FontItem[] = [
  { id: 'inter',   name: 'Inter',    stack: "'Inter', system-ui, sans-serif" },
  { id: 'manrope', name: 'Manrope',  stack: "'Manrope', system-ui, sans-serif" },
  { id: 'space',   name: 'Space',    stack: "'Space Grotesk', system-ui, sans-serif" },
  { id: 'chakra',  name: 'Chakra',   stack: "'Chakra Petch', system-ui, sans-serif" },
  { id: 'serif',   name: 'Serif',    stack: "'Playfair Display', Georgia, serif" },
  { id: 'display', name: 'Display',  stack: "'Anton', Impact, sans-serif" },
  { id: 'mono',    name: 'Mono',     stack: "'JetBrains Mono', ui-monospace, monospace" },
  { id: 'pixel',   name: 'Pixel',    stack: "'Press Start 2P', 'Courier New', monospace" },
  { id: 'gothic',  name: 'Gótica',   stack: "'Pirata One', 'Playfair Display', serif" },
  { id: 'term',    name: 'Terminal', stack: "'VT323', ui-monospace, monospace" },

  // ── decorativas, alojadas por nosotros ────────────────────
  // Las de arriba vienen de Google Fonts; estas son woff2 propios en
  // /public/fuentes, recortados al latin. Se declaran en fuentes.css.
  { id: 'harley',     name: 'Harley',         stack: "'Harley', cursive", grupo: 'deco' },
  { id: 'bastliga',   name: 'Bastliga',       stack: "'Bastliga', cursive", grupo: 'deco' },
  { id: 'bloodrops',  name: 'Sangre',         stack: "'Bloodrops', fantasy", grupo: 'deco' },
  { id: 'chiikawa',   name: 'Chiikawa',       stack: "'Chiikawa', cursive", grupo: 'deco' },
  { id: 'emo',        name: 'Emo',            stack: "'Emo Script', cursive", grupo: 'deco' },
  { id: 'creamy',     name: 'Creamy',         stack: "'Creamy Chicken', cursive", grupo: 'deco' },
  { id: 'deathnote',  name: 'Death Note',     stack: "'Death Note', fantasy", grupo: 'deco' },
  { id: 'video',      name: 'Video',          stack: "'Video Med', sans-serif", grupo: 'deco' },
  { id: 'gothicwar',  name: 'Gothic War',     stack: "'Gothic War', fantasy", grupo: 'deco' },
  { id: 'harryp',     name: 'Harry P',        stack: "'Harry P', fantasy", grupo: 'deco' },
  { id: 'hoshiko',    name: 'Hoshiko',        stack: "'Hoshiko', cursive", grupo: 'deco' },
  { id: 'navidad',    name: 'Last Christmas', stack: "'Last Christmas', cursive", grupo: 'deco' },
  { id: 'mitchel',    name: 'Mitchel',        stack: "'Mitchel', serif", grupo: 'deco' },
  { id: 'maquina',    name: 'Máquina',        stack: "'Moms Typewriter', monospace", grupo: 'deco' },
  { id: 'newrocker',  name: 'New Rocker',     stack: "'New Rocker', fantasy", grupo: 'deco' },
  { id: 'cheeky',     name: 'Cheeky',         stack: "'Cheeky Rabbit', cursive", grupo: 'deco' },
  { id: 'playpen',    name: 'Playpen',        stack: "'Playpen Sans', cursive", grupo: 'deco' },
  { id: 'pricedown',  name: 'Pricedown',      stack: "'Pricedown', sans-serif", grupo: 'deco' },
  { id: 'ritual',     name: 'Ritual',         stack: "'Ritual', fantasy", grupo: 'deco' },
  { id: 'simbiot',    name: 'Simbiot',        stack: "'Simbiot', fantasy", grupo: 'deco' },
  { id: 'singsong',   name: 'Singsong',       stack: "'Singsong', cursive", grupo: 'deco' },
  { id: 'smile',      name: 'Smile',          stack: "'Smile Delight', cursive", grupo: 'deco' },
  { id: 'swordskull', name: 'Swordskull',     stack: "'Swordskull', fantasy", grupo: 'deco' },
  { id: 'rum',        name: 'Rum',            stack: "'Rum Is Gone', cursive", grupo: 'deco' },
  { id: 'trash',      name: 'Trash',          stack: "'Trash Rush', fantasy", grupo: 'deco' },
  { id: 'vampiro',    name: 'Vampiro',        stack: "'Vampire Zone', fantasy", grupo: 'deco' },
  { id: 'zombie',     name: 'Zombieland',     stack: "'Zoombieland', fantasy", grupo: 'deco' },
];

// ── Marketplace (demo — empty, filled by creators) ──────────
export const MARKET: CatalogItem[] = [];

// ── Seed profiles (empty) ───────────────────────────────────
export const SEED: unknown[] = [];
