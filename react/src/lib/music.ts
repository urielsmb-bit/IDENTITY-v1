import type { AudioTrack } from '@/types';

export type Track = AudioTrack;

export const K_CID = 'identity.spotify.cid';
const K_VER = 'identity.spotify.ver';

let sesionSpotify: any = null;

function guardarVerificador(v: any) {
  try { sessionStorage.setItem(K_VER, JSON.stringify(v)); } catch { /* modo privado */ }
}
function leerVerificador() {
  try {
    const v = sessionStorage.getItem(K_VER);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
function borrarVerificador() {
  try { sessionStorage.removeItem(K_VER); } catch { /* modo privado */ }
  try { localStorage.removeItem(K_VER); } catch { /* modo privado */ }
}

const API = 'https://api.spotify.com/v1';
const SCOPES = 'playlist-read-private playlist-read-collaborative user-read-email';

/* ============================================================
   YOUTUBE
   ============================================================ */
export function idYouTube(url: string | null | undefined): string {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^[\w-]{11}$/.test(u)) return u;
  const m =
    u.match(/youtu\.be\/([\w-]{11})/) ||
    u.match(/[?&]v=([\w-]{11})/) ||
    u.match(/\/embed\/([\w-]{11})/) ||
    u.match(/\/shorts\/([\w-]{11})/) ||
    u.match(/\/live\/([\w-]{11})/);
  return (m && m[1]) ? m[1] : '';
}

export function miniaturaYouTube(id: string): string {
  return id ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : '';
}

let apiLista = false;
const colaAPI: Array<() => void> = [];

function cargarAPIYouTube(cb: () => void) {
  if (apiLista && (window as any).YT && (window as any).YT.Player) return cb();
  colaAPI.push(cb);
  if (document.getElementById('yt-api')) return;

  const anterior = (window as any).onYouTubeIframeAPIReady;
  (window as any).onYouTubeIframeAPIReady = function () {
    if (typeof anterior === 'function') anterior();
    apiLista = true;
    colaAPI.splice(0).forEach((f) => f());
  };
  const s = document.createElement('script');
  s.id = 'yt-api';
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function () { colaAPI.splice(0); };
  document.head.appendChild(s);
}

export function reproductorYouTube(contenedor: HTMLElement, videoId: string, cb: any = {}) {
  let yt: any = null, listo = false, pendiente: string | null = null, muerto = false;

  cargarAPIYouTube(() => {
    if (muerto) return;
    const hueco = document.createElement('div');
    contenedor.appendChild(hueco);
    yt = new (window as any).YT.Player(hueco, {
      videoId: videoId,
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: () => {
          listo = true;
          if (cb.alListo) cb.alListo();
          if (pendiente === 'play') yt.playVideo();
          pendiente = null;
        },
        onStateChange: (e: any) => {
          if (e.data === 0 && cb.alTerminar) cb.alTerminar();
          if (cb.alEstado) cb.alEstado(e.data === 1);
        }
      }
    });
  });

  return {
    play: () => { if (listo && yt) yt.playVideo(); else pendiente = 'play'; },
    pause: () => { if (listo && yt) yt.pauseVideo(); else pendiente = null; },
    cargar: (id: string, arrancar: boolean) => {
      if (!listo || !yt) { pendiente = arrancar ? 'play' : null; return; }
      if (arrancar) yt.loadVideoById(id); else yt.cueVideoById(id);
    },
    buscar: (seg: number) => { if (listo && yt) yt.seekTo(seg, true); },
    tiempo: () => { return (listo && yt && yt.getCurrentTime) ? yt.getCurrentTime() : 0; },
    duracion: () => { return (listo && yt && yt.getDuration) ? yt.getDuration() : 0; },
    volumen: (v: number) => { if (listo && yt) yt.setVolume(Math.round(v * 100)); },
    destroy: () => {
      muerto = true;
      try { if (yt && yt.destroy) yt.destroy(); } catch { /* ya se fue */ }
    }
  };
}

/* ============================================================
   CONTROLADOR
   ============================================================ */
export function mmss(seg: number | string): string {
  const s = Math.max(0, Math.floor(Number(seg) || 0));
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}

export function duracion(ms: number | string): string {
  const s = Math.round((Number(ms) || 0) / 1000);
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}

export function crearReproductor(host: HTMLElement, pistas: any[], cb: any = {}) {
  pistas = (pistas || []).filter(Boolean);
  if (!pistas.length) return null;

  let i = 0, yt: any = null, au: HTMLAudioElement | null = null, latido: any = 0, sonando = false, muerto = false;

  function actual() { return pistas[i] || pistas[0]; }

  function avisarEstado(s: boolean) {
    sonando = !!s;
    if (cb.alEstado) cb.alEstado(sonando);
    if (sonando) arrancarLatido(); else pararLatido();
  }

  function arrancarLatido() {
    pararLatido();
    latido = setInterval(() => {
      if (muerto) return;
      if (cb.alAvanzar) cb.alAvanzar(tiempo(), duracionTrack());
    }, 250);
  }
  function pararLatido() { clearInterval(latido); latido = 0; }

  function motor() {
    const t = actual();
    return (t && t.src === 'youtube' && t.yt) ? 'yt' : (t && t.preview ? 'au' : null);
  }

  function asegurarYT(arrancar: boolean) {
    const t = actual();
    if (!yt) {
      yt = reproductorYouTube(host, t.yt, {
        alEstado: avisarEstado,
        alTerminar: () => { siguiente(true); }
      });
      if (arrancar) yt.play();
    } else {
      yt.cargar(t.yt, arrancar);
    }
  }

  function asegurarAudio(arrancar: boolean) {
    const t = actual();
    if (!au) {
      au = new Audio();
      au.addEventListener('play', () => { avisarEstado(true); });
      au.addEventListener('pause', () => { avisarEstado(false); });
      au.addEventListener('ended', () => { siguiente(true); });
    }
    if (au.getAttribute('data-t') !== String(i)) {
      au.src = t.preview;
      au.setAttribute('data-t', String(i));
    }
    if (arrancar) au.play().catch(() => { avisarEstado(false); });
  }

  function precalentar() {
    if (muerto) return;
    const m = motor();
    if (m === 'yt') asegurarYT(false);
    else if (m === 'au') asegurarAudio(false);
  }

  function tiempo() {
    const m = motor();
    if (m === 'yt' && yt) return yt.tiempo();
    if (m === 'au' && au) return au.currentTime || 0;
    return 0;
  }

  function duracionTrack() {
    const m = motor();
    if (m === 'yt' && yt) return yt.duracion();
    if (m === 'au' && au) return au.duration || 30;
    const t = actual();
    return t && t.segundos ? t.segundos : 0;
  }

  function play() {
    const m = motor();
    if (m === 'yt') asegurarYT(true);
    else if (m === 'au') asegurarAudio(true);
    else avisarEstado(false);
  }

  function pause() {
    if (yt) yt.pause();
    if (au) au.pause();
    avisarEstado(false);
  }

  function ir(n: number, arrancar: boolean) {
    if (pistas.length < 2) { buscar(0); if (arrancar) play(); return; }
    i = ((n % pistas.length) + pistas.length) % pistas.length;
    const m = motor();
    if (m !== 'au' && au) { au.pause(); }
    if (m === 'yt') asegurarYT(arrancar);
    else if (m === 'au') { if (yt) yt.pause(); asegurarAudio(arrancar); }
    if (cb.alPista) cb.alPista(i, actual());
    if (cb.alAvanzar) cb.alAvanzar(0, duracionTrack());
  }

  function siguiente(arrancar: boolean = true) { ir(i + 1, arrancar !== false); }
  function anterior(arrancar: boolean = true) {
    if (tiempo() > 3) { buscar(0); return; }
    ir(i - 1, arrancar !== false);
  }

  function buscar(seg: number) {
    const m = motor();
    if (m === 'yt' && yt) yt.buscar(seg);
    else if (m === 'au' && au) au.currentTime = seg;
    if (cb.alAvanzar) cb.alAvanzar(seg, duracionTrack());
  }

  if (cb.alPista) cb.alPista(i, actual());

  return {
    play, pause,
    alternar: () => { if (sonando) pause(); else play(); },
    siguiente: () => { siguiente(sonando); },
    anterior: () => { anterior(sonando); },
    buscar,
    indice: () => i,
    pistas: () => pistas,
    duracion: duracionTrack,
    precalentar,
    destruir: () => {
      muerto = true;
      pararLatido();
      if (yt) yt.destroy();
      if (au) { au.pause(); au.src = ''; }
    },
    destroy: () => {
      muerto = true;
      pararLatido();
      if (yt) yt.destroy();
      if (au) { au.pause(); au.src = ''; }
    }
  };
}

/* ============================================================
   SPOTIFY  ·  autenticación PKCE
   ============================================================ */
function b64url(buf: ArrayBuffer) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function aleatorio(n: number) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.prototype.map.call(a, (x) => ('0' + (x % 36).toString(36)).slice(-1)).join('');
}

export const spotify = {
  clientId: () => localStorage.getItem(K_CID) || '',
  setClientId: (v: string) => localStorage.setItem(K_CID, String(v || '').trim()),
  sesion: () => sesionSpotify,

  conectado: () => {
    const s = spotify.sesion();
    return !!(s && s.access_token && s.expira > Date.now());
  },

  redirect: () => location.origin + location.pathname,

  desconectar: () => {
    sesionSpotify = null;
    try { localStorage.removeItem('identity.spotify.v1'); } catch { /* modo privado */ }
  },

  conectar: () => {
    const cid = spotify.clientId();
    if (!cid) return Promise.reject(new Error('Falta el Client ID de Spotify'));

    const verificador = aleatorio(64);
    guardarVerificador({ v: verificador, vuelta: location.hash });

    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))
      .then((hash) => {
        const params = new URLSearchParams({
          client_id: cid,
          response_type: 'code',
          redirect_uri: spotify.redirect(),
          code_challenge_method: 'S256',
          code_challenge: b64url(hash),
          scope: SCOPES
        });
        location.href = 'https://accounts.spotify.com/authorize?' + params;
      });
  },

  _api: null as Promise<any> | null,
  cargarApi: () => {
    if (spotify._api) return spotify._api;
    spotify._api = new Promise((ok, mal) => {
      if ((window as any).SpotifyIframeApi) return ok((window as any).SpotifyIframeApi);
      const t = setTimeout(() => mal(new Error('El reproductor de Spotify no cargo')), 8000);
      (window as any).onSpotifyIframeApiReady = (API: any) => {
        clearTimeout(t);
        (window as any).SpotifyIframeApi = API;
        ok(API);
      };
      const e = document.createElement('script');
      e.src = 'https://open.spotify.com/embed/iframe-api/v1';
      e.async = true;
      e.onerror = () => { clearTimeout(t); mal(new Error('No se pudo cargar el reproductor')); };
      document.head.appendChild(e);
    });
    spotify._api.catch(() => { spotify._api = null; });
    return spotify._api;
  },

  uriDeEmbed: (url: string) => {
    const m = String(url || '').match(/\/embed\/(\w+)\/([A-Za-z0-9]+)/);
    return m ? 'spotify:' + m[1] + ':' + m[2] : null;
  },

  deEnlace: (texto: string) => {
    const t = String(texto || '').trim();
    if (!t) return null;
    const TIPOS = 'track|album|playlist|artist|episode|show';

    let m = t.match(new RegExp('^spotify:(' + TIPOS + '):([A-Za-z0-9]{16,32})$'));
    if (!m) {
      m = t.match(new RegExp('^https?://open\\.spotify\\.com/(?:intl-[a-z]{2}/)?(' + TIPOS + ')/([A-Za-z0-9]{16,32})'));
    }
    if (!m) return null;
    return {
      tipo: m[1],
      id: m[2],
      embed: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2],
      publico: 'https://open.spotify.com/' + m[1] + '/' + m[2]
    };
  },

  datosDeEnlace: (info: any) => {
    if (!info) return Promise.resolve(null);
    return fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(info.publico))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return null;
        return { title: d.title || '', cover: d.thumbnail_url || '' };
      })
      .catch(() => null);
  },

  explicar: (codigo: number) => {
    if (codigo === 403) {
      return 'Spotify no autoriza a esta cuenta. Suele ser porque la aplicacion esta en modo desarrollo y solo funciona con las cuentas añadidas a mano en el panel de Spotify.';
    }
    if (codigo === 429) return 'Spotify esta limitando las peticiones. Espera un poco.';
    if (codigo === 404) return 'Spotify no encontro eso.';
    if (codigo >= 500) return 'Spotify esta fallando ahora mismo. No es cosa tuya.';
    return 'Spotify respondio ' + codigo + '.';
  },

  volver: () => {
    const q = new URLSearchParams(location.search);
    const code = q.get('code');
    const err = q.get('error');
    const guard = leerVerificador();
    if ((!code && !err) || !guard) return Promise.resolve(null);

    const limpio = location.origin + location.pathname + (guard.vuelta || '');
    history.replaceState(null, '', limpio);
    borrarVerificador();

    if (err) return Promise.reject(new Error('Spotify: ' + err));

    const body = new URLSearchParams({
      client_id: spotify.clientId(),
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: spotify.redirect(),
      code_verifier: guard.v
    });

    return fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then((r) => r.json()).then((t) => {
      if (!t.access_token) throw new Error(t.error_description || 'No se pudo conectar');
      t.expira = Date.now() + (t.expires_in || 3600) * 1000;
      sesionSpotify = t;
      return t;
    });
  },

  refrescar: () => {
    const s = spotify.sesion();
    if (!s || !s.refresh_token) return Promise.reject(new Error('Sesión caducada'));
    const body = new URLSearchParams({
      client_id: spotify.clientId(),
      grant_type: 'refresh_token',
      refresh_token: s.refresh_token
    });
    return fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then((r) => r.json()).then((t) => {
      if (!t.access_token) throw new Error('Sesión caducada');
      t.refresh_token = t.refresh_token || s.refresh_token;
      t.expira = Date.now() + (t.expires_in || 3600) * 1000;
      sesionSpotify = t;
      return t;
    });
  },

  pedir: (ruta: string) => {
    const s = spotify.sesion();
    if (!s) return Promise.reject(new Error('Sin conectar'));
    const hacer = (tok: string) => {
      return fetch(API + ruta, { headers: { Authorization: 'Bearer ' + tok } })
        .then((r) => {
          if (r.status === 401) throw new Error('401');
          if (!r.ok) throw new Error(spotify.explicar(r.status));
          return r.json();
        });
    };
    if (s.expira <= Date.now()) {
      return spotify.refrescar().then((t) => hacer(t.access_token));
    }
    return hacer(s.access_token).catch((e) => {
      if (e.message !== '401') throw e;
      return spotify.refrescar().then((t) => hacer(t.access_token));
    });
  },

  playlists: () => {
    return spotify.pedir('/me/playlists?limit=50').then((d) => {
      return (d.items || []).map((p: any) => ({
        id: p.id,
        nombre: p.name,
        total: p.tracks ? p.tracks.total : 0,
        cover: (p.images && p.images[0]) ? p.images[0].url : ''
      }));
    });
  },

  canciones: (playlistId: string) => {
    return spotify.pedir('/playlists/' + playlistId + '/tracks?limit=100').then((d) => {
      return (d.items || []).map((it: any) => {
        const t = it.track;
        if (!t || t.is_local) return null;
        return {
          id: t.id,
          nombre: t.name,
          artista: (t.artists || []).map((a: any) => a.name).join(', '),
          cover: (t.album && t.album.images && t.album.images[t.album.images.length - 1])
            ? t.album.images[t.album.images.length - 1].url : '',
          preview: t.preview_url || '',
          url: (t.external_urls && t.external_urls.spotify) || '',
          duracion: t.duration_ms || 0
        };
      }).filter(Boolean);
    });
  }
};
