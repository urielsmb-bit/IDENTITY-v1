/* ============================================================
   IDENTITY — analytics
   Gráficas dibujadas a mano en canvas: sin librerías, sin peso.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc, num = ID.util.num, full = ID.util.full;

  var state = { user: null, days: 30 };

  /* ---- gráfica de área ------------------------------------------- */
  function drawChart(canvas, series) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = canvas.clientWidth || 600;
    var H = 220;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var padL = 42, padR = 8, padT = 14, padB = 26;
    var cw = W - padL - padR, ch = H - padT - padB;
    var max = Math.max.apply(null, series.map(function (d) { return d.v; })) * 1.12;
    var min = 0;

    var css = getComputedStyle(document.documentElement);
    var accent = css.getPropertyValue('--accent').trim() || '#fff';
    var muted = css.getPropertyValue('--text-muted').trim() || '#6B6B6B';
    var line = 'rgba(255,255,255,.07)';

    function X(i) { return padL + (i / Math.max(1, series.length - 1)) * cw; }
    function Y(v) { return padT + ch - ((v - min) / (max - min)) * ch; }

    /* rejilla horizontal + etiquetas del eje */
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (var g = 0; g <= 3; g++) {
      var val = min + (max - min) * (g / 3);
      var y = Y(val);
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(W - padR, y);
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.fillText(num(Math.round(val)), padL - 9, y);
    }

    /* área bajo la curva */
    var grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
    grad.addColorStop(0, hexA(accent, .22));
    grad.addColorStop(1, hexA(accent, 0));
    ctx.beginPath();
    ctx.moveTo(X(0), Y(series[0].v));
    for (var i = 1; i < series.length; i++) ctx.lineTo(X(i), Y(series[i].v));
    ctx.lineTo(X(series.length - 1), padT + ch);
    ctx.lineTo(X(0), padT + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* línea */
    ctx.beginPath();
    ctx.moveTo(X(0), Y(series[0].v));
    for (i = 1; i < series.length; i++) ctx.lineTo(X(i), Y(series[i].v));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* punto final */
    var lx = X(series.length - 1), ly = Y(series[series.length - 1].v);
    ctx.beginPath(); ctx.arc(lx, ly, 3.6, 0, 6.283);
    ctx.fillStyle = accent; ctx.fill();
    ctx.beginPath(); ctx.arc(lx, ly, 7.5, 0, 6.283);
    ctx.strokeStyle = hexA(accent, .3); ctx.lineWidth = 1.4; ctx.stroke();

    /* fechas: primera, media y última */
    ctx.textAlign = 'center';
    ctx.fillStyle = muted;
    [0, Math.floor(series.length / 2), series.length - 1].forEach(function (idx) {
      var d = series[idx].date;
      ctx.fillText(d.getDate() + '/' + (d.getMonth() + 1), X(idx), padT + ch + 14);
    });
  }

  function hexA(hex, a) {
    hex = String(hex || '#FFFFFF').trim().replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    if (isNaN(n)) return 'rgba(255,255,255,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function paint(mount) {
    var p = ID.store.get(state.user);
    if (!p) return;
    var a = ID.store.analytics(p.username, state.days);
    var real = ID.app.clicksFor(p.username);

    var body = mount.querySelector('#anBody');
    var maxClick = Math.max.apply(null, a.clicks.map(function (c) { return c.n; }).concat([1]));

    body.innerHTML =
      '<div class="stats-row">' +
        stat('Visitas totales', full(a.total), '', '') +
        stat('Tendencia', (a.trend >= 0 ? '+' : '') + a.trend + '%',
          state.days + ' días', a.trend >= 0 ? 'up' : 'down') +
        stat('Mejor día', full(a.peak.v),
          a.peak.date.getDate() + '/' + (a.peak.date.getMonth() + 1), '') +
        stat('En el periodo', full(a.medidas), state.days + ' días', '') +
      '</div>' +

      '<div class="panel" style="margin-top:12px">' +
        '<div class="panel__h">' +
          '<span class="panel__t">Visitas</span>' +
          '<span class="seg">' +
            [7, 30, 90].map(function (d) {
              return '<button type="button" data-days="' + d + '"' +
                (d === state.days ? ' class="on"' : '') + '>' + d + 'd</button>';
            }).join('') +
          '</span>' +
        '</div>' +
        '<canvas class="chart" id="anChart"></canvas>' +
      '</div>' +

      '<div class="split">' +
        '<div class="panel">' +
          '<div class="panel__h"><span class="panel__t">Enlaces más clicados</span></div>' +
          '<div class="barlist">' +
            (a.clicks.length ? a.clicks.map(function (c) {
              var extra = real[c.net] ? ' · ' + real[c.net] + ' reales' : '';
              return row(c.label, full(c.n) + extra, c.n / maxClick * 100, '');
            }).join('') : '<p class="t-meta">Aún no hay redes enlazadas.</p>') +
          '</div>' +
        '</div>' +

        '<div class="panel">' +
          '<div class="panel__h"><span class="panel__t">Todavía no se puede medir</span></div>' +
          '<div class="barlist">' +
            ['País del visitante', 'De dónde llega', 'Dispositivo', 'Tiempo de permanencia']
              .map(function (t) { return row(t, '—', 0, 'alt'); }).join('') +
          '</div>' +
          '<p class="t-meta" style="margin:12px 0 0">Los cuatro necesitan un servidor que reciba ' +
            'la visita. Aquí sólo llega lo que pasa por tu propio navegador.</p>' +
        '</div>' +
      '</div>' +

      '<div class="note">' +
        '<b>Todo lo de arriba está medido.</b> Las visitas se cuentan una por perfil, día y ' +
        'navegador; la gráfica son esas mismas visitas día a día; los clics se cuentan al pulsar. ' +
        'Ningún número está estimado ni rellenado: lo que no se puede medir sin servidor aparece ' +
        'vacío en vez de inventado.' +
      '</div>';

    drawChart(mount.querySelector('#anChart'), a.series);

    body.querySelectorAll('[data-days]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.days = Number(b.getAttribute('data-days'));
        paint(mount);
      });
    });
  }

  function stat(label, n, d, cls) {
    return '<div class="stat"><div class="stat__l">' + esc(label) + '</div>' +
      '<div class="stat__n">' + esc(n) + '</div>' +
      (d ? '<div class="stat__d ' + cls + '">' + esc(d) + '</div>' : '') + '</div>';
  }
  function row(label, val, pct, cls) {
    return '<div class="barlist__row">' +
      '<span class="barlist__t">' + esc(label) + '</span>' +
      '<span class="barlist__v">' + esc(val) + '</span>' +
      '<span class="barlist__bar ' + cls + '"><i style="width:' + Math.max(2, pct) + '%"></i></span>' +
      '</div>';
  }

  V.analytics = {
    route: function (mount, params) {
      state.user = params.u || ID.store.mineName() || 'uriel';
      var p = ID.store.get(state.user);

      if (!p) {
        mount.innerHTML = '<div class="page rise"><h1 class="t-h1">Sin datos todavía</h1>' +
          '<p class="t-sub" style="margin-top:10px">Crea tu perfil y vuelve.</p>' +
          '<div style="margin-top:22px"><a class="btn btn--primary" href="#/dashboard">Ir al panel</a></div></div>';
        return;
      }

      var others = ID.store.list().filter(function (x) { return x.discoverable !== false; });

      mount.innerHTML =
        '<div class="page rise">' +
          '<header class="page__head">' +
            '<p class="t-label">Analytics</p>' +
            '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:10px">' +
              '<h1 class="t-h1">@' + esc(p.username) + '</h1>' +
              '<select class="sel" id="anUser" style="width:auto;min-width:170px">' +
                others.map(function (x) {
                  return '<option value="' + esc(x.username) + '"' +
                    (x.username === state.user ? ' selected' : '') + '>@' + esc(x.username) + '</option>';
                }).join('') +
              '</select>' +
              '<a class="btn btn--ghost btn--sm" href="#/u/' + esc(p.username) + '">Ver perfil</a>' +
            '</div>' +
          '</header>' +
          '<div id="anBody"></div>' +
        '</div>';

      paint(mount);

      mount.querySelector('#anUser').addEventListener('change', function (e) {
        state.user = e.target.value;
        location.hash = '#/analytics?u=' + encodeURIComponent(state.user);
      });

      var onResize = function () {
        var c = mount.querySelector('#anChart');
        if (c) drawChart(c, ID.store.analytics(state.user, state.days).series);
      };
      window.addEventListener('resize', onResize);
      ID.fx.register(function () { window.removeEventListener('resize', onResize); });
    }
  };
})();
