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

/**
 * La imagen del bloque de música: la que hayas subido, y si no, la del vídeo.
 *
 * La regla vive AQUÍ y no en cada sitio que pinta una portada, que eran dos y
 * la tenían escrita a mano cada uno. Dos copias de la misma regla divergen
 * siempre, y cuando eso pasa una de las dos empieza a enseñar el `♪` de
 * reserva sin que nadie sepa por qué.
 *
 * `mqdefault` y no `hqdefault`: la segunda viene en 4:3 con franjas negras
 * pegadas arriba y abajo, y la caja de la portada es CUADRADA y recorta por
 * el centro — o sea que de un vídeo apaisado se quedaría con una franja
 * negra. `mqdefault` es 16:9 de verdad, sin franjas, y a 320 px sobra para
 * una caja de 42.
 */
export function portadaPista(t: { cover?: string; yt?: string } | null | undefined): string {
  const propia = String(t?.cover || '').trim();
  if (propia) return propia;
  return miniaturaYouTube(String(t?.yt || '').trim());
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
  /* El saludo a los servidores de YouTube, antes de pedirles nada. Cargar
     la API son dos servidores distintos (el de la pagina y el de las
     miniaturas) y cada uno cuesta su DNS y su TLS. Aqui se solapan con lo
     que quede de la carga del perfil en vez de ir en fila detras. */
  for (const donde of ['https://www.youtube.com', 'https://i.ytimg.com']) {
    if (document.querySelector(`link[data-yt-pre="${donde}"]`)) continue;
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = donde;
    l.crossOrigin = '';
    l.setAttribute('data-yt-pre', donde);
    document.head.appendChild(l);
  }

  const s = document.createElement('script');
  s.id = 'yt-api';
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function () { colaAPI.splice(0); };
  document.head.appendChild(s);
}

/**
 * El reproductor de YouTube, con la pista ya MASTICADA antes del clic.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LO QUE TARDABA, MEDIDO EN PRODUCCION
 * ────────────────────────────────────────────────────────────────────────
 *
 * Desde que alguien pulsa la puerta hasta que se oye algo: 2.400 ms. Y el
 * hilo principal no estaba bloqueado —cero tareas largas, un setTimeout(0)
 * respondia en 0 ms—, asi que la espera entera era de YouTube.
 *
 * Aislado en la misma pagina, con el mismo video:
 *
 *   A · playVideo() sobre un reproductor recien creado ........  861 ms
 *   B · loadVideoById() con el MISMO id, ya con buffer ........  351 ms
 *   C · playVideo() con el buffer ya lleno ....................   81 ms
 *   D · lo que hacia la web: loadVideoById() sin buffer .......  571 ms
 *   E · precalentado en silencio y luego playVideo() ..........   80 ms
 *
 * Lo que manda no es que metodo se llame: es si el MEDIO ya esta bajado.
 * `autoplay: 0` crea el reproductor pero no baja ni un byte de audio, asi
 * que el primer play siempre pagaba la descarga entera.
 *
 * Dos cosas, entonces:
 *
 *   1 · se arranca mudo en cuanto el reproductor esta listo, y en cuanto
 *       suena —callado— se para y se rebobina. Nadie oye nada; lo que
 *       queda es el buffer lleno. Al clic solo le queda quitar el mudo.
 *
 *   2 · `cargar` deja de recargar la pista que YA esta puesta.
 *       `precalentar` creaba el reproductor con su `videoId`, y el clic
 *       llamaba a `loadVideoById` con ESE MISMO id: tirar a la basura lo
 *       que se acababa de preparar para volver a empezar.
 *
 * Lo que cuesta: unos segundos de audio bajados para alguien que quiza no
 * pulse nunca. Se paga una vez, solo en perfiles que tienen musica.
 */
export function reproductorYouTube(contenedor: HTMLElement, videoId: string, cb: any = {}) {
  let yt: any = null, listo = false, pendiente: string | null = null, muerto = false;
  /** El id que el reproductor tiene puesto ahora mismo. */
  let cargado = videoId;
  /** Arrancando en silencio para llenar el buffer. */
  let calentando = false;
  /** Ya tiene bocado: el siguiente play es inmediato. */
  let calentado = false;
  /** El segundo por el que arranca esta pista. Lo pone quien la elige. */
  let inicio = 0;

  /* Se arranca mudo, que es lo que el navegador deja hacer sin que nadie
     haya tocado nada. Si lo niega igualmente —modo ahorro de bateria en el
     movil— no pasa nada: `calentando` se queda puesto, nunca llega el
     estado 1, y el clic de verdad sigue el camino de siempre. */
  function calentar() {
    if (calentado || calentando || !listo || !yt || muerto) return;
    try {
      yt.mute();
      yt.playVideo();
      calentando = true;
    } catch { /* reproductor que no esta para nadie */ }
  }

  function arrancar() {
    if (!listo || !yt) { pendiente = 'play'; return; }
    /* Al segundo que pidio su dueño, si lo pidio. El calentamiento deja el
       video rebobinado a cero, asi que sin esto el recorte se ignoraba
       justo en el arranque, que es la unica vez que casi todo el mundo lo
       oye. La tolerancia de un segundo evita rebobinar cuando ya esta
       donde toca: un `seekTo` de mas vacia el buffer. */
    if (inicio > 0) {
      try {
        if (Math.abs((yt.getCurrentTime() || 0) - inicio) > 1) yt.seekTo(inicio, true);
      } catch { /* aun no esta */ }
    }
    /* Si se pulsa MIENTRAS calienta, deja de ser un calentamiento y pasa a
       ser lo que la persona ha pedido: se quita el mudo y el estado vuelve
       a contarse. */
    calentando = false;
    try { yt.unMute(); } catch { /* da igual: sonara al volumen que tenga */ }
    yt.playVideo();
    /**
     * Y SE COMPRUEBA QUE EL MUDO SE HAYA QUITADO DE VERDAD.
     *
     * En el movil esta es la pieza fragil. `playVideo()` dentro de un gesto
     * se concede siempre; `unMute()` se acepta sin rechistar y a veces no
     * hace nada, asi que el video corre, el estado dice «sonando» y no se
     * oye nada. Es la peor forma de fallar, porque desde fuera la pagina
     * parece que va bien y lo unico que se nota es que no hay musica.
     *
     * No se puede adelantar fuera del gesto, y esto se probo: quitar el
     * mudo con el reproductor en pausa RELANZA el video —medido, estados 3
     * y 1 detras del 2— o sea sonido antes de que nadie toque la puerta,
     * que es justo lo que la puerta existe para impedir.
     *
     * Asi que se insiste un momento despues, ya con el video en marcha.
     * Aqui no hay riesgo de sonar sin permiso: suena porque lo han pedido.
     */
    setTimeout(() => {
      if (muerto || !yt) return;
      try { if (yt.isMuted && yt.isMuted()) yt.unMute(); } catch { /* ya no esta */ }
    }, 250);
  }

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
          if (pendiente === 'play') arrancar();
          else calentar();
          pendiente = null;
        },
        onStateChange: (e: any) => {
          /* El unico estado que se esconde. Sonando y mudo no es «sonando»:
             avisar aqui pondria el boton en pausa y arrancaria el contador
             de tiempo por una pista que nadie ha pedido. */
          if (calentando && e.data === 1) {
            calentando = false;
            calentado = true;
            try { yt.pauseVideo(); yt.seekTo(0, true); } catch { /* ya no esta */ }
            return;
          }
          if (e.data === 0 && cb.alTerminar) cb.alTerminar();
          if (cb.alEstado) cb.alEstado(e.data === 1);
        }
      }
    });
  });

  return {
    fijarInicio: (n: number) => { inicio = Math.max(0, Number(n) || 0); },
    play: () => { if (listo && yt) arrancar(); else pendiente = 'play'; },
    pause: () => { if (listo && yt) yt.pauseVideo(); else pendiente = null; },
    cargar: (id: string, arrancarYa: boolean) => {
      if (!listo || !yt) { pendiente = arrancarYa ? 'play' : null; return; }
      /* La que ya esta puesta. Recargarla es tirar el buffer y volver a
         bajarlo: eran 571 ms en vez de 80. */
      if (id === cargado) { if (arrancarYa) arrancar(); return; }
      cargado = id;
      calentado = false;
      calentando = false;
      if (arrancarYa) {
        try { yt.unMute(); } catch { /* sonara al volumen que tenga */ }
        yt.loadVideoById(id);
      } else {
        yt.cueVideoById(id);
      }
    },
    buscar: (seg: number) => { if (listo && yt) yt.seekTo(seg, true); },
    /* YouTube SABE como se llama la cancion, y lo sabe desde que el
       reproductor esta listo. No hacia falta pedirselo a nadie: solo
       preguntarselo. Sin esto el bloque ponia «Pista de audio», que es lo
       mismo que pone cuando no hay nada. */
    datos: () => {
      if (!listo || !yt || !yt.getVideoData) return null;
      try {
        const d = yt.getVideoData();
        return { titulo: String(d?.title || ''), autor: String(d?.author || '') };
      } catch { return null; }
    },
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

  /**
   * Como se llama lo que suena.
   *
   * Se avisa al estar listo y al cambiar de pista, no en cada latido: el
   * titulo no cambia cuatro veces por segundo y repintar el bloque a ese
   * ritmo por un texto que es el mismo es trabajo tirado.
   *
   * Manda lo que hayas escrito tu. Solo si no has puesto nada se usa lo que
   * diga YouTube — quien se molesto en titular su pista no quiere que se la
   * renombre sola.
   */
  function avisarFicha() {
    if (!cb.alFicha) return;
    const t = actual();
    const d = yt && yt.datos ? yt.datos() : null;
    cb.alFicha({
      titulo: String(t?.title || '').trim() || (d?.titulo ?? ''),
      autor: String(t?.artist || '').trim() || (d?.autor ?? ''),
    });
  }

  /**
   * EL RECORTE: donde empieza y donde vuelve.
   *
   * Una cancion de fondo casi nunca quiere empezar por el principio. Lo que
   * la gente pone en un perfil es el estribillo, y sin esto habia que oir
   * la intro entera cada vez que alguien entraba.
   *
   * `duracion` en cero significa ENTERA, que es lo que tiene quien no toca
   * nada. Y el final se vigila desde el latido que ya existia —cuatro veces
   * por segundo— en vez de poner otro reloj: el error de recorte que se
   * puede colar son 250 ms al final de un trozo que dura segundos, y eso no
   * se oye. Un reloj mas fino costaria mas de lo que arregla.
   */
  function inicioDePista(): number {
    const t = actual();
    return Math.max(0, Number(t?.inicio) || 0);
  }
  function finDePista(): number {
    const t = actual();
    const d = Math.max(0, Number(t?.duracion) || 0);
    return d > 0 ? inicioDePista() + d : 0;
  }

  function arrancarLatido() {
    pararLatido();
    latido = setInterval(() => {
      if (muerto) return;
      const ahora = tiempo();
      const fin = finDePista();
      /* Se vuelve al principio del trozo en vez de parar: un fondo que se
         calla a los quince segundos parece roto, y el bucle es lo que hace
         que un recorte corto siga siendo musica de fondo. */
      if (fin > 0 && ahora >= fin) {
        buscar(inicioDePista());
        if (cb.alAvanzar) cb.alAvanzar(inicioDePista(), duracionTrack());
        return;
      }
      if (cb.alAvanzar) cb.alAvanzar(ahora, duracionTrack());
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
        alTerminar: () => { siguiente(true); },
        alListo: avisarFicha,
      });
      yt.fijarInicio(inicioDePista());
      if (arrancar) yt.play();
    } else {
      yt.fijarInicio(inicioDePista());
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
    /* La ficha, ANTES de que suene nada. Si esperara al `play`, el bloque
       pondria «Pista de audio» hasta que alguien le diera — y hasta ese
       momento no hay ningun motivo para darle. */
    avisarFicha();
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
    avisarFicha();
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
