/* ============================================================
   IDENTITY — validación de perfiles

   Un perfil puede llegar de tres sitios, y NINGUNO es de fiar:

     · localStorage — lo edita cualquiera con la consola abierta;
     · Supabase     — la fila la escribió otra persona, y la base
                      solo comprueba el tamaño, no la forma;
     · una URL      — el parámetro `?d=` traía un perfil entero en
                      base64, elegido por quien mandaba el enlace.

   Antes `normalizar()` hacía `Object.assign({}, DEFAULTS, p)`: se
   quedaba con TODO lo que trajera el objeto, con el tipo que
   trajera. Un número podía ser un objeto, una cadena podía medir
   diez megas, y una clave inventada entraba sin más.

   Aquí hay una LISTA BLANCA. Lo que no está en el esquema no
   sobrevive; lo que está, se fuerza a su tipo y se recorta a su
   rango. No es sanear: es rechazar lo que no encaja.

   Sanear y validar no son lo mismo, y aquí hacen falta los dos:
   esto valida la FORMA; `util.esc` y `util.safeUrl` sanean el
   CONTENIDO al pintarlo.
   ============================================================ */
(function () {
  'use strict';
  var ID = (window.ID = window.ID || {});

  /* ---- topes ---------------------------------------------------
     Generosos para el uso legítimo y estrechos para el abuso. Una
     bio de 600 caracteres es larguísima; una de 2 MB solo sirve
     para reventar la página de quien la mire. */
  var TOPE = {
    corto: 80,        /* nombre, oficio, ubicación */
    medio: 300,       /* etiquetas, textos de campo */
    largo: 1200,      /* bio, sobre mí */
    url: 2048,
    uri: 8 * 1024 * 1024,   /* data: e imágenes en línea */
    lista: 60,        /* elementos por colección */
    claves: 200       /* claves en pos/bstyle/bcontent */
  };

  function txt(v, max) {
    if (v == null) return '';
    if (typeof v === 'object') return '';      /* nada de objetos donde va texto */
    return String(v).slice(0, max || TOPE.corto);
  }

  function num(v, min, max, porDefecto) {
    var n = Number(v);
    if (!isFinite(n)) return porDefecto;
    return Math.min(max, Math.max(min, n));
  }

  /* null significa "lo que diga el tema": hay que poder distinguirlo
     de cero, que es un valor elegido. */
  function numOnulo(v, min, max) {
    if (v == null || v === '') return null;
    var n = Number(v);
    if (!isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
  }

  /* Una sola definicion de "verdadero" en todo el proyecto.
     Acepta lo que puede venir de un JSON antiguo (1, '1', 'true')
     y NADA mas: cualquier otra cosa vale false. Un interruptor con
     un valor raro se apaga, no se enciende — falla hacia cerrado. */
  function bool(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function deLista(v, lista, porDefecto) {
    var s = String(v == null ? '' : v);
    return lista.indexOf(s) !== -1 ? s : porDefecto;
  }

  function ids(catalogo) {
    return (catalogo || []).map(function (x) {
      return typeof x === 'string' ? x : x.id;
    });
  }

  /* Color: solo lo que un navegador entiende como color y no puede
     llevar nada dentro. Nada de url(), var() ni expresiones. */
  function color(v, porDefecto) {
    var s = String(v == null ? '' : v).trim().slice(0, 32);
    if (!s) return porDefecto === undefined ? '' : porDefecto;
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
    if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(s)) return s;
    if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(s)) return s;
    if (/^[a-z]{3,20}$/i.test(s)) return s;          /* red, tomato... */
    return porDefecto === undefined ? '' : porDefecto;
  }

  /* Referencias a medios: http(s), data: de imagen o vídeo, blob:,
     o la referencia interna media:xxx. Cualquier otra cosa fuera —
     ahí es donde entrarían javascript: y data:text/html. */
  function medio(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    if (s.length > TOPE.uri) return '';
    if (/^https?:\/\//i.test(s)) return s.slice(0, TOPE.url);
    if (/^media:[\w-]{1,64}$/.test(s)) return s;
    if (/^blob:/i.test(s)) return s.slice(0, TOPE.url);
    if (/^data:(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm));base64,[A-Za-z0-9+/=]+$/i.test(s)) return s;
    return '';
  }

  /* Direccion de un reproductor incrustado.
     NO vale `medio()` aqui: eso admite cualquier https, y esto
     acaba dentro de un <iframe>. Un iframe ajeno puede intentar
     navegar la pagina de arriba, abrir dialogos o hacerse pasar por
     la interfaz. Lista blanca estricta: solo los reproductores que
     la CSP ya permite, y solo con la forma exacta que tienen.

     Lo que no encaje devuelve cadena vacia y no llega a guardarse. */
  var INCRUSTABLES = [
    /^https:\/\/open\.spotify\.com\/embed\/(track|album|playlist|artist|episode|show)\/[A-Za-z0-9]{16,32}(\?[\w=&%-]{0,80})?$/,
    /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}(\?[\w=&%-]{0,80})?$/
  ];
  function incrustable(v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return '';
    for (var i = 0; i < INCRUSTABLES.length; i++) {
      if (INCRUSTABLES[i].test(t)) return t;
    }
    return '';
  }

  /* ---- el esquema ---------------------------------------------
     Lo que no aparece aquí NO sobrevive. Añadir un campo al perfil
     obliga a añadirlo aquí, y eso es exactamente lo que se busca:
     que nada entre por olvido.
     ------------------------------------------------------------- */
  function esquema() {
    var C = ID;   /* los catálogos ya cargados */
    return {
      /* identidad */
      username:  function (v) { return txt(v, 20).toLowerCase().replace(/[^a-z0-9_]/g, ''); },
      name:      function (v) { return txt(v, TOPE.corto); },
      title:     function (v) { return txt(v, TOPE.corto); },
      location:  function (v) { return txt(v, TOPE.corto); },
      pronouns:  function (v) { return txt(v, 24); },
      emoji:     function (v) { return txt(v, 8); },
      age:       function (v) { return numOnulo(v, 0, 120); },
      avatarUrl: medio,
      bio:       function (v) { return txt(v, TOPE.largo); },
      about:     function (v) { return txt(v, TOPE.largo); },
      joined:    function (v) { return txt(v, 40); },

      /* apariencia */
      theme:     function (v) { return deLista(v, ids(C.THEMES), 'dark'); },
      accent:    function (v) { return color(v, ''); },
      colText:   function (v) { return color(v, ''); },
      colBg:     function (v) { return color(v, ''); },
      colIcon:   function (v) { return color(v, ''); },
      align:     function (v) { return deLista(v, ids(C.ALIGNS), 'center'); },
      surface:   function (v) { return deLista(v, ids(C.SURFACES), 'none'); },
      avShape:   function (v) { return deLista(v, ids(C.AV_SHAPES), 'circle'); },
      avatarFx:  function (v) { return deLista(v, ids(C.AVATAR_FX), 'none'); },
      socialStyle: function (v) { return deLista(v, ids(C.SOCIAL_STYLES), 'icons'); },
      musicStyle:  function (v) { return deLista(v, ids(C.MUSIC_STYLES), 'compact'); },
      badgeStyle:  function (v) { return txt(v, 24); },
      blockStyle:  function (v) { return deLista(v, ids(C.BLOCK_STYLES), 'inherit'); },
      layoutMode:  function (v) { return deLista(v, ids(C.LAYOUT_MODES), 'stack'); },
      stackPos:    function (v) { return deLista(v, ids(C.STACK_POS), 'center'); },
      widthMode:   function (v) { return deLista(v, ids(C.WIDTH_MODES), 'fixed'); },
      hoverFx:     function (v) { return deLista(v, ids(C.HOVER_FX), 'lift'); },
      enterFx:     function (v) { return deLista(v, ids(C.ENTER_FX), 'rise'); },
      nameWeight:  function (v) { return deLista(v, ids(C.NAME_WEIGHTS), ''); },
      nameCase:    function (v) { return deLista(v, ids(C.NAME_CASES), ''); },
      cursor:      function (v) { return deLista(v, ids(C.CURSORS), 'none'); },
      particles:   function (v) { return deLista(v, ids(C.PARTICLES), 'none'); },
      font:        function (v) { return txt(v, 40); },
      fontDisplay: function (v) { return txt(v, 40); },

      /* números, todos acotados */
      avSize:      function (v) { return num(v, 40, 240, 112); },
      stackWidth:  function (v) { return num(v, 260, 1200, 460); },
      gap:         function (v) { return num(v, 0, 80, 16); },
      radius:      function (v) { return num(v, 0, 60, 18); },
      iconSize:    function (v) { return num(v, 12, 64, 20); },
      nameSize:    function (v) { return num(v, 0, 120, 0); },
      bioSize:     function (v) { return num(v, 0, 40, 0); },
      sBlur:       function (v) { return num(v, 0, 60, 22); },
      sGlow:       function (v) { return num(v, 0, 100, 40); },
      bgOpacity:   function (v) { return num(v, 0, 100, 100); },
      bgBlur:      function (v) { return num(v, 0, 40, 0); },
      bgDim:       function (v) { return num(v, 0, 100, 0); },
      vignette:    function (v) { return num(v, 0, 100, 0); },
      nameSpacing: function (v) { return num(v, -20, 60, 0); },
      lineHeight:  function (v) { return num(v, 0, 250, 0); },
      pad:         function (v) { return numOnulo(v, 0, 120); },
      sOpacity:    function (v) { return numOnulo(v, 0, 100); },
      sBorder:     function (v) { return numOnulo(v, 0, 100); },
      blockRadius: function (v) { return numOnulo(v, 0, 60); },
      level:       function (v) { return num(v, 0, 999, 1); },
      xp:          function (v) { return num(v, 0, 1e9, 0); },
      xpMax:       function (v) { return num(v, 1, 1e9, 100); },
      views:       function (v) { return num(v, 0, 1e9, 0); },
      likes:       function (v) { return num(v, 0, 1e9, 0); },

      /* interruptores */
      avBorder: bool, avGlow: bool, monoIcons: bool, bgFixed: bool,
      fxMagnet: bool, fxGlow: bool, fxParallax: bool,
      gradient: bool, animatedName: bool, glowName: bool,
      glowSocials: bool, glowBadges: bool, noise: bool, tilt: bool,
      gate: bool, verified: bool, premium: bool, discoverable: bool,
      showStats: bool, showRate: bool, discordWidget: bool, trackClick: bool,

      /* fondo */
      bgType:  function (v) { return deLista(v, ['none', 'color', 'gradient', 'image', 'video'], 'none'); },
      bgValue: medio
    };
  }

  var ESQUEMA = null;

  /* ---- colecciones --------------------------------------------
     Cada elemento se reconstruye campo a campo. Si llega un objeto
     con cincuenta claves extra, salen cuatro. */
  var FORMAS = {
    socials:  { net: 24, url: TOPE.url, label: TOPE.corto },
    links:    { title: TOPE.corto, url: TOPE.url, desc: TOPE.medio, icon: 24 },
    projects: { title: TOPE.corto, desc: TOPE.medio, url: TOPE.url, tag: 24, img: 'medio' },
    gallery:  { url: 'medio', alt: TOPE.corto, caption: TOPE.medio },
    live:     { title: TOPE.corto, url: TOPE.url, kind: 24 },
    fields:   { label: TOPE.corto, value: TOPE.medio, icon: 24 },
    tags:     null,     /* lista de cadenas sueltas */
    badges:   null
  };

  function limpiarColeccion(clave, lista) {
    if (!Array.isArray(lista)) return [];
    var forma = FORMAS[clave];
    return lista.slice(0, TOPE.lista).map(function (it) {
      if (!forma) return txt(it, TOPE.corto);
      if (!it || typeof it !== 'object') return null;
      var salida = {};
      Object.keys(forma).forEach(function (k) {
        salida[k] = forma[k] === 'medio' ? medio(it[k]) : txt(it[k], forma[k]);
      });
      return salida;
    }).filter(function (x) {
      return x !== null && (typeof x !== 'string' || x.length > 0);
    });
  }

  /* ---- mapas indexados por bloque ------------------------------
     pos, bstyle y bcontent van indexados por id de bloque. La clave
     tiene que parecer un id de bloque; si no, fuera. Sin esto se
     puede meter cualquier cosa en el objeto del perfil y hacerlo
     crecer sin medida. */
  function claveDeBloque(k) {
    return /^[a-z]{2,20}(#\d{1,3})?$/.test(String(k));
  }

  function limpiarMapa(m, limpiaValor) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    var salida = {}, n = 0;
    Object.keys(m).forEach(function (k) {
      if (n >= TOPE.claves) return;
      if (!claveDeBloque(k)) return;
      var v = limpiaValor(m[k]);
      if (v !== null) { salida[k] = v; n++; }
    });
    return salida;
  }

  function limpiarPos(v) {
    if (!v || typeof v !== 'object') return null;
    return {
      col: num(v.col, 1, 12, 1),
      span: num(v.span, 1, 12, 12),
      align: deLista(v.align, ['stretch', 'start', 'center', 'end'], 'stretch')
    };
  }

  function limpiarBstyle(v) {
    if (!v || typeof v !== 'object') return null;
    var o = {};
    if (v.s != null)     o.s = deLista(v.s, ids(ID.BLOCK_SURFACES), 'inherit');
    if (v.anim != null)  o.anim = deLista(v.anim, ids(ID.BLOCK_ANIMS), '');
    if (v.font != null)  o.font = txt(v.font, 40);
    if (v.color != null) o.color = color(v.color, '');
    if (v.halo != null)  o.halo = color(v.halo, '');
    if (v.w != null)     o.w = numOnulo(v.w, 5, 100);
    if (v.pad != null)   o.pad = numOnulo(v.pad, 0, 80);
    if (v.rad != null)   o.rad = numOnulo(v.rad, 0, 60);
    if (v.op != null)    o.op = numOnulo(v.op, 0, 100);
    if (v.bd != null)    o.bd = numOnulo(v.bd, 0, 100);
    if (v.blur != null)  o.blur = numOnulo(v.blur, 0, 60);
    if (v.glow != null)  o.glow = numOnulo(v.glow, 0, 100);
    return o;
  }

  function limpiarBcontent(v) {
    if (!v || typeof v !== 'object') return null;
    var o = {};
    if (v.text != null) o.text = txt(v.text, TOPE.largo);
    if (Array.isArray(v.nets)) {
      o.nets = v.nets.slice(0, TOPE.lista).map(function (n) { return txt(n, 24); });
    }
    return o;
  }

  /* ---- la puerta ---------------------------------------------- */
  ID.validar = {
    TOPE: TOPE,
    bool: bool,
    texto: txt,
    numero: num,
    color: color,
    medio: medio,
    incrustable: incrustable,
    deLista: deLista,

    /* Devuelve un objeto NUEVO con solo lo permitido. Nunca falla:
       lo que no encaja se sustituye por su valor por defecto. Un
       perfil roto tiene que poder pintarse igual, no tumbar la
       página de quien lo visita. */
    perfil: function (p, defectos) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
      if (!ESQUEMA) ESQUEMA = esquema();
      var out = Object.assign({}, defectos || {});

      Object.keys(ESQUEMA).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(p, k)) {
          out[k] = ESQUEMA[k](p[k]);
        }
      });

      Object.keys(FORMAS).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(p, k)) {
          out[k] = limpiarColeccion(k, p[k]);
        }
      });

      out.pos      = limpiarMapa(p.pos, limpiarPos);
      out.bstyle   = limpiarMapa(p.bstyle, limpiarBstyle);
      out.bcontent = limpiarMapa(p.bcontent, limpiarBcontent);

      if (p.status && typeof p.status === 'object') {
        out.status = {
          state: deLista(p.status.state, ids(ID.STATUS_STATES), 'online'),
          activity: txt(p.status.activity, TOPE.corto),
          detail: txt(p.status.detail, TOPE.medio)
        };
      }

      if (p.audio && typeof p.audio === 'object') {
        out.audio = {
          provider: txt(p.audio.provider, 24),

          /* Estos seis se perdian al guardar, y con ellos la fuente
             elegida en el editor: volvia a "Manual" en cada recarga.
             Las canciones si sobrevivian -viven en `tracks`- asi que
             el fallo se notaba solo al reabrir el editor, que es
             donde menos se mira.

             Es la regla de este archivo mordiendo un caso que se me
             paso: lo que no aparece aqui NO sobrevive, y eso vale
             tambien para lo que uno olvida poner. */
          src: deLista(p.audio.src, ['manual', 'youtube', 'spotify'], 'manual'),
          title: txt(p.audio.title, TOPE.corto),
          artist: txt(p.audio.artist, TOPE.corto),
          /* La portada admite un emoji o una direccion: se prueba
             como medio y, si no lo es, se guarda como texto corto. */
          cover: medio(p.audio.cover) || txt(p.audio.cover, 8),
          /* Un identificador de YouTube, no una direccion: es lo que
             se mete luego en la URL del reproductor. */
          yt: String(p.audio.yt || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20),
          ytUrl: medio(p.audio.ytUrl),
          tracks: Array.isArray(p.audio.tracks)
            ? p.audio.tracks.slice(0, 30).map(function (t) {
                if (!t || typeof t !== 'object') return null;
                return {
                  title: txt(t.title, TOPE.corto),
                  artist: txt(t.artist, TOPE.corto),
                  length: txt(t.length, 12),
                  cover: medio(t.cover),
                  /* `src` aqui NO es una direccion: es de donde sale
                     la pista (manual | youtube | spotify). Pasaba por
                     medio(), que solo deja pasar cosas con esquema, asi
                     que 'youtube' se convertia en cadena vacia y la
                     pista perdia su origen. */
                  src: deLista(t.src, ['manual', 'youtube', 'spotify'], 'manual'),
                  /* El identificador del video. Sin el, tipoDe() no
                     reconoce la pista como de YouTube y no se carga
                     nunca su reproductor: la cancion no sonaba y no
                     habia ningun error que lo dijera. */
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
          design: num(p.ratings.design, 0, 5, 0),
          originality: num(p.ratings.originality, 0, 5, 0),
          aesthetic: num(p.ratings.aesthetic, 0, 5, 0),
          votes: num(p.ratings.votes, 0, 1e9, 0)
        };
      }

      /* Las marcas internas (_id, _actualizado) las pone el
         backend, no el perfil: se conservan aparte y nunca se
         validan como contenido. */
      ['_id', '_actualizado', '_parcial', '_sucio'].forEach(function (k) {
        if (p[k] != null) out[k] = p[k];
      });

      return out;
    }
  };
})();
