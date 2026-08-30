/* ============================================================
   IDENTITY — enrutador
   Basado en hash para que funcione en cualquier hosting estático
   e incluso abriendo el archivo directamente. Con una regla de
   reescritura en el servidor, /uriel entra como #/u/uriel.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;

  /* `cargar` se cumple ANTES de pintar. Solo lo tienen las rutas
     que necesitan datos que no estan en memoria; las demas pintan
     al instante como siempre. Sin backend configurado no se llama
     a ninguna: todo esta ya en este navegador. */
  var ROUTES = [
    { re: /^\/?$/,                    name: 'home',      view: function () { return ID.views.landing; } },
    { re: /^\/u\/([\w-]+)$/,          name: 'profile',   view: function () { return ID.views.profile; },
      keys: ['username'],
      cargar: function (p) { return ID.store.hidratar(p.username); } },
    { re: /^\/entrar$/,               name: 'auth',      view: function () { return ID.views.auth; } },
    /* Los tres documentos legales. Antes /terminos no existia como
       ruta y caia en la de perfil, que ofrecia "Reclamar @terminos":
       el alta te pedia aceptar algo que no podias leer. */
    { re: /^\/(terminos|privacidad|copyright)$/, name: 'legal',
      view: function () { return ID.views.legal; }, keys: ['doc'] },
    { re: /^\/dashboard$/,            name: 'dashboard', view: function () { return ID.views.dashboard; },
      /* Sin sesion NO se echa a nadie: se entra al editor igual y
         se trabaja en borrador, guardado en este navegador. La
         cuenta se pide cuando quieras que el perfil exista para los
         demas, no en la puerta. */
      cargar: function () { return ID.store.hidratarMio(); } },
    { re: /^\/discover$/,             name: 'discover',  view: function () { return ID.views.discover; },
      cargar: function () { return ID.store.hidratarDescubrir({ limite: 40 }); } },
    { re: /^\/top$/,                  name: 'top',       view: function () { return ID.views.leaderboard; },
      cargar: function () { return ID.store.hidratarDescubrir({ limite: 60 }); } },
    { re: /^\/analytics$/,            name: 'analytics', view: function () { return ID.views.analytics; } },
    { re: /^\/ai$/,                   name: 'ai',        view: function () { return ID.views.ai; } },
    { re: /^\/templates$/,            name: 'templates', view: function () { return ID.views.templates; } },
    { re: /^\/pricing$/,              name: 'pricing',   view: function () { return ID.views.pricing; } }
  ];

  /* rutas reservadas: no pueden ser nombres de usuario */
  var RESERVED = ['dashboard', 'discover', 'top', 'analytics', 'ai', 'pricing', 'templates',
    'entrar', 'salir', 'terminos', 'privacidad', 'copyright',
    'u', 'api', 'admin', 'login', 'signup', 'settings', 'help', 'about'];

  /* quien tiene la vez para pintar */
  var turno = 0;

  var ESQUELETO =
    '<div class="cargando" role="status" aria-live="polite">' +
      '<span class="cargando__giro" aria-hidden="true"></span>' +
      '<span class="cargando__txt">Cargando\u2026</span>' +
    '</div>';

  var router = ID.router = {
    RESERVED: RESERVED,
    current: null,

    parse: function () {
      var h = location.hash.replace(/^#/, '') || '/';
      var qi = h.indexOf('?');
      var path = qi === -1 ? h : h.slice(0, qi);
      var query = qi === -1 ? '' : h.slice(qi + 1);

      var params = {};
      if (query) {
        query.split('&').forEach(function (pair) {
          if (!pair) return;
          var kv = pair.split('=');
          params[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
        });
      }

      for (var i = 0; i < ROUTES.length; i++) {
        var m = path.match(ROUTES[i].re);
        if (m) {
          (ROUTES[i].keys || []).forEach(function (k, j) { params[k] = m[j + 1]; });
          return { route: ROUTES[i], path: path, params: params };
        }
      }
      /* atajo: #/uriel también abre el perfil */
      var short = path.match(/^\/([\w-]+)$/);
      if (short && RESERVED.indexOf(short[1]) === -1) {
        params.username = short[1];
        return { route: ROUTES[1], path: path, params: params };
      }
      return { route: ROUTES[1], path: path, params: { username: path.replace(/^\//, '') } };
    },

    go: function (path) {
      if (location.hash === '#' + path) router.render();
      else location.hash = path;
    },

    reload: function () { router.render(); },

    /* ---- traer y luego pintar --------------------------------
       El numero de turno evita el fallo clasico de esto: si navegas
       rapido de un perfil a otro, la primera peticion puede llegar
       DESPUES de la segunda y pintar el perfil equivocado encima
       del bueno. Solo pinta quien sigue teniendo el ultimo turno.
       ---------------------------------------------------------- */
    render: function () {
      var hit = router.parse();
      var mount = document.getElementById('view');
      var mio = ++turno;

      /* `hayNube` y no `enLinea`: para LEER un perfil publico no
         hace falta sesion, y con enLinea() el router no esperaba
         a traerlo para quien no habia entrado. */
      if (!hit.route.cargar || !ID.store || !ID.store.hayNube()) {
        router.pintar(hit, mount);
        return;
      }

      /* El esqueleto solo aparece si la espera se nota. Enseñarlo
         siempre haria un parpadeo feo en cada navegacion rapida. */
      var lento = setTimeout(function () {
        if (mio === turno) mount.innerHTML = ESQUELETO;
      }, 180);

      hit.route.cargar(hit.params).catch(function (e) {
        /* Que no se pueda traer no es motivo para no pintar: la
           vista ya sabe decir "este perfil no existe", y con el
           espejo puede que hasta lo tenga. */
        console.warn('[router] no se pudo cargar', e && e.message);
      }).then(function () {
        clearTimeout(lento);
        if (mio !== turno) return;      /* llego tarde: manda otra ruta */
        router.pintar(hit, mount);
      });
    },

    pintar: function (hit, mount) {
      /* toda vista anterior deja de consumir CPU antes de la nueva */
      ID.fx.clear();
      if (ID.views.dashboard && ID.views.dashboard.limpiar) ID.views.dashboard.limpiar();
      document.body.classList.remove('is-profile', 'is-dashboard');
      document.body.className = document.body.className.trim();

      var view = hit.route.view();
      if (!view || typeof view.route !== 'function') {
        mount.innerHTML = '<div class="page"><h1 class="t-h1">Vista no disponible</h1></div>';
        return;
      }

      router.current = hit.route.name;
      mount.innerHTML = '';
      view.route(mount, hit.params);

      /* estado activo en la navegación */
      var links = document.querySelectorAll('.nav__links a');
      Array.prototype.forEach.call(links, function (a) {
        a.classList.toggle('on', a.getAttribute('data-route') === hit.route.name);
      });

      /* el foco vuelve arriba en cada navegación (accesibilidad) */
      if (!hit.params._noscroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      mount.focus({ preventScroll: true });

      if (hit.route.name !== 'profile') {
        ID.app.meta({
          title: 'IDENTITY — Tu identidad, en línea.',
          description: 'Crea un perfil que se sienta como tú. No una lista de enlaces: un sitio.',
          type: 'website'
        });
      }
    },

    start: function () {
      /* /uriel servido por un rewrite entra como perfil */
      var seg = location.pathname.split('/').filter(Boolean).pop();
      if (!location.hash && seg && /^[\w-]+$/.test(seg) &&
          seg.indexOf('.') === -1 && RESERVED.indexOf(seg) === -1) {
        location.replace('#/u/' + seg);
      }
      window.addEventListener('hashchange', router.render);
      router.render();
    }
  };
})();
