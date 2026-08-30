/* ============================================================
   IDENTITY — plantillas
   Una plantilla es un preajuste de apariencia: no toca tu
   identidad ni tus enlaces, sólo cómo se ve todo.
   Aplicarla es reversible, y por eso la gente experimenta.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc, num = ID.util.num;

  var K_FAV = 'identity.favs.v1';
  var K_MINE = 'identity.mytpl.v1';

  /* ---- catalogo -------------------------------------------------
     VACIO A PROPOSITO. Aqui habia 13 plantillas con autor, numero de
     usos y estrellas inventados (@ana, 183.051 usos, 17.138
     estrellas). Ninguna persona las habia hecho ni usado.

     Las plantillas oficiales van aqui, en este mismo formato:

       { id:'…', name:'…', author:'@…', tags:['…'],
         config:{ theme, preset, accent, font, particles, … } }

     `config` acepta cualquier campo del perfil salvo identidad y
     contenido: una plantilla cambia como se ve, no quien eres.

     Las de la comunidad no se escriben aqui: llegan de
     identity.mytpl.v1 cuando alguien publica la suya.
     ---------------------------------------------------------------- */
  var SEED = [];

  var SORTS = [
    { id: 'trending', name: 'Tendencia' },
    { id: 'uses',     name: 'Más usadas' },
    { id: 'stars',    name: 'Mejor valoradas' },
    { id: 'new',      name: 'Nuevas' }
  ];

  var state = { sort: 'trending', q: '', tab: 'all' };

  function favs() { return ID.util.read(K_FAV, {}); }
  function isFav(id) { return !!favs()[id]; }
  function toggleFav(id) {
    var f = favs();
    if (f[id]) delete f[id]; else f[id] = 1;
    ID.util.write(K_FAV, f);
    return !!f[id];
  }

  function mine() { return ID.util.read(K_MINE, []); }

  function all() { return SEED.concat(mine()); }

  /* perfil de muestra al que se le aplica la plantilla para la miniatura */
  function sample(cfg) {
    /* Antes tomaba de base el perfil semilla '@uriel'. Al quitar los
       perfiles inventados esa base desaparecio y las miniaturas se
       quedaron en negro. Ahora parte del perfil de quien mira, y
       solo rellena lo que le falte. */
    var mio = ID.store.mine ? ID.store.mine() : null;
    var p = Object.assign(ID.store.muestra(mio), cfg);
    p.gate = false;
    p.cursor = 'default';   /* la miniatura no secuestra el puntero */
    p.tilt = false;
    p.showRate = false;
    return p;
  }

  function filtrar() {
    var list = state.tab === 'fav'
      ? all().filter(function (t) { return isFav(t.id); })
      : state.tab === 'mine' ? mine() : all();

    var q = state.q.trim().toLowerCase();
    if (q) {
      list = list.filter(function (t) {
        return t.name.toLowerCase().indexOf(q) !== -1 ||
               t.author.toLowerCase().indexOf(q) !== -1 ||
               t.tags.join(' ').indexOf(q) !== -1;
      });
    }

    var sorters = {
      uses:  function (a, b) { return b.uses - a.uses; },
      stars: function (a, b) { return b.stars - a.stars; },
      new:   function (a, b) { return (b.created || 0) - (a.created || 0); },
      trending: function (a, b) { return (b.stars / Math.max(1, b.uses)) - (a.stars / Math.max(1, a.uses)); }
    };
    return list.slice().sort(sorters[state.sort] || sorters.trending);
  }

  function card(t) {
    return '<article class="tpl" data-tpl="' + esc(t.id) + '">' +
      '<div class="tpl__pre" data-pre="' + esc(t.id) + '"></div>' +
      '<button class="tpl__fav' + (isFav(t.id) ? ' on' : '') + '" type="button" ' +
        'data-fav="' + esc(t.id) + '" aria-label="Guardar en favoritas">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linejoin="round"><path d="m12 3.6 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 17.4 6.7 20.3l1.1-6.1L3.4 10l6-.8z"/></svg>' +
      '</button>' +
      '<div class="tpl__b">' +
        '<div class="tpl__id">' +
          '<span class="tpl__n">' + esc(t.name) + '</span>' +
          '<span class="tpl__a">' + esc(t.author) + '</span>' +
        '</div>' +
        '<div class="tpl__meta">' +
          '<span title="Usos">' + num(t.uses) + ' usos</span>' +
          '<span title="Favoritas">' + num(t.stars) + ' ★</span>' +
        '</div>' +
        '<div class="tpl__tags">' +
          t.tags.slice(0, 3).map(function (x) {
            return '<span class="tpl__tag">' + esc(x) + '</span>';
          }).join('') +
        '</div>' +
        '<div class="tpl__acts">' +
          '<button class="btn btn--primary btn--sm" type="button" data-use="' + esc(t.id) + '">Usar plantilla</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-view="' + esc(t.id) + '" ' +
            'aria-label="Previsualizar">Ver</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function pintar(mount) {
    var list = filtrar();
    var grid = mount.querySelector('#tplGrid');
    var cuenta = mount.querySelector('#tplCount');
    if (cuenta) cuenta.textContent = list.length + (list.length === 1 ? ' plantilla' : ' plantillas');

    grid.innerHTML = list.length
      ? list.map(card).join('')
      : '<div class="empty">' +
        (state.tab === 'mine'
          ? 'Todavía no has publicado ninguna plantilla.<br>Crea una desde tu perfil actual.'
          : state.tab === 'fav'
            ? 'No has guardado ninguna favorita todavía.'
            : all().length
              ? 'Ninguna plantilla coincide con esa búsqueda.'
              : 'Todavía no hay plantillas publicadas.<br>' +
                'Ajusta tu perfil como quieras y publica la primera.<br>' +
                '<a class="btn btn--primary" style="margin-top:16px" href="#/dashboard">' +
                'Ir al panel</a>') +
        '</div>';

    /* miniaturas: cada una es un perfil real renderizado y escalado */
    ID.fx.clear();
    list.forEach(function (t) {
      var slot = grid.querySelector('[data-pre="' + t.id + '"]');
      if (!slot) return;
      var p = sample(t.config);
      slot.innerHTML = '<div class="tpl__scale">' +
        ID.views.profile.render(p, { preview: true }) + '</div>';
      ID.views.profile.mount(slot, p, { preview: true });
    });

    enlazar(mount, grid);
  }

  function enlazar(mount, grid) {
    grid.querySelectorAll('[data-fav]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        b.classList.toggle('on', toggleFav(b.getAttribute('data-fav')));
      });
    });

    grid.querySelectorAll('[data-use]').forEach(function (b) {
      b.addEventListener('click', function () { usar(b.getAttribute('data-use')); });
    });

    grid.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { previsualizar(mount, b.getAttribute('data-view')); });
    });
  }

  /* aplicar: sólo apariencia, nunca identidad ni enlaces */
  function usar(id) {
    var t = all().filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var p = ID.store.mine();
    Object.keys(t.config).forEach(function (k) { p[k] = t.config[k]; });

    var nombre = p.username || '__draft__';
    ID.store.saveRaw(nombre, p);
    ID.store.setMine(nombre);
    ID.app.toast('Plantilla "' + t.name + '" aplicada');
    location.hash = '#/dashboard?sec=appearance';
  }

  function previsualizar(mount, id) {
    var t = all().filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var p = sample(t.config);
    p.tilt = true;

    var modal = document.createElement('div');
    modal.className = 'tplmodal';
    modal.innerHTML =
      '<div class="tplmodal__box" role="dialog" aria-modal="true" aria-label="Vista previa">' +
        '<header class="tplmodal__bar">' +
          '<div><b>' + esc(t.name) + '</b> <span>' + esc(t.author) + '</span></div>' +
          '<button class="btn btn--primary btn--sm" type="button" id="tmUse">Usar plantilla</button>' +
          '<button class="row-it__x" type="button" id="tmClose" aria-label="Cerrar">×</button>' +
        '</header>' +
        '<div class="tplmodal__view" id="tmView"></div>' +
      '</div>';
    document.body.appendChild(modal);

    var view = modal.querySelector('#tmView');
    view.innerHTML = ID.views.profile.render(p, { preview: true });
    ID.views.profile.mount(view, p, { preview: true });

    function cerrar() {
      modal.remove();
      document.removeEventListener('keydown', esc2);
    }
    function esc2(e) { if (e.key === 'Escape') cerrar(); }

    modal.querySelector('#tmClose').addEventListener('click', cerrar);
    modal.querySelector('#tmUse').addEventListener('click', function () { cerrar(); usar(id); });
    modal.addEventListener('click', function (e) { if (e.target === modal) cerrar(); });
    document.addEventListener('keydown', esc2);
  }

  /* ---- que viaja dentro de una plantilla ------------------------
     Lista NEGRA, no blanca. La lista blanca que habia aqui se quedo
     obsoleta en cuanto el perfil crecio: no incluia la tipografia de
     titulos, el peso ni la caja del nombre, el orden de los bloques,
     sus posiciones, el color por pieza ni el estilo de cada una. Una
     plantilla publicada con aquella lista perdia justo lo que hace
     unico a un perfil.

     Enumerar lo que NO puede viajar es una lista corta y estable:
     quien eres y lo que has escrito. Todo lo demas es apariencia, y
     cualquier campo nuevo entra solo.
     ---------------------------------------------------------------- */
  var NO_VIAJA = [
    /* identidad */
    'username', 'name', 'title', 'location', 'pronouns', 'age', 'emoji', 'avatarUrl',
    /* contenido */
    'bio', 'about', 'socials', 'links', 'projects', 'gallery', 'live', 'fields',
    'audio', 'status',
    /* metricas y estado de la cuenta */
    'badges', 'tags', 'views', 'likes', 'level', 'xp', 'xpMax', 'ratings', 'joined',
    'verified', 'premium', 'discoverable',
    /* interno */
    'v'
  ];

  function configDe(p) {
    var cfg = {};
    Object.keys(p).forEach(function (k) {
      if (NO_VIAJA.indexOf(k) === -1) cfg[k] = p[k];
    });
    /* bcontent lleva la ESTRUCTURA de las copias (que redes ensena
       cada grupo) pero no las palabras: una plantilla no te escribe
       la bio. */
    if (cfg.bcontent) {
      var limpio = {};
      Object.keys(cfg.bcontent).forEach(function (id) {
        var c = Object.assign({}, cfg.bcontent[id]);
        delete c.text;
        if (Object.keys(c).length) limpio[id] = c;
      });
      cfg.bcontent = limpio;
    }
    try { return JSON.parse(JSON.stringify(cfg)); } catch (e) { return cfg; }
  }

  /* ---- guardar la apariencia actual como plantilla --------------- */
  function publicar(mount) {
    var p = ID.store.mine();
    if (!p.username) { ID.app.toast('Elige un nombre de usuario primero', true); return; }

    var modal = document.createElement('div');
    modal.className = 'tplmodal';
    modal.innerHTML =
      '<div class="tplmodal__box tplmodal__box--form" role="dialog" aria-modal="true" ' +
        'aria-label="Guardar como plantilla">' +
        '<header class="tplmodal__bar">' +
          '<div><b>Guardar como plantilla</b></div>' +
          '<button class="row-it__x" type="button" id="tnClose" aria-label="Cerrar">\u00d7</button>' +
        '</header>' +
        '<div class="tplform">' +
          '<div class="tplform__pre" id="tnPre"></div>' +
          '<div class="tplform__f">' +
            '<label class="f__l" for="tnName"><span>Nombre</span></label>' +
            '<input class="inp" id="tnName" maxlength="40" autocomplete="off" ' +
              'placeholder="Como se llama tu estilo" value="' +
              esc((p.name && p.name !== 'Tu nombre' ? p.name : 'Mi') + ' style') + '">' +
            '<label class="f__l" for="tnTags" style="margin-top:14px"><span>Etiquetas</span>' +
              '<em>separadas por comas</em></label>' +
            '<input class="inp" id="tnTags" maxlength="60" autocomplete="off" ' +
              'placeholder="oscuro, minimal, gaming">' +
            '<p class="t-meta" style="margin:14px 0 0">Viaja <b>como se ve</b>: tema, ' +
              'tipografia, colores, fondo, efectos, el orden de los bloques y el estilo de ' +
              'cada pieza. <b>No viaja</b> tu nombre, tu bio, tus enlaces ni tus metricas.</p>' +
            '<div class="tplform__acts">' +
              '<button class="btn btn--primary" type="button" id="tnSave">Guardar</button>' +
              '<button class="btn btn--ghost" type="button" id="tnCancel">Cancelar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    /* se ve lo que se va a guardar, en vez de nombrarlo a ciegas */
    var demo = sample(configDe(p));
    modal.querySelector('#tnPre').innerHTML =
      '<div class="tpl__scale">' + ID.views.profile.render(demo, { preview: true }) + '</div>';

    function cerrar() {
      modal.remove();
      document.removeEventListener('keydown', porTecla);
    }
    function porTecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', porTecla);
    modal.querySelector('#tnClose').addEventListener('click', cerrar);
    modal.querySelector('#tnCancel').addEventListener('click', cerrar);
    modal.addEventListener('click', function (e) { if (e.target === modal) cerrar(); });

    var campo = modal.querySelector('#tnName');
    campo.focus(); campo.select();

    modal.querySelector('#tnSave').addEventListener('click', function () {
      var nombre = campo.value.trim();
      if (!nombre) { campo.focus(); return; }
      var etiquetas = modal.querySelector('#tnTags').value
        .split(',').map(function (x) { return x.trim().toLowerCase(); })
        .filter(Boolean).slice(0, 3);

      var lista = mine();
      lista.push({
        id: 'mia-' + Date.now(),
        name: nombre.slice(0, 40),
        author: '@' + p.username,
        uses: 0, stars: 0, created: Date.now(),
        tags: etiquetas,
        config: configDe(p),
        own: true
      });
      /* el guardado puede fallar de verdad; no se dice que si a ciegas */
      if (!ID.util.write(K_MINE, lista)) {
        ID.app.toast((ID.util.ultimoError || {}).message || 'No se pudo guardar', true);
        return;
      }
      cerrar();
      ID.app.toast('Plantilla guardada');
      state.tab = 'mine';
      V.templates.route(mount, {});
    });
  }

  V.templates = {
    route: function (mount, params) {
      var tabs = [
        { id: 'all',  name: 'Biblioteca' },
        { id: 'fav',  name: 'Favoritas' },
        { id: 'mine', name: 'Mis plantillas' }
      ];

      mount.innerHTML =
        '<div class="page rise">' +
          '<header class="page__head">' +
            '<div class="tpl__top">' +
              '<div>' +
                '<p class="t-label">Plantillas</p>' +
                '<h1 class="t-h1" style="margin-top:10px">Empieza por una que ya funciona</h1>' +
                '<p class="t-sub" style="margin-top:10px;max-width:54ch">' +
                  'Una plantilla cambia el aspecto, no tu contenido. ' +
                  'Tus enlaces y tu nombre siguen intactos.</p>' +
              '</div>' +
              '<button class="btn btn--ghost" type="button" id="tplNew">Publicar la mía</button>' +
            '</div>' +

            '<div class="chips" style="margin-top:24px" role="tablist">' +
              tabs.map(function (t) {
                return '<button type="button" role="tab" class="chip' +
                  (t.id === state.tab ? ' on' : '') + '" data-tab="' + t.id + '" ' +
                  'aria-selected="' + (t.id === state.tab) + '">' + esc(t.name) + '</button>';
              }).join('') +
            '</div>' +

            '<div class="tpl__bar">' +
              '<div class="search">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                  'stroke-linecap="round" aria-hidden="true">' +
                  '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
                '<input id="tplQ" type="search" placeholder="Explora las plantillas de la comunidad" ' +
                  'value="' + esc(state.q) + '" aria-label="Buscar plantillas" autocomplete="off">' +
              '</div>' +
              '<select class="sel" id="tplSort" style="width:auto;min-width:170px">' +
                SORTS.map(function (o) {
                  return '<option value="' + o.id + '"' +
                    (o.id === state.sort ? ' selected' : '') + '>' + esc(o.name) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<p class="t-meta" id="tplCount" style="margin-top:14px"></p>' +
          '</header>' +

          '<div class="tplgrid" id="tplGrid"></div>' +
        '</div>';

      pintar(mount);

      var q = mount.querySelector('#tplQ'), timer = 0;
      q.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { state.q = q.value; pintar(mount); }, 160);
      });

      mount.querySelector('#tplSort').addEventListener('change', function (e) {
        state.sort = e.target.value;
        pintar(mount);
      });

      mount.querySelectorAll('[data-tab]').forEach(function (c) {
        c.addEventListener('click', function () {
          state.tab = c.getAttribute('data-tab');
          mount.querySelectorAll('[data-tab]').forEach(function (x) {
            var on = x === c;
            x.classList.toggle('on', on);
            x.setAttribute('aria-selected', String(on));
          });
          pintar(mount);
        });
      });

      mount.querySelector('#tplNew').addEventListener('click', function () { publicar(mount); });

      /* #/templates?nueva=1 abre el formulario directo: es el enlace
         que sale del editor, donde de verdad se diseña */
      if (params && params.nueva) setTimeout(function () { publicar(mount); }, 60);
    }
  };
})();
