/* ============================================================
   IDENTITY — descubrir
   No es un marketplace: es explorar gente interesante.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc, num = ID.util.num;

  /* filtros: los tres primeros ordenan, el resto segmenta */
  var FILTERS = [
    { id: 'trending',  name: 'Trending' },
    { id: 'new',       name: 'Nuevos' },
    { id: 'popular',   name: 'Populares' },
    { id: 'gaming',    name: 'Gaming',      tag: 'gaming' },
    { id: 'developer', name: 'Developers',  tag: 'developer' },
    { id: 'creator',   name: 'Creators',    tag: 'creator' },
    { id: 'design',    name: 'Designers',   tag: 'design' },
    { id: 'music',     name: 'Música',      tag: 'music' },
    { id: 'other',     name: 'Otros' }
  ];

  var state = { filter: 'trending', q: '' };

  V.discover = {

    /* tarjeta reutilizada por la portada y el ranking */
    card: function (p) {
      var tint = V.landing.hexA(p.accent, .18);
      var av = p.avatarUrl
        ? '<img src="' + esc(ID.util.safeMedia(p.avatarUrl)) + '" alt="">'
        : '<span aria-hidden="true">' + esc(p.emoji || (p.name || '?').charAt(0)) + '</span>';

      var bd = (p.badges || []).slice(0, 3).map(function (id) {
        var b = ID.BADGES[id];
        return b ? '<span title="' + esc(b.label) + '">' + b.icon + '</span>' : '';
      }).join('');

      return '<a class="pcard" href="#/u/' + esc(p.username) + '" ' +
        'style="--pc-tint:' + tint + ';--pc-ring:' + esc(p.accent || 'transparent') + '">' +
        '<span class="pcard__av">' + av + '</span>' +
        '<span class="pcard__name">' + esc(p.name || p.username) +
          (p.verified ? '<i class="pcard__v" title="Verificado">✔</i>' : '') + '</span>' +
        '<span class="pcard__at">@' + esc(p.username) + '</span>' +
        '<span class="pcard__role">' + esc(p.title || '') + '</span>' +
        (bd ? '<span class="pcard__bd">' + bd + '</span>' : '') +
        '<span class="pcard__foot">' +
          '<span class="pcard__views">' + num(p.views) + ' visitas</span>' +
          '<span>Nv ' + (p.level || 1) + '</span>' +
        '</span>' +
        '</a>';
    },

    filter: function () {
      var all = ID.store.list().filter(function (p) { return p.discoverable !== false; });
      var q = state.q.trim().toLowerCase().replace(/^@/, '');

      if (q) {
        all = all.filter(function (p) {
          return (p.username || '').toLowerCase().indexOf(q) !== -1 ||
                 (p.name || '').toLowerCase().indexOf(q) !== -1 ||
                 (p.title || '').toLowerCase().indexOf(q) !== -1 ||
                 (p.tags || []).join(' ').toLowerCase().indexOf(q) !== -1 ||
                 (p.location || '').toLowerCase().indexOf(q) !== -1;
        });
      }

      var f = FILTERS.filter(function (x) { return x.id === state.filter; })[0] || FILTERS[0];

      if (f.tag) {
        all = all.filter(function (p) { return (p.tags || []).indexOf(f.tag) !== -1; });
      } else if (f.id === 'other') {
        var known = FILTERS.filter(function (x) { return x.tag; }).map(function (x) { return x.tag; });
        all = all.filter(function (p) {
          return !(p.tags || []).some(function (t) { return known.indexOf(t) !== -1; });
        });
      }

      if (f.id === 'new') {
        all.sort(function (a, b) { return new Date(b.joined) - new Date(a.joined); });
      } else if (f.id === 'popular') {
        all.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
      } else {
        /* trending = crecimiento reciente, no total acumulado */
        all.sort(function (a, b) {
          var ga = ID.store.analytics(a.username, 7), gb = ID.store.analytics(b.username, 7);
          return ((gb ? gb.trend : 0) * (b.views || 1)) - ((ga ? ga.trend : 0) * (a.views || 1));
        });
      }
      return all;
    },

    paint: function (mount) {
      var list = V.discover.filter();
      var grid = mount.querySelector('#dGrid');
      var count = mount.querySelector('#dCount');
      if (count) count.textContent = list.length + (list.length === 1 ? ' perfil' : ' perfiles');
      if (!grid) return;
      /* No es lo mismo "tu busqueda no encuentra nada" que "todavia
         no hay nadie". Con la plataforma recien abierta, mandar a
         alguien a buscar "gaming" es hacerle perder el tiempo. */
      var hayPerfiles = ID.store.list().length > 0;
      grid.innerHTML = list.length
        ? list.map(V.discover.card).join('')
        : hayPerfiles
          ? '<div class="empty">Nadie coincide con esa búsqueda todavía.<br>' +
            'Prueba con otro nombre, oficio o ciudad.</div>'
          : '<div class="empty">Todavía no hay perfiles públicos.<br>' +
            'Puedes ser el primero.<br>' +
            '<a class="btn btn--primary" style="margin-top:16px" href="#/dashboard">' +
            'Crear el mío</a></div>';
    },

    route: function (mount, params) {
      if (params.q) state.q = params.q;

      mount.innerHTML =
        '<div class="page rise">' +
          '<header class="page__head">' +
            '<p class="t-label">Descubrir</p>' +
            '<h1 class="t-h1" style="margin-top:10px">Gente que vale la pena mirar</h1>' +
            '<p class="t-sub" style="margin-top:10px;max-width:52ch">' +
              'Busca por nombre, oficio, etiqueta o ciudad.</p>' +

            '<div class="search" style="margin-top:24px">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                'stroke-linecap="round" aria-hidden="true">' +
                '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
              '<input id="dQ" type="search" placeholder="@usuario, gaming, Medellín…" ' +
                'value="' + esc(state.q) + '" aria-label="Buscar perfiles" autocomplete="off">' +
            '</div>' +

            '<div class="chips" role="tablist" aria-label="Filtros">' +
              FILTERS.map(function (f) {
                return '<button type="button" role="tab" class="chip' +
                  (f.id === state.filter ? ' on' : '') + '" data-f="' + f.id + '" ' +
                  'aria-selected="' + (f.id === state.filter) + '">' + esc(f.name) + '</button>';
              }).join('') +
            '</div>' +

            '<p class="t-meta" id="dCount" style="margin-top:18px"></p>' +
          '</header>' +

          '<div class="grid-p" id="dGrid"></div>' +
        '</div>';

      V.discover.paint(mount);

      var input = mount.querySelector('#dQ');
      var timer = 0;
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.q = input.value;
          V.discover.paint(mount);
        }, 160);
      });

      mount.querySelectorAll('.chip').forEach(function (c) {
        c.addEventListener('click', function () {
          state.filter = c.getAttribute('data-f');
          mount.querySelectorAll('.chip').forEach(function (x) {
            var on = x === c;
            x.classList.toggle('on', on);
            x.setAttribute('aria-selected', String(on));
          });
          V.discover.paint(mount);
        });
      });
    }
  };
})();
