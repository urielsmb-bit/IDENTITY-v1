/* ============================================================
   IDENTITY — música

   Tres fuentes:
     manual   — título y artista escritos a mano (sin sonido)
     youtube  — un enlace de YouTube; suena de verdad con el
                reproductor incrustado de YouTube
     spotify  — se conecta la cuenta y se elige una canción de tus
                playlists

   SOBRE SPOTIFY, sin adornos:
   - La conexión usa el flujo PKCE, que SÍ funciona desde un sitio
     estático: no hace falta secreto de servidor. Lo que sí hace
     falta es que registres una app en developer.spotify.com y
     pegues su Client ID en Ajustes.
   - Reproducir el catálogo completo exige Premium y el Web
     Playback SDK. Aquí usamos `preview_url`, el fragmento de 30s
     que Spotify expone. Cuando una pista no lo trae, se guarda la
     ficha y se enlaza a Spotify en vez de fingir que suena.
   ============================================================ */
(function () {
  'use strict';
  var ID = (window.ID = window.ID || {});

  var K_CID = 'identity.spotify.cid'; /* Client ID de la app: NO es secreto */
  var K_VER = 'identity.spotify.ver'; /* verificador PKCE en curso */

  /* ---- F1-01 · los tokens NO se guardan en el disco -------------
     Antes la respuesta entera de Spotify —access_token Y
     refresh_token— se escribia en localStorage. Un solo XSS en
     cualquier parte de la aplicacion se llevaba el refresh_token, y
     un refresh_token no caduca: da acceso permanente a la cuenta de
     Spotify de esa persona hasta que lo revoque a mano.

     El token solo hace falta MIENTRAS SE EDITA, para elegir listas
     y canciones. El perfil publico pinta `p.audio.tracks`, que ya
     esta guardado en el perfil (ver views/profile.js:81). O sea que
     no perder el token entre recargas no aporta nada al producto y
     si mucho al atacante.

     Ahora vive en una variable: muere al recargar, no queda rastro
     en disco, y no hay credencial de larga vida que robar. El
     precio es volver a conectar al empezar otra sesion de edicion.
     ---------------------------------------------------------------- */
  var sesionSpotify = null;

  /* ---- F1-02 · el verificador PKCE, en sessionStorage -----------
     Es el secreto de un solo uso que demuestra que quien canjea el
     codigo es quien inicio el flujo. En localStorage sobrevive al
     cierre del navegador y lo comparten TODAS las pestañas del
     dominio. En sessionStorage muere con la pestaña, que es
     exactamente lo que dura el flujo.
     Se sigue borrando en cuanto se usa; esto es la segunda capa.
     ---------------------------------------------------------------- */
  function guardarVerificador(v) {
    try { sessionStorage.setItem(K_VER, JSON.stringify(v)); } catch (e) { /* modo privado */ }
  }
  function leerVerificador() {
    try {
      var v = sessionStorage.getItem(K_VER);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function borrarVerificador() {
    try { sessionStorage.removeItem(K_VER); } catch (e) {}
    /* y el sitio donde lo dejaban las versiones anteriores */
    try { localStorage.removeItem(K_VER); } catch (e) {}
  }

  var API = 'https://api.spotify.com/v1';
  var SCOPES = 'playlist-read-private playlist-read-collaborative user-read-email';

  var music = ID.music = {};

  /* ============================================================
     YOUTUBE
     ============================================================ */

  /* Acepta las formas habituales: youtu.be, watch?v=, /embed/,
     /shorts/ y music.youtube.com */
  music.idYouTube = function (url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^[\w-]{11}$/.test(u)) return u;   /* ya es un id */
    var m =
      u.match(/youtu\.be\/([\w-]{11})/) ||
      u.match(/[?&]v=([\w-]{11})/) ||
      u.match(/\/embed\/([\w-]{11})/) ||
      u.match(/\/shorts\/([\w-]{11})/) ||
      u.match(/\/live\/([\w-]{11})/);
    return m ? m[1] : '';
  };

  music.miniaturaYouTube = function (id) {
    return id ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : '';
  };

  var apiLista = false, colaAPI = [];

  function cargarAPIYouTube(cb) {
    if (apiLista && window.YT && window.YT.Player) return cb();
    colaAPI.push(cb);
    if (document.getElementById('yt-api')) return;

    var anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof anterior === 'function') anterior();
      apiLista = true;
      colaAPI.splice(0).forEach(function (f) { f(); });
    };
    var s = document.createElement('script');
    s.id = 'yt-api';
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { colaAPI.splice(0); };  /* sin red, sin drama */
    document.head.appendChild(s);
  }

  /* Motor de YouTube. El contenedor puede estar oculto: solo
     queremos el audio, pero necesitamos el iframe para tenerlo. */
  music.reproductorYouTube = function (contenedor, videoId, cb) {
    cb = cb || {};
    var yt = null, listo = false, pendiente = null, muerto = false;

    cargarAPIYouTube(function () {
      if (muerto) return;
      var hueco = document.createElement('div');
      contenedor.appendChild(hueco);
      yt = new YT.Player(hueco, {
        videoId: videoId,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1,
                      modestbranding: 1, rel: 0 },
        events: {
          onReady: function () {
            listo = true;
            if (cb.alListo) cb.alListo();
            if (pendiente === 'play') yt.playVideo();
            pendiente = null;
          },
          onStateChange: function (e) {
            /* 1 sonando · 2 pausado · 0 terminado */
            if (e.data === 0 && cb.alTerminar) cb.alTerminar();
            if (cb.alEstado) cb.alEstado(e.data === 1);
          }
        }
      });
    });

    return {
      play:    function () { if (listo && yt) yt.playVideo(); else pendiente = 'play'; },
      pause:   function () { if (listo && yt) yt.pauseVideo(); else pendiente = null; },
      cargar:  function (id, arrancar) {
        if (!listo || !yt) { pendiente = arrancar ? 'play' : null; return; }
        if (arrancar) yt.loadVideoById(id); else yt.cueVideoById(id);
      },
      buscar:  function (seg) { if (listo && yt) yt.seekTo(seg, true); },
      tiempo:  function () { return (listo && yt && yt.getCurrentTime) ? yt.getCurrentTime() : 0; },
      duracion:function () { return (listo && yt && yt.getDuration) ? yt.getDuration() : 0; },
      volumen: function (v) { if (listo && yt) yt.setVolume(Math.round(v * 100)); },
      destroy: function () {
        muerto = true;
        try { if (yt && yt.destroy) yt.destroy(); } catch (e) { /* ya se fue */ }
      }
    };
  };

  /* ============================================================
     CONTROLADOR
     Una sola interfaz por encima de los dos motores. La vista del
     perfil no tiene que saber de donde sale el sonido.
     ============================================================ */
  music.mmss = function (seg) {
    seg = Math.max(0, Math.floor(Number(seg) || 0));
    return Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2);
  };

  music.crearReproductor = function (host, pistas, cb) {
    cb = cb || {};
    pistas = (pistas || []).filter(Boolean);
    if (!pistas.length) return null;

    var i = 0, yt = null, au = null, latido = 0, sonando = false, muerto = false;

    function actual() { return pistas[i] || pistas[0]; }

    function avisarEstado(s) {
      sonando = !!s;
      if (cb.alEstado) cb.alEstado(sonando);
      if (sonando) arrancarLatido(); else pararLatido();
    }

    function arrancarLatido() {
      pararLatido();
      latido = setInterval(function () {
        if (muerto) return;
        if (cb.alAvanzar) cb.alAvanzar(tiempo(), duracion());
      }, 250);
    }
    function pararLatido() { clearInterval(latido); latido = 0; }

    function motor() {
      var t = actual();
      return (t && t.src === 'youtube' && t.yt) ? 'yt' : (t && t.preview ? 'au' : null);
    }

    function asegurarYT(arrancar) {
      var t = actual();
      if (!yt) {
        yt = music.reproductorYouTube(host, t.yt, {
          alEstado: avisarEstado,
          alTerminar: function () { siguiente(true); }
        });
        if (arrancar) yt.play();
      } else {
        yt.cargar(t.yt, arrancar);
      }
    }

    function asegurarAudio(arrancar) {
      var t = actual();
      if (!au) {
        au = new Audio();
        au.addEventListener('play',  function () { avisarEstado(true); });
        au.addEventListener('pause', function () { avisarEstado(false); });
        au.addEventListener('ended', function () { siguiente(true); });
      }
      if (au.getAttribute('data-t') !== String(i)) {
        au.src = t.preview;
        au.setAttribute('data-t', String(i));
      }
      if (arrancar) au.play().catch(function () { avisarEstado(false); });
    }

    /* ============================================================
       PRECALENTAR
       ============================================================
       Medido en el sitio en vivo: el bloque de musica se pinta a los
       0 ms, pero el script de YouTube NO se pedia en nueve segundos.
       Toda la cadena -bajar el script, esperar la API, crear el
       reproductor, esperar su onReady- ocurria DESPUES del toque, y
       por eso la cancion tardaba en arrancar.

       Ahora se prepara mientras la persona mira la pantalla de
       entrada. No suena: `arrancar` va en false, y el reproductor de
       YouTube se crea con autoplay:0. Solo deja todo listo para que
       el toque sea inmediato.

       No se precalienta si no hay nada que precalentar: un perfil
       sin musica no descarga nada de YouTube.
       ============================================================ */
    function precalentar() {
      if (muerto) return;
      var m = motor();
      if (m === 'yt') asegurarYT(false);
      else if (m === 'au') asegurarAudio(false);
    }

    function tiempo() {
      var m = motor();
      if (m === 'yt' && yt) return yt.tiempo();
      if (m === 'au' && au) return au.currentTime || 0;
      return 0;
    }

    function duracion() {
      var m = motor();
      if (m === 'yt' && yt) return yt.duracion();
      if (m === 'au' && au) return au.duration || 30;
      var t = actual();
      return t && t.segundos ? t.segundos : 0;
    }

    function play() {
      var m = motor();
      if (m === 'yt') asegurarYT(true);
      else if (m === 'au') asegurarAudio(true);
      else avisarEstado(false);        /* pista sin audio: no fingimos */
    }

    function pause() {
      if (yt) yt.pause();
      if (au) au.pause();
      avisarEstado(false);
    }

    function ir(n, arrancar) {
      /* con una sola pista los botones reinician: un boton muerto
         confunde mas que uno que hace lo evidente */
      if (pistas.length < 2) { buscar(0); if (arrancar) play(); return; }
      i = ((n % pistas.length) + pistas.length) % pistas.length;
      var m = motor();
      /* al cambiar de motor callamos el otro */
      if (m !== 'au' && au) { au.pause(); }
      if (m === 'yt') asegurarYT(arrancar);
      else if (m === 'au') { if (yt) yt.pause(); asegurarAudio(arrancar); }
      if (cb.alPista) cb.alPista(i, actual());
      if (cb.alAvanzar) cb.alAvanzar(0, duracion());
    }

    function siguiente(arrancar) { ir(i + 1, arrancar !== false); }
    function anterior(arrancar) {
      /* como en cualquier reproductor: si ya sonó un poco, reinicia */
      if (tiempo() > 3) { buscar(0); return; }
      ir(i - 1, arrancar !== false);
    }

    function buscar(seg) {
      var m = motor();
      if (m === 'yt' && yt) yt.buscar(seg);
      else if (m === 'au' && au) au.currentTime = seg;
      if (cb.alAvanzar) cb.alAvanzar(seg, duracion());
    }

    if (cb.alPista) cb.alPista(i, actual());

    return {
      play: play, pause: pause,
      alternar: function () { if (sonando) pause(); else play(); },
      siguiente: function () { siguiente(sonando); },
      anterior: function () { anterior(sonando); },
      buscar: buscar,
      indice: function () { return i; },
      pistas: function () { return pistas; },
      duracion: duracion,
      precalentar: precalentar,
      destruir: function () {
        muerto = true;
        pararLatido();
        if (yt) yt.destroy();
        if (au) { au.pause(); au.src = ''; }
      }
    };
  };

  /* ============================================================
     SPOTIFY  ·  autenticación PKCE
     ============================================================ */

  function b64url(buf) {
    var bin = '';
    var bytes = new Uint8Array(buf);
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function aleatorio(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (x) {
      return ('0' + (x % 36).toString(36)).slice(-1);
    }).join('');
  }

  var sp = music.spotify = {

    clientId: function () { return ID.util.read(K_CID, ''); },
    setClientId: function (v) { ID.util.write(K_CID, String(v || '').trim()); },

    sesion: function () { return sesionSpotify; },

    conectado: function () {
      var s = sp.sesion();
      return !!(s && s.access_token && s.expira > Date.now());
    },

    /* la URI de retorno debe estar registrada TAL CUAL en la app
       de Spotify: mismo origen, misma ruta, sin hash */
    redirect: function () {
      return location.origin + location.pathname;
    },

    desconectar: function () {
      sesionSpotify = null;
      /* por si quedaba de una version anterior que si lo guardaba */
      try { localStorage.removeItem('identity.spotify.v1'); } catch (e) {}
    },

    conectar: function () {
      var cid = sp.clientId();
      if (!cid) return Promise.reject(new Error('Falta el Client ID de Spotify'));

      var verificador = aleatorio(64);
      guardarVerificador({ v: verificador, vuelta: location.hash });

      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))
        .then(function (hash) {
          var params = new URLSearchParams({
            client_id: cid,
            response_type: 'code',
            redirect_uri: sp.redirect(),
            code_challenge_method: 'S256',
            code_challenge: b64url(hash),
            scope: SCOPES
          });
          location.href = 'https://accounts.spotify.com/authorize?' + params;
        });
    },

    /* ============================================================
       DARLE A REPRODUCIR DESDE NUESTRO CODIGO
       ============================================================
       El reproductor incrustado ignora `autoplay=1`: Spotify lo
       decide asi y no hay parametro que lo cambie. Comprobado.

       Lo unico que si puede arrancarlo es su API de iframe, que
       expone un `play()`. A cambio hay que cargar un script suyo,
       o sea abrir `script-src` a open.spotify.com.

       Es un coste real y conviene verlo de frente: en la Fase 11
       se quito `cdn.jsdelivr.net` justamente para no dejar correr
       codigo de terceros. La diferencia es que aquel era un CDN de
       paquetes -cualquiera publica ahi- y este es el dominio de la
       propia aplicacion de Spotify. Para abusar de esto haria falta
       comprometer a Spotify.

       Se carga UNA vez y solo cuando alguien pide musica: un perfil
       sin canciones no descarga nada de esto.
       ============================================================ */
    _api: null,
    cargarApi: function () {
      if (sp._api) return sp._api;
      sp._api = new Promise(function (ok, mal) {
        if (window.SpotifyIframeApi) return ok(window.SpotifyIframeApi);
        var t = setTimeout(function () {
          mal(new Error('El reproductor de Spotify no cargo'));
        }, 8000);
        window.onSpotifyIframeApiReady = function (API) {
          clearTimeout(t);
          window.SpotifyIframeApi = API;
          ok(API);
        };
        var e = document.createElement('script');
        e.src = 'https://open.spotify.com/embed/iframe-api/v1';
        e.async = true;
        e.onerror = function () { clearTimeout(t); mal(new Error('No se pudo cargar el reproductor')); };
        document.head.appendChild(e);
      });
      /* si falla, que el proximo intento vuelva a probar */
      sp._api.catch(function () { sp._api = null; });
      return sp._api;
    },

    /* De la direccion incrustada al identificador que pide la API. */
    uriDeEmbed: function (url) {
      var m = String(url || '').match(/\/embed\/(\w+)\/([A-Za-z0-9]+)/);
      return m ? 'spotify:' + m[1] + ':' + m[2] : null;
    },

    /* ============================================================
       PEGAR UN ENLACE, SIN CONECTAR NADA
       ============================================================
       El API de Spotify no sirve para un producto abierto: en modo
       desarrollo admite CINCO cuentas, y salir de ahi exige empresa
       registrada y 250.000 usuarios activos al mes. Comprobado en
       su documentacion, no supuesto.

       El reproductor incrustado no pide nada de eso: ni token, ni
       cuota, ni aprobacion. Y a quien tenga Premium con la sesion
       abierta le suena la cancion ENTERA, no los 30 segundos de
       `preview_url` -que ademas Spotify ya marca como deprecado-.

       Esto NO sustituye a la conexion por API: se suma. Quien ya la
       tenga funcionando la conserva.
       ============================================================ */

    /* De cualquier forma de enlace de Spotify a su reproductor.
       Hay mas variantes de las que parece:
         open.spotify.com/track/ID
         open.spotify.com/track/ID?si=...        (enlace de compartir)
         open.spotify.com/intl-es/track/ID       (con idioma dentro)
         spotify:track:ID                        (URI de la app)
       Devuelve null si no reconoce nada. */
    deEnlace: function (texto) {
      var t = String(texto || '').trim();
      if (!t) return null;
      var TIPOS = 'track|album|playlist|artist|episode|show';

      /* la URI de la aplicacion */
      var m = t.match(new RegExp('^spotify:(' + TIPOS + '):([A-Za-z0-9]{16,32})$'));
      if (!m) {
        /* la direccion web, con o sin segmento de idioma */
        m = t.match(new RegExp(
          '^https?://open\.spotify\.com/(?:intl-[a-z]{2}/)?(' + TIPOS + ')/([A-Za-z0-9]{16,32})'
        ));
      }
      if (!m) return null;
      return {
        tipo: m[1],
        id: m[2],
        embed: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2],
        publico: 'https://open.spotify.com/' + m[1] + '/' + m[2]
      };
    },

    /* Titulo y caratula sin autenticacion: oEmbed es publico.
       Si falla no pasa nada -se guarda el enlace igual y el
       reproductor incrustado enseña el titulo por su cuenta-, asi
       que nunca rechaza. */
    datosDeEnlace: function (info) {
      if (!info) return Promise.resolve(null);
      return fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(info.publico))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d) return null;
          return { title: d.title || '', cover: d.thumbnail_url || '' };
        })
        .catch(function () { return null; });
    },

    /* ============================================================
       DECIR QUE PASA, NO EL NUMERO
       ============================================================
       "Spotify respondió 403" no le sirve a nadie: ni al que lo ve
       ni al que tiene que arreglarlo. Cada codigo tiene una causa
       distinta y casi siempre una accion concreta detras.

       El 403 es el interesante. Con los permisos correctos -y aqui
       lo estan: /me/playlists necesita playlist-read-private, que
       es justo lo que se pide- un 403 significa casi siempre que la
       aplicacion de Spotify sigue en MODO DESARROLLO. En ese modo
       Spotify solo la deja usar a las cuentas añadidas a mano en el
       panel, hasta 25. El login funciona, y todas las llamadas al
       API responden 403.

       Se distingue por eso: 401 es "tu sesion caduco" -y se
       reintenta sola-, 403 es "esta cuenta no esta autorizada".
       ============================================================ */
    explicar: function (codigo) {
      if (codigo === 403) {
        return 'Spotify no autoriza a esta cuenta. Suele ser porque la ' +
          'aplicacion esta en modo desarrollo y solo funciona con las cuentas ' +
          'añadidas a mano en el panel de Spotify.';
      }
      if (codigo === 429) return 'Spotify esta limitando las peticiones. Espera un poco.';
      if (codigo === 404) return 'Spotify no encontro eso.';
      if (codigo >= 500) return 'Spotify esta fallando ahora mismo. No es cosa tuya.';
      return 'Spotify respondio ' + codigo + '.';
    },

    /* se llama al cargar la página: si volvemos con ?code, canjea */
    volver: function () {
      var q = new URLSearchParams(location.search);
      var code = q.get('code');
      var err = q.get('error');
      var guard = leerVerificador();
      if ((!code && !err) || !guard) return Promise.resolve(null);

      /* limpiamos la URL pase lo que pase */
      var limpio = location.origin + location.pathname + (guard.vuelta || '');
      history.replaceState(null, '', limpio);
      borrarVerificador();

      if (err) return Promise.reject(new Error('Spotify: ' + err));

      var body = new URLSearchParams({
        client_id: sp.clientId(),
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: sp.redirect(),
        code_verifier: guard.v
      });

      return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }).then(function (r) { return r.json(); }).then(function (t) {
        if (!t.access_token) throw new Error(t.error_description || 'No se pudo conectar');
        t.expira = Date.now() + (t.expires_in || 3600) * 1000;
        sesionSpotify = t;
        return t;
      });
    },

    /* refresca el token si Spotify nos dio uno de refresco */
    refrescar: function () {
      var s = sp.sesion();
      if (!s || !s.refresh_token) return Promise.reject(new Error('Sesión caducada'));
      var body = new URLSearchParams({
        client_id: sp.clientId(),
        grant_type: 'refresh_token',
        refresh_token: s.refresh_token
      });
      return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }).then(function (r) { return r.json(); }).then(function (t) {
        if (!t.access_token) throw new Error('Sesión caducada');
        t.refresh_token = t.refresh_token || s.refresh_token;
        t.expira = Date.now() + (t.expires_in || 3600) * 1000;
        sesionSpotify = t;
        return t;
      });
    },

    pedir: function (ruta) {
      var s = sp.sesion();
      if (!s) return Promise.reject(new Error('Sin conectar'));
      var hacer = function (tok) {
        return fetch(API + ruta, { headers: { Authorization: 'Bearer ' + tok } })
          .then(function (r) {
            if (r.status === 401) throw new Error('401');
            if (!r.ok) throw new Error(sp.explicar(r.status));
            return r.json();
          });
      };
      if (s.expira <= Date.now()) {
        return sp.refrescar().then(function (t) { return hacer(t.access_token); });
      }
      return hacer(s.access_token).catch(function (e) {
        if (e.message !== '401') throw e;
        return sp.refrescar().then(function (t) { return hacer(t.access_token); });
      });
    },

    playlists: function () {
      return sp.pedir('/me/playlists?limit=50').then(function (d) {
        return (d.items || []).map(function (p) {
          return {
            id: p.id,
            nombre: p.name,
            total: p.tracks ? p.tracks.total : 0,
            cover: (p.images && p.images[0]) ? p.images[0].url : ''
          };
        });
      });
    },

    canciones: function (playlistId) {
      return sp.pedir('/playlists/' + playlistId + '/tracks?limit=100').then(function (d) {
        return (d.items || []).map(function (it) {
          var t = it.track;
          if (!t || t.is_local) return null;
          return {
            id: t.id,
            nombre: t.name,
            artista: (t.artists || []).map(function (a) { return a.name; }).join(', '),
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

  /* mm:ss a partir de milisegundos */
  music.duracion = function (ms) {
    var s = Math.round((Number(ms) || 0) / 1000);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  };
})();
