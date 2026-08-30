/* ============================================================
   IDENTITY — panel de control
   El usuario nunca guarda para ver: la vista previa cambia en el
   mismo momento en que mueve un control.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc, num = ID.util.num;

  var ACCENTS = ['#FFFFFF', '#3BA55D', '#5865F2', '#A855F7', '#ED4245', '#F97316', '#EC4899', '#22D3EE'];

  var ic = {
    overview:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
    appearance:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18 4.5 4.5 0 0 0 0-9 4.5 4.5 0 0 1 0-9z"/></svg>',
    media:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/></svg>',
    links:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>',
    badges:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9.5" r="5.5"/><path d="m8.5 14.5-1 7 4.5-2.5 4.5 2.5-1-7"/></svg>',
    analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    design:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21s1-4 4-5.5"/><path d="M14.5 4.5 19.5 9.5 10 19H5v-5z"/><path d="M12.5 6.5 17.5 11.5"/></svg>',
    blocks:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="18" height="5" rx="1.6"/><rect x="3" y="11" width="18" height="4" rx="1.6"/><rect x="3" y="17.5" width="18" height="3" rx="1.4"/></svg>',
    settings:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-3-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.3-3l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 3 1.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };

  var SECTIONS = [
    { id: 'overview',   name: 'Resumen' },
    { id: 'design',     name: 'Diseño' },
    { id: 'blocks',     name: 'Bloques' },
    { id: 'appearance', name: 'Apariencia' },
    { id: 'media',      name: 'Fondo y media' },
    { id: 'links',      name: 'Enlaces' },
    { id: 'badges',     name: 'Badges' },
    { id: 'analytics',  name: 'Analytics' },
    { id: 'settings',   name: 'Ajustes' }
  ];

  var state = {
    sec: 'overview', p: null, dirty: false, vp: 'desktop',
    modo: ID.util.read('identity.editmode', 'simple'),   /* simple | avanzado */
    hist: [], hi: -1, guardando: 0, autoTimer: 0, histTimer: 0, okTimer: 0,
    saveError: null,     /* ultimo fallo de guardado, si lo hubo */
    ro: null, onResize: null, textoTimer: 0,
    sel: null            /* bloque seleccionado al hacer click en el preview */
  };

  /* ---- historial: deshacer y rehacer ------------------------------
     Guardamos instantaneas del perfil. Es barato (son objetos planos)
     y permite experimentar sin miedo, que es justo lo que hace que
     alguien se atreva a personalizar. */
  var HIST_MAX = 60;

  function instantanea() {
    try { return JSON.stringify(state.p); } catch (e) { return null; }
  }

  function histPush() {
    var snap = instantanea();
    if (!snap || snap === state.hist[state.hi]) return;
    state.hist = state.hist.slice(0, state.hi + 1);
    state.hist.push(snap);
    if (state.hist.length > HIST_MAX) state.hist.shift();
    state.hi = state.hist.length - 1;
  }

  function refrescarUndo(mount) {
    var u = mount.querySelector('#undoBtn'), r = mount.querySelector('#redoBtn');
    if (u) u.disabled = state.hi <= 0;
    if (r) r.disabled = state.hi >= state.hist.length - 1;
  }

  function histIr(delta, mount) {
    var i = state.hi + delta;
    if (i < 0 || i >= state.hist.length) return;
    state.hi = i;
    try { state.p = JSON.parse(state.hist[i]); } catch (e) { return; }
    paintSection(mount);
    paintPreview(mount);
    refrescarUndo(mount);
    autoguardar(mount, true);
    ID.app.toast(delta < 0 ? 'Deshecho' : 'Rehecho');
  }

  /* ---- autoguardado ------------------------------------------------
     Tres estados y ninguno de adorno: Guardando / Guardado / Error al
     guardar. "Guardado" solo se pinta si store.save() devolvio true.
     Antes se pintaba siempre, asi que con el almacenamiento lleno el
     editor decia que estaba a salvo un trabajo que se estaba
     perdiendo.
     ------------------------------------------------------------------ */
  function marcarEstado(mount, texto, cls, detalle) {
    var el = mount.querySelector('#saveState');
    if (!el) return;
    el.textContent = texto;
    el.className = 'savestate' + (cls ? ' ' + cls : '');
    if (detalle) el.title = detalle; else el.removeAttribute('title');
  }

  /* el trabajo no guardado sigue vivo en memoria: si la pestaña se
     cierra se lo lleva por delante, asi que se avisa. Solo cuando una
     escritura fallo de verdad; el "sin guardar" normal se resuelve
     solo en 900 ms y no merece un dialogo. */
  function guardiaSalida(e) {
    if (!state.saveError) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  }

  function autoguardar(mount, inmediato) {
    if (!state.p.username) {
      marcarEstado(mount, 'Elige un nombre de usuario', 'warn');
      return;
    }
    clearTimeout(state.autoTimer);

    var hacer = function () {
      clearTimeout(state.okTimer);   /* que un "Guardado" en cola no tape un error */
      marcarEstado(mount, 'Guardando\u2026');

      var lv = ID.store.computeLevel(state.p);
      state.p.level = lv.level; state.p.xp = lv.xp; state.p.xpMax = lv.xpMax;

      var ok = ID.store.save(state.p);
      if (ok) ok = ID.store.setMine(state.p.username);

      if (!ok) {
        var err = ID.store.ultimoError ||
          { code: 'fallo', message: 'No se pudo guardar en este navegador.' };
        var nuevo = !state.saveError || state.saveError.code !== err.code;
        state.saveError = err;
        state.dirty = true;          /* sigue pendiente: nada se da por hecho */
        marcarEstado(mount, 'Error al guardar', 'err', err.message);
        /* el aviso solo la primera vez: el autoguardado reintenta cada 900 ms
           y repetir el toast en cada tecla convierte un error en un acoso.
           El estado sigue visible en la barra mientras dure. */
        if (nuevo) ID.app.toast(err.message, true);
        return;
      }

      state.saveError = null;
      state.dirty = false;
      state.okTimer = setTimeout(function () {
        marcarEstado(mount, 'Guardado', 'ok');
      }, 180);
    };

    if (inmediato) hacer(); else state.autoTimer = setTimeout(hacer, 900);
  }

  /* ---- medios ------------------------------------------------------
     Tres cosas al abrir el editor, en este orden:
       1. rescatar un video que siguiera metido dentro del perfil
          (perfiles anteriores a IndexedDB: eso es lo que llenaba
          localStorage);
       2. tener el video en memoria antes de pintar la previsualizacion;
       3. borrar lo que ya no referencia nadie.
     Nada de esto puede tumbar el editor si falla: se ignora y sigue.
     ------------------------------------------------------------------ */
  function prepararMedios(mount) {
    if (!ID.media || !ID.media.disponible()) return;

    ID.media.extraer(state.p, ['bgValue']).then(function (r) {
      if (r.movidos) {
        ID.store.save(state.p);
        ID.app.toast('Video sacado de localStorage \u00b7 ' +
          ID.app.humano(r.liberadoKB) + ' liberados');
      }
      return ID.media.precargar(state.p);
    }).then(function () {
      paintPreview(mount);
      /* lo que esta en el perfil abierto se protege aunque todavia
         no este guardado en disco */
      return ID.media.recolectar(ID.media.refsDe(state.p));
    }).catch(function () { /* sin medios el editor funciona igual */ });
  }

  /* ---- helpers de formulario ------------------------------------ */

  function field(label, hint, control) {
    return '<div class="f"><label class="f__l"><span>' + label + '</span>' +
      (hint ? '<em>' + hint + '</em>' : '') + '</label>' + control + '</div>';
  }
  function input(key, val, ph, extra) {
    return '<input class="inp" data-k="' + key + '" value="' + esc(val || '') +
      '" placeholder="' + esc(ph || '') + '" ' + (extra || '') + '>';
  }
  function textarea(key, val, ph) {
    return '<textarea class="ta" data-k="' + key + '" placeholder="' + esc(ph || '') + '">' +
      esc(val || '') + '</textarea>';
  }
  function opts(key, list, cur) {
    return '<div class="opts">' + list.map(function (o) {
      return '<button type="button" class="opt' + (o.id === cur ? ' on' : '') +
        '" data-opt="' + key + '" data-v="' + o.id + '">' + esc(o.name) + '</button>';
    }).join('') + '</div>';
  }
  function toggle(key, val, label, hint) {
    return '<div class="sw-row"><div>' + label +
      (hint ? '<small>' + hint + '</small>' : '') + '</div>' +
      '<button type="button" class="sw-box' + (val ? ' on' : '') +
      '" data-sw="' + key + '" role="switch" aria-checked="' + !!val +
      '" aria-label="' + esc(label) + '"></button></div>';
  }
  /* Rejilla de fuentes. La misma sirve para el cuerpo y para los
     titulos: la clave viaja en el propio atributo. */
  function fuentes(clave, valor) {
    return '<div class="fonts">' +
      '<button type="button" class="fontpick' + (!valor ? ' on' : '') +
        '" data-fuente="' + clave + ':">' +
        '<span class="fontpick__s">Aa</span><span class="fontpick__n">Del tema</span></button>' +
      ID.FONTS.map(function (f) {
        return '<button type="button" class="fontpick' + (f.id === valor ? ' on' : '') +
          '" data-fuente="' + clave + ':' + f.id + '" style="--ff:' + f.stack + '">' +
          '<span class="fontpick__s">Aa</span>' +
          '<span class="fontpick__n">' + esc(f.name) + '</span></button>';
      }).join('') +
    '</div>';
  }

  /* Opciones con nombre humano que por debajo son numeros.
     El usuario elige "Amplio", no "28px". */
  function escala(key, val, lista) {
    var actual = Number(val);
    return '<div class="opts">' + lista.map(function (o) {
      return '<button type="button" class="opt' + (actual === o.v ? ' on' : '') +
        '" data-num="' + key + ':' + o.v + '">' + esc(o.name) + '</button>';
    }).join('') + '</div>';
  }

  var ESC_GAP = [
    { name: 'Compacto', v: 8 }, { name: 'Normal', v: 16 },
    { name: 'Amplio', v: 26 }, { name: 'Muy amplio', v: 38 }
  ];
  var ESC_ANCHO = [
    { name: 'Estrecho', v: 380 }, { name: 'Normal', v: 460 },
    { name: 'Ancho', v: 560 }, { name: 'Muy ancho', v: 700 }
  ];
  var ESC_AVATAR = [
    { name: 'Pequeno', v: 72 }, { name: 'Mediano', v: 112 },
    { name: 'Grande', v: 150 }, { name: 'Enorme', v: 200 }
  ];

  /* campo de color con opción de heredar el del tema */
  function color(key, val, label, hint) {
    return '<div class="f"><label class="f__l"><span>' + label + '</span>' +
      (hint ? '<em>' + hint + '</em>' : '') + '</label>' +
      '<div class="col-field">' +
        '<input type="color" class="col-custom" data-col="' + key + '" value="' +
          esc(/^#[0-9a-f]{6}$/i.test(val || '') ? val : '#FFFFFF') + '" aria-label="' + esc(label) + '">' +
        '<code class="col-hex">' + esc(val || 'heredado') + '</code>' +
        (val ? '<button type="button" class="btn btn--quiet btn--sm" data-colclear="' + key +
               '">Heredar</button>' : '') +
      '</div></div>';
  }

  function range(key, val, min, max, unit) {
    return '<div class="rng"><input type="range" data-rg="' + key + '" min="' + min +
      '" max="' + max + '" value="' + (Number(val) || 0) + '">' +
      '<output>' + (Number(val) || 0) + (unit || '') + '</output></div>';
  }

  /* que interruptor gobierna cada bloque del orden */
  var BLOQUE_SW = {
    avatar: 'avatar', identity: 'name', handle: 'handle', meta: 'meta', joined: 'joined', fields: 'fields', status: 'status',
    discord: 'discord', live: 'live', bio: 'bio', badges: 'badges',
    socials: 'socials', music: 'music', level: 'level', views: 'views', stats: 'stats'
  };

  /* ---- secciones -------------------------------------------------- */

  /* barra de completitud: lo que más mueve a terminar un perfil */
  function progressHTML(p) {
    var c = ID.store.completion(p);
    if (c.pct === 100) {
      return '<div class="prog prog--done">' +
        '<div class="prog__bar"><i style="width:100%"></i></div>' +
        '<div class="prog__head"><b>Perfil completo</b>' +
        '<span>' + c.done + '/' + c.total + '</span></div></div>';
    }
    return '<div class="prog">' +
      '<div class="prog__bar"><i style="width:' + c.pct + '%"></i></div>' +
      '<div class="prog__head">' +
        '<b>Tu perfil está al ' + c.pct + '%</b>' +
        '<span>' + c.done + ' de ' + c.total + '</span>' +
      '</div>' +
      '<div class="prog__items">' +
        c.items.map(function (it) {
          return '<button type="button" class="prog__it' + (it.ok ? ' ok' : '') + '" ' +
            'data-goto="' + it.sec + '"' + (it.ok ? ' disabled' : '') + '>' +
            '<span class="prog__mark">' + (it.ok ? '✓' : '') + '</span>' +
            esc(it.label) + (it.ok ? '' : '<span class="prog__go">›</span>') + '</button>';
        }).join('') +
      '</div></div>';
  }

  function secOverview(p) {
    var lv = ID.store.computeLevel(p);
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Resumen</h1>' +
      '<p>Quién eres y cómo te presentas. Lo demás es decoración.</p>' +
    '</div></div>' +

    progressHTML(p) +

    '<div class="mini-stats">' +
      '<div class="mini-stat"><div class="mini-stat__n">' + num(p.views || 0) + '</div>' +
        '<div class="mini-stat__l">Visitas</div></div>' +
      '<div class="mini-stat"><div class="mini-stat__n">' + lv.level + '</div>' +
        '<div class="mini-stat__l">Nivel</div></div>' +
      '<div class="mini-stat"><div class="mini-stat__n">' + (p.badges || []).length + '</div>' +
        '<div class="mini-stat__l">Badges</div></div>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Identidad</div>' +
      '<div class="blk__d">El nombre de usuario es tu URL y no debería cambiar seguido.</div>' +
      field('Nombre de usuario', 'identity.gg/' + esc(p.username || '…'),
        '<div class="f-pre"><span>identity.gg/</span>' + input('username', p.username, 'tunombre') + '</div>') +
      '<div class="f-row">' +
        field('Nombre visible', '', input('name', p.name, 'Cómo te llamas')) +
        field('Qué haces', '', input('title', p.title, 'Developer / Gamer')) +
      '</div>' +
      '<div class="f-row">' +
        field('Ubicación', 'opcional', input('location', p.location, 'Medellín 🇨🇴')) +
        field('Pronombres', 'opcional', input('pronouns', p.pronouns, 'él / ella / elle')) +
      '</div>' +
      field('Biografía', (p.bio || '').length + '/160',
        textarea('bio', p.bio, 'Algo que valga la pena leer dos veces.')) +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Avatar</div>' +
      '<div class="blk__d">Una imagen, un GIF o simplemente un emoji.</div>' +
      '<div class="f-row">' +
        field('Emoji o inicial', '', input('emoji', p.emoji, '◈')) +
        field('URL de imagen', 'o sube una', input('avatarUrl', p.avatarUrl, 'https://…')) +
      '</div>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-act="upload-avatar">Subir imagen</button>' +
      field('Efecto del avatar', '', opts('avatarFx', ID.AVATAR_FX, p.avatarFx)) +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Estado</div>' +
      '<div class="blk__d">Aparece junto a tu nombre.</div>' +
      field('Presencia', '', opts('status.state', ID.STATUS_STATES, (p.status || {}).state)) +
      '<div class="f-row">' +
        field('Actividad', '', input('status.activity', (p.status || {}).activity, 'Programando')) +
        field('Detalle', 'opcional', input('status.detail', (p.status || {}).detail, 'VS Code')) +
      '</div>' +
    '</div>';
  }

  /* ---- Diseño: la composición del perfil ------------------------
     Aquí vive la decisión más importante del producto: si hay caja
     o no. Por eso va antes que los colores. */
  function secDesign(p) {
    var conCaja = (p.surface || 'none') !== 'none';
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Diseño</h1>' +
      '<p>Tu perfil no obliga a usar una caja. Empieza por decidir si quieres una.</p>' +
    '</div></div>' +

        '<div class="blk">' +
      '<div class="blk__t">Superficie</div>' +
      '<div class="blk__d">' +
        (conCaja
          ? 'El contenido va dentro de una caja.'
          : 'El contenido flota sobre el fondo. Es lo que hace que un perfil no parezca un formulario.') +
      '</div>' +
      field('Estilo de caja', '', opts('surface', ID.SURFACES, p.surface)) +
      (conCaja
        ? avanzado(
            field('Opacidad', '', range('sOpacity', p.sOpacity == null ? (p.surface === 'glass' ? 9 : 90) : p.sOpacity, 0, 100, '%')) +
            field('Borde', '', range('sBorder', p.sBorder == null ? 25 : p.sBorder, 0, 100, '%')) +
            (p.surface === 'glass' ? field('Desenfoque del vidrio', '', range('sBlur', p.sBlur, 0, 40, 'px')) : '') +
            (p.surface === 'glow' ? field('Intensidad del halo', '', range('sGlow', p.sGlow, 0, 100, '')) : '') +
            field('Curvatura', '', range('radius', p.radius, 0, 40, 'px')) +
            field('Relleno interior', '', range('pad', p.pad == null ? 28 : p.pad, 0, 60, 'px')) +
            toggle('tilt', p.tilt, 'Inclinacion 3D', 'La caja sigue al puntero'),
            'Ajustar la caja')
        : '') +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Composicion</div>' +
      field('Alineacion', '', opts('align', ID.ALIGNS, p.align)) +
      avanzado(
        field('Modo de composicion', 'libre = rejilla de 12 columnas',
          opts('layoutMode', ID.LAYOUT_MODES, p.layoutMode)) +
        field('Posicion en pantalla', 'el bloque va centrado salvo que lo cambies',
          opts('stackPos', ID.STACK_POS, p.stackPos)),
        'Composicion libre') +
      field('Ancho', 'ajustar evita cajas enormes y vacias',
        opts('widthMode', ID.WIDTH_MODES, p.widthMode)) +
      (p.widthMode === 'full' ? '' :
        field(p.widthMode === 'auto' ? 'Ancho maximo' : 'Ancho', '',
          escala('stackWidth', p.stackWidth, ESC_ANCHO))) +
      field('Separacion', '', escala('gap', p.gap, ESC_GAP)) +
      avanzado(
        (p.widthMode === 'full' ? '' :
          field('Ancho exacto', '', range('stackWidth', p.stackWidth, 260, 900, 'px'))) +
        field('Separacion exacta', '', range('gap', p.gap, 0, 48, 'px')),
        'Medidas exactas') +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Movimiento</div>' +
      field('Al abrir el perfil', '', opts('enterFx', ID.ENTER_FX, p.enterFx)) +
      avanzado(
        field('Al pasar el puntero', '', opts('hoverFx', ID.HOVER_FX, p.hoverFx)) +
      '<div class="blk__sub">Efectos de ratón</div>' +
      '<div class="blk__d">Los tres se apagan solos en móvil, con movimiento reducido ' +
        'y en equipos que no dan para tanto.</div>' +
      toggle('fxMagnet', p.fxMagnet, 'Magnetismo',
        'Los iconos se acercan al cursor cuando pasa cerca') +
      toggle('fxGlow', p.fxGlow, 'Luz que sigue al ratón',
        'Un resplandor recorre el fondo bajo el puntero') +
      toggle('fxParallax', p.fxParallax, 'Profundidad',
        'El fondo y el contenido se mueven a distinta velocidad') +
        '<div class="blk__d" style="margin:18px 0 8px">Cajas internas: el estado, los ' +
          'enlaces, la musica y las stats pueden vestirse aparte.</div>' +
        field('Estilo de las cajas internas', '', opts('blockStyle', ID.BLOCK_STYLES, p.blockStyle)) +
        field('Curvatura', p.blockRadius == null ? 'del tema' : p.blockRadius + 'px',
          range('blockRadius', p.blockRadius == null ? 12 : p.blockRadius, 0, 40, 'px')),
        'Detalles finos') +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Cada pieza se ajusta sola</div>' +
      '<div class="blk__d">La tipografia, el avatar, las redes, la musica y los badges ya no ' +
        'estan aqui: cada uno tiene sus propias opciones. Toca la pieza en la vista previa ' +
        '\u2014 o en la lista de Bloques \u2014 y aparecen solo las suyas.</div>' +
      '<button class="btn btn--ghost btn--sm btn--block" type="button" data-goto="blocks">' +
        'Ver mis bloques</button>' +
    '</div>';
  }

  /* ---- Bloques: que existe y en que orden ------------------------ */
  function secBlocks(p) {
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Bloques</h1>' +
      '<p>Enciende lo que quieras mostrar. Arrastra las secciones para cambiar su orden.</p>' +
    '</div></div>' +

    '<div class="blk">' +
      '<div class="blk__t">Primera pantalla</div>' +
      '<div class="blk__d">' +
        (p.layoutMode === 'free'
          ? 'Arrastra para el orden; las flechas mueven cada bloque por las 12 columnas ' +
            'y \u2212/+ cambian su ancho. En movil todo vuelve a una columna.'
          : 'Arrastra para cambiar el orden. Menos es mas: no lo llenes todo. ' +
            'Para mover bloques a los lados, activa el modo libre en Diseno.') +
      '</div>' +
      '<div class="rows" data-list="blockOrder">' +
        (p.blockOrder || ID.BLOCK_ORDER).map(function (id, i) {
          /* el bloque "identity" reune nombre, @usuario y oficio */
          var tipo = ID.util.tipoBloque(id);
          var copia = ID.util.esCopia(id);
          /* una copia se apaga sola; el original sigue con su interruptor de tipo */
          var sw = copia ? id : (BLOQUE_SW[tipo] || tipo);
          var meta = ID.BLOCKS.filter(function (x) { return x.id === (BLOQUE_SW[tipo] || tipo); })[0];
          var nombre = tipo === 'identity' ? 'Nombre y @usuario' : (meta ? meta.name : tipo);
          if (copia) nombre += ' ' + id.slice(id.indexOf('#'));
          var on = p.blocks[sw] !== false;
          var q = (p.pos || {})[id] || {};
          var col = Math.max(1, Math.min(12, Number(q.col) || 1));
          var span = Math.max(1, Math.min(13 - col, Number(q.span) || 12));
          var al = q.align || 'stretch';
          var libre = p.layoutMode === 'free';

          var ctl = libre
            ? '<span class="posctl" role="group" aria-label="Posicion de ' + esc(nombre) + '">' +
                '<button type="button" data-mv="' + id + ':-1" title="Mover a la izquierda">\u2190</button>' +
                '<button type="button" data-mv="' + id + ':1" title="Mover a la derecha">\u2192</button>' +
                '<b class="posctl__v" title="Columna ' + col + ', ancho ' + span + '">' +
                  col + '\u00b7' + span + '</b>' +
                '<button type="button" data-sp="' + id + ':-1" title="Mas angosto">\u2212</button>' +
                '<button type="button" data-sp="' + id + ':1" title="Mas ancho">+</button>' +
                '<button type="button" data-al="' + id + '" title="Alinear (' + al + ')">' +
                  (al === 'start' ? '\u2039' : al === 'end' ? '\u203a' :
                   al === 'center' ? '\u2022' : '\u2194') + '</button>' +
              '</span>'
            : '';

          /* duplicar solo lo que gana algo al duplicarse: una pieza
             con contenido propio. Duplicar el avatar seria la misma
             pieza dos veces. */
          var dup = ID.BLOQUES_DUPLICABLES.indexOf(tipo) !== -1
            ? '<button type="button" class="row-it__x row-it__dup" data-dup="' + id +
                '" title="Duplicar ' + esc(nombre) + '" aria-label="Duplicar">+</button>'
            : '';
          var quitar = copia
            ? '<button type="button" class="row-it__x" data-quitarcopia="' + id +
                '" title="Quitar esta copia" aria-label="Quitar copia">\u00d7</button>'
            : '';

          return '<div class="row-it row-it--sec' + (libre ? ' row-it--free' : '') +
            (copia ? ' row-it--copia' : '') +
            '" draggable="true" data-i="' + i + '">' +
            '<button class="row-it__h" type="button" aria-label="Reordenar">\u283f</button>' +
            '<button class="row-it__b row-it__abrir" type="button" data-abrir="' + esc(id) + '" ' +
              'title="Ajustar ' + esc(nombre) + '">' +
              '<span class="row-it__t">' + esc(nombre) + '</span>' +
              '<span class="row-it__go" aria-hidden="true">\u203a</span></button>' +
            ctl + dup + quitar +
            '<button type="button" class="sw-box' + (on ? ' on' : '') +
              '" data-sw="blocks.' + sw + '" role="switch" aria-checked="' + on +
              '" aria-label="' + esc(nombre) + '"></button>' +
            '</div>';
        }).join('') +
      '</div>' +

    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Secciones al hacer scroll</div>' +
      '<div class="blk__d">El heroe es tu identidad; esto es la profundidad.</div>' +
      '<div class="rows" data-list="sections">' +
        p.sections.map(function (id, i) {
          var meta = ID.PAGE_SECTIONS.filter(function (x) { return x.id === id; })[0] || { name: id };
          var on = p.sectionsOn[id] !== false;
          return '<div class="row-it row-it--sec" draggable="true" data-i="' + i + '">' +
            '<button class="row-it__h" type="button" aria-label="Reordenar">\u283f</button>' +
            '<span class="row-it__b"><span class="row-it__t">' + esc(meta.name) + '</span></span>' +
            '<button type="button" class="sw-box' + (on ? ' on' : '') +
              '" data-sw="sectionsOn.' + id + '" role="switch" aria-checked="' + on +
              '" aria-label="' + esc(meta.name) + '"></button>' +
            '</div>';
        }).join('') +
      '</div>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Sobre mi</div>' +
      '<div class="blk__d">Texto largo para la seccion que aparece al bajar.</div>' +
      field('Texto', (p.about || '').length + ' caracteres',
        textarea('about', p.about, 'Cuenta lo que no cabe en la biografia.')) +
    '</div>';
  }

  function secAppearance(p) {
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Apariencia</h1>' +
      '<p>Catorce puntos de partida. Ninguno te obliga a quedarte ahí.</p>' +
    '</div></div>' +

    '<div class="blk">' +
      '<div class="blk__t">Tema</div>' +
      '<div class="blk__d">Cambia colores, tipografía, curvatura y sombras a la vez.</div>' +
      '<div class="themes">' +
        ID.THEMES.map(function (t) {
          return '<button type="button" class="th' + (t.id === p.theme ? ' on' : '') +
            '" data-theme="' + t.id + '">' +
            '<span class="th__pre sw-' + t.id + '"></span>' +
            '<span class="th__n">' + esc(t.name) + '</span></button>';
        }).join('') +
      '</div>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Color de acento</div>' +
      '<div class="blk__d">Se usa en detalles: brillo, bordes activos, barras. Déjalo vacío para heredar el del tema.</div>' +
      '<div class="colors">' +
        ACCENTS.map(function (c) {
          return '<button type="button" class="col' + (c.toLowerCase() === String(p.accent).toLowerCase() ? ' on' : '') +
            '" data-accent="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>';
        }).join('') +
        '<input type="color" class="col-custom" data-accent-custom value="' +
          esc(/^#[0-9a-f]{6}$/i.test(p.accent || '') ? p.accent : '#FFFFFF') + '" aria-label="Color personalizado">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="clear-accent">Heredar del tema</button>' +
      '</div>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Color por elemento</div>' +
      '<div class="blk__d">Déjalos en blanco y mandan los del tema.</div>' +
      '<div class="f-row">' +
        color('colText', p.colText, 'Color del texto') +
        color('colBg', p.colBg, 'Color de fondo') +
      '</div>' +
      color('colIcon', p.colIcon, 'Color de icono', 'sólo con iconos monocromos') +
      toggle('gradient', p.gradient, 'Gradiente del perfil', 'El acento tiñe el lienzo') +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Ajustes de brillo</div>' +
      '<div class="blk__d">Elige qué elementos brillan. Todo a la vez cansa la vista.</div>' +
      toggle('glowName', p.glowName, 'Nombre') +
      toggle('glowSocials', p.glowSocials, 'Redes') +
      toggle('glowBadges', p.glowBadges, 'Badges') +
      toggle('animatedName', p.animatedName, 'Título animado', 'Degradado que recorre el nombre') +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Efectos</div>' +
      '<div class="blk__d">Los efectos son sal, no el plato.</div>' +
      field('Partículas', '', opts('particles', ID.PARTICLES, p.particles)) +
      field('Cursor', 'sólo en escritorio', opts('cursor', ID.CURSORS, p.cursor)) +
      toggle('gate', p.gate, 'Pantalla de entrada', 'Necesaria si usas música') +
    '</div>';
  }

  function secMedia(p) {
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Fondo y media</h1>' +
      '<p>El contenido siempre tiene que seguir siendo legible encima.</p>' +
    '</div></div>' +

    '<div class="blk">' +
      '<div class="blk__t">Fondo</div>' +
      field('Tipo', '', opts('bgType', [
        { id: 'gradient', name: 'Degradado' }, { id: 'solid', name: 'Sólido' },
        { id: 'image', name: 'Imagen' }, { id: 'video', name: 'Video' }
      ], p.bgType)) +
      (p.bgType === 'gradient' ? '' :
        field(p.bgType === 'solid' ? 'Color o CSS' : 'URL del archivo', '',
          input('bgValue', p.bgValue, p.bgType === 'solid' ? '#101010' : 'https://…'))) +
      (p.bgType === 'image' || p.bgType === 'video'
        ? '<button class="btn btn--ghost btn--sm" type="button" data-act="upload-bg">Subir archivo</button>'
        : '') +
      '<div style="height:16px"></div>' +
      field('Oscurecer', 'legibilidad', range('bgDim', p.bgDim, 0, 90, '%')) +
      field('Desenfoque', '', range('bgBlur', p.bgBlur, 0, 24, 'px')) +
      field('Ruido', 'textura de grano', range('noise', p.noise, 0, 60, '%')) +
    '</div>' +

    bloqueMusica(p) +

    '<div class="blk">' +
      '<div class="blk__t">Galería</div>' +
      '<div class="blk__d">Emojis o URLs de imagen, separados por coma.</div>' +
      field('Elementos', (p.gallery || []).length + ' elementos',
        input('gallery', (p.gallery || []).join(', '), '🌃, 🏎️, https://…')) +
    '</div>';
  }

  /* fila de una lista ordenable */
  function rowItem(list, i, ico, title, sub, extra) {
    return '<div class="row-it" draggable="true" data-i="' + i + '">' +
      '<button class="row-it__h" type="button" aria-label="Reordenar">\u283f</button>' +
      '<span class="row-it__ico">' + ico + '</span>' +
      '<span class="row-it__b"><span class="row-it__t">' + title + '</span>' +
      '<span class="row-it__s">' + sub + '</span></span>' +
      (extra || '<span></span>') +
      '<button class="row-it__x" type="button" data-del="' + list + '" data-i="' + i +
      '" aria-label="Eliminar">\u00d7</button></div>';
  }

  /* ---- lista de reproducción --------------------------------------
     Un perfil viejo con una sola canción se migra a lista de uno la
     primera vez que se toca. Mantenemos audio.title al día porque
     otras partes lo usan para saber si hay música. */
  function pistas(p) {
    p.audio = p.audio || {};
    if (!Array.isArray(p.audio.tracks)) {
      p.audio.tracks = p.audio.title ? [{
        title: p.audio.title, artist: p.audio.artist, cover: p.audio.cover,
        src: p.audio.src || 'manual', yt: p.audio.yt,
        preview: p.audio.preview, url: p.audio.url, length: p.audio.length
      }] : [];
    }
    return p.audio.tracks;
  }

  function sincronizarAudio(p) {
    var ls = (p.audio && p.audio.tracks) || [];
    if (!ls.length) { p.audio = null; return; }
    var t = ls[0];
    p.audio.title = t.title;
    p.audio.artist = t.artist;
    p.audio.cover = t.cover;
    p.audio.src = t.src;
  }

  function filaPista(t, i) {
    var esUrl = /^(https?:|data:)/i.test(String(t.cover || ''));
    var etiqueta = t.src === 'youtube' ? 'YouTube'
      : (t.src === 'spotify' ? (t.preview ? '30s' : 'sin audio') : 'ficha');
    return '<div class="row-it" draggable="true" data-i="' + i + '">' +
      '<button class="row-it__h" type="button" aria-label="Reordenar">\u283f</button>' +
      '<span class="row-it__ico">' +
        (esUrl ? '<img class="pista__cov" src="' + esc(t.cover) + '" alt="">'
               : esc(t.cover || '\u266a')) + '</span>' +
      '<span class="row-it__b"><span class="row-it__t">' + esc(t.title || 'Sin título') + '</span>' +
      '<span class="row-it__s">' + esc(t.artist || '') + '</span></span>' +
      '<span class="pista__tag' + (etiqueta === 'sin audio' ? ' pista__tag--no' : '') + '">' +
        esc(etiqueta) + '</span>' +
      '<button class="row-it__x" type="button" data-del="audio.tracks" data-i="' + i +
        '" aria-label="Quitar">\u00d7</button>' +
      '</div>';
  }

  /* ---- música ----------------------------------------------------
     Tres fuentes. Manual no suena (solo es una ficha), YouTube suena
     de verdad y Spotify sirve para elegir la pista de tus playlists. */
  function bloqueMusica(p) {
    var a = p.audio || {};
    var fuente = a.src || 'manual';
    var idyt = a.yt || '';

    var cuerpo = '';

    if (fuente === 'youtube') {
      cuerpo =
        field('Enlace de YouTube', idyt ? 'video ' + esc(idyt) : 'pega la URL',
          '<input class="inp" id="ytUrl" placeholder="https://youtu.be/..." value="' +
          esc(a.ytUrl || '') + '">') +
        (idyt
          ? '<div class="ytprev">' +
              '<img src="' + esc(ID.music.miniaturaYouTube(idyt)) + '" alt="">' +
              '<div><b>' + esc(a.title || 'Sin título') + '</b>' +
              '<span>' + esc(a.artist || '') + '</span></div>' +
            '</div>'
          : '') +
        '<div class="blk__d" style="margin-top:10px">Suena de verdad con el reproductor ' +
          'de YouTube. El navegador exige un clic antes de arrancar: para eso está la ' +
          'pantalla de entrada.</div>';

    } else if (fuente === 'spotify') {
      cuerpo = '<div id="spBox"></div>';

    } else {
      cuerpo =
        '<div class="blk__d" style="margin:-6px 0 14px">Una ficha sin sonido: sirve para ' +
          'enseñar qué escuchas sin reproducir nada.</div>' +
        '<div class="f-row">' +
          field('Título', '', input('audio.title', a.title, 'Nombre de la canción')) +
          field('Artista', '', input('audio.artist', a.artist, 'Artista')) +
        '</div>' +
        field('Portada', 'emoji o URL', input('audio.cover', a.cover, '♪'));
    }

    var ls = pistas(p);
    var lista = ls.length
      ? '<div class="blk__sub" style="margin-top:0;padding-top:0;border-top:0">' +
          'Tu lista (' + ls.length + ')</div>' +
        '<div class="rows" data-list="audio.tracks">' + ls.map(filaPista).join('') + '</div>' +
        (ls.length > 1
          ? '<div class="blk__d" style="margin:8px 0 0">Los botones de anterior y ' +
            'siguiente del perfil recorren esta lista.</div>'
          : '')
      : '';

    return '<div class="blk">' +
      '<div class="blk__t">Música</div>' +
      lista +
      (ls.length ? '<div class="blk__sub">Añadir otra</div>' : '') +
      field('Fuente', '', opts('audio.src', [
        { id: 'manual',  name: 'Manual' },
        { id: 'youtube', name: 'YouTube' },
        { id: 'spotify', name: 'Spotify' }
      ], fuente)) +
      cuerpo +
      (ls.length
        ? '<button class="btn btn--ghost btn--sm" type="button" data-act="quitar-musica" ' +
          'style="margin-top:12px">Vaciar la lista</button>'
        : '') +
    '</div>';
  }

  function secLinks(p) {
    var groups = ID.NET_GROUPS.map(function (g) {
      return '<button type="button" class="chip chip--sm' + (g.id === 'all' ? ' on' : '') +
        '" data-npg="' + g.id + '">' + esc(g.name) + '</button>';
    }).join('');

    /* rejilla de iconos: el nombre aparece arriba al pasar el puntero,
       asi caben las ~50 redes sin que el panel se vuelva un muro de texto */
    var tiles = ID.NET_ORDER.map(function (k) {
      var n = ID.NETS[k];
      return '<button type="button" class="nettile" data-net="' + k + '" ' +
        'data-group="' + n.group + '" data-label="' + esc(n.label.toLowerCase()) + '" ' +
        'style="--brand:' + n.color + '" title="' + esc(n.label) + '" ' +
        'aria-label="' + esc(n.label) + '">' + n.icon + '</button>';
    }).join('');

    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Enlaces</h1>' +
      '<p>Arrastra para reordenar. El orden es el que ve la gente.</p>' +
    '</div></div>' +

    '<div class="blk">' +
      '<div class="blk__t">Vincula tus perfiles de redes sociales</div>' +
      '<div class="blk__d">Elige una red para anadirla a tu perfil.</div>' +

      '<div class="netpick">' +
        '<div class="netpick__top">' +
          '<div class="search search--sm">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
              'stroke-linecap="round" aria-hidden="true">' +
              '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
            '<input id="npSearch" type="search" placeholder="Buscar red..." ' +
              'aria-label="Buscar red social" autocomplete="off">' +
          '</div>' +
          '<span class="netpick__name" id="npName">' + ID.NET_ORDER.length + ' servicios</span>' +
        '</div>' +
        '<div class="chips chips--sm" id="npGroups">' + groups + '</div>' +
        '<div class="netgrid" id="npGrid">' + tiles + '</div>' +
        '<div class="netpick__form" id="npForm" hidden></div>' +
      '</div>' +

      ((p.socials || []).length
        ? '<div class="blk__t" style="margin-top:24px">Tus redes</div>' +
          '<div class="rows" data-list="socials">' +
            p.socials.map(function (sc, i) {
              var net = ID.NETS[sc.net] || ID.NETS.web;
              return rowItem('socials', i,
                '<span class="row-it__brand" style="color:' + net.color + '">' +
                  (sc.net === 'custom' && sc.emoji
                    ? esc(sc.emoji)
                    : net.icon) + '</span>',
                esc(sc.label || net.label),
                esc(sc.url || ''));
            }).join('') +
          '</div>'
        : '') +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Enlaces personalizados</div>' +
      '<div class="blk__d">Cuatro formatos: clasico, minimal, tarjeta y destacado.</div>' +
      '<div class="rows" data-list="links">' +
        (p.links || []).map(function (l, i) {
          var variante = '<select class="sel sel--mini" data-lvar="' + i + '">' +
            ['classic', 'minimal', 'card', 'featured'].map(function (v) {
              return '<option value="' + v + '"' +
                ((l.variant || 'classic') === v ? ' selected' : '') + '>' + v + '</option>';
            }).join('') + '</select>';
          return rowItem('links', i, esc(l.ico || '\ud83d\udd17'),
            esc(l.title), esc(l.url || ''), variante);
        }).join('') +
      '</div>' +
      '<div class="add-form">' +
        '<div class="f-row">' +
          '<input class="inp" id="nlIco" placeholder="Emoji" maxlength="4">' +
          '<input class="inp" id="nlTitle" placeholder="Titulo del enlace">' +
        '</div>' +
        '<div class="f-row">' +
          '<input class="inp" id="nlDesc" placeholder="Descripcion (opcional)">' +
          '<input class="inp" id="nlUrl" placeholder="https://...">' +
        '</div>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-act="add-link">Anadir enlace</button>' +
      '</div>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Proyectos</div>' +
      '<div class="rows" data-list="projects">' +
        (p.projects || []).map(function (pr, i) {
          return rowItem('projects', i, '\u25c6', esc(pr.title), esc(pr.desc || ''));
        }).join('') +
      '</div>' +
      '<div class="add-form">' +
        '<div class="f-row">' +
          '<input class="inp" id="npTitle" placeholder="Nombre">' +
          '<input class="inp" id="npTag" placeholder="Etiqueta (web, bot...)">' +
        '</div>' +
        '<div class="f-row">' +
          '<input class="inp" id="npDesc" placeholder="Descripcion">' +
          '<input class="inp" id="npUrl" placeholder="https://...">' +
        '</div>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-act="add-project">Anadir proyecto</button>' +
      '</div>' +
    '</div>';
  }


  function secBadges(p) {
    var have = ID.store.evaluateBadges(p);
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Badges</h1>' +
      '<p>No se compran ni se activan: se desbloquean. Cada uno responde a algo que hiciste.</p>' +
    '</div></div>' +
    '<div class="blk">' +
      '<div class="blk__t">' + have.length + ' de ' + Object.keys(ID.BADGES).length + ' desbloqueados</div>' +
      '<div class="blk__d">Los bloqueados muestran la condición exacta.</div>' +
      '<div class="bdg-grid">' +
        Object.keys(ID.BADGES).map(function (id) {
          var b = ID.BADGES[id];
          var on = have.indexOf(id) !== -1;
          return '<div class="bdg ' + (on ? 'unlocked' : 'locked') + '">' +
            '<span class="bdg__i">' + b.icon + '</span>' +
            '<span><span class="bdg__n">' + esc(b.label) + '</span>' +
            '<span class="bdg__h">' + esc(b.how) + '</span></span>' +
            '<span class="bdg__s">' + (on ? '✓' : '🔒') + '</span>' +
            '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function secAnalytics(p) {
    var a = p.username ? ID.store.analytics(p.username, 30) : null;
    if (!a) {
      return '<div class="dash__h"><div><h1>Analytics</h1>' +
        '<p>Guarda tu perfil para empezar a medir.</p></div></div>';
    }
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Analytics</h1>' +
      '<p>Resumen de 30 días. El detalle completo está en la vista dedicada.</p>' +
    '</div>' +
    '<a class="btn btn--ghost btn--sm" href="#/analytics?u=' + esc(p.username) + '">Ver todo</a></div>' +

    '<div class="mini-stats">' +
      '<div class="mini-stat"><div class="mini-stat__n">' + num(a.total) + '</div>' +
        '<div class="mini-stat__l">Visitas totales</div></div>' +
      '<div class="mini-stat"><div class="mini-stat__n" style="color:' +
        (a.trend >= 0 ? 'var(--online)' : 'var(--dnd)') + '">' +
        (a.trend >= 0 ? '+' : '') + a.trend + '%</div>' +
        '<div class="mini-stat__l">Tendencia</div></div>' +
      '<div class="mini-stat"><div class="mini-stat__n">' + num(a.medidas) + '</div>' +
        '<div class="mini-stat__l">En 30 días</div></div>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Lo que todavía no se puede medir</div>' +
      '<div class="blk__d">País, referente, dispositivo y tiempo de permanencia necesitan un ' +
        'servidor que reciba la visita. Aquí sólo llega lo que pasa por tu navegador, así que ' +
        'aparecen vacíos en vez de inventados.</div>' +
    '</div>';
  }

  function secSettings(p) {
    return '' +
    '<div class="dash__h"><div>' +
      '<h1>Ajustes</h1>' +
      '<p>Qué se muestra y qué no.</p>' +
    '</div></div>' +

    '<div class="blk">' +
      '<div class="blk__t">Tu estilo como plantilla</div>' +
      '<div class="blk__d">Guarda como se ve tu perfil para reutilizarlo o compartirlo. ' +
        'No incluye tu nombre, tu bio ni tus enlaces.</div>' +
      '<a class="btn btn--ghost btn--sm btn--block" href="#/templates?nueva=1">' +
        'Guardar como plantilla</a>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Visibilidad</div>' +
      toggle('discoverable', p.discoverable, 'Aparecer en Descubrir', 'Y en el ranking público') +
      toggle('showStats', p.showStats !== false, 'Mostrar estadísticas', 'Visitas, me gusta y días') +
      toggle('showLevel', p.showLevel !== false, 'Mostrar nivel y XP') +
      toggle('showRate', p.showRate !== false, 'Permitir que me califiquen', 'Activa el bucle de "califica mi perfil"') +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Etiquetas</div>' +
      '<div class="blk__d">Sirven para que te encuentren en Descubrir. Separadas por coma.</div>' +
      field('Etiquetas', (p.tags || []).length + ' etiquetas',
        input('tags', (p.tags || []).join(', '), 'gaming, developer, colombia')) +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Tus datos</div>' +
      '<div class="blk__d">Todo vive en este navegador. Exporta si vas a cambiar de equipo.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-act="export">Exportar JSON</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-act="import">Importar JSON</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-act="copy-link">Copiar enlace para compartir</button>' +
      '</div>' +
    '</div>' +

    '<div class="blk">' +
      '<div class="blk__t">Zona peligrosa</div>' +
      '<div class="blk__d">Borra este perfil de este navegador. No se puede deshacer.</div>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-act="delete" ' +
        'style="border-color:rgba(237,66,69,.4);color:#FF9A9C">Eliminar perfil</button>' +
    '</div>';
  }

  var RENDERERS = {
    overview: secOverview, design: secDesign, blocks: secBlocks,
    appearance: secAppearance, media: secMedia,
    links: secLinks, badges: secBadges, analytics: secAnalytics, settings: secSettings
  };

  /* ---- preview ------------------------------------------------------ */

  /* anchos que simula la vista previa */
  var VP_ANCHO = { desktop: 1180, tablet: 820, mobile: 390 };
  var VP_ALTO  = { desktop: 800,  tablet: 1024, mobile: 780 };

  function escalarPreview(mount) {
    var marco = mount.querySelector('#prevFrame');
    var stage = mount.querySelector('#prevSlot');
    if (!marco || !stage) return;

    var w = marco.clientWidth, h = marco.clientHeight;
    if (!w || !h) return;

    var ancho = VP_ANCHO[state.vp] || VP_ANCHO.desktop;
    /* nunca por encima de 1:1: ampliar un diseño de 1180px solo lo
       vuelve borroso. Si sobra sitio, el escenario se centra. */
    var escala = Math.min(w / ancho, 1);

    stage.style.setProperty('--stage-w', ancho + 'px');
    stage.style.setProperty('--stage-h', Math.round(h / escala) + 'px');
    /* el heroe mide lo que mediria en el dispositivo real */
    stage.style.setProperty('--vp-h', (VP_ALTO[state.vp] || VP_ALTO.desktop) + 'px');
    stage.style.setProperty('--stage-s', escala.toFixed(4));
    /* si el marco es mas ancho que el escenario escalado, lo centramos */
    var sobra = Math.max(0, w - ancho * escala);
    stage.style.setProperty('--stage-x', Math.round(sobra / 2) + 'px');

    var et = mount.querySelector('#prevSize');
    if (et) et.textContent = ancho + '×' + (VP_ALTO[state.vp] || VP_ALTO.desktop) +
      '  \u00b7  ' + Math.round(escala * 100) + '%';
  }

  /* que seccion del panel edita cada bloque del perfil */
  var BLOQUE_SEC = {
    avatar: 'design', identity: 'overview', fields: 'overview',
    status: 'overview', discord: 'overview', bio: 'overview',
    badges: 'badges', socials: 'links', music: 'media',
    live: 'blocks', level: 'blocks', views: 'blocks', stats: 'blocks',
  };

  var BLOQUE_NOMBRE = {
    avatar: 'Avatar', identity: 'Nombre', handle: '@usuario',
    meta: 'Oficio y ubicacion', joined: 'Fecha de registro',
    fields: 'Campos', status: 'Estado',
    discord: 'Discord', bio: 'Biografia', badges: 'Badges', socials: 'Redes',
    music: 'Musica', live: 'Actividad', level: 'Nivel', views: 'Visitas',
    stats: 'Estadisticas'
  };

  function paintPreview(mount) {
    var slot = mount.querySelector('#prevSlot');
    if (!slot) return;
    /* al reconstruir se perdia el punto de lectura del preview */
    var caja = slot.parentNode;
    var scroll = caja ? caja.scrollTop : 0;
    ID.fx.clear();
    slot.innerHTML = ID.views.profile.render(state.p, { preview: true, editable: true });
    ID.views.profile.mount(slot, state.p, { preview: true });
    if (caja && scroll) caja.scrollTop = scroll;
    marcarSeleccion(slot);
    bindClickEditar(mount, slot);
    bindArrastre(mount, slot);
    escalarPreview(mount);
    var url = mount.querySelector('#prevUrl');
    if (url) url.textContent = 'identity.gg/' + (state.p.username || '…');
  }

  function marcarSeleccion(slot) {
    var libre = state.p.layoutMode === 'free';
    slot.querySelectorAll('[data-block]').forEach(function (el) {
      var on = el.getAttribute('data-block') === state.sel;
      el.classList.toggle('is-sel', on);

      /* las asas solo existen en el bloque seleccionado */
      Array.prototype.slice.call(el.children).forEach(function (c) {
        if (c.classList && c.classList.contains('rsz')) c.remove();
      });
      if (on) {
        ['l', 'r'].forEach(function (lado) {
          var h = document.createElement('span');
          h.className = 'rsz rsz--' + lado;
          h.setAttribute('data-rsz', lado);
          h.title = 'Arrastra para cambiar el ancho';
          el.appendChild(h);
        });
      }
    });
  }

  /* Selecciona un bloque y abre SU panel de ajustes.
     Se llama al soltar, no desde un evento click: el pointerdown
     hace preventDefault por las asas y eso cancelaria el click. */
  function seleccionar(mount, slot, id) {
    if (state.sel === id) return;
    state.sel = id;
    marcarSeleccion(slot);
    paintSection(mount);
    var main = mount.querySelector('#dashMain');
    if (main) main.scrollTop = 0;
  }

  function deseleccionar(mount, slot) {
    if (!state.sel) return;
    state.sel = null;
    marcarSeleccion(slot);
    paintSection(mount);
  }

  function bindClickEditar(mount, slot) {
    var raiz = slot.querySelector('.pf');
    if (!raiz) return;
    /* tocar el fondo quita la seleccion */
    raiz.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('[data-block]')) deseleccionar(mount, slot);
    });
  }

  /* ---- arrastrar bloques sobre la vista previa ------------------
     El usuario mueve su perfil con el raton, no con una lista.
     ---------------------------------------------------------------- */
  /* ---- cuantas columnas necesita de verdad un bloque -------------
     Un bloque que ocupa las 12 columnas no tiene a donde ir: la fila
     entera es suya. Pero cuando su contenido es mas estrecho que la
     fila -el avatar es el caso de manual: 86px de 693- ese hueco
     sobrante es AIRE, no bloque. Midiendo lo que ocupa se le ajusta
     el hueco y recupera sitio por donde moverse, sin cambiar ni un
     pixel de como se ve.
     Devuelve null si el bloque SI llena la fila: entonces se queda
     quieto, porque moverlo exigiria estrecharlo, y estrechar es cosa
     de las asas.
     ---------------------------------------------------------------- */
  function spanQueNecesita(el, stack) {
    if (!el || !stack) return null;
    var ancho = stack.getBoundingClientRect().width;
    if (!ancho) return null;
    /* el preview va escalado; el gap del CSS no, hay que llevarlo al
       mismo terreno que las medidas de pantalla */
    var esc = stack.offsetWidth ? ancho / stack.offsetWidth : 1;
    var gap = (parseFloat(getComputedStyle(stack).columnGap) || 0) * esc;
    var col = (ancho - gap * 11) / 12;
    if (col <= 0) return null;
    /* n columnas dan n*col + (n-1)*gap de ancho */
    var n = Math.ceil((el.getBoundingClientRect().width + gap) / (col + gap));
    n = Math.max(1, Math.min(12, n));
    return n < 12 ? n : null;
  }

  function bindArrastre(mount, slot) {
    var stack = slot.querySelector('.pf-stack');
    if (!stack) return;

    var libre = state.p.layoutMode === 'free';
    var arr = null;
    var linea = null;

    function hermanos() {
      return Array.prototype.filter.call(stack.children, function (c) {
        return c.hasAttribute && c.hasAttribute('data-block');
      });
    }

    function quitarLinea() {
      if (linea && linea.parentNode) linea.remove();
      linea = null;
    }

    /* Dentro de la vista previa hay enlaces e imagenes. Al tirar de
       ellos el navegador arranca SU arrastre nativo y se lleva por
       delante el gesto del puntero: por eso un bloque solo se podia
       agarrar por los margenes vacios. */
    stack.addEventListener('dragstart', function (e) { e.preventDefault(); });

    stack.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var asa = e.target.closest('.rsz');
      var el = e.target.closest('[data-block]');
      if (!el || el.parentNode !== stack) return;

      var q = (state.p.pos || {})[el.getAttribute('data-block')] || {};
      arr = {
        el: el, id: el.getAttribute('data-block'),
        x0: e.clientX, y0: e.clientY, activo: false, pid: e.pointerId,
        modo: asa ? 'ancho' : 'mover',
        lado: asa ? asa.getAttribute('data-rsz') : null,
        col0: Math.max(1, Math.min(12, Number(q.col) || 1)),
        span0: Math.max(1, Math.min(12, Number(q.span) || 12)),
        rect0: el.getBoundingClientRect(),
        anchoStack: stack.getBoundingClientRect().width
      };
      /* Por donde lo agarraste, medido dentro de su hueco de la
         rejilla. Sin esto el bloque saltaba para poner su centro bajo
         el cursor: si lo cogias por la derecha se te escapaba de la
         mano, y solo agarrandolo por la izquierda parecia obedecer.
         Se mide contra el hueco y no contra la caja visible para que
         de igual si el bloque esta alineado a un lado. */
      var _ac = arr.anchoStack / 12;
      var _hueco = stack.getBoundingClientRect().left + (arr.col0 - 1) * _ac;
      arr.agarre = Math.max(0, Math.min(arr.span0 * _ac, e.clientX - _hueco));

      if (libre && arr.span0 >= 12 && arr.modo === 'mover') {
        var _cabe = spanQueNecesita(el, stack);
        if (_cabe) {
          arr.spanAuto = _cabe;
          arr.agarre = Math.max(0, Math.min(_cabe * _ac, e.clientX - _hueco));
        }
      }
      /* Solo cancelamos el gesto del navegador al tirar de un asa.
         Hacerlo siempre mataba el click y por eso habia que mover
         un bloque para poder seleccionarlo. */
      if (asa) e.preventDefault();
      try { stack.setPointerCapture(e.pointerId); } catch (err) { /* sin captura seguimos igual */ }
    });

    stack.addEventListener('pointermove', function (e) {
      if (!arr) return;

      if (!arr.activo) {
        /* umbral: por debajo de esto sigue siendo un click */
        if (Math.abs(e.clientX - arr.x0) + Math.abs(e.clientY - arr.y0) < 5) return;
        arr.activo = true;
        if (arr.modo === 'mover') arr.el.classList.add('is-dragging');
        else arr.el.classList.add('is-resizing');
        stack.classList.add('is-dragmode');
        if (libre) stack.classList.add('is-gridhint');
        e.preventDefault();
      }

      /* --- redimensionar --- */
      if (arr.modo === 'ancho' && !libre) {
        /* en columna el bloque tiene su propio ancho en % */
        var px = arr.lado === 'r'
          ? (e.clientX - arr.rect0.left)
          : (arr.rect0.right - e.clientX);
        arr.w = Math.max(15, Math.min(100, Math.round(px / arr.anchoStack * 100)));
        arr.el.style.setProperty('--b-w', arr.w + '%');
        return;
      }

      if (arr.modo === 'ancho') {
        var sr2 = stack.getBoundingClientRect();
        var cw = sr2.width / 12;
        if (arr.lado === 'r') {
          var span = Math.round((e.clientX - sr2.left) / cw) + 1 - arr.col0;
          arr.span = Math.max(1, Math.min(13 - arr.col0, span));
          arr.col = arr.col0;
        } else {
          var derecha = arr.col0 + arr.span0;          /* borde derecho fijo */
          var nuevaCol = Math.round((e.clientX - sr2.left) / cw) + 1;
          arr.col = Math.max(1, Math.min(derecha - 1, nuevaCol));
          arr.span = derecha - arr.col;
        }
        arr.el.style.gridColumn = arr.col + '/span ' + arr.span;
        return;
      }

      /* --- posicion vertical: entre que dos hermanos cae --- */
      var otros = hermanos().filter(function (x) { return x !== arr.el; });
      var destino = null;
      for (var i = 0; i < otros.length; i++) {
        var r = otros[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { destino = otros[i]; break; }
      }
      if (destino) stack.insertBefore(arr.el, destino);
      else stack.appendChild(arr.el);

      /* --- posicion horizontal: solo en modo libre --- */
      if (libre) {
        var sr = stack.getBoundingClientRect();
        var anchoCol = sr.width / 12;
        /* el ancho es del gesto, no se relee: mover nunca lo cambia.
           (Ademas state.p.pos puede no existir aun, y leerlo aqui sin
           red reventaba el arrastre del primer bloque colocado.) */
        var span = arr.spanAuto || arr.span0;
        if (arr.spanAuto) arr.span = arr.spanAuto;

        /* Un bloque a 12 columnas ocupa todo: no tiene hacia donde ir.
           Antes se estrechaba solo a 6 en cuanto lo movias de lado, y
           eso es lo peor de los dos mundos: pedias mover y te
           cambiaba el tamano. Mover mueve; para estrecharlo estan las
           asas de los lados, que aparecen en el bloque seleccionado. */
        var col = Math.round((e.clientX - arr.agarre - sr.left) / anchoCol) + 1;
        col = Math.max(1, Math.min(13 - span, col));
        arr.col = col;
        arr.el.style.gridColumn = col + '/span ' + span;
      }
    });

    function soltar(e) {
      if (!arr) return;
      var era = arr;
      arr = null;
      quitarLinea();
      stack.classList.remove('is-dragmode', 'is-gridhint');
      era.el.classList.remove('is-dragging', 'is-resizing');
      try { stack.releasePointerCapture(era.pid); } catch (err) { /* ya liberado */ }

      if (!era.activo) {
        /* fue un click limpio: seleccionar y mostrar sus ajustes */
        seleccionar(mount, slot, era.id);
        return;
      }

      /* orden nuevo leido del DOM */
      var visibles = hermanos().map(function (x) { return x.getAttribute('data-block'); });
      var expandido = [];
      visibles.forEach(function (id) {
        /* con la cabecera en fila, avatar e identidad son una sola pieza */
        expandido.push(id);
      });

      /* los bloques ocultos conservan su sitio relativo */
      var previos = (state.p.blockOrder || ID.BLOCK_ORDER).slice();
      var enPantalla = previos.filter(function (id) { return expandido.indexOf(id) !== -1; });
      var k = 0;
      var nuevo = previos.map(function (id) {
        return enPantalla.indexOf(id) !== -1 ? expandido[k++] : id;
      });
      state.p.blockOrder = nuevo;

      if (era.w != null) {
        state.p.bstyle = state.p.bstyle || {};
        state.p.bstyle[era.id] = state.p.bstyle[era.id] || {};
        state.p.bstyle[era.id].w = era.w;
      }

      if (libre && era.col) {
        state.p.pos = state.p.pos || {};
        var q = state.p.pos[era.id] || { col: 1, span: 12, align: 'stretch' };
        q.col = era.col;
        if (era.span) q.span = era.span;
        if (q.col + (q.span || 12) > 13) q.span = 13 - q.col;
        state.p.pos[era.id] = q;
      }

      state.sel = era.id;
      /* Ni mover ni redimensionar necesitan reconstruir: el DOM ya
         quedo como toca durante el arrastre. Reaplicar estilos basta
         y evita el parpadeo. */
      touch(mount, 'estilo');
      paintSection(mount);
      marcarSeleccion(slot);
    }

    stack.addEventListener('pointerup', soltar);
    stack.addEventListener('pointercancel', soltar);
  }

  /* escribe un valor anidado con notación de punto */
  function setDeep(obj, path, val) {
    var parts = path.split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = val;
  }

  /* Cambios que obligan a reconstruir porque alteran QUE elementos
     existen, no solo como se ven. */
  var ESTRUCTURALES = {
    bgType: 1, 'status.state': 1, discordWidget: 1, theme: 1,
    /* los efectos de puntero se enganchan en mount(): uno de ellos
       ademas anade su propia capa al DOM. Con 'estilo' no se
       reconstruye nada y el interruptor no haria nada visible. */
    fxMagnet: 1, fxGlow: 1, fxParallax: 1
  };

  function esEstructural(clave) {
    if (!clave) return false;
    if (ESTRUCTURALES[clave]) return true;
    return clave.indexOf('blocks.') === 0 ||
           clave.indexOf('sectionsOn.') === 0 ||
           clave.indexOf('audio.') === 0;
  }

  function touch(mount, tipo) {
    state.dirty = true;

    if (tipo === 'estructura') {
      clearTimeout(state.textoTimer);
      paintPreview(mount);
    } else if (tipo === 'texto') {
      /* agrupado: escribir no debe rehacer el perfil en cada tecla */
      clearTimeout(state.textoTimer);
      state.textoTimer = setTimeout(function () { paintPreview(mount); }, 260);
    } else {
      /* por defecto solo estilo: se aplica encima, sin reconstruir */
      var slot = mount.querySelector('#prevSlot');
      var ok = slot && ID.views.profile.aplicar(slot, state.p, { preview: true });
      if (!ok) paintPreview(mount);
    }

    /* el historial se agrupa: arrastrar un slider no debe generar
       cuarenta pasos de deshacer */
    clearTimeout(state.histTimer);
    state.histTimer = setTimeout(function () {
      histPush();
      refrescarUndo(mount);   /* el paso se apunta DESPUES de guardarlo */
    }, 420);

    autoguardar(mount);
  }

  /* ---- envoltorio de opciones avanzadas ---------------------------
     Progressive disclosure: por defecto solo lo importante. */
  function avanzado(contenido, etiqueta) {
    if (!contenido) return '';
    if (state.modo === 'avanzado') {
      return '<div class="adv adv--open">' +
        '<div class="adv__h">' + esc(etiqueta || 'Avanzado') + '</div>' +
        contenido + '</div>';
    }
    return '<details class="adv"><summary>' + esc(etiqueta || 'Mas opciones') +
      '</summary><div class="adv__b">' + contenido + '</div></details>';
  }

  /* ---- montaje de la sección ---------------------------------------- */

  /* ---- ajustes del bloque seleccionado --------------------------
     Al tocar una caja del preview aparece arriba su propio panel,
     con lo justo para esa caja. Lo demas sigue mas abajo. */
  function panelBloque(p) {
    var id = state.sel;
    if (!id) return '';
    /* el TIPO decide que controles se ensenan; el ID, sobre quien
       se escriben. Asi una copia (bio#2) trae el panel de su tipo
       pero edita su propio contenido. */
    var tipo = ID.util.tipoBloque(id);
    var copia = ID.util.esCopia(id);
    var nombre = (BLOQUE_NOMBRE[tipo] || tipo) + (copia ? ' ' + id.slice(id.indexOf('#')) : '');
    var sw = copia ? id : (BLOQUE_SW[tipo] || tipo);
    var cuerpo = '';

    if (tipo === 'avatar') {
      cuerpo =
        field('Imagen', 'o deja el emoji', input('avatarUrl', p.avatarUrl, 'https://…')) +
        '<button class="btn btn--ghost btn--sm btn--block" type="button" ' +
          'data-act="upload-avatar" style="margin:-6px 0 14px">Subir una imagen</button>' +
        field('Emoji', 'si no hay imagen', input('emoji', p.emoji, '\u25c8')) +
        field('Forma', '', opts('avShape', ID.AV_SHAPES, p.avShape)) +
        field('Tamano', '', escala('avSize', p.avSize, ESC_AVATAR)) +
        field('Animacion', '', opts('avatarFx',
          ID.AVATAR_FX.concat([{ id: 'float', name: 'Flotar' }]), p.avatarFx)) +
        toggle('avBorder', p.avBorder, 'Borde') +
        toggle('avGlow', p.avGlow, 'Halo') +
        avanzado(field('Tamano exacto', '', range('avSize', p.avSize, 40, 240, 'px')),
          'Medida exacta') +
        '';
    } else if (tipo === 'identity') {
      /* Solo el nombre. El @usuario y el oficio son piezas aparte y
         tienen su propio panel: repetir aqui sus campos era tener el
         mismo dato en dos sitios. */
      cuerpo =
        field('Nombre visible', '', input('name', p.name, 'Como te llamas')) +
        toggle('verified', p.verified, 'Marca de verificado') +

        '<div class="blk__sub">Como se ve el nombre</div>' +
        field('Tipografia', 'la de los titulos', fuentes('fontDisplay', p.fontDisplay)) +
        '<div class="f-row">' +
          field('Peso', '', opts('nameWeight', ID.NAME_WEIGHTS, p.nameWeight || '')) +
          field('Caja', '', opts('nameCase', ID.NAME_CASES, p.nameCase || '')) +
        '</div>' +
        toggle('glowName', p.glowName, 'Halo') +
        toggle('animatedName', p.animatedName, 'Degradado en movimiento') +
        avanzado(
          field('Tamano', p.nameSize ? p.nameSize + 'px' : 'automatico',
            range('nameSize', p.nameSize, 0, 96, 'px')) +
          field('Espaciado entre letras', (p.nameSpacing || 0) / 100 + 'em',
            range('nameSpacing', p.nameSpacing, -8, 30, '')),
          'Afinar el nombre');
    } else if (tipo === 'bio') {
      var texto = copia ? (((p.bcontent || {})[id] || {}).text || '') : (p.bio || '');
      var clave = copia ? 'bcontent.' + id + '.text' : 'bio';
      cuerpo =
        field(copia ? 'Texto de este bloque' : 'Biografia', texto.length + ' caracteres',
          textarea(clave, texto, copia ? 'Otro parrafo, con su propia voz.'
                                       : 'Algo que valga la pena leer dos veces.')) +
        (copia ? '' :
          '<div class="blk__sub">Como se lee</div>' +
          field('Tipografia', 'la del cuerpo del perfil', fuentes('font', p.font)) +
          '<div class="f-row">' +
            field('Tamano', p.bioSize ? p.bioSize + 'px' : 'auto',
              range('bioSize', p.bioSize, 0, 28, 'px')) +
            field('Interlineado', p.lineHeight ? (p.lineHeight / 100).toFixed(2) : 'auto',
              range('lineHeight', p.lineHeight, 0, 240, '')) +
          '</div>');
    } else if (tipo === 'handle') {
      cuerpo =
        field('Nombre de usuario', 'tambien es tu direccion',
          input('username', p.username, 'tu-nombre')) +
        '<div class="blk__d">identity.gg/' + esc(p.username || '…') + '</div>';
    } else if (tipo === 'meta') {
      cuerpo =
        field('Que haces', '', input('title', p.title, 'Developer / Gamer')) +
        field('Ubicacion', 'opcional', input('location', p.location, 'Medellin')) +
        avanzado(
          field('Pronombres', 'opcional', input('pronouns', p.pronouns, 'el / ella')) +
          field('Edad', 'opcional', input('age', p.age, '21')),
          'Mas datos');
    } else if (tipo === 'status') {
      cuerpo =
        field('Presencia', '', opts('status.state', ID.STATUS_STATES, (p.status || {}).state)) +
        field('Actividad', '', input('status.activity', (p.status || {}).activity, 'Programando')) +
        field('Detalle', 'opcional', input('status.detail', (p.status || {}).detail, 'VS Code'));
    } else if (tipo === 'socials') {
      var elegidas = ((p.bcontent || {})[id] || {}).nets || [];
      cuerpo = (copia
        ? field('Redes de este grupo',
            elegidas.length ? elegidas.length + ' elegidas' : 'todas',
            '<div class="opts">' + (p.socials || []).map(function (x) {
              var n = ID.NETS[x.net] || { label: x.net };
              return '<button type="button" class="opt' +
                (elegidas.indexOf(x.net) !== -1 ? ' on' : '') +
                '" data-neton="' + esc(id) + ':' + esc(x.net) + '">' +
                esc(n.label) + '</button>';
            }).join('') + '</div>') +
          '<div class="blk__d" style="margin:-4px 0 12px">Sin ninguna elegida ensena todas.</div>'
        : '') +
        field('Estilo', '', opts('socialStyle', ID.SOCIAL_STYLES, p.socialStyle)) +
        field('Tamano', '', range('iconSize', p.iconSize, 12, 40, 'px')) +
        toggle('monoIcons', p.monoIcons !== false, 'Iconos monocromos',
          'Apagalo y cada red usa su color de marca') +
        toggle('glowSocials', p.glowSocials, 'Halo',
          'Sigue la silueta del icono, no una caja') +
        '<button class="btn btn--ghost btn--sm btn--block" type="button" ' +
          'data-ir="links" style="margin-top:10px">Anadir o quitar redes</button>';
    } else if (tipo === 'music') {
      cuerpo =
        field('Estilo', '', opts('musicStyle', ID.MUSIC_STYLES, p.musicStyle)) +
        '<div class="f-row">' +
          field('Titulo', '', input('audio.title', (p.audio || {}).title, 'Cancion')) +
          field('Artista', '', input('audio.artist', (p.audio || {}).artist, 'Artista')) +
        '</div>';
    } else if (tipo === 'badges') {
      cuerpo =
        field('Estilo', '', opts('badgeStyle', [
          { id: 'full', name: 'Con texto' }, { id: 'icons', name: 'Solo icono' }
        ], p.badgeStyle)) +
        toggle('glowBadges', p.glowBadges, 'Con halo') +
        '<button class="btn btn--ghost btn--sm btn--block" type="button" ' +
          'data-ir="badges" style="margin-top:10px">Ver todos los badges</button>';
    } else if (tipo === 'links') {
      cuerpo = '<button class="btn btn--ghost btn--sm btn--block" type="button" ' +
        'data-ir="links">Gestionar los enlaces</button>';
    } else {
      cuerpo = '<div class="blk__d" style="margin:0 0 12px">' +
        'Este bloque no tiene ajustes propios: se enciende, se apaga y se mueve.</div>' +
        '<button class="btn btn--ghost btn--sm btn--block" type="button" ' +
          'data-ir="' + esc(BLOQUE_SEC[tipo] || 'blocks') + '">Ir a su seccion</button>';
    }

    /* ---- caja propia de este bloque ---- */
    var bs = (p.bstyle || {})[id] || {};
    var tieneCaja = bs.s && bs.s !== 'inherit';
    var opDef = bs.s === 'glass' ? 10 : bs.s === 'solid' ? 92 : bs.s === 'glow' ? 55 : 0;
    /* La pieza puede llevar su propia cara y su propia entrada
       aunque no tenga caja: son suyas, no de la superficie. */
    /* si el panel del tipo ya ofrece su tipografia (nombre, texto),
       no se repite aqui con otro significado: seria la misma rejilla
       dos veces en la misma pantalla */
    var yaTieneFuente = (tipo === 'identity' || tipo === 'bio') && !copia;
    var propioUI =
      '<div class="blk__sub">Solo de esta pieza</div>' +
      color('bstyle.' + id + '.color', bs.color, 'Color', 'vacio = el del tema') +
      color('bstyle.' + id + '.halo', bs.halo, 'Halo', 'vacio = el del tema') +
      (yaTieneFuente ? '' :
        field('Tipografia', 'vacio = la del perfil', fuentes('bstyle.' + id + '.font', bs.font || ''))) +
      field('Animacion de entrada', '',
        opts('bstyle.' + id + '.anim', ID.BLOCK_ANIMS, bs.anim || '')) +
      (ID.BLOQUES_DUPLICABLES.indexOf(tipo) !== -1
        ? '<button class="btn btn--ghost btn--sm btn--block" type="button" ' +
            'data-dup="' + esc(id) + '" style="margin-top:8px">Duplicar esta pieza</button>'
        : '') +
      (copia
        ? '<button class="btn btn--ghost btn--sm btn--block" type="button" ' +
            'data-quitarcopia="' + esc(id) + '" style="margin-top:8px">Quitar esta copia</button>'
        : '');

    var cajaUI = ID.BLOQUES_CON_CAJA.indexOf(tipo) === -1 ? '' :
      '<div class="blk__sub">Su caja</div>' +
      field('Estilo', 'sin caja salvo que la pidas',
        opts('bstyle.' + id + '.s', ID.BLOCK_SURFACES, bs.s || 'inherit')) +
      (tieneCaja
        ? field('Relleno', '', range('bstyle.' + id + '.pad', bs.pad == null ? 14 : bs.pad, 0, 56, 'px')) +
          field('Curvatura', '', range('bstyle.' + id + '.rad', bs.rad == null ? 14 : bs.rad, 0, 44, 'px')) +
          avanzado(
            field('Opacidad', '', range('bstyle.' + id + '.op', bs.op == null ? opDef : bs.op, 0, 100, '%')) +
            field('Borde', '', range('bstyle.' + id + '.bd', bs.bd == null ? 18 : bs.bd, 0, 100, '%')) +
            (bs.s === 'glass'
              ? field('Desenfoque', '', range('bstyle.' + id + '.blur', bs.blur == null ? 18 : bs.blur, 0, 44, 'px'))
              : '') +
            (bs.s === 'glow'
              ? field('Intensidad del halo', '', range('bstyle.' + id + '.glow', bs.glow == null ? 40 : bs.glow, 0, 100, ''))
              : ''),
            'Ajustar la caja')
        : '') +
      field('Ancho', bs.w == null ? 'automatico' : bs.w + '%',
        range('bstyle.' + id + '.w', bs.w == null ? 100 : bs.w, 15, 100, '%')) +
      '<div class="blk__d" style="margin:6px 0 0">Tambien puedes tirar de los bordes ' +
        'del bloque en el preview.</div>';

    /* posicion, solo cuando tiene sentido */
    var q = (p.pos || {})[id] || {};
    var pos = p.layoutMode === 'free'
      ? '<div class="f__l" style="margin-top:14px"><span>Posicion</span>' +
        '<em>columna ' + (q.col || 1) + ' \u00b7 ancho ' + (q.span || 12) + '</em></div>' +
        '<span class="posctl posctl--wide" role="group" aria-label="Posicion">' +
          '<button type="button" data-mv="' + id + ':-1" title="Izquierda">\u2190</button>' +
          '<button type="button" data-mv="' + id + ':1" title="Derecha">\u2192</button>' +
          '<button type="button" data-sp="' + id + ':-1" title="Mas angosto">\u2212</button>' +
          '<button type="button" data-sp="' + id + ':1" title="Mas ancho">+</button>' +
          '<button type="button" data-al="' + id + '" title="Alinear">\u2194</button>' +
        '</span>' +
        '<div class="blk__d" style="margin:8px 0 0">Tambien puedes arrastrarlo en el ' +
          'preview, o tirar de sus bordes para cambiar el ancho.</div>'
      : '';

    return '<div class="blk blk--sel">' +
      '<div class="blk__sel">' +
        '<span class="blk__seldot"></span>' +
        '<b>' + esc(nombre) + '</b>' +
        '<button type="button" class="sw-box' + (p.blocks[sw] !== false ? ' on' : '') +
          '" data-sw="blocks.' + sw + '" role="switch" ' +
          'aria-checked="' + (p.blocks[sw] !== false) + '" aria-label="Mostrar ' + esc(nombre) + '"></button>' +
        '<button type="button" class="row-it__x" id="selClose" aria-label="Cerrar">\u00d7</button>' +
      '</div>' +
      /* Lo que la pieza ES va siempre visible. Lo que la afina
         —su caja, su animacion, su sitio exacto— se pliega en modo
         Simple: son decisiones de milimetros, y quien esta creando
         su primera bio no deberia tropezarse con ellas.
         En modo Avanzado se abren solas. */
      cuerpo + avanzado(propioUI + cajaUI + pos, 'Ajustes finos') +
    '</div>';
  }

  /* Ir a una seccion siempre suelta la pieza que estuviera abierta:
     una cosa a la vez. */
  function irA(sec, mount) {
    state.sel = null;
    state.sec = sec;
    paintSection(mount);
    var slot = mount.querySelector('#prevSlot');
    if (slot) marcarSeleccion(slot);
  }

  function paintSection(mount) {
    var main = mount.querySelector('#dashMain');
    var sel = panelBloque(state.p);
    var nombreSec = (SECTIONS.filter(function (x) { return x.id === state.sec; })[0] || {}).name || 'la seccion';
    main.innerHTML = (sel
      /* una cosa a la vez: o ajustas una pieza, o miras la seccion */
      ? sel + '<button class="btn btn--ghost btn--sm btn--block" type="button" id="selVolver" ' +
              'style="margin-top:4px">\u2190 Volver a ' + esc(nombreSec) + '</button>'
      : (RENDERERS[state.sec] || secOverview)(state.p)) +
      '<div class="dash__actions">' +
        '<span class="savestate' + (state.saveError ? ' err' : '') + '" id="saveState">' +
          (state.saveError ? 'Error al guardar'
            : state.dirty ? 'Sin guardar' : 'Guardado') + '</span>' +
        '<span class="undo">' +
          '<button class="btn btn--ghost btn--sm" id="undoBtn" type="button" ' +
            'title="Deshacer" aria-label="Deshacer"' +
            (state.hi <= 0 ? ' disabled' : '') + '>\u21b6</button>' +
          '<button class="btn btn--ghost btn--sm" id="redoBtn" type="button" ' +
            'title="Rehacer" aria-label="Rehacer"' +
            (state.hi >= state.hist.length - 1 ? ' disabled' : '') + '>\u21b7</button>' +
        '</span>' +
        '<button class="btn btn--primary" id="pubBtn" type="button">Publicar</button>' +
        '<a class="btn btn--ghost" id="viewBtn" href="#/u/' + esc(state.p.username || '') + '">Ver perfil</a>' +
      '</div>';

    mount.querySelectorAll('.dash__nav a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-sec') === state.sec);
    });

    bind(mount);
  }

  /* ---- música: YouTube y Spotify ---------------------------------- */
  function bindMusica(mount) {
    var main = mount.querySelector('#dashMain');

    /* --- YouTube --- */
    var yt = main.querySelector('#ytUrl');
    if (yt) {
      var temp = 0;
      yt.addEventListener('input', function () {
        clearTimeout(temp);
        temp = setTimeout(function () {
          var url = yt.value.trim();
          var id = ID.music.idYouTube(url);
          if (!id) return;

          var t = { src: 'youtube', yt: id, ytUrl: url,
                    cover: ID.music.miniaturaYouTube(id), title: 'Canción', artist: '' };

          /* oEmbed es público y no necesita clave: sirve para el título */
          fetch('https://www.youtube.com/oembed?format=json&url=' +
                encodeURIComponent('https://www.youtube.com/watch?v=' + id))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
              if (d) { t.title = d.title || t.title; t.artist = d.author_name || ''; }
            })
            .catch(function () { /* sin red nos quedamos con el nombre genérico */ })
            .then(function () {
              pistas(state.p).push(t);
              sincronizarAudio(state.p);
              state.p.audio.src = 'youtube';
              yt.value = '';
              touch(mount, 'estructura');
              paintSection(mount);
              ID.app.toast('Añadida: ' + t.title);
            });
        }, 420);
      });
    }

    /* --- Spotify --- */
    var caja = main.querySelector('#spBox');
    if (!caja) return;
    pintarSpotify(mount, caja);
  }

  function pintarSpotify(mount, caja) {
    var sp = ID.music.spotify;
    var a = state.p.audio || {};

    if (!sp.clientId()) {
      caja.innerHTML =
        '<div class="blk__d" style="margin:-6px 0 12px">Spotify no deja conectar cuentas ' +
        'desde una página anónima: necesita una app registrada. Crea una en ' +
        '<b>developer.spotify.com</b>, añade esta URI de retorno y pega su Client ID.</div>' +
        '<div class="f"><label class="f__l"><span>URI de retorno</span></label>' +
          '<div class="f-pre"><input class="inp inp--mono" id="spRedir" readonly value="' +
          esc(sp.redirect()) + '">' +
          '<button class="btn btn--quiet btn--sm" type="button" id="spCopiar">Copiar</button></div></div>' +
        '<div class="f"><label class="f__l"><span>Client ID</span></label>' +
          '<input class="inp" id="spCid" placeholder="pega aquí el Client ID"></div>' +
        '<button class="btn btn--primary btn--sm btn--block" type="button" id="spGuardar">Guardar</button>';

      caja.querySelector('#spCopiar').addEventListener('click', function () {
        ID.app.copy(sp.redirect(), 'URI copiada');
      });
      caja.querySelector('#spGuardar').addEventListener('click', function () {
        var v = caja.querySelector('#spCid').value.trim();
        if (!v) { ID.app.toast('Falta el Client ID', true); return; }
        sp.setClientId(v);
        pintarSpotify(mount, caja);
      });
      return;
    }

    if (!sp.conectado()) {
      caja.innerHTML =
        '<div class="blk__d" style="margin:-6px 0 12px">Conecta tu cuenta para elegir una ' +
        'canción de tus playlists.</div>' +
        '<button class="btn btn--primary btn--sm btn--block" type="button" id="spConectar">' +
          'Conectar con Spotify</button>' +
        '<button class="btn btn--quiet btn--sm btn--block" type="button" id="spOtroCid" ' +
          'style="margin-top:6px">Cambiar el Client ID</button>';
      caja.querySelector('#spConectar').addEventListener('click', function () {
        sp.conectar().catch(function (e) { ID.app.toast(e.message, true); });
      });
      caja.querySelector('#spOtroCid').addEventListener('click', function () {
        sp.setClientId(''); pintarSpotify(mount, caja);
      });
      return;
    }

    caja.innerHTML =
      (a.src === 'spotify' && a.title
        ? '<div class="sptrack sptrack--on">' +
            (a.cover ? '<img src="' + esc(a.cover) + '" alt="">' : '<span>♪</span>') +
            '<div><b>' + esc(a.title) + '</b><span>' + esc(a.artist || '') + '</span></div>' +
            (a.preview ? '<i class="sptrack__ok">30s</i>' : '<i class="sptrack__no">sin audio</i>') +
          '</div>'
        : '') +
      '<div class="splists" id="spListas"><p class="blk__d">Cargando tus playlists…</p></div>' +
      '<button class="btn btn--quiet btn--sm btn--block" type="button" id="spSalir" ' +
        'style="margin-top:10px">Desconectar</button>';

    caja.querySelector('#spSalir').addEventListener('click', function () {
      sp.desconectar(); pintarSpotify(mount, caja);
    });

    var cont = caja.querySelector('#spListas');
    sp.playlists().then(function (ls) {
      if (!ls.length) { cont.innerHTML = '<p class="blk__d">No hay playlists en tu cuenta.</p>'; return; }
      cont.innerHTML = ls.map(function (l) {
        return '<button type="button" class="splist" data-pl="' + esc(l.id) + '">' +
          (l.cover ? '<img src="' + esc(l.cover) + '" alt="">' : '<span>♪</span>') +
          '<b>' + esc(l.nombre) + '</b><i>' + l.total + '</i></button>';
      }).join('');
      cont.querySelectorAll('[data-pl]').forEach(function (b) {
        b.addEventListener('click', function () { abrirPlaylist(mount, caja, b.getAttribute('data-pl')); });
      });
    }).catch(function (e) {
      cont.innerHTML = '<p class="blk__d">No se pudieron cargar: ' + esc(e.message) + '</p>';
    });
  }

  function abrirPlaylist(mount, caja, id) {
    var cont = caja.querySelector('#spListas');
    cont.innerHTML = '<p class="blk__d">Cargando canciones…</p>';
    ID.music.spotify.canciones(id).then(function (ts) {
      cont.innerHTML =
        '<button type="button" class="btn btn--quiet btn--sm" id="spVolver">← Playlists</button>' +
        '<div class="sptracks">' + ts.map(function (t) {
          return '<button type="button" class="sptrack" data-tr="' + esc(t.id) + '">' +
            (t.cover ? '<img src="' + esc(t.cover) + '" alt="">' : '<span>♪</span>') +
            '<div><b>' + esc(t.nombre) + '</b><span>' + esc(t.artista) + '</span></div>' +
            (t.preview ? '<i class="sptrack__ok">30s</i>' : '<i class="sptrack__no">sin audio</i>') +
            '</button>';
        }).join('') + '</div>';

      cont.querySelector('#spVolver').addEventListener('click', function () {
        pintarSpotify(mount, caja);
      });
      cont.querySelectorAll('[data-tr]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = ts.filter(function (x) { return x.id === b.getAttribute('data-tr'); })[0];
          if (!t) return;
          pistas(state.p).push({
            src: 'spotify', title: t.nombre, artist: t.artista,
            cover: t.cover, preview: t.preview, url: t.url,
            length: ID.music.duracion(t.duracion)
          });
          sincronizarAudio(state.p);
          state.p.audio.src = 'spotify';
          touch(mount, 'estructura');
          paintSection(mount);
          ID.app.toast(t.preview
            ? 'Añadida: ' + t.nombre
            : 'Añadida sin audio: Spotify no da fragmento para esa pista');
        });
      });
    }).catch(function (e) {
      cont.innerHTML = '<p class="blk__d">No se pudieron cargar: ' + esc(e.message) + '</p>';
    });
  }

  /* ---- selector de redes ------------------------------------------ */
  function bindNetPicker(mount) {
    var box = mount.querySelector('.netpick');
    if (!box) return;

    var grid   = box.querySelector('#npGrid');
    var search = box.querySelector('#npSearch');
    var name   = box.querySelector('#npName');
    var form   = box.querySelector('#npForm');
    var group  = 'all';

    function visibles() {
      return grid.querySelectorAll('.nettile:not([hidden])').length;
    }

    function filtrar() {
      var q = (search.value || '').trim().toLowerCase();
      grid.querySelectorAll('.nettile').forEach(function (t) {
        var okG = group === 'all' || t.getAttribute('data-group') === group;
        var okQ = !q || t.getAttribute('data-label').indexOf(q) !== -1;
        t.hidden = !(okG && okQ);
      });
      var n = visibles();
      name.textContent = n ? n + (n === 1 ? ' servicio' : ' servicios') : 'Sin resultados';
    }

    search.addEventListener('input', filtrar);

    box.querySelectorAll('[data-npg]').forEach(function (c) {
      c.addEventListener('click', function () {
        group = c.getAttribute('data-npg');
        box.querySelectorAll('[data-npg]').forEach(function (x) { x.classList.toggle('on', x === c); });
        filtrar();
      });
    });

    /* el nombre de la red se lee arriba: asi la rejilla no necesita etiquetas */
    grid.addEventListener('mouseover', function (e) {
      var t = e.target.closest('.nettile');
      if (t) name.textContent = ID.NETS[t.getAttribute('data-net')].label;
    });
    grid.addEventListener('mouseleave', filtrar);
    grid.addEventListener('focusin', function (e) {
      var t = e.target.closest('.nettile');
      if (t) name.textContent = ID.NETS[t.getAttribute('data-net')].label;
    });

    grid.addEventListener('click', function (e) {
      var t = e.target.closest('.nettile');
      if (!t) return;
      abrir(t.getAttribute('data-net'));
    });

    function abrir(netId) {
      var n = ID.NETS[netId];
      grid.querySelectorAll('.nettile').forEach(function (x) {
        x.classList.toggle('on', x.getAttribute('data-net') === netId);
      });

      form.hidden = false;
      form.innerHTML =
        '<div class="netpick__head" style="--brand:' + n.color + '">' +
          '<span class="netpick__ico">' + n.icon + '</span>' +
          '<b>' + esc(n.label) + '</b>' +
          '<button class="row-it__x" type="button" id="npCancel" aria-label="Cerrar">\u00d7</button>' +
        '</div>' +
        (n.custom
          ? '<div class="f-row">' +
              '<input class="inp" id="npEmoji" placeholder="Emoji" maxlength="4">' +
              '<input class="inp" id="npTitulo" placeholder="Nombre a mostrar">' +
            '</div>'
          : '') +
        '<div class="f-pre">' +
          (n.prefix ? '<span>' + esc(n.prefix) + '</span>' : '') +
          '<input class="inp" id="npValor" placeholder="' + esc(n.ph) + '" autocomplete="off">' +
        '</div>' +
        '<div class="netpick__acts">' +
          '<button class="btn btn--primary btn--sm" type="button" id="npAdd">Anadir</button>' +
        '</div>';

      var valor = form.querySelector('#npValor');
      valor.focus();

      form.querySelector('#npCancel').addEventListener('click', cerrar);
      form.querySelector('#npAdd').addEventListener('click', function () { anadir(netId); });
      valor.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); anadir(netId); }
      });
    }

    function cerrar() {
      form.hidden = true;
      form.innerHTML = '';
      grid.querySelectorAll('.nettile').forEach(function (x) { x.classList.remove('on'); });
    }

    function anadir(netId) {
      var n = ID.NETS[netId];
      var v = (form.querySelector('#npValor').value || '').trim();
      if (!v) { ID.app.toast('Falta el dato', true); return; }

      /* si ya pegaron una URL completa la respetamos; si no, anteponemos el prefijo */
      var url = /^(https?:|mailto:)/i.test(v) ? v : (n.prefix || '') + v.replace(/^@/, '');

      var entrada = { net: netId, url: url, label: '' };
      if (n.custom) {
        entrada.emoji = (form.querySelector('#npEmoji').value || '\ud83d\udd17').trim();
        entrada.label = (form.querySelector('#npTitulo').value || 'Enlace').trim();
      }

      state.p.socials = state.p.socials || [];
      state.p.socials.push(entrada);
      touch(mount, 'estructura');
      paintSection(mount);
      ID.app.toast(n.label + ' anadido');
    }
  }

  function bind(mount) {
    var main = mount.querySelector('#dashMain');

    /* texto y áreas de texto */
    main.querySelectorAll('[data-k]').forEach(function (el) {
      el.addEventListener('input', function () {
        var k = el.getAttribute('data-k');
        var v = el.value;
        if (k === 'username') { v = ID.util.slug(v); if (el.value !== v) el.value = v; }
        if (k === 'tags' || k === 'gallery') {
          v = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        }
        setDeep(state.p, k, v);
        /* los textos se agrupan; las listas cambian la estructura */
        touch(mount, (k === 'tags' || k === 'gallery') ? 'estructura' : 'texto');
      });
    });

    /* opciones */
    main.querySelectorAll('[data-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-opt');
        setDeep(state.p, k, b.getAttribute('data-v'));
        main.querySelectorAll('[data-opt="' + k + '"]').forEach(function (x) {
          x.classList.toggle('on', x === b);
        });
        /* estos cambian qué controles existen, así que se repinta el panel */
        if (k === 'bgType' || k === 'surface' || k === 'align' ||
            k === 'widthMode' || k === 'layoutMode' || k === 'audio.src' ||
            /^bstyle\..+\.s$/.test(k)) {
          touch(mount, esEstructural(k) ? 'estructura' : 'estilo');
          paintSection(mount);
          return;
        }
        touch(mount, esEstructural(k) ? 'estructura' : 'estilo');
      });
    });

    /* interruptores */
    main.querySelectorAll('[data-sw]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sw');
        var next = !b.classList.contains('on');
        b.classList.toggle('on', next);
        b.setAttribute('aria-checked', String(next));
        setDeep(state.p, k, next);
        touch(mount, esEstructural(k) ? 'estructura' : 'estilo');
      });
    });

    /* rangos */
    main.querySelectorAll('[data-rg]').forEach(function (r) {
      r.addEventListener('input', function () {
        var out = r.parentNode.querySelector('output');
        var unit = /noise|Dim/.test(r.getAttribute('data-rg')) ? '%' : 'px';
        if (r.getAttribute('data-rg') === 'bgDim' || r.getAttribute('data-rg') === 'noise') unit = '%';
        if (out) out.textContent = r.value + unit;
        setDeep(state.p, r.getAttribute('data-rg'), Number(r.value));
        touch(mount, 'estilo');
      });
    });

    /* temas */
    main.querySelectorAll('[data-theme]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.p.theme = b.getAttribute('data-theme');
        main.querySelectorAll('[data-theme]').forEach(function (x) { x.classList.toggle('on', x === b); });
        touch(mount, 'estilo');
      });
    });

    /* acento */
    main.querySelectorAll('[data-accent]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.p.accent = b.getAttribute('data-accent');
        main.querySelectorAll('[data-accent]').forEach(function (x) { x.classList.toggle('on', x === b); });
        touch(mount, 'estilo');
      });
    });
    var custom = main.querySelector('[data-accent-custom]');
    if (custom) {
      custom.addEventListener('input', function () {
        state.p.accent = custom.value;
        main.querySelectorAll('[data-accent]').forEach(function (x) { x.classList.remove('on'); });
        touch(mount, 'estilo');
      });
    }

    /* variante de enlace */
    main.querySelectorAll('[data-lvar]').forEach(function (s) {
      s.addEventListener('change', function () {
        var i = Number(s.getAttribute('data-lvar'));
        state.p.links[i].variant = s.value;
        touch(mount, 'estilo');
      });
    });

    /* eliminar de una lista */
    main.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        /* soporta rutas anidadas como audio.tracks */
        var partes = b.getAttribute('data-del').split('.');
        var obj = state.p;
        for (var i = 0; i < partes.length - 1; i++) obj = obj[partes[i]] || {};
        var arr = obj[partes[partes.length - 1]];
        if (!Array.isArray(arr)) return;
        arr.splice(Number(b.getAttribute('data-i')), 1);
        if (partes[0] === 'audio') sincronizarAudio(state.p);
        /* borrar cambia QUE elementos existen: es estructural */
        touch(mount, 'estructura');
        paintSection(mount);
      });
    });

    /* reordenar arrastrando */
    main.querySelectorAll('[data-list]').forEach(function (box) {
      var list = box.getAttribute('data-list');
      var from = null;
      box.querySelectorAll('.row-it').forEach(function (row) {
        row.addEventListener('dragstart', function () {
          from = Number(row.getAttribute('data-i'));
          row.classList.add('is-drag');
        });
        row.addEventListener('dragend', function () { row.classList.remove('is-drag'); });
        row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('is-over'); });
        row.addEventListener('dragleave', function () { row.classList.remove('is-over'); });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          row.classList.remove('is-over');
          var to = Number(row.getAttribute('data-i'));
          if (from === null || from === to) return;
          var partes = list.split('.');
          var obj = state.p;
          for (var k = 0; k < partes.length - 1; k++) obj = obj[partes[k]] || {};
          var arr = obj[partes[partes.length - 1]];
          if (!Array.isArray(arr)) return;
          arr.splice(to, 0, arr.splice(from, 1)[0]);
          if (partes[0] === 'audio') sincronizarAudio(state.p);
          touch(mount, 'estructura');
          paintSection(mount);
        });
      });
    });

    /* tocar el nombre de un bloque abre sus opciones */
    main.querySelectorAll('[data-abrir]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        state.sel = b.getAttribute('data-abrir');
        paintSection(mount);
        marcarSeleccion(mount.querySelector('#prevSlot'));
      });
    });

    /* acciones */
    main.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () { action(b.getAttribute('data-act'), mount); });
    });

    /* ---- piezas: duplicar y quitar ------------------------------
       Duplicar crea una pieza NUEVA con su propio id, no otra copia
       del mismo bloque: hereda el estilo para que no aparezca
       desnuda, pero a partir de ahi vive su vida. */
    main.querySelectorAll('[data-dup]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var origen = b.getAttribute('data-dup');
        var tipo = ID.util.tipoBloque(origen);
        var orden = state.p.blockOrder || [];
        var nuevo = ID.util.nuevaCopia(tipo, orden);

        orden.splice(orden.indexOf(origen) + 1, 0, nuevo);
        state.p.blockOrder = orden;

        /* hereda el estilo del original; el contenido arranca vacio
           para que se note que hay que darle voz propia */
        var bs = (state.p.bstyle || {})[origen];
        if (bs) {
          state.p.bstyle = state.p.bstyle || {};
          state.p.bstyle[nuevo] = JSON.parse(JSON.stringify(bs));
        }
        state.p.bcontent = state.p.bcontent || {};
        if (tipo === 'bio') state.p.bcontent[nuevo] = { text: '' };

        state.sel = nuevo;
        touch(mount, 'estructura');
        paintSection(mount);
        ID.app.toast('Pieza duplicada \u00b7 dale su propio contenido');
      });
    });

    main.querySelectorAll('[data-quitarcopia]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = b.getAttribute('data-quitarcopia');
        state.p.blockOrder = (state.p.blockOrder || []).filter(function (x) { return x !== id; });
        /* no se deja basura indexada por un id que ya no existe */
        [state.p.bstyle, state.p.pos, state.p.bcontent, state.p.blocks].forEach(function (m) {
          if (m) delete m[id];
        });
        if (state.sel === id) state.sel = null;
        touch(mount, 'estructura');
        paintSection(mount);
        ID.app.toast('Copia eliminada');
      });
    });

    /* que redes ensena un grupo concreto */
    main.querySelectorAll('[data-neton]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-neton');
        var id = t.slice(0, t.lastIndexOf(':'));
        var net = t.slice(t.lastIndexOf(':') + 1);
        state.p.bcontent = state.p.bcontent || {};
        var c = state.p.bcontent[id] = state.p.bcontent[id] || {};
        var lista = c.nets = c.nets || [];
        var i = lista.indexOf(net);
        if (i === -1) lista.push(net); else lista.splice(i, 1);
        b.classList.toggle('on', i === -1);
        touch(mount, 'estructura');
      });
    });


    /* selector de fuente */
    main.querySelectorAll('[data-fuente]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-fuente');
        /* la clave puede ser una ruta ('bstyle.bio#2.font'), asi que
           se escribe con setDeep y no como clave literal */
        var clave = t.slice(0, t.lastIndexOf(':'));
        setDeep(state.p, clave, t.slice(t.lastIndexOf(':') + 1));
        main.querySelectorAll('[data-fuente^="' + clave + ':"]').forEach(function (x) {
          x.classList.toggle('on', x === b);
        });
        touch(mount, 'estilo');
      });
    });

    /* opciones con nombre humano que escriben un numero */
    main.querySelectorAll('[data-num]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-num').split(':');
        setDeep(state.p, t[0], Number(t[1]));
        main.querySelectorAll('[data-num^="' + t[0] + ':"]').forEach(function (x) {
          x.classList.toggle('on', x === b);
        });
        touch(mount, 'estilo');
      });
    });

    /* campos de color */
    main.querySelectorAll('[data-col]').forEach(function (el) {
      el.addEventListener('input', function () {
        setDeep(state.p, el.getAttribute('data-col'), el.value);
        var hex = el.parentNode.querySelector('.col-hex');
        if (hex) hex.textContent = el.value;
        touch(mount, 'estilo');
      });
    });
    main.querySelectorAll('[data-colclear]').forEach(function (b) {
      b.addEventListener('click', function () {
        setDeep(state.p, b.getAttribute('data-colclear'), '');
        touch(mount, 'estilo');
        paintSection(mount);
      });
    });

    /* los pasos del progreso llevan a la sección que los resuelve */
    main.querySelectorAll('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () {
        irA(b.getAttribute('data-goto'), mount);
      });
    });

    /* posicion libre: columna, ancho y alineacion por bloque */
    function pos(id) {
      state.p.pos = state.p.pos || {};
      state.p.pos[id] = state.p.pos[id] || { col: 1, span: 12, align: 'stretch' };
      return state.p.pos[id];
    }

    main.querySelectorAll('[data-mv]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-mv').split(':');
        var q = pos(t[0]);
        /* Mover conserva el ancho y se para en el borde. Antes se
           empujaba la columna hasta la 12 y luego se recortaba el
           span para que cupiera: el bloque se encogia solo por
           moverlo a la derecha. */
        var span = Math.max(1, Math.min(12, q.span || 12));
        if (span >= 12) {
          /* mismo aire que en el arrastre: si no llena la fila, se le
             ajusta el hueco para que tenga por donde moverse */
          var slotPrev = mount.querySelector('#prevSlot');
          var cabe = slotPrev && spanQueNecesita(
            slotPrev.querySelector('[data-block="' + t[0] + '"]'),
            slotPrev.querySelector('.pf-stack'));
          if (cabe) span = cabe;
        }
        q.col = Math.max(1, Math.min(13 - span, (q.col || 1) + Number(t[1])));
        q.span = span;
        touch(mount, 'estructura'); paintSection(mount);
      });
    });

    main.querySelectorAll('[data-sp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-sp').split(':');
        var q = pos(t[0]);
        q.span = Math.max(1, Math.min(13 - (q.col || 1), (q.span || 12) + Number(t[1])));
        touch(mount, 'estructura'); paintSection(mount);
      });
    });

    main.querySelectorAll('[data-al]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = pos(b.getAttribute('data-al'));
        var ciclo = ['stretch', 'start', 'center', 'end'];
        q.align = ciclo[(ciclo.indexOf(q.align || 'stretch') + 1) % ciclo.length];
        touch(mount, 'estructura'); paintSection(mount);
      });
    });

    /* botones de "ir a la seccion" y cerrar la seleccion */
    main.querySelectorAll('[data-ir]').forEach(function (b) {
      b.addEventListener('click', function () {
        irA(b.getAttribute('data-ir'), mount);
        return;
      });
    });
    var volver = main.querySelector('#selVolver');
    if (volver) volver.addEventListener('click', function () {
      state.sel = null;
      paintSection(mount);
      marcarSeleccion(mount.querySelector('#prevSlot'));
    });

    var cerrarSel = main.querySelector('#selClose');
    if (cerrarSel) {
      cerrarSel.addEventListener('click', function () {
        state.sel = null;
        var slot = mount.querySelector('#prevSlot');
        if (slot) marcarSeleccion(slot);
        paintSection(mount);
      });
    }

    bindMusica(mount);
    bindNetPicker(mount);

    var undo = mount.querySelector('#undoBtn');
    if (undo) undo.addEventListener('click', function () { histIr(-1, mount); });
    var redo = mount.querySelector('#redoBtn');
    if (redo) redo.addEventListener('click', function () { histIr(1, mount); });
    var pub = mount.querySelector('#pubBtn');
    if (pub) pub.addEventListener('click', function () { publicar(mount); });
  }

  function action(name, mount) {
    var p = state.p;
    switch (name) {
      case 'upload-avatar':
        ID.app.pickFile('image/*', function (data) {
          p.avatarUrl = data; touch(mount, 'estructura'); paintSection(mount);
        }, { media: 'avatar' });
        break;
      case 'upload-bg': {
        var fondoAnterior = p.bgValue;
        ID.app.pickFile(p.bgType === 'video' ? 'video/*' : 'image/*', function (data) {
          p.bgValue = data;
          /* el video que acaba de ser sustituido ya no lo referencia
             nadie: si no se borra, se queda ocupando disco para siempre */
          if (ID.media && ID.media.esRef(fondoAnterior) && fondoAnterior !== data) {
            ID.media.borrar(fondoAnterior);
          }
          touch(mount, 'estructura'); paintSection(mount);
        }, { media: 'fondo' });
        break;
      }
      case 'quitar-musica':
        p.audio = null;
        touch(mount, 'estructura'); paintSection(mount);
        break;
      case 'clear-accent':
        p.accent = ''; touch(mount, 'estilo'); paintSection(mount);
        break;
      case 'add-link': {
        var t = mount.querySelector('#nlTitle').value;
        var u = mount.querySelector('#nlUrl').value;
        if (!t) { ID.app.toast('Falta el título', true); return; }
        p.links = p.links || [];
        p.links.push({
          ico: mount.querySelector('#nlIco').value || '🔗',
          title: t,
          desc: mount.querySelector('#nlDesc').value,
          url: u, variant: 'classic'
        });
        touch(mount, 'estructura'); paintSection(mount);
        break;
      }
      case 'add-project': {
        var pt = mount.querySelector('#npTitle').value;
        if (!pt) { ID.app.toast('Falta el nombre', true); return; }
        p.projects = p.projects || [];
        p.projects.push({
          title: pt,
          desc: mount.querySelector('#npDesc').value,
          tag: mount.querySelector('#npTag').value,
          url: mount.querySelector('#npUrl').value
        });
        touch(mount, 'estructura'); paintSection(mount);
        break;
      }
      case 'export':
        /* un .json tiene que servir en otro navegador, asi que el
           video vuelve a incrustarse antes de descargar */
        (ID.media ? ID.media.inflar(p) : Promise.resolve(p)).then(function (completo) {
          ID.app.download(completo, (p.username || 'perfil') + '.identity.json');
        });
        break;
      case 'import':
        ID.app.pickFile('application/json', function (txt) {
          try {
            var obj = JSON.parse(txt);
            if (!obj || typeof obj !== 'object') throw new Error('formato');
            state.p = Object.assign(ID.store.blank(), obj);
            /* el camino inverso al de exportar: el video sale del
               JSON y se queda en IndexedDB, no en localStorage */
            var seguir = function () {
              touch(mount, 'estructura'); paintSection(mount);
              ID.app.toast('Perfil importado');
            };
            if (ID.media && ID.media.disponible()) {
              ID.media.extraer(state.p, ['bgValue']).then(seguir, seguir);
            } else { seguir(); }
          } catch (e) { ID.app.toast('Ese archivo no es un perfil válido', true); }
        });
        break;
      case 'copy-link':
        if (!p.username) { ID.app.toast('Elige un nombre de usuario primero', true); return; }
        ID.app.copy(location.origin + location.pathname + '#/u/' + p.username, 'Enlace copiado');
        break;
      case 'delete':
        if (!p.username) return;
        if (confirm('¿Eliminar @' + p.username + ' de este navegador?')) {
          ID.store.remove(p.username);
          ID.store.setMine(null);
          ID.app.toast('Perfil eliminado');
          location.hash = '#/';
        }
        break;
    }
  }

  /* ---- publicar ---------------------------------------------------
     El perfil ya se guarda solo. Publicar es el momento de celebrarlo
     y de dar el enlace: por eso tiene su propia pantalla. */
  function publicar(mount) {
    var p = state.p;
    if (!p.username) {
      ID.app.toast('Elige un nombre de usuario', true);
      state.sec = 'overview';
      paintSection(mount);
      var inp = mount.querySelector('[data-k="username"]');
      if (inp) inp.focus();
      return;
    }
    /* La lista del cliente tiene 15 nombres; la del servidor, 70. Y
       `store.get` solo sabe de ESTE navegador: un nombre puede estar
       cogido por otra persona y aqui parecer libre.
       Se pregunta al servidor, que es donde esta la verdad. La
       comprobacion del navegador se queda como respuesta inmediata
       para los casos evidentes, no como autoridad. */
    if (ID.router.RESERVED.indexOf(p.username) !== -1) {
      ID.app.toast('@' + p.username + ' esta reservado', true); return;
    }
    var mio = ID.store.mineName();
    var tomado = ID.store.get(p.username);
    if (tomado && mio !== p.username && !ID.store.local()[p.username]) {
      ID.app.toast('@' + p.username + ' ya esta tomado', true); return;
    }

    function seguir() {
      if (mio && mio !== p.username) ID.store.remove(mio);
      autoguardar(mount, true);
      modalPublicado(mount, p);
    }

    /* Sin backend, o si ya es mi propio nombre, no hay nada que
       preguntar. */
    if (!ID.store.hayNube() || mio === p.username) { seguir(); return; }

    ID.app.toast('Comprobando el nombre…');
    ID.backend.nombreDisponible(p.username).then(function (libre) {
      if (libre) { seguir(); return; }
      ID.app.toast('@' + p.username + ' no esta disponible. Prueba con otro.', true);
      state.sec = 'overview';
      paintSection(mount);
      var i = mount.querySelector('[data-k="username"]');
      if (i) { i.focus(); i.select(); }
    }).catch(function () {
      /* Si la comprobacion falla —sin red, servidor caido— NO se
         bloquea la publicacion: el indice unico de la base sigue
         siendo la garantia final, y esta comprobacion es comodidad,
         no seguridad. */
      seguir();
    });
  }

  function modalPublicado(mount, p) {
    var url = location.origin + location.pathname + '#/u/' + p.username;
    var bonita = 'identity.gg/' + p.username;

    var m = document.createElement('div');
    m.className = 'pubmodal';
    m.innerHTML =
      '<div class="pubmodal__box" role="dialog" aria-modal="true" aria-label="Perfil publicado">' +
        '<div class="pubmodal__tick" aria-hidden="true">\u2713</div>' +
        '<h2>Tu perfil esta publicado</h2>' +
        '<p class="pubmodal__url">' + esc(bonita) + '</p>' +

        /* vista previa de como se vera al compartirlo */
        '<div class="ogcard">' +
          '<div class="ogcard__thumb" id="ogThumb"></div>' +
          '<div class="ogcard__b">' +
            '<div class="ogcard__t">' + esc(p.name || p.username) +
              (p.title ? ' \u2014 ' + esc(p.title) : '') + '</div>' +
            '<div class="ogcard__d">' + esc((p.bio || 'Perfil en IDENTITY').slice(0, 90)) + '</div>' +
            '<div class="ogcard__u">identity.gg</div>' +
          '</div>' +
        '</div>' +

        '<div class="pubmodal__acts">' +
          '<button class="btn btn--primary" type="button" id="pmCopy">Copiar enlace</button>' +
          '<a class="btn btn--ghost" href="#/u/' + esc(p.username) + '" id="pmView">Ver perfil</a>' +
          '<button class="btn btn--ghost" type="button" id="pmShare">Compartir</button>' +
        '</div>' +
        '<button class="pubmodal__x" type="button" id="pmClose" aria-label="Cerrar">\u00d7</button>' +
      '</div>';
    document.body.appendChild(m);

    /* miniatura real del perfil dentro de la tarjeta de compartir */
    var th = m.querySelector('#ogThumb');
    th.innerHTML = '<div class="ogcard__scale">' +
      ID.views.profile.render(p, { preview: true }) + '</div>';

    function cerrar() { m.remove(); document.removeEventListener('keydown', tecla); }
    function tecla(e) { if (e.key === 'Escape') cerrar(); }

    m.querySelector('#pmClose').addEventListener('click', cerrar);
    m.addEventListener('click', function (e) { if (e.target === m) cerrar(); });
    document.addEventListener('keydown', tecla);
    m.querySelector('#pmView').addEventListener('click', cerrar);
    m.querySelector('#pmCopy').addEventListener('click', function () {
      ID.app.copy(url, 'Enlace copiado');
    });
    m.querySelector('#pmShare').addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: (p.name || p.username) + ' \u2014 IDENTITY', url: url })
          .catch(function () {});
      } else {
        ID.app.copy(url, 'Enlace copiado');
      }
    });
  }

  /* ---- vista --------------------------------------------------------- */

  V.dashboard = {
    /* el router lo llama al salir: el observador del preview no forma
       parte de ID.fx, asi que hay que soltarlo aparte */
    limpiar: function () {
      if (state.ro) { state.ro.disconnect(); state.ro = null; }
      if (state.onResize) { window.removeEventListener('resize', state.onResize); state.onResize = null; }
      clearTimeout(state.autoTimer);
      clearTimeout(state.histTimer);
      clearTimeout(state.okTimer);
      window.removeEventListener('beforeunload', guardiaSalida);
    },

    route: function (mount, params) {
      /* primera vez: asistente en lugar de una pagina en blanco */
      if (V.onboard && V.onboard.pendiente() && !params.skipwizard) {
        document.body.classList.add('is-dashboard');
        V.onboard.abrir(mount, {
          base: params.claim ? { username: ID.util.slug(params.claim) } : {},
          alTerminar: function (perfil) {
            ID.router.go('/dashboard?skipwizard=1');
            if (perfil) {
              setTimeout(function () {
                ID.app.toast('Perfil creado. Toca cualquier elemento para editarlo.');
              }, 400);
            }
          }
        });
        return;
      }

      state.p = ID.store.mine();
      window.addEventListener('beforeunload', guardiaSalida);
      prepararMedios(mount);
      /* el orden de bloques se materializa la primera vez que se edita */
      if (!state.p.blockOrder || !state.p.blockOrder.length) {
        state.p.blockOrder = ID.BLOCK_ORDER.slice();
      }
      if (params.claim) { state.p.username = ID.util.slug(params.claim); state.dirty = true; }
      if (params.sec && RENDERERS[params.sec]) state.sec = params.sec;

      var p = state.p;
      var avatar = p.avatarUrl
        ? '<img src="' + esc(ID.util.safeMedia(p.avatarUrl)) + '" alt="">'
        : esc(p.emoji || '◈');

      mount.innerHTML =
        '<div class="dash" id="dash">' +
          '<aside class="dash__side">' +
            '<div class="dash__who">' +
              '<span class="dash__who-av">' + avatar + '</span>' +
              '<span><span class="dash__who-n" id="whoN">' + esc(p.name || 'Sin nombre') + '</span>' +
              '<span class="dash__who-u" id="whoU">@' + esc(p.username || 'sin-usuario') + '</span></span>' +
            '</div>' +
            '<nav class="dash__nav" aria-label="Secciones del panel">' +
              SECTIONS.map(function (s) {
                var count = s.id === 'links'
                  ? String((p.links || []).length + (p.socials || []).length)
                  : (s.id === 'badges' ? String((p.badges || []).length) : '');
                return '<a href="#/dashboard?sec=' + s.id + '" data-sec="' + s.id + '"' +
                  (s.id === state.sec ? ' class="on"' : '') + '>' + ic[s.id] +
                  '<span>' + esc(s.name) + '</span>' +
                  (count ? '<span class="dash__nav-c">' + count + '</span>' : '') + '</a>';
              }).join('') +
            '</nav>' +
            '<div class="dash__side-foot">' +
              '<div class="modeswitch" role="group" aria-label="Nivel de opciones">' +
                '<button type="button" data-modo="simple"' +
                  (state.modo === 'simple' ? ' class="on"' : '') + '>Simple</button>' +
                '<button type="button" data-modo="avanzado"' +
                  (state.modo === 'avanzado' ? ' class="on"' : '') + '>Avanzado</button>' +
              '</div>' +
              '<button class="btn btn--ghost btn--sm btn--block" type="button" id="togglePrev" ' +
                'style="margin-top:8px">Ver vista previa</button>' +
            '</div>' +
          '</aside>' +

          '<div class="dash__main" id="dashMain"></div>' +

          '<aside class="dash__prev">' +
            '<div class="prev__bar">' +
              '<span class="prev__url" id="prevUrl">identity.gg/' + esc(p.username || '…') + '</span>' +
              '<button class="prev__focus" type="button" id="prevFocus" ' +
                'title="Ocultar los controles" aria-label="Ocultar los controles">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                'stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M9 4v16M4 4h16v16H4z"/></svg></button>' +
              '<span class="prev__vp">' +
                '<button type="button" data-vp="desktop" class="on" aria-label="Escritorio">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8"/></svg></button>' +
                '<button type="button" data-vp="tablet" aria-label="Tablet">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4.5" y="3" width="15" height="18" rx="2.2"/><path d="M10.5 18.4h3"/></svg></button>' +
                '<button type="button" data-vp="mobile" aria-label="Móvil">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg></button>' +
              '</span>' +
            '</div>' +
            '<div class="prev__frame" id="prevFrame" data-vp="desktop">' +
              '<div class="prev__scroll">' +
                '<div class="prev__stage" id="prevSlot"></div>' +
              '</div>' +
              '<span class="prev__size" id="prevSize"></span>' +
            '</div>' +
          '</aside>' +
        '</div>';

      document.body.classList.add('is-dashboard');
      state.hist = []; state.hi = -1;
      histPush();

      /* pista contextual, una sola vez (spec 61) */
      if (!ID.util.read('identity.hint.click', 0)) {
        setTimeout(function () {
          ID.app.toast('Toca un elemento del preview para editarlo, o arrastralo para moverlo');
          ID.util.write('identity.hint.click', 1);
        }, 900);
      }
      paintSection(mount);
      paintPreview(mount);

      /* modo simple / avanzado */
      mount.querySelectorAll('[data-modo]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.modo = b.getAttribute('data-modo');
          ID.util.write('identity.editmode', state.modo);
          mount.querySelectorAll('[data-modo]').forEach(function (x) {
            x.classList.toggle('on', x === b);
          });
          paintSection(mount);
        });
      });

      /* atajos: deshacer y rehacer */
      var atajos = function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        var k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); histIr(-1, mount); }
        else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); histIr(1, mount); }
      };
      document.addEventListener('keydown', atajos);
      ID.fx.register(function () { document.removeEventListener('keydown', atajos); });

      /* la navegación lateral no debe recargar toda la vista */
      mount.querySelectorAll('.dash__nav a').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          state.sel = null;   /* cambiar de seccion suelta la pieza */
          state.sec = a.getAttribute('data-sec');
          history.replaceState(null, '', '#/dashboard?sec=' + state.sec);
          paintSection(mount);
        });
      });

      /* tamaño de la vista previa */
      mount.querySelectorAll('[data-vp]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.vp = b.getAttribute('data-vp');
          mount.querySelector('#prevFrame').setAttribute('data-vp', state.vp);
          mount.querySelectorAll('[data-vp]').forEach(function (x) { x.classList.toggle('on', x === b); });
          escalarPreview(mount);
        });
      });

      /* en pantallas medianas la vista previa se alterna */
      var toggleBtn = mount.querySelector('#togglePrev');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          var d = mount.querySelector('#dash');
          var on = d.classList.toggle('show-prev');
          toggleBtn.textContent = on ? 'Volver a editar' : 'Ver vista previa';
          if (on) paintPreview(mount);
        });
      }

      /* ocultar los controles para ver el perfil a lo ancho */
      var foco = mount.querySelector('#prevFocus');
      if (foco) {
        foco.addEventListener('click', function () {
          var d = mount.querySelector('#dash');
          var on = d.classList.toggle('solo-prev');
          foco.title = on ? 'Mostrar los controles' : 'Ocultar los controles';
          /* No basta con el ResizeObserver: sus avisos se entregan al
             pintar, y aqui el cambio es inmediato. Leer offsetWidth
             fuerza el reflujo y ya podemos medir de verdad. */
          var m = mount.querySelector('#prevFrame');
          if (m) { void m.offsetWidth; }
          escalarPreview(mount);
        });
      }

      /* Un observador sobre el marco cubre todos los casos de una vez:
         entrar en modo concentrado, redimensionar la ventana o cambiar
         de dispositivo. Antes había que acordarse de llamar a mano. */
      /* OJO: no puede registrarse en ID.fx. paintPreview llama a
         ID.fx.clear() en cada repintado y desconectaria el observador
         al primer cambio. Vive en state y se limpia al salir. */
      if (state.ro) { state.ro.disconnect(); state.ro = null; }
      if (state.onResize) { window.removeEventListener('resize', state.onResize); state.onResize = null; }

      var marco = mount.querySelector('#prevFrame');
      if (marco && window.ResizeObserver) {
        state.ro = new ResizeObserver(function () { escalarPreview(mount); });
        state.ro.observe(marco);
      } else {
        state.onResize = function () { escalarPreview(mount); };
        window.addEventListener('resize', state.onResize);
      }

      /* con autoguardado no hace falta avisar al salir */
    }
  };
})();
