/* ============================================================
   IDENTITY — ranking
   El ranking representa estatus, así que se diseña como podio,
   no como tabla de administración.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc, num = ID.util.num;

  var CATS = [
    { id: 'views',   name: 'Más vistos',    unit: 'visitas',  fmt: function (p) { return num(p.views); } },
    { id: 'rating',  name: 'Mejor diseño',  unit: 'de nota',  fmt: function (p) {
        var r = p.ratings || {};
        return (Math.round(((r.design + r.originality + r.aesthetic) / 3) * 10) / 10 || 0).toFixed(1);
      } },
    { id: 'likes',   name: 'Más queridos',  unit: 'me gusta', fmt: function (p) { return num(p.likes); } },
    { id: 'growth',  name: 'Más crecimiento', unit: 'esta semana', fmt: function (p) {
        var a = ID.store.analytics(p.username, 7);
        return (a && a.trend > 0 ? '+' : '') + (a ? a.trend : 0) + '%';
      } },
    { id: 'level',   name: 'Nivel más alto', unit: 'de nivel', fmt: function (p) { return String(p.level || 1); } },
    { id: 'premium', name: 'Premium',       unit: 'visitas',  fmt: function (p) { return num(p.views); } }
  ];

  var state = { cat: 'views' };

  function av(p, cls) {
    return '<span class="' + cls + '">' + (p.avatarUrl
      ? '<img src="' + esc(ID.util.safeMedia(p.avatarUrl)) + '" alt="">'
      : '<span aria-hidden="true">' + esc(p.emoji || (p.name || '?').charAt(0)) + '</span>') + '</span>';
  }

  function paint(mount) {
    var cat = CATS.filter(function (c) { return c.id === state.cat; })[0] || CATS[0];
    var rows = ID.store.leaderboard(state.cat);
    var podium = rows.slice(0, 3);
    var rest = rows.slice(3);

    var slot = mount.querySelector('#lbBody');
    if (!slot) return;

    /* sin nadie clasificado no hay podio que enseñar: un ranking
       vacio con tres huecos parece roto, no parece nuevo */
    if (!rows.length) {
      slot.innerHTML = '<div class="empty">El ranking está vacío porque todavía no hay ' +
        'perfiles públicos.<br>El primero en publicar encabeza la lista.<br>' +
        '<a class="btn btn--primary" style="margin-top:16px" href="#/dashboard">' +
        'Crear mi perfil</a></div>';
      return;
    }

    /* el podio va en orden 2 · 1 · 3 para que el primero quede al centro */
    var order = [podium[1], podium[0], podium[2]].filter(Boolean);

    slot.innerHTML =
      '<div class="podium">' +
        order.map(function (x) {
          var p = x.p;
          var place = podium.indexOf(x) + 1;
          return '<a class="pod pod--' + place + '" href="#/u/' + esc(p.username) + '" ' +
            'style="--pod-tint:' + V.landing.hexA(p.accent, .16) + '">' +
            '<span class="pod__medal">' + place + '</span>' +
            av(p, 'pod__av') +
            '<span class="pod__name">' + esc(p.name || p.username) + '</span>' +
            '<span class="pod__at">@' + esc(p.username) + '</span>' +
            '<span class="pod__v">' + cat.fmt(p) + '</span>' +
            '<span class="pod__u">' + esc(cat.unit) + '</span>' +
            '</a>';
        }).join('') +
      '</div>' +

      (rest.length
        ? '<ol class="lb">' + rest.map(function (x, i) {
            var p = x.p;
            return '<li><a class="lb__row" href="#/u/' + esc(p.username) + '">' +
              '<span class="lb__rank">' + String(i + 4).padStart(2, '0') + '</span>' +
              av(p, 'lb__av') +
              '<span class="lb__id">' +
                '<span class="lb__n">' + esc(p.name || p.username) +
                (p.verified ? '<i title="Verificado">✔</i>' : '') + '</span>' +
                '<span class="lb__h">@' + esc(p.username) + ' · ' + esc(p.title || '') + '</span>' +
              '</span>' +
              '<span class="lb__v">' + cat.fmt(p) + '<small>' + esc(cat.unit) + '</small></span>' +
              '</a></li>';
          }).join('') + '</ol>'
        : '');
  }

  V.leaderboard = {
    route: function (mount) {
      mount.innerHTML =
        '<div class="page rise">' +
          '<header class="page__head">' +
            '<p class="t-label">Ranking global</p>' +
            '<h1 class="t-h1" style="margin-top:10px">Quién manda hoy</h1>' +
            '<p class="t-sub" style="margin-top:10px;max-width:52ch">' +
              'Seis formas de estar arriba. Elige la tuya.</p>' +
            '<div class="chips" role="tablist" aria-label="Categorías" style="margin-top:24px">' +
              CATS.map(function (c) {
                return '<button type="button" role="tab" class="chip' +
                  (c.id === state.cat ? ' on' : '') + '" data-c="' + c.id + '" ' +
                  'aria-selected="' + (c.id === state.cat) + '">' + esc(c.name) + '</button>';
              }).join('') +
            '</div>' +
          '</header>' +
          '<div id="lbBody"></div>' +
        '</div>';

      paint(mount);

      mount.querySelectorAll('.chip').forEach(function (c) {
        c.addEventListener('click', function () {
          state.cat = c.getAttribute('data-c');
          mount.querySelectorAll('.chip').forEach(function (x) {
            var on = x === c;
            x.classList.toggle('on', on);
            x.setAttribute('aria-selected', String(on));
          });
          paint(mount);
        });
      });
    }
  };
})();
