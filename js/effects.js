/* ============================================================
   IDENTITY — efectos
   Partículas en canvas, inclinación 3D y cursores.
   Todo devuelve una función de limpieza: el router la llama al
   cambiar de vista para que nada quede corriendo de fondo.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var fx = ID.fx = { _cleanups: [] };

  fx.register = function (fn) { if (fn) fx._cleanups.push(fn); return fn; };

  /* ============================================================
     PRESUPUESTO DE MOVIMIENTO
     Un perfil no puede quemar la GPU de quien lo mira. Antes de
     encender nada se decide cuanto movimiento aguanta el equipo, y
     los efectos se degradan solos en vez de ir a tirones.

     La medida no es una lista de dispositivos: es lo que el propio
     navegador cuenta de si mismo mas los fotogramas reales del
     primer segundo.
     ============================================================ */
  var equipo = (function () {
    var nav = navigator || {};
    var nucleos = nav.hardwareConcurrency || 4;
    var memoria = nav.deviceMemory || 4;
    var lento = (window.matchMedia && window.matchMedia('(update: slow)').matches) ||
                nucleos <= 2 || memoria <= 2;
    return {
      nucleos: nucleos, memoria: memoria,
      /* 2 = todo, 1 = lo esencial, 0 = quieto */
      nivel: reduce ? 0 : (lento ? 1 : 2),
      medido: false
    };
  })();

  fx.equipo = equipo;
  fx.puede = function (coste) { return equipo.nivel >= (coste || 1); };

  /* ---- un solo reloj para todo -------------------------------
     Siete bucles independientes eran siete despertadores. Uno solo
     se puede parar, medir y repartir. */
  /* se arranca leyendo el estado REAL, no suponiendo que la pestaña
     esta delante: si la pagina carga en una pestaña de fondo,
     requestAnimationFrame no dispara nunca y con la suposicion
     equivocada las animaciones no arrancarian jamas al volver. */
  var oyentes = [], latido = 0, pendientes = [];
  var oculto = typeof document.hidden === 'boolean' ? document.hidden : false;
  var t0 = 0, cuadros = 0;

  function tic(ahora) {
    latido = 0;
    if (oculto) return;

    /* medicion del primer segundo: si el equipo no llega, baja el
       nivel y los efectos caros se apagan solos */
    if (!equipo.medido) {
      if (!t0) t0 = ahora;
      cuadros++;
      if (ahora - t0 > 1000) {
        var fps = cuadros * 1000 / (ahora - t0);
        if (fps < 45 && equipo.nivel > 1) equipo.nivel = 1;
        if (fps < 25) equipo.nivel = 0;
        equipo.fps = Math.round(fps);
        equipo.medido = true;
      }
    }

    for (var i = oyentes.length - 1; i >= 0; i--) {
      try { oyentes[i](ahora); } catch (e) { oyentes.splice(i, 1); }
    }
    if (oyentes.length) latido = requestAnimationFrame(tic);
  }

  /* Suscribe una funcion al reloj comun. Devuelve como bajarse. */
  fx.ticker = function (fn) {
    if (!fn) return function () {};
    oyentes.push(fn);
    if (!latido && !oculto) latido = requestAnimationFrame(tic);
    return function () {
      var i = oyentes.indexOf(fn);
      if (i > -1) oyentes.splice(i, 1);
      if (!oyentes.length && latido) { cancelAnimationFrame(latido); latido = 0; }
    };
  };

  /* requestAnimationFrame que NO gasta fotogramas con la pestana
     oculta: guarda la llamada y la suelta al volver. Los bucles que
     ya existian solo cambian de puerta. */
  fx.raf = function (fn) {
    if (oculto) { pendientes.push(fn); return 0; }
    return requestAnimationFrame(fn);
  };

  document.addEventListener('visibilitychange', function () {
    oculto = document.hidden;
    if (oculto) {
      if (latido) { cancelAnimationFrame(latido); latido = 0; }
    } else {
      var cola = pendientes; pendientes = [];
      cola.forEach(function (fn) { requestAnimationFrame(fn); });
      if (oyentes.length && !latido) latido = requestAnimationFrame(tic);
    }
  });

  fx.clear = function () {
    for (var i = 0; i < fx._cleanups.length; i++) {
      try { fx._cleanups[i](); } catch (e) { /* una limpieza rota no debe frenar las demás */ }
    }
    fx._cleanups = [];
  };

  /* ---- partículas ------------------------------------------ */
  fx.particles = function (canvas, type, color, opts) {
    if (!canvas || !type || type === 'none') return null;
    opts = opts || {};

    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], raf = 0, t = 0, alive = true;

    function resize() {
      var r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function count() {
      var area = W * H;
      var n = Math.round(area / (opts.light ? 26000 : 14000));
      var cap = opts.light ? 44 : (type === 'matrix' ? 90 : 130);
      return Math.max(8, Math.min(cap, n));
    }

    function build() {
      parts = [];
      var n = count(), i;
      for (i = 0; i < n; i++) parts.push(spawn(true));
    }

    function spawn(anywhere) {
      var p = { x: Math.random() * W, y: anywhere ? Math.random() * H : -10 };
      switch (type) {
        case 'stars':
          p.r = Math.random() * 1.5 + 0.4;
          p.a = Math.random() * 0.7 + 0.15;
          p.tw = Math.random() * 0.04 + 0.008;
          p.vx = (Math.random() - 0.5) * 0.08;
          p.vy = (Math.random() - 0.5) * 0.08;
          break;
        case 'snow':
          p.r = Math.random() * 2.4 + 0.8;
          p.vy = Math.random() * 0.5 + 0.22;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.sw = Math.random() * 2 + 1;
          p.ph = Math.random() * 6.28;
          p.a = Math.random() * 0.5 + 0.3;
          break;
        case 'embers':
          p.x = Math.random() * W; p.y = anywhere ? Math.random() * H : H + 10;
          p.r = Math.random() * 1.8 + 0.6;
          p.vy = -(Math.random() * 0.55 + 0.22);
          p.vx = (Math.random() - 0.5) * 0.28;
          p.life = Math.random() * 0.6 + 0.4;
          p.a = p.life;
          break;
        case 'matrix':
          p.x = Math.floor(Math.random() * (W / 15)) * 15;
          p.y = anywhere ? Math.random() * H : -20;
          p.vy = Math.random() * 2.6 + 1.1;
          p.len = Math.floor(Math.random() * 12) + 5;
          p.ch = [];
          for (var j = 0; j < p.len; j++) p.ch.push(glyph());
          p.tick = 0;
          break;
        case 'bubbles':
          p.y = anywhere ? Math.random() * H : H + 20;
          p.r = Math.random() * 12 + 3;
          p.vy = -(Math.random() * 0.4 + 0.12);
          p.ph = Math.random() * 6.28;
          p.a = Math.random() * 0.22 + 0.05;
          break;
        case 'grid':
          p.r = Math.random() * 1.6 + 0.8;
          p.vx = (Math.random() - 0.5) * 0.22;
          p.vy = (Math.random() - 0.5) * 0.22;
          p.a = Math.random() * 0.5 + 0.2;
          break;
      }
      return p;
    }

    function glyph() {
      var set = 'アイウエオカキクケコサシスセソ0123456789ABCDEF';
      return set[Math.floor(Math.random() * set.length)];
    }

    function hex2rgb(h) {
      h = String(h || '#ffffff').replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      if (isNaN(n)) return [255, 255, 255];
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var rgb = hex2rgb(color);
    var C = rgb[0] + ',' + rgb[1] + ',' + rgb[2];

    function draw() {
      if (!alive) return;
      t++;
      ctx.clearRect(0, 0, W, H);
      var i, p;

      if (type === 'grid') {
        /* red de puntos que se enlazan cuando están cerca */
        for (i = 0; i < parts.length; i++) {
          p = parts[i];
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, 6.283);
          ctx.fillStyle = 'rgba(' + C + ',' + p.a + ')';
          ctx.fill();
        }
        for (i = 0; i < parts.length; i++) {
          for (var k = i + 1; k < parts.length; k++) {
            var dx = parts[i].x - parts[k].x, dy = parts[i].y - parts[k].y;
            var d2 = dx * dx + dy * dy;
            if (d2 < 13000) {
              ctx.beginPath();
              ctx.moveTo(parts[i].x, parts[i].y);
              ctx.lineTo(parts[k].x, parts[k].y);
              ctx.strokeStyle = 'rgba(' + C + ',' + (0.14 * (1 - d2 / 13000)) + ')';
              ctx.lineWidth = 0.7;
              ctx.stroke();
            }
          }
        }
        raf = fx.raf(draw);
        return;
      }

      if (type === 'matrix') {
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.textBaseline = 'top';
        for (i = 0; i < parts.length; i++) {
          p = parts[i];
          p.y += p.vy;
          p.tick++;
          if (p.tick % 7 === 0) p.ch[Math.floor(Math.random() * p.ch.length)] = glyph();
          for (var m = 0; m < p.len; m++) {
            var yy = p.y - m * 15;
            if (yy < -15 || yy > H) continue;
            var a = (1 - m / p.len) * 0.85;
            ctx.fillStyle = m === 0
              ? 'rgba(255,255,255,' + a + ')'
              : 'rgba(' + C + ',' + a + ')';
            ctx.fillText(p.ch[m], p.x, yy);
          }
          if (p.y - p.len * 15 > H) parts[i] = spawn(false);
        }
        raf = fx.raf(draw);
        return;
      }

      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        switch (type) {
          case 'stars':
            p.x += p.vx; p.y += p.vy;
            p.a += p.tw;
            if (p.a > 0.9 || p.a < 0.12) p.tw *= -1;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.fillStyle = 'rgba(' + C + ',' + p.a + ')';
            ctx.fill();
            break;

          case 'snow':
            p.ph += 0.012;
            p.y += p.vy;
            p.x += p.vx + Math.sin(p.ph) * 0.4;
            if (p.y > H + 6) { parts[i] = spawn(false); break; }
            if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.fillStyle = 'rgba(255,255,255,' + p.a + ')';
            ctx.fill();
            break;

          case 'embers':
            p.y += p.vy;
            p.x += p.vx + Math.sin((t + i * 30) * 0.012) * 0.22;
            p.life -= 0.0035;
            if (p.life <= 0 || p.y < -12) { parts[i] = spawn(false); break; }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.fillStyle = 'rgba(' + C + ',' + Math.max(0, p.life) + ')';
            ctx.shadowBlur = 9;
            ctx.shadowColor = 'rgba(' + C + ',.8)';
            ctx.fill();
            ctx.shadowBlur = 0;
            break;

          case 'bubbles':
            p.ph += 0.014;
            p.y += p.vy;
            p.x += Math.sin(p.ph) * 0.5;
            if (p.y < -p.r * 2) { parts[i] = spawn(false); break; }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.strokeStyle = 'rgba(' + C + ',' + (p.a + 0.14) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = 'rgba(' + C + ',' + (p.a * 0.4) + ')';
            ctx.fill();
            break;
        }
      }
      raf = fx.raf(draw);
    }

    resize();
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    if (reduce) {
      /* con movimiento reducido pintamos un solo fotograma */
      var once = draw;
      alive = true; once(); alive = false; cancelAnimationFrame(raf);
    } else {
      draw();
    }

    return fx.register(function () {
      alive = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    });
  };

  /* ---- inclinación 3D --------------------------------------- */
  fx.tilt = function (root, card, max) {
    if (!root || !card || reduce) return null;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return null;
    max = max || 9;

    var rect = null, raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, resting = true;

    function measure() { rect = card.getBoundingClientRect(); }

    function onMove(e) {
      if (!rect) measure();
      var px = (e.clientX - rect.left) / rect.width;
      var py = (e.clientY - rect.top) / rect.height;
      cx = Math.max(0, Math.min(1, px));
      cy = Math.max(0, Math.min(1, py));
      tx = (0.5 - cy) * 2 * max;
      ty = (cx - 0.5) * 2 * max;
      if (resting) { resting = false; card.classList.remove('is-resting'); }
      if (!raf) raf = fx.raf(apply);
    }

    function apply() {
      raf = 0;
      root.style.setProperty('--rx', tx.toFixed(2) + 'deg');
      root.style.setProperty('--ry', ty.toFixed(2) + 'deg');
      card.style.setProperty('--mx', (cx * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (cy * 100).toFixed(1) + '%');
    }

    function onLeave() {
      tx = ty = 0; resting = true;
      card.classList.add('is-resting');
      root.style.setProperty('--rx', '0deg');
      root.style.setProperty('--ry', '0deg');
    }

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseenter', measure);
    card.addEventListener('mouseleave', onLeave);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);

    return fx.register(function () {
      cancelAnimationFrame(raf);
      card.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseenter', measure);
      card.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    });
  };

  /* ---- cursor personalizado ---------------------------------- */
  fx.cursor = function (type) {
    if (!type || type === 'default' || reduce) return null;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return null;

    var el = document.createElement('div');
    el.className = 'cur cur--' + type;
    document.body.appendChild(el);

    var trails = [], TRAIL = (type === 'dot' || type === 'blade') ? 5 : 0, i;
    for (i = 0; i < TRAIL; i++) {
      var t = document.createElement('div');
      t.className = 'cur-trail';
      t.style.opacity = String(0.35 * (1 - i / TRAIL));
      t.style.transform = 'translate3d(-100px,-100px,0)';
      document.body.appendChild(t);
      trails.push({ el: t, x: -100, y: -100 });
    }

    var mx = -100, my = -100;
    /* muelle de verdad: posicion, velocidad, rigidez y amortiguacion.
       Una interpolacion lineal llega y se planta; un muelle acelera,
       pasa un pelo de largo y se asienta. Es lo que hace que un
       cursor se sienta con peso en vez de pegado. */
    var px = -100, py = -100, vx = 0, vy = 0;
    var RIGIDEZ = 0.22, AMORT = 0.72;

    function onMove(e) {
      mx = e.clientX; my = e.clientY;
      var over = e.target && e.target.closest &&
        e.target.closest('a,button,.pf-link,.pf-social,.pf-badge');
      el.classList.toggle('is-hot', !!over);
    }

    var soltar = fx.ticker(function (ahora) {
      vx = (vx + (mx - px) * RIGIDEZ) * AMORT;
      vy = (vy + (my - py) * RIGIDEZ) * AMORT;
      px += vx; py += vy;

      var tr = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
      if (type === 'glitch') {
        /* la distorsion sigue la velocidad: quieto no vibra, y al
           lanzarlo se rompe. Un glitch constante es ruido. */
        var v = Math.min(1, Math.hypot(vx, vy) / 26);
        el.style.setProperty('--gl', v.toFixed(3));
        tr += ' translate3d(' + (Math.random() - 0.5) * 7 * v + 'px,' +
              (Math.random() - 0.5) * 7 * v + 'px,0)';
      }
      el.style.transform = tr;

      var qx = px, qy = py;
      for (var j = 0; j < trails.length; j++) {
        var t = trails[j];
        t.x += (qx - t.x) * 0.3;
        t.y += (qy - t.y) * 0.3;
        t.el.style.transform = 'translate3d(' + t.x.toFixed(2) + 'px,' + t.y.toFixed(2) + 'px,0)';
        qx = t.x; qy = t.y;
      }
    });

    window.addEventListener('mousemove', onMove, { passive: true });

    return fx.register(function () {
      soltar();
      window.removeEventListener('mousemove', onMove);
      el.remove();
      trails.forEach(function (t) { t.el.remove(); });
    });
  };

  /* ============================================================
     EFECTOS DE PUNTERO
     Tres cosas distintas que suelen confundirse en una sola:
       magnetismo  los elementos se acercan al cursor
       brillo      una luz recorre el fondo bajo el raton
       parallax    las capas se mueven a distintas velocidades
     Se pueden combinar. Ninguna existe en tactil ni con
     prefers-reduced-motion.
     ============================================================ */
  function soloPuntero() {
    if (reduce || !fx.puede(1)) return false;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return false;
    return true;
  }

  /* ---- magnetismo -------------------------------------------
     Cada pieza pequena se inclina hacia el cursor cuando entra en
     su radio, con caida suave. Se mueve la pieza, no el puntero:
     asi el click sigue cayendo donde el ojo lo espera. */
  fx.magnetismo = function (root, opciones) {
    if (!root || !soloPuntero()) return null;
    opciones = opciones || {};
    var RADIO = opciones.radio || 90;
    var FUERZA = opciones.fuerza || 0.34;
    var SEL = opciones.sel || '.pf-social, .pf-badge, .pf-link__ico, .pf-music__btn';

    var piezas = [], mx = -9999, my = -9999, medido = 0;

    function medir() {
      piezas = Array.prototype.map.call(root.querySelectorAll(SEL), function (el) {
        var r = el.getBoundingClientRect();
        return { el: el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: 0, y: 0 };
      });
      medido = performance.now();
    }
    medir();

    function onMove(e) { mx = e.clientX; my = e.clientY; }
    function onSalir() { mx = -9999; my = -9999; }

    var soltar = fx.ticker(function (ahora) {
      /* las cajas cambian al desplazarse o al repintar: se vuelven a
         medir de vez en cuando, no en cada fotograma */
      if (ahora - medido > 500) medir();
      for (var i = 0; i < piezas.length; i++) {
        var p = piezas[i];
        var dx = mx - p.cx, dy = my - p.cy;
        var d = Math.hypot(dx, dy);
        var k = d < RADIO ? (1 - d / RADIO) : 0;
        /* caida cuadratica: el tiron aparece cerca, no de lejos */
        k = k * k;
        var ox = dx * k * FUERZA, oy = dy * k * FUERZA;
        p.x += (ox - p.x) * 0.18;
        p.y += (oy - p.y) * 0.18;
        if (Math.abs(p.x) < 0.05 && Math.abs(p.y) < 0.05) {
          if (p.el.style.getPropertyValue('--mgx')) {
            p.el.style.removeProperty('--mgx'); p.el.style.removeProperty('--mgy');
          }
          continue;
        }
        p.el.style.setProperty('--mgx', p.x.toFixed(2) + 'px');
        p.el.style.setProperty('--mgy', p.y.toFixed(2) + 'px');
      }
    });

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', medir, { passive: true });
    document.addEventListener('mouseleave', onSalir);

    return fx.register(function () {
      soltar();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', medir);
      document.removeEventListener('mouseleave', onSalir);
      piezas.forEach(function (p) {
        p.el.style.removeProperty('--mgx'); p.el.style.removeProperty('--mgy');
      });
    });
  };

  /* ---- brillo que sigue al raton -----------------------------
     Dos variables CSS por fotograma y un degradado radial que las
     lee. Todo el trabajo lo hace el compositor: no se toca el
     layout ni se repinta el arbol. */
  fx.brillo = function (root, capa) {
    if (!root || !capa || !soloPuntero()) return null;
    var mx = 50, my = 50, ax = 50, ay = 50, activo = false;

    function onMove(e) {
      var r = root.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 100;
      my = ((e.clientY - r.top) / r.height) * 100;
      if (!activo) { activo = true; capa.style.opacity = '1'; }
    }
    function onSalir() { activo = false; capa.style.opacity = '0'; }

    var soltar = fx.ticker(function () {
      ax += (mx - ax) * 0.12;
      ay += (my - ay) * 0.12;
      capa.style.setProperty('--gx', ax.toFixed(2) + '%');
      capa.style.setProperty('--gy', ay.toFixed(2) + '%');
    });

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onSalir);

    return fx.register(function () {
      soltar();
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onSalir);
    });
  };

  /* ---- parallax por capas ------------------------------------
     El fondo se mueve poco, el contenido menos todavia. La
     diferencia es lo que da profundidad; si todo se mueve igual,
     no se percibe nada. Coste 2: es lo primero que se apaga en un
     equipo modesto. */
  fx.parallax = function (root, capas) {
    if (!root || !capas || !capas.length || !soloPuntero() || !fx.puede(2)) return null;
    var mx = 0, my = 0, ax = 0, ay = 0;

    function onMove(e) {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    }

    var soltar = fx.ticker(function () {
      ax += (mx - ax) * 0.06;
      ay += (my - ay) * 0.06;
      for (var i = 0; i < capas.length; i++) {
        var c = capas[i];
        if (!c.el) continue;
        c.el.style.setProperty('--pxx', (ax * c.k).toFixed(2) + 'px');
        c.el.style.setProperty('--pxy', (ay * c.k).toFixed(2) + 'px');
      }
    });

    window.addEventListener('mousemove', onMove, { passive: true });

    return fx.register(function () {
      soltar();
      window.removeEventListener('mousemove', onMove);
      capas.forEach(function (c) {
        if (c.el) { c.el.style.removeProperty('--pxx'); c.el.style.removeProperty('--pxy'); }
      });
    });
  };

  /* ---- contador que sube ------------------------------------- */
  fx.countUp = function (el, to, dur) {
    if (!el) return;
    to = Number(to) || 0;
    if (reduce) { el.textContent = ID.util.full(to); return; }
    dur = dur || 1100;
    var t0 = performance.now();
    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = ID.util.full(Math.round(to * e));
      if (k < 1) fx.raf(step);
    }
    fx.raf(step);
  };

  /* ---- revelado al hacer scroll ------------------------------ */
  fx.reveal = function (root) {
    if (!('IntersectionObserver' in window)) return null;
    var els = (root || document).querySelectorAll('[data-reveal]');
    if (!els.length) return null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('rise');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
    return fx.register(function () { io.disconnect(); });
  };
})();
