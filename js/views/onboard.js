/* ============================================================
   IDENTITY — asistente de creación

   Nadie debería empezar con una página en blanco. En cuatro pasos
   y sin escribir una línea de CSS, alguien sale con un perfil que
   ya se ve bien. Después lo cambia todo si quiere.

   Cada paso muestra el resultado en vivo: eso es lo que convence.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc;

  var K_HECHO = 'identity.onboard.v1';

  /* Estilos de arranque: cada uno es un preset de composición más
     un tema. Son los seis que cubren casi todo lo que pide la gente. */
  var ESTILOS = [
    { id: 'minimal',   name: 'Minimal',   sub: 'Limpio y directo',
      cfg: { preset: 'minimal', theme: 'dark', surface: 'none', socialStyle: 'text',
             font: 'inter', particles: 'none', vignette: 25, avSize: 84 } },
    { id: 'glass',     name: 'Vidrio',    sub: 'Suave y translúcido',
      cfg: { preset: 'glass', theme: 'glass', surface: 'glass', socialStyle: 'boxed',
             font: 'manrope', particles: 'stars', vignette: 20 } },
    { id: 'immersive', name: 'Inmersivo', sub: 'Sin cajas, puro fondo',
      cfg: { preset: 'immersive', theme: 'dark', surface: 'none', socialStyle: 'icons',
             font: 'inter', particles: 'stars', vignette: 45, avSize: 96 } },
    { id: 'gaming',    name: 'Gaming',    sub: 'Nivel, badges y brillo',
      cfg: { preset: 'gaming', theme: 'gaming', surface: 'glow', socialStyle: 'glow',
             font: 'chakra', particles: 'embers', vignette: 30, glowName: true } },
    { id: 'anime',     name: 'Anime',     sub: 'Colores suaves',
      cfg: { preset: 'glass', theme: 'anime', surface: 'glass', socialStyle: 'boxed',
             font: 'manrope', particles: 'bubbles', vignette: 15, glowBadges: true } },
    { id: 'editorial', name: 'Editorial', sub: 'Tipografía grande',
      cfg: { preset: 'editorial', theme: 'minimal', surface: 'none', socialStyle: 'text',
             font: 'serif', particles: 'none', vignette: 0, avShape: 'bare', nameSize: 54 } }
  ];

  var COLORES = [
    { c: '#FFFFFF', n: 'Blanco' }, { c: '#3BA55D', n: 'Verde' },
    { c: '#5865F2', n: 'Azul' },   { c: '#A855F7', n: 'Morado' },
    { c: '#ED4245', n: 'Rojo' },   { c: '#F97316', n: 'Naranja' },
    { c: '#EC4899', n: 'Rosa' },   { c: '#22D3EE', n: 'Cyan' }
  ];

  /* redes que pedimos en el paso 4: las que de verdad usa la gente */
  var REDES = ['discord', 'instagram', 'tiktok', 'youtube', 'twitch',
    'github', 'x', 'spotify', 'steam', 'whatsapp'];

  var st = { paso: 1, p: null, alTerminar: null };
  var TOTAL = 4;

  function preview(mount) {
    var slot = mount.querySelector('#obPrev');
    if (!slot) return;
    ID.fx.clear();
    slot.innerHTML = ID.views.profile.render(st.p, { preview: true });
    ID.views.profile.mount(slot, st.p, { preview: true });
  }

  /* ---- pasos ------------------------------------------------- */

  function paso1() {
    return '<h2 class="ob__t">¿Cómo quieres que se vea?</h2>' +
      '<p class="ob__d">Elige un punto de partida. Podrás cambiarlo todo después.</p>' +
      '<div class="ob__grid">' +
        ESTILOS.map(function (e) {
          return '<button type="button" class="obcard' +
            (st.p._estilo === e.id ? ' on' : '') + '" data-estilo="' + e.id + '">' +
            '<span class="obcard__pre sw-' + e.cfg.theme + '"></span>' +
            '<span class="obcard__n">' + esc(e.name) + '</span>' +
            '<span class="obcard__s">' + esc(e.sub) + '</span></button>';
        }).join('') +
      '</div>';
  }

  function paso2() {
    return '<h2 class="ob__t">Elige tu color</h2>' +
      '<p class="ob__d">Se usa en los detalles: brillos, bordes activos y barras.</p>' +
      '<div class="ob__colors">' +
        COLORES.map(function (c) {
          return '<button type="button" class="obcol' +
            (String(st.p.accent).toLowerCase() === c.c.toLowerCase() ? ' on' : '') +
            '" data-color="' + c.c + '" style="--c:' + c.c + '" ' +
            'aria-label="' + esc(c.n) + '"><span></span>' + esc(c.n) + '</button>';
        }).join('') +
      '</div>';
  }

  function paso3() {
    return '<h2 class="ob__t">¿Quién eres?</h2>' +
      '<p class="ob__d">El nombre de usuario será tu enlace.</p>' +
      '<div class="f"><label class="f__l"><span>Tu enlace</span></label>' +
        '<div class="f-pre"><span>identity.gg/</span>' +
        '<input class="inp" id="obUser" value="' + esc(st.p.username || '') +
        '" placeholder="tunombre" autocomplete="off" spellcheck="false"></div>' +
        '<p class="ob__hint" id="obUserHint"></p></div>' +
      '<div class="f"><label class="f__l"><span>Nombre visible</span></label>' +
        '<input class="inp" id="obName" value="' +
        esc(st.p.name === 'Tu nombre' ? '' : st.p.name || '') + '" placeholder="Como te llamas"></div>' +
      '<div class="f"><label class="f__l"><span>Qué haces</span>' +
        '<em>opcional</em></label>' +
        '<input class="inp" id="obTitle" value="' + esc(st.p.title === 'Lo que haces' ? '' : st.p.title || '') +
        '" placeholder="Developer / Gamer"></div>' +
      '<div class="f"><label class="f__l"><span>Biografía</span><em>opcional</em></label>' +
        '<textarea class="ta" id="obBio" placeholder="Algo que valga la pena leer dos veces.">' +
        esc(st.p.bio && st.p.bio.indexOf('Escribe algo') === -1 ? st.p.bio : '') + '</textarea></div>';
  }

  function paso4() {
    var puestas = (st.p.socials || []).map(function (s) { return s.net; });
    return '<h2 class="ob__t">Tus redes</h2>' +
      '<p class="ob__d">Toca las que uses y pon tu usuario. Puedes añadir más luego.</p>' +
      '<div class="ob__nets">' +
        REDES.map(function (id) {
          var n = ID.NETS[id];
          var i = puestas.indexOf(id);
          return '<div class="obnet' + (i > -1 ? ' on' : '') + '" data-net="' + id + '">' +
            '<button type="button" class="obnet__b" style="--brand:' + n.color + '" ' +
              'aria-label="' + esc(n.label) + '">' + n.icon + '</button>' +
            '<span class="obnet__n">' + esc(n.label) + '</span>' +
            (i > -1
              ? '<input class="inp obnet__i" data-neti="' + id + '" placeholder="' + esc(n.ph) +
                '" value="' + esc((st.p.socials[i].url || '').replace(n.prefix || '', '')) + '">'
              : '') +
            '</div>';
        }).join('') +
      '</div>';
  }

  var PASOS = [null, paso1, paso2, paso3, paso4];

  /* ---- pintado ------------------------------------------------ */

  function pintar(mount) {
    var cuerpo = mount.querySelector('#obBody');
    cuerpo.innerHTML = PASOS[st.paso](st.p);

    mount.querySelector('#obStep').textContent = st.paso + ' / ' + TOTAL;
    mount.querySelector('#obBar').style.width = (st.paso / TOTAL * 100) + '%';

    var atras = mount.querySelector('#obBack');
    atras.disabled = st.paso === 1;
    var next = mount.querySelector('#obNext');
    next.textContent = st.paso === TOTAL ? 'Crear mi perfil' : 'Continuar';

    enlazar(mount);
    preview(mount);
  }

  function enlazar(mount) {
    var cuerpo = mount.querySelector('#obBody');

    cuerpo.querySelectorAll('[data-estilo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var e = ESTILOS.filter(function (x) { return x.id === b.getAttribute('data-estilo'); })[0];
        if (!e) return;
        st.p._estilo = e.id;
        Object.keys(e.cfg).forEach(function (k) { st.p[k] = e.cfg[k]; });
        cuerpo.querySelectorAll('[data-estilo]').forEach(function (x) { x.classList.toggle('on', x === b); });
        preview(mount);
      });
    });

    cuerpo.querySelectorAll('[data-color]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.p.accent = b.getAttribute('data-color');
        cuerpo.querySelectorAll('[data-color]').forEach(function (x) { x.classList.toggle('on', x === b); });
        preview(mount);
      });
    });

    var user = cuerpo.querySelector('#obUser');
    if (user) {
      var pista = cuerpo.querySelector('#obUserHint');
      var revisar = function () {
        var v = ID.util.slug(user.value);
        if (user.value !== v) user.value = v;
        st.p.username = v;
        if (!v) { pista.textContent = ''; pista.className = 'ob__hint'; }
        else if (ID.router.RESERVED.indexOf(v) !== -1) {
          pista.textContent = 'Ese nombre está reservado'; pista.className = 'ob__hint bad';
        } else if (ID.store.exists(v) && ID.store.mineName() !== v) {
          pista.textContent = '@' + v + ' ya está tomado'; pista.className = 'ob__hint bad';
        } else {
          pista.textContent = 'identity.gg/' + v + ' está libre'; pista.className = 'ob__hint good';
        }
        preview(mount);
      };
      user.addEventListener('input', revisar);
      revisar();

      cuerpo.querySelector('#obName').addEventListener('input', function (e) {
        st.p.name = e.target.value || 'Tu nombre'; preview(mount);
      });
      cuerpo.querySelector('#obTitle').addEventListener('input', function (e) {
        st.p.title = e.target.value; preview(mount);
      });
      cuerpo.querySelector('#obBio').addEventListener('input', function (e) {
        st.p.bio = e.target.value; preview(mount);
      });
    }

    cuerpo.querySelectorAll('.obnet__b').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.parentNode.getAttribute('data-net');
        st.p.socials = st.p.socials || [];
        var i = st.p.socials.findIndex(function (s) { return s.net === id; });
        if (i > -1) st.p.socials.splice(i, 1);
        else st.p.socials.push({ net: id, url: '', label: '' });
        pintar(mount);
      });
    });

    cuerpo.querySelectorAll('[data-neti]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-neti');
        var n = ID.NETS[id];
        var s = st.p.socials.filter(function (x) { return x.net === id; })[0];
        if (!s) return;
        var v = inp.value.trim().replace(/^@/, '');
        s.url = !v ? '' : (/^https?:/i.test(v) ? v : (n.prefix || '') + v);
        preview(mount);
      });
    });
  }

  function validar(mount) {
    if (st.paso === 3) {
      var v = ID.util.slug(st.p.username || '');
      if (!v) { ID.app.toast('Elige un nombre de usuario', true); return false; }
      if (ID.router.RESERVED.indexOf(v) !== -1) { ID.app.toast('Ese nombre está reservado', true); return false; }
      if (ID.store.exists(v) && ID.store.mineName() !== v) {
        ID.app.toast('@' + v + ' ya está tomado', true); return false;
      }
    }
    return true;
  }

  function terminar(mount) {
    delete st.p._estilo;
    st.p.joined = new Date().toISOString().slice(0, 10);
    /* las redes sin usuario no se guardan */
    st.p.socials = (st.p.socials || []).filter(function (s) { return s.url; });

    var lv = ID.store.computeLevel(st.p);
    st.p.level = lv.level; st.p.xp = lv.xp; st.p.xpMax = lv.xpMax;

    ID.store.save(st.p);
    ID.store.setMine(st.p.username);
    ID.util.write(K_HECHO, 1);

    if (typeof st.alTerminar === 'function') st.alTerminar(st.p);
  }

  V.onboard = {
    /* ¿hace falta el asistente? */
    pendiente: function () {
      return !ID.store.mineName() && !ID.util.read(K_HECHO, 0);
    },

    saltar: function () { ID.util.write(K_HECHO, 1); },

    /* se monta dentro de un contenedor; avisa al terminar */
    abrir: function (mount, opciones) {
      opciones = opciones || {};
      st.paso = 1;
      st.alTerminar = opciones.alTerminar || null;
      st.p = Object.assign(ID.store.blank(), opciones.base || {});
      st.p._estilo = null;

      /* arrancamos con el primer estilo aplicado: nunca una página en blanco */
      Object.keys(ESTILOS[0].cfg).forEach(function (k) { st.p[k] = ESTILOS[0].cfg[k]; });
      st.p._estilo = ESTILOS[0].id;
      st.p.accent = '#FFFFFF';

      mount.innerHTML =
        '<div class="ob">' +
          '<div class="ob__panel">' +
            '<div class="ob__head">' +
              '<span class="ob__mark">IDENTITY</span>' +
              '<span class="ob__step" id="obStep"></span>' +
            '</div>' +
            '<div class="ob__prog"><i id="obBar"></i></div>' +
            '<div class="ob__body" id="obBody"></div>' +
            '<div class="ob__foot">' +
              '<button class="btn btn--ghost" type="button" id="obBack">Atrás</button>' +
              '<button class="btn btn--quiet btn--sm" type="button" id="obSkip">Saltar</button>' +
              '<button class="btn btn--primary" type="button" id="obNext">Continuar</button>' +
            '</div>' +
          '</div>' +
          '<div class="ob__stage">' +
            '<div class="ob__frame"><div class="ob__scroll" id="obPrev"></div></div>' +
          '</div>' +
        '</div>';

      pintar(mount);

      mount.querySelector('#obBack').addEventListener('click', function () {
        if (st.paso > 1) { st.paso--; pintar(mount); }
      });
      mount.querySelector('#obNext').addEventListener('click', function () {
        if (!validar(mount)) return;
        if (st.paso < TOTAL) { st.paso++; pintar(mount); }
        else terminar(mount);
      });
      mount.querySelector('#obSkip').addEventListener('click', function () {
        V.onboard.saltar();
        if (typeof st.alTerminar === 'function') st.alTerminar(null);
      });
    }
  };
})();
