/* ============================================================
   IDENTITY — portada
   Regla: mostrar, no explicar. El héroe no lleva una captura:
   lleva un perfil funcionando que el visitante puede tocar.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc, num = ID.util.num;

  /* paleta de acentos que ofrecemos en el demo */
  var ACCENTS = ['#FFFFFF', '#3BA55D', '#5865F2', '#A855F7', '#ED4245', '#F97316', '#EC4899', '#22D3EE'];

  V.landing = {
    route: function (mount) {
      var demo = JSON.parse(JSON.stringify(ID.store.get('uriel') || ID.store.blank()));
      demo.gate = false;
      demo.cursor = 'default';   /* el cursor del demo no debe secuestrar la página */

      var potd = ID.store.profileOfDay();
      var top = ID.store.leaderboard('views').slice(0, 3);
      var rail = ID.store.leaderboard('rating').slice(0, 8).map(function (x) { return x.p; });

      mount.innerHTML =
        heroHTML(demo) +
        railHTML(rail) +
        potdHTML(potd) +
        topHTML(top) +
        closeHTML();

      /* --- monta el perfil demo --- */
      var slot = mount.querySelector('#demoSlot');
      var renderDemo = function () {
        ID.fx.clear();
        slot.innerHTML = ID.views.profile.render(demo, { preview: true });
        ID.views.profile.mount(slot, demo, { preview: true });
      };
      renderDemo();

      /* --- controles del demo: tema --- */
      mount.querySelectorAll('[data-demo-theme]').forEach(function (b) {
        b.addEventListener('click', function () {
          mount.querySelectorAll('[data-demo-theme]').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          demo.theme = b.getAttribute('data-demo-theme');
          demo.accent = '';           /* que mande la paleta del tema */
          renderDemo();
        });
      });

      /* --- controles del demo: acento --- */
      mount.querySelectorAll('[data-demo-accent]').forEach(function (b) {
        b.addEventListener('click', function () {
          mount.querySelectorAll('[data-demo-accent]').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          demo.accent = b.getAttribute('data-demo-accent');
          renderDemo();
        });
      });

      /* --- reclamar nombre desde el héroe --- */
      var form = mount.querySelector('#claimForm');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var v = ID.util.slug(form.querySelector('input').value);
          if (!v) { ID.app.toast('Escribe un nombre de usuario', true); return; }
          if (ID.router.RESERVED.indexOf(v) !== -1) {
            ID.app.toast('@' + v + ' está reservado', true); return;
          }
          if (ID.store.exists(v)) {
            ID.app.toast('@' + v + ' ya está tomado', true);
            location.hash = '#/u/' + v;
            return;
          }
          /* Reclamar un nombre es crear un perfil: hace falta
             cuenta. El nombre elegido viaja en la vuelta, para no
             tener que escribirlo dos veces. */
          var ir = '/dashboard?claim=' + encodeURIComponent(v);
          if (ID.app.requiereSesion(ir)) return;
          location.hash = '#' + ir;
        });
      }

      ID.fx.reveal(mount);
    }
  };

  /* ---- héroe --------------------------------------------------- */
  function heroHTML(demo) {
    var themeSw = ID.THEMES.slice(0, 10).map(function (t) {
      return '<button type="button" class="demo__sw sw-' + t.id + (t.id === demo.theme ? ' on' : '') +
        '" data-demo-theme="' + t.id + '" title="' + esc(t.name) + '" aria-label="Tema ' + esc(t.name) + '"></button>';
    }).join('');

    var accentSw = ACCENTS.map(function (c) {
      return '<button type="button" class="demo__sw" data-demo-accent="' + c +
        '" style="background:' + c + '" title="' + c + '" aria-label="Acento ' + c + '"></button>';
    }).join('');

    var total = ID.store.list().reduce(function (s, p) { return s + (p.views || 0); }, 0);

    return '' +
    '<section class="hero">' +
      '<div class="rise">' +
        '<span class="hero__eyebrow"><i class="dot"></i>' +
          '<b>' + num(ID.store.list().length) + ' perfiles</b> creados esta semana</span>' +

        '<h1 class="hero__h">Tu identidad,<br><em>en línea.</em></h1>' +

        '<p class="hero__p">Crea un perfil que se sienta como tú. ' +
          'No una lista de enlaces: un sitio.</p>' +

        '<form class="claim" id="claimForm">' +
          '<span class="claim__pre">identity.gg/</span>' +
          '<input type="text" placeholder="tunombre" maxlength="24" ' +
            'aria-label="Elige tu nombre de usuario" autocomplete="off" spellcheck="false">' +
          '<button class="btn btn--primary btn--sm" type="submit">Crear</button>' +
        '</form>' +

        '<div class="hero__cta">' +
          '<a class="btn btn--ghost" href="#/discover">Explorar perfiles</a>' +
        '</div>' +

        '<div class="hero__proof">' +
          '<div class="hero__faces" aria-hidden="true">' +
            ID.store.list().slice(0, 5).map(function (p) {
              return '<span>' + esc(p.emoji || '◍') + '</span>';
            }).join('') +
          '</div>' +
          '<p class="t-meta" style="margin:0">' + num(total) + ' visitas servidas en total</p>' +
        '</div>' +
      '</div>' +

      '<div class="demo rise d2">' +
        '<div class="demo__frame"><div class="demo__scroll" id="demoSlot"></div></div>' +
        '<div class="demo__ctrl">' +
          '<span class="demo__hint">Tema</span>' + themeSw +
        '</div>' +
        '<div class="demo__ctrl">' +
          '<span class="demo__hint">Acento</span>' + accentSw +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ---- carrusel de perfiles reales ------------------------------ */
  function railHTML(list) {
    return '' +
    '<section class="band wrap" data-reveal>' +
      '<div class="band__head">' +
        '<div><h2 class="t-h2">Gente que ya lo hizo</h2>' +
        '<p>Cada uno de estos perfiles usa el mismo editor que vas a usar tú.</p></div>' +
        '<a class="btn btn--ghost btn--sm" href="#/discover">Ver todos</a>' +
      '</div>' +
      '<div class="rail">' +
        list.map(function (p) { return ID.views.discover.card(p); }).join('') +
      '</div>' +
    '</section>';
  }

  /* ---- perfil del día -------------------------------------------- */
  function potdHTML(p) {
    if (!p) return '';
    var av = p.avatarUrl
      ? '<img src="' + esc(ID.util.safeMedia(p.avatarUrl)) + '" alt="">'
      : esc(p.emoji || (p.name || '?').charAt(0));
    return '' +
    '<section class="band wrap" data-reveal>' +
      '<div class="band__head"><div>' +
        '<h2 class="t-h2">Perfil del día</h2>' +
        '<p>Rota cada 24 horas. Aparecer aquí es la forma más rápida de que te vean.</p>' +
      '</div></div>' +
      '<article class="potd" style="--potd-tint:' + esc(hexA(p.accent, .12)) + '">' +
        '<div class="potd__av">' + av + '</div>' +
        '<div>' +
          '<div class="potd__name">' + esc(p.name || p.username) + '</div>' +
          '<div class="potd__why">@' + esc(p.username) + ' · ' + esc(p.title || '') + '</div>' +
          '<div class="t-meta" style="margin-top:6px">' + num(p.views) + ' visitas · nivel ' + (p.level || 1) + '</div>' +
        '</div>' +
        '<a class="btn btn--primary potd__cta" href="#/u/' + esc(p.username) + '">Visitar perfil</a>' +
      '</article>' +
    '</section>';
  }

  /* ---- top 3 ------------------------------------------------------ */
  function topHTML(rows) {
    return '' +
    '<section class="band wrap" data-reveal>' +
      '<div class="band__head">' +
        '<div><h2 class="t-h2">Los más vistos</h2>' +
        '<p>El ranking se actualiza con cada visita.</p></div>' +
        '<a class="btn btn--ghost btn--sm" href="#/top">Ranking completo</a>' +
      '</div>' +
      '<div class="top3">' +
        rows.map(function (x, i) {
          var p = x.p;
          var av = p.avatarUrl ? '<img src="' + esc(ID.util.safeMedia(p.avatarUrl)) + '" alt="">' : esc(p.emoji || '◍');
          return '<a class="top3__row" href="#/u/' + esc(p.username) + '">' +
            '<span class="top3__n">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="top3__av">' + av + '</span>' +
            '<span><span style="font-weight:500">' + esc(p.name || p.username) + '</span>' +
            '<span class="t-meta" style="display:block">@' + esc(p.username) + '</span></span>' +
            '<span class="top3__v">' + num(p.views) + '<small>visitas</small></span>' +
            '</a>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  function closeHTML() {
    return '' +
    '<section class="close-band" data-reveal>' +
      '<h2>Deja de explicar quién eres.</h2>' +
      '<p>Muéstralo. Un enlace, todo tu mundo.</p>' +
      '<a class="btn btn--primary btn--lg" href="#/dashboard">Crear mi perfil</a>' +
    '</section>' +
    '<footer class="foot">' +
      '<span>IDENTITY</span>' +
      '<a href="#/discover">Descubrir</a>' +
      '<a href="#/top">Ranking</a>' +
      '<a href="#/pricing">Precios</a>' +
      '<span class="foot__sep">Hecho en Medellín</span>' +
    '</footer>';
  }

  /* color hex + alfa como rgba, para tintes suaves */
  function hexA(hex, a) {
    hex = String(hex || '#FFFFFF').replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    if (isNaN(n)) return 'rgba(255,255,255,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  V.landing.hexA = hexA;
})();
