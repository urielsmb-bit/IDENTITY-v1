/* ============================================================
   IDENTITY — generador de perfiles
   Motor de reglas local: interpreta el texto y arma un perfil
   completo. No llama a ningún modelo — el README explica dónde
   se enchufaría uno de verdad. Prefiero que funcione sin red y
   sin clave a que sea una demo que no se puede probar.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc;

  /* cada regla aporta señales; gana la que más peso acumula */
  var RULES = [
    { k: ['cyberpunk', 'neon', 'futurista', 'futuro', 'tech', 'hacker', 'matrix', 'cyber'],
      theme: 'cyberpunk', particles: 'matrix', cursor: 'dot', layout: 'card3d', fx: 'glitch' },
    { k: ['gaming', 'gamer', 'juego', 'juegos', 'fivem', 'gta', 'rp', 'roleplay', 'fps', 'valorant'],
      theme: 'gaming', particles: 'embers', cursor: 'ring', layout: 'gamecard', fx: 'pulse' },
    { k: ['anime', 'manga', 'kawaii', 'otaku', 'waifu', 'cosplay'],
      theme: 'anime', particles: 'bubbles', cursor: 'glow', layout: 'card3d', fx: 'ring' },
    { k: ['minimal', 'minimalista', 'limpio', 'simple', 'sobrio', 'elegante'],
      theme: 'minimal', particles: 'none', cursor: 'default', layout: 'minimal', fx: 'none' },
    { k: ['lujo', 'luxury', 'premium', 'oro', 'dorado', 'exclusivo', 'trading', 'inversion'],
      theme: 'luxury', particles: 'none', cursor: 'ring', layout: 'card3d', fx: 'none' },
    { k: ['retro', 'vintage', '80', '90', 'noventa', 'ochenta', 'viejo', 'clasico'],
      theme: 'retro', particles: 'none', cursor: 'default', layout: 'card3d', fx: 'none' },
    { k: ['hacker', 'terminal', 'linux', 'consola', 'seguridad', 'ctf', 'bug'],
      theme: 'hacker', particles: 'matrix', cursor: 'dot', layout: 'minimal', fx: 'glitch' },
    { k: ['windows', '98', 'nostalgia', 'pixel', 'pixelado'],
      theme: 'win98', particles: 'none', cursor: 'default', layout: 'card3d', fx: 'none' },
    { k: ['minecraft', 'bloques', 'builder', 'survival'],
      theme: 'minecraft', particles: 'snow', cursor: 'default', layout: 'card3d', fx: 'none' },
    { k: ['discord', 'comunidad', 'servidor', 'mod', 'moderador'],
      theme: 'discord', particles: 'none', cursor: 'default', layout: 'card3d', fx: 'none' },
    { k: ['vice city', 'vice', 'miami', 'palmera', 'synthwave', 'vaporwave'],
      theme: 'gta', particles: 'embers', cursor: 'blade', layout: 'gamecard', fx: 'pulse' },
    { k: ['vidrio', 'glass', 'cristal', 'transparente', 'blur'],
      theme: 'glass', particles: 'stars', cursor: 'glow', layout: 'glass', fx: 'ring' },
    { k: ['oscuro', 'dark', 'negro', 'noche', 'sobrio'],
      theme: 'dark', particles: 'stars', cursor: 'default', layout: 'card3d', fx: 'none' }
  ];

  /* colores nombrados en el texto */
  var COLORS = {
    rojo: '#ED4245', red: '#ED4245', verde: '#3BA55D', green: '#3BA55D',
    azul: '#5865F2', blue: '#5865F2', morado: '#A855F7', purple: '#A855F7',
    violeta: '#A855F7', naranja: '#F97316', orange: '#F97316',
    rosa: '#EC4899', pink: '#EC4899', cyan: '#22D3EE', celeste: '#22D3EE',
    amarillo: '#FACC15', dorado: '#D4AF6E', oro: '#D4AF6E', gold: '#D4AF6E',
    blanco: '#FFFFFF', white: '#FFFFFF', lima: '#D8FF47', verdelima: '#D8FF47'
  };

  var ROLES = [
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

  var CITIES = ['medellin', 'bogota', 'cali', 'barranquilla', 'cartagena', 'cdmx', 'guadalajara',
    'monterrey', 'lima', 'santiago', 'buenos aires', 'madrid', 'barcelona', 'quito', 'caracas', 'montevideo'];

  /* coincidencia por palabra completa: sin esto 'ui' aparece dentro de
     "quiero" y el generador cree que eres disenador. */
  /* Coincidencia por INICIO de palabra. Con limite a ambos lados,
     'disenador' no casaba con "disenadora" ni 'ctf' con "ctfs";
     sin limite alguno, 'ui' aparecia dentro de "quiero". */
  function has(text, word) {
    return new RegExp('(^|[^a-z0-9])' + word.replace(/ /g, '\\s+')).test(text);
  }

  /* Los colores si exigen palabra completa: 'red' no debe salir de "redes". */
  function hasWord(text, word) {
    return new RegExp('(^|[^a-z0-9])' + word + '([^a-z0-9]|$)').test(text);
  }

  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function generate(text, base) {
    var t = norm(text);
    var p = Object.assign(ID.store.blank(), base || {});
    var scores = [];

    /* pesa la longitud de lo que coincide: "vice city" dice mas que "rp" */
    RULES.forEach(function (r) {
      var score = 0;
      r.k.forEach(function (w) { if (has(t, w)) score += w.length; });
      if (score) scores.push({ r: r, n: score });
    });
    scores.sort(function (a, b) { return b.n - a.n; });

    var win = scores.length ? scores[0].r : RULES[RULES.length - 1];
    p.theme = win.theme;
    p.particles = win.particles;
    p.cursor = win.cursor;
    p.layout = win.layout;
    p.avatarFx = win.fx;
    p.tilt = win.layout !== 'minimal';

    /* color explícito gana sobre el del tema */
    var found = null;
    Object.keys(COLORS).forEach(function (name) {
      if (found) return;
      if (hasWord(t, name)) found = COLORS[name];
    });
    p.accent = found || '';

    /* oficio */
    var roles = ROLES.filter(function (r) {
      return r.k.some(function (w) { return has(t, w); });
    });
    if (roles.length) {
      p.title = roles.map(function (r) { return r.t; }).slice(0, 3).join(' / ');
      p.tags = roles.map(function (r) { return r.tag; });
    } else {
      p.title = 'Creador';
      p.tags = ['creator'];
    }

    /* ciudad */
    var city = CITIES.filter(function (c) { return has(t, c); })[0];
    if (city) p.location = city.replace(/\b\w/g, function (m) { return m.toUpperCase(); });

    /* redes mencionadas */
    var socials = [];
    Object.keys(ID.NETS).forEach(function (net) {
      if (has(t, net)) socials.push({ net: net, url: 'https://', label: '' });
    });
    if (t.indexOf('fivem') !== -1 && !socials.some(function (s) { return s.net === 'discord'; })) {
      socials.push({ net: 'discord', url: 'https://', label: '' });
    }
    p.socials = socials.length ? socials : [
      { net: 'discord', url: 'https://', label: '' },
      { net: 'instagram', url: 'https://', label: '' }
    ];

    /* fondo y textura acordes al tema */
    p.bgType = 'gradient';
    p.bgDim = win.theme === 'minimal' || win.theme === 'retro' ? 10 : 45;
    p.noise = win.theme === 'retro' || win.theme === 'hacker' ? 28 : 8;
    p.bgBlur = win.theme === 'glass' ? 8 : 0;

    /* biografía armada con las señales encontradas */
    p.bio = buildBio(p, t);
    p.emoji = pickEmoji(win.theme);
    p.gate = win.theme !== 'minimal';

    return p;
  }

  function buildBio(p, t) {
    var oficio = (p.title || 'Creador').toLowerCase();
    var donde = p.location ? ' desde ' + p.location : '';
    var extra = t.indexOf('fivem') !== -1 ? ' Servidor abierto casi todas las noches.'
      : t.indexOf('comision') !== -1 ? ' Comisiones abiertas.'
      : t.indexOf('directo') !== -1 || t.indexOf('stream') !== -1 ? ' En directo casi todos los días.'
      : '';
    return oficio.charAt(0).toUpperCase() + oficio.slice(1) + donde + '.' + extra +
      ' Este texto es un punto de partida: reescríbelo con tus palabras.';
  }

  function pickEmoji(theme) {
    return ({
      cyberpunk: '◈', gaming: '⚡', anime: '🌸', minimal: '◍', luxury: '◆',
      retro: '📼', hacker: '🐍', win98: '💾', minecraft: '⛏️', discord: '💬',
      gta: '🌴', glass: '❖', dark: '●'
    })[theme] || '◈';
  }

  var EXAMPLES = [
    'Quiero un perfil estilo cyberpunk negro y rojo, para mi cuenta de FiveM.',
    'Algo minimalista y elegante, soy diseñadora en Medellín.',
    'Perfil anime rosa para mis comisiones de ilustración.',
    'Estilo hacker verde, soy developer y hago CTFs.',
    'Vice City, morado y naranja, soy streamer de GTA RP.'
  ];

  V.ai = {
    route: function (mount) {
      var result = null;

      mount.innerHTML =
        '<div class="page rise">' +
          '<header class="page__head">' +
            '<p class="t-label">Generador</p>' +
            '<h1 class="t-h1" style="margin-top:10px">Descríbelo y lo armamos</h1>' +
            '<p class="t-sub" style="margin-top:10px;max-width:56ch">' +
              'Escribe cómo quieres que se sienta tu perfil. Elegimos tema, colores, ' +
              'disposición, efectos y un borrador de biografía.</p>' +
          '</header>' +

          '<div class="ai-grid">' +
            '<div>' +
              '<textarea class="prompt" id="aiPrompt" ' +
                'placeholder="Quiero un perfil estilo cyberpunk negro y rojo, para mi cuenta de FiveM."></textarea>' +
              '<div class="chips" style="margin-top:12px">' +
                EXAMPLES.map(function (e, i) {
                  return '<button type="button" class="chip" data-ex="' + i + '">' +
                    esc(e.length > 42 ? e.slice(0, 40) + '…' : e) + '</button>';
                }).join('') +
              '</div>' +
              '<div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">' +
                '<button class="btn btn--primary" type="button" id="aiGo">Generar perfil</button>' +
                '<button class="btn btn--ghost" type="button" id="aiUse" disabled>Usar en el panel</button>' +
              '</div>' +
              '<div class="ai-out" id="aiOut" style="margin-top:18px">' +
                '<p class="t-meta">Aún no has generado nada.</p>' +
              '</div>' +
              '<div class="note">' +
                '<b>Cómo funciona.</b> Es un motor de reglas que corre en tu navegador: ' +
                'busca señales en el texto (estilo, color, oficio, ciudad, redes) y las traduce a ' +
                'ajustes concretos. No hay ningún modelo detrás, y por eso funciona sin conexión ' +
                'y sin clave. El <code>README.md</code> indica la función exacta que hay que ' +
                'reemplazar para enchufar un LLM real.' +
              '</div>' +
            '</div>' +

            '<div>' +
              '<div class="demo__frame" style="height:560px">' +
                '<div class="demo__scroll" id="aiPrev"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var ta = mount.querySelector('#aiPrompt');
      var out = mount.querySelector('#aiOut');
      var prev = mount.querySelector('#aiPrev');
      var useBtn = mount.querySelector('#aiUse');

      function run() {
        var txt = ta.value.trim();
        if (!txt) { ID.app.toast('Escribe algo primero', true); return; }

        var mine = ID.store.mine();
        result = generate(txt, {
          username: mine.username || '',
          name: mine.name && mine.name !== 'Tu nombre' ? mine.name : 'Tu nombre'
        });

        var theme = ID.THEMES.filter(function (t) { return t.id === result.theme; })[0];
        var lay = ID.LAYOUTS.filter(function (l) { return l.id === result.layout; })[0];
        var par = ID.PARTICLES.filter(function (x) { return x.id === result.particles; })[0];
        var cur = ID.CURSORS.filter(function (c) { return c.id === result.cursor; })[0];

        out.innerHTML =
          line('Tema', theme ? theme.name : result.theme) +
          line('Disposición', lay ? lay.name : result.layout) +
          line('Acento', result.accent || 'heredado del tema') +
          line('Partículas', par ? par.name : result.particles) +
          line('Cursor', cur ? cur.name : result.cursor) +
          line('Efecto de avatar', result.avatarFx) +
          line('Oficio', result.title) +
          line('Ubicación', result.location || '—') +
          line('Redes', result.socials.map(function (s) {
            return (ID.NETS[s.net] || {}).label || s.net;
          }).join(', ')) +
          line('Ruido / Oscurecer', result.noise + '% / ' + result.bgDim + '%');

        ID.fx.clear();
        prev.innerHTML = ID.views.profile.render(result, { preview: true });
        ID.views.profile.mount(prev, result, { preview: true });

        useBtn.disabled = false;
      }

      function line(k, v) {
        return '<div class="ai-line"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
      }

      mount.querySelector('#aiGo').addEventListener('click', run);
      ta.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
      });

      mount.querySelectorAll('[data-ex]').forEach(function (b) {
        b.addEventListener('click', function () {
          ta.value = EXAMPLES[Number(b.getAttribute('data-ex'))];
          run();
        });
      });

      useBtn.addEventListener('click', function () {
        if (!result) return;
        /* conservamos lo que el usuario ya tenía escrito */
        var mine = ID.store.mine();
        result.username = mine.username || result.username;
        result.links = mine.links && mine.links.length ? mine.links : result.links;
        result.views = mine.views || 0;
        result.joined = mine.joined;

        var name = result.username || '__draft__';
        ID.store.saveRaw(name, result);
        ID.store.setMine(name);
        ID.app.toast('Aplicado. Ajústalo a tu gusto.');
        location.hash = '#/dashboard?sec=appearance';
      });
    },

    /* expuesto para pruebas y para sustituirlo por un LLM */
    generate: generate
  };
})();
