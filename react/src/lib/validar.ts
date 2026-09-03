
export const TOPE = {
  corto: 80,
  medio: 300,
  largo: 1200,
  url: 2048,
  uri: 8 * 1024 * 1024,
  lista: 60,
  claves: 200
};

export function texto(v: any, max?: number): string {
  if (v == null) return '';
  if (typeof v === 'object') return '';
  return String(v).slice(0, max || TOPE.corto);
}

export function numero(v: any, min: number, max: number, defecto: number): number {
  const n = Number(v);
  if (!isFinite(n)) return defecto;
  return Math.min(max, Math.max(min, n));
}

function numOnulo(v: any, min: number, max: number): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

export function bool(v: any): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

export function deLista(v: any, lista: string[], porDefecto: string): string {
  const s = String(v == null ? '' : v);
  return lista.includes(s) ? s : porDefecto;
}

/** Acepta `unknown` a propósito: si un catálogo llega mal, devolver la lista
 *  vacía es preferible a reventar en mitad del saneado. */
export function ids(catalogo: unknown): string[] {
  if (!Array.isArray(catalogo)) return [];
  return catalogo
    .map((x) => (typeof x === 'string' ? x : x?.id))
    .filter((x): x is string => typeof x === 'string');
}

export function color(v: any, porDefecto?: string): string {
  const s = String(v == null ? '' : v).trim().slice(0, 32);
  if (!s) return porDefecto === undefined ? '' : porDefecto;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(s)) return s;
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(s)) return s;
  if (/^[a-z]{3,20}$/i.test(s)) return s;
  return porDefecto === undefined ? '' : porDefecto;
}

export function medio(v: any): string {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (s.length > TOPE.uri) return '';
  if (/^https?:\/\//i.test(s)) return s.slice(0, TOPE.url);
  if (/^media:[\w-]{1,64}$/.test(s)) return s;
  if (/^blob:/i.test(s)) return s.slice(0, TOPE.url);
  if (/^data:(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm));base64,[A-Za-z0-9+/=]+$/i.test(s)) return s;
  return '';
}

/** Degradados CSS permitidos en `bgValue`. Se deja pasar sólo la familia
 *  gradient: nada de `url()` (cargaría recursos externos desde el perfil de
 *  otra persona), ni `image-set`, ni `@import`, ni barras invertidas. */
const GRADIENTE = /^(repeating-)?(linear|radial|conic)-gradient\([^;{}<>]*\)$/i;

export function fondoCss(v: any): string {
  const t = String(v == null ? '' : v).trim().slice(0, TOPE.medio);
  if (!t) return '';
  const PELIGRO = /url\s*\(|image-set|expression|@import/i;
  if (PELIGRO.test(t) || t.indexOf('\\') !== -1) return '';
  return GRADIENTE.test(t) ? t : '';
}

const INCRUSTABLES = [
  /^https:\/\/open\.spotify\.com\/embed\/(track|album|playlist|artist|episode|show)\/[A-Za-z0-9]{16,32}(\?[\w=&%-]{0,80})?$/,
  /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}(\?[\w=&%-]{0,80})?$/,
  /^https:\/\/player\.vimeo\.com\/video\/\d{6,12}(\?[\w=&%-]{0,120})?$/
];

export function incrustable(v: any): string {
  const t = String(v == null ? '' : v).trim();
  if (!t) return '';
  for (let i = 0; i < INCRUSTABLES.length; i++) {
    if (INCRUSTABLES[i]?.test(t)) return t;
  }
  return '';
}

/**
 * Una dirección a la que se puede mandar a alguien.
 *
 * `safeUrl` ya hace de portero al pintar, y hoy TODOS los `href` pasan por
 * él, así que esto no tapa ningún agujero abierto. Lo que hace es que una
 * dirección con `javascript:` no llegue siquiera a guardarse: no viaja al
 * servidor, no sale en el JSON que alguien se exporta, y el día que se añada
 * una vista nueva y se olvide `safeUrl`, no habrá nada malo que pintar.
 */
export function enlace(v: any): string {
  const s = texto(v, TOPE.url).trim();
  if (!s) return '';
  // Se juzga sobre una copia sin espacios: partir el esquema con un salto
  // de línea o un tabulador es el truco de siempre para colarse por un
  // `startsWith`. Lo que se devuelve es el original.
  const desnudo = s.replace(/\s+/g, '').toLowerCase();
  if (/^(javascript|data|vbscript|file):/.test(desnudo)) return '';
  // Relativa dentro del sitio. `//otro.com` NO: es absoluta disfrazada.
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^(https?|mailto|tel):/.test(desnudo)) return s;
  // Sin esquema —«ejemplo.com/x»— se deja pasar: `safeUrl` le pone https al
  // pintarla, y eso es lo que la gente escribe.
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(s)) return s;
  return '';
}

const FORMAS: Record<string, any> = {
  socials: { net: 24, url: 'url', label: TOPE.corto, icon: 24 },
  links: { title: TOPE.corto, url: 'url', desc: TOPE.medio, icon: 24 },
  projects: { title: TOPE.corto, desc: TOPE.medio, url: 'url', tag: 24, img: 'medio' },
  gallery: { url: 'medio', alt: TOPE.corto, caption: TOPE.medio },
  tags: null,
  blocksOff: null,
  blockOrder: null
};

function limpiarColeccion(clave: string, lista: any[]): any[] {
  if (!Array.isArray(lista)) return [];
  const forma = FORMAS[clave];
  const salida = lista.slice(0, TOPE.lista).map(it => {
    if (!forma) return texto(it, TOPE.corto);
    if (!it || typeof it !== 'object') return null;
    const salida: any = {};
    Object.keys(forma).forEach(k => {
      salida[k] =
        forma[k] === 'medio'
          ? medio(it[k])
          : forma[k] === 'url'
            ? enlace(it[k])
            : texto(it[k], forma[k]);
    });
    return salida;
  }).filter(x => x !== null && (typeof x !== 'string' || x.length > 0));

  // `tags` y `badges` son listas de identificadores sueltos (forma === null):
  // repetir uno no significa nada y además rompe las claves de React al
  // pintarlos, que usan el propio identificador.
  return forma ? salida : Array.from(new Set(salida as string[]));
}

function claveDeBloque(k: string): boolean {
  return /^[a-z]{2,20}(#\d{1,3})?$/.test(String(k));
}

function limpiarMapa(m: any, limpiaValor: (v: any, cat?: any) => any, cat?: any) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  const salida: any = {};
  let n = 0;
  Object.keys(m).forEach(k => {
    if (n >= TOPE.claves) return;
    if (!claveDeBloque(k)) return;
    const v = limpiaValor(m[k], cat);
    if (v !== null) {
      salida[k] = v;
      n++;
    }
  });
  return salida;
}

function limpiarPos(v: any) {
  if (!v || typeof v !== 'object') return null;
  const o: any = {
    col: numero(v.col, 1, 12, 1),
    span: numero(v.span, 1, 12, 12),
    align: deLista(v.align, ['stretch', 'start', 'center', 'end'], 'stretch')
  };
  // Lienzo libre. Se admite algo de margen fuera de la caja (-20..120) para
  // poder sacar una pieza a propósito por un borde.
  if (v.x != null) o.x = numero(v.x, -20, 120, 0);
  if (v.y != null) o.y = numero(v.y, -400, 6000, 0);
  if (v.w != null) o.w = numero(v.w, 5, 100, 100);
  return o;
}

function limpiarBstyle(v: any, ID?: any) {
  if (!v || typeof v !== 'object') return null;
  const o: any = {};
  if (v.s != null) o.s = deLista(v.s, ids(ID?.BLOCK_SURFACES), 'inherit');
  if (v.anim != null) o.anim = deLista(v.anim, ids(ID?.BLOCK_ANIMS), '');
  if (v.animDir != null) o.animDir = deLista(v.animDir, ['up','down','left','right'], 'up');
  if (v.animMs != null) o.animMs = numOnulo(v.animMs, 100, 3000);
  if (v.animDelay != null) o.animDelay = numOnulo(v.animDelay, 0, 3000);
  if (v.animI != null) o.animI = numOnulo(v.animI, 0, 200);
  if (v.animE != null) o.animE = deLista(v.animE, ids(ID?.ANIM_EASINGS), 'suave');
  if (v.case != null) o.case = deLista(v.case, ['none','uppercase','lowercase','capitalize'], 'none');
  if (v.lsp != null) o.lsp = numOnulo(v.lsp, -20, 60);
  if (v.size != null) o.size = numOnulo(v.size, 50, 250);
  if (v.align != null) o.align = deLista(v.align, ['left','center','right'], '');
  if (v.mt != null) o.mt = numOnulo(v.mt, 0, 120);
  if (v.font != null) o.font = deLista(v.font, ids(ID?.FONTS), '');
  if (v.color != null) o.color = color(v.color, '');
  if (v.halo != null) o.halo = color(v.halo, '');
  // 100 es el resplandor de siempre, asi que un perfil que no lo toque se ve
  // igual. Se deja llegar al doble, no mas: pasado eso solo emborrona.
  if (v.hi != null) o.hi = numOnulo(v.hi, 0, 200);
  if (v.w != null) o.w = numOnulo(v.w, 5, 100);
  if (v.pad != null) o.pad = numOnulo(v.pad, 0, 80);
  if (v.rad != null) o.rad = numOnulo(v.rad, 0, 60);
  if (v.op != null) o.op = numOnulo(v.op, 0, 100);
  if (v.bd != null) o.bd = numOnulo(v.bd, 0, 100);
  if (v.blur != null) o.blur = numOnulo(v.blur, 0, 60);
  if (v.glow != null) o.glow = numOnulo(v.glow, 0, 100);
  if (v.scolor != null) o.scolor = color(v.scolor, '');
  if (v.bdcolor != null) o.bdcolor = color(v.bdcolor, '');
  if (v.bdw != null) o.bdw = numOnulo(v.bdw, 0, 8);
  return o;
}

function limpiarBcontent(v: any) {
  if (!v || typeof v !== 'object') return null;
  const o: any = {};
  if (v.text != null) o.text = texto(v.text, TOPE.largo);
  if (Array.isArray(v.nets)) {
    o.nets = v.nets.slice(0, TOPE.lista).map((netName: string) => texto(netName, 24));
  }
  return o;
}

function esquema(ID: any) {
  return {
    username: (v: any) => texto(v, 20).toLowerCase().replace(/[^a-z0-9_]/g, ''),
    name: (v: any) => texto(v, TOPE.corto),
    title: (v: any) => texto(v, TOPE.corto),
    location: (v: any) => texto(v, TOPE.corto),
    pronouns: (v: any) => texto(v, 24),
    emoji: (v: any) => texto(v, 8),
    age: (v: any) => numOnulo(v, 0, 120),
    avatarUrl: medio,
    bio: (v: any) => texto(v, TOPE.largo),
    about: (v: any) => texto(v, TOPE.largo),
    joined: (v: any) => texto(v, 40),
    
    theme: (v: any) => deLista(v, ids(ID?.THEMES), 'dark'),
    accent: (v: any) => color(v, ''),
    colText: (v: any) => color(v, ''),
    sColor: (v: any) => color(v, ''),
    sBorderColor: (v: any) => color(v, ''),
    colBg: (v: any) => color(v, ''),
    colIcon: (v: any) => color(v, ''),
    align: (v: any) => deLista(v, ids(ID?.ALIGNS), 'center'),
    surface: (v: any) => deLista(v, ids(ID?.SURFACES), 'none'),
    avShape: (v: any) => deLista(v, ids(ID?.AV_SHAPES), 'circle'),
    avPos: (v: any) => deLista(v, ids(ID?.AV_POS), 'center'),
    avatarFx: (v: any) => deLista(v, ids(ID?.AVATAR_FX), 'none'),
    socialStyle: (v: any) => deLista(v, ids(ID?.SOCIAL_STYLES), 'icons'),
    musicStyle: (v: any) => deLista(v, ids(ID?.MUSIC_STYLES), 'compact'),
    badgeStyle: (v: any) => deLista(v, ids(ID?.BADGE_STYLES), 'icons'),
    blockStyle: (v: any) => deLista(v, ids(ID?.BLOCK_STYLES), 'inherit'),
    layoutMode: (v: any) => deLista(v, ids(ID?.LAYOUT_MODES), 'stack'),
    stackPos: (v: any) => deLista(v, ids(ID?.STACK_POS), 'center'),
    widthMode: (v: any) => deLista(v, ids(ID?.WIDTH_MODES), 'fixed'),
    hoverFx: (v: any) => deLista(v, ids(ID?.HOVER_FX), 'lift'),
    enterFx: (v: any) => deLista(v, ids(ID?.ENTER_FX), 'rise'),
    nameWeight: (v: any) => deLista(v, ids(ID?.NAME_WEIGHTS), ''),
    nameCase: (v: any) => deLista(v, ids(ID?.NAME_CASES), ''),
    cursor: (v: any) => deLista(v, ids(ID?.CURSORS), 'none'),
    particles: (v: any) => deLista(v, ids(ID?.PARTICLES), 'none'),
    font: (v: any) => texto(v, 40),
    fontDisplay: (v: any) => texto(v, 40),
    
    avSize: (v: any) => numero(v, 40, 240, 112),
    stackWidth: (v: any) => numero(v, 260, 1200, 460),
    gap: (v: any) => numero(v, 0, 80, 16),
    radius: (v: any) => numero(v, 0, 60, 18),
    iconSize: (v: any) => numero(v, 12, 64, 20),
    nameSize: (v: any) => numero(v, 0, 120, 0),
    bioSize: (v: any) => numero(v, 0, 40, 0),
    sBlur: (v: any) => numero(v, 0, 60, 22),
    sGlow: (v: any) => numero(v, 0, 100, 40),
    sBorderW: (v: any) => numero(v, 0, 12, 1),
    sWidthPct: (v: any) => numOnulo(v, 10, 100),
    canvasH: (v: any) => numOnulo(v, 120, 6000),
    bgOpacity: (v: any) => numero(v, 0, 100, 100),
    bgBlur: (v: any) => numero(v, 0, 40, 0),
    bgDim: (v: any) => numero(v, 0, 100, 0),
    vignette: (v: any) => numero(v, 0, 100, 0),
    nameSpacing: (v: any) => numero(v, -20, 60, 0),
    lineHeight: (v: any) => numero(v, 0, 250, 0),
    pad: (v: any) => numOnulo(v, 0, 120),
    sOpacity: (v: any) => numOnulo(v, 0, 100),
    sBorder: (v: any) => numOnulo(v, 0, 100),
    blockRadius: (v: any) => numOnulo(v, 0, 60),
    views: (v: any) => numero(v, 0, 1e9, 0),
    /* Las calcula el servidor y llegan pegadas al perfil. Se dejan pasar
       porque de ellas salen las insignias de visitas y valoraciones; si el
       normalizador las tira, esas insignias se quedan a cero para siempre. */
    numNotas: (v: any) => numero(v, 0, 1e9, 0),
    /* Nula mientras no la haya votado nadie: 0 y «sin votos» no son lo
       mismo, y la insignia Aclamado pide una media minima. */
    nota: (v: any) => numOnulo(v, 0, 5),
    
    sBorderOn: bool,
    avBorder: bool, avGlow: bool, monoIcons: bool, bgFixed: bool,
    fxMagnet: bool, fxGlow: bool, fxParallax: bool,
    gradient: bool, animatedName: bool, glowName: bool,
    glowSocials: bool, glowBadges: bool, noise: bool, tilt: bool,
    gateText: (v: any) => texto(v, 40),
    gate: bool, verified: bool, premium: bool, discoverable: bool,
    // Un id de Discord es un snowflake: solo digitos. Guardar cualquier otra
    // cosa acabaria en una peticion a Lanyard que no puede salir bien.
    discordId: (v: any) => {
      const t = String(v ?? '').replace(/\D/g, '').slice(0, 20);
      return /^\d{17,20}$/.test(t) ? t : '';
    },
    discordDeco: bool,
    showStats: bool, showRate: bool, discordWidget: bool, trackClick: bool,
    
    // 100 es "sin tocar". Menos de 100 dejaria hueco alrededor del fondo,
    // asi que el minimo es 100 y solo se puede acercar.
    enterDir: (v: any) => deLista(v, ['up','down','left','right'], 'up'),
    enterMs: (v: any) => numOnulo(v, 100, 3000),
    enterDelay: (v: any) => numOnulo(v, 0, 3000),
    enterI: (v: any) => numOnulo(v, 0, 200),
    enterE: (v: any) => deLista(v, ids(ID?.ANIM_EASINGS), 'suave'),
    cursorImg: medio,
    cursorSize: (v: any) => numOnulo(v, 12, 96),
    cursorTrail: (v: any) => numOnulo(v, 0, 12),
    cursorTrailFx: (v: any) => deLista(v, ids(ID?.TRAIL_FX), 'chispas'),
    bgScale: (v: any) => numero(v, 100, 300, 100),
    sHeightPx: (v: any) => numOnulo(v, 0, 4000),
    bgType: (v: any) => deLista(v, ['none', 'color', 'gradient', 'image', 'video'], 'none'),
    bgValue: medio,
    // De un panoramico extremo (4:1) a un vertical de movil (9:16). Fuera
    // de ese rango no es una proporcion de video, es un valor manipulado.
    bgRatio: (v: any) => numOnulo(v, 0.4, 4)
  };
}

let ESQUEMA: Record<string, (v: any) => any> | null = null;
let ESQUEMA_DE: unknown = null;

/**
 * `catalogs` es OBLIGATORIO a propósito. Antes había un respaldo a
 * `window.ID`, que en React no existe: los catálogos salían vacíos y cada
 * campo de lista se reseteaba en silencio. Usa `normalizarPerfil()`.
 */
export function perfil(p: any, defectos: any, catalogs: Record<string, unknown>): any {
  if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};

  const ID = catalogs;
  // La caché se rehace si cambian los catálogos: guardarla sin más dejaba
  // el esquema fijado para siempre por la primera llamada.
  if (!ESQUEMA || ESQUEMA_DE !== ID) {
    ESQUEMA = esquema(ID);
    ESQUEMA_DE = ID;
  }
  
  const out: any = { ...defectos };

  const sch = ESQUEMA;
  Object.keys(sch).forEach(k => {
    if (Object.prototype.hasOwnProperty.call(p, k)) {
      const validator = sch[k];
      if (validator) {
        out[k] = validator(p[k]);
      }
    }
  });

  Object.keys(FORMAS).forEach(k => {
    if (Object.prototype.hasOwnProperty.call(p, k)) {
      out[k] = limpiarColeccion(k, p[k]);
    }
  });

  out.pos = limpiarMapa(p.pos, limpiarPos);
  out.bstyle = limpiarMapa(p.bstyle, (v) => limpiarBstyle(v, ID));
  out.bcontent = limpiarMapa(p.bcontent, limpiarBcontent);

  // `bgValue` guarda cosas distintas según `bgType` (un degradado CSS, un
  // color, o la URL de una imagen o vídeo) y el esquema valida campo a campo
  // sin poder mirar a su vecino. Tratarlo siempre como medio borraba todos
  // los fondos con degradado y con color.
  if (Object.prototype.hasOwnProperty.call(p, 'bgValue')) {
    const tipo = out.bgType || 'none';
    out.bgValue =
      tipo === 'gradient' ? fondoCss(p.bgValue)
      : tipo === 'color' ? color(p.bgValue, '')
      : (tipo === 'image' || tipo === 'video') ? medio(p.bgValue)
      : '';
  }


  if (p.audio && typeof p.audio === 'object') {
    out.audio = {
      provider: texto(p.audio.provider, 24),
      src: deLista(p.audio.src, ['manual', 'youtube', 'spotify'], 'manual'),
      title: texto(p.audio.title, TOPE.corto),
      artist: texto(p.audio.artist, TOPE.corto),
      cover: medio(p.audio.cover) || texto(p.audio.cover, 8),
      yt: String(p.audio.yt || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20),
      ytUrl: medio(p.audio.ytUrl),
      tracks: Array.isArray(p.audio.tracks)
        ? p.audio.tracks.slice(0, 30).map((t: any) => {
            if (!t || typeof t !== 'object') return null;
            return {
              title: texto(t.title, TOPE.corto),
              artist: texto(t.artist, TOPE.corto),
              length: texto(t.length, 12),
              cover: medio(t.cover),
              src: deLista(t.src, ['manual', 'youtube', 'spotify'], 'manual'),
              yt: String(t.yt || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20),
              preview: medio(t.preview),
              url: medio(t.url),
              embed: incrustable(t.embed)
            };
          }).filter(Boolean)
        : []
    };
  }

  if (p.ratings && typeof p.ratings === 'object') {
    out.ratings = {
      design: numero(p.ratings.design, 0, 5, 0),
      originality: numero(p.ratings.originality, 0, 5, 0),
      aesthetic: numero(p.ratings.aesthetic, 0, 5, 0),
      votes: numero(p.ratings.votes, 0, 1e9, 0)
    };
  }

  ['_id', '_actualizado', '_parcial', '_sucio'].forEach(k => {
    if (p[k] != null) out[k] = p[k];
  });

  return out;
}
