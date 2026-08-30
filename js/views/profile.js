/* ============================================================
   IDENTITY — vista de perfil  ·  v2

   El perfil ES el producto y NO tiene una tarjeta obligatoria.
   Se compone de bloques independientes que el usuario enciende,
   apaga y ordena, sobre un fondo que ocupa toda la pantalla.

   render(p, opts) -> HTML
   mount(cont, p, opts) -> engancha efectos y eventos
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc, safe = ID.util.safeUrl, num = ID.util.num;

  var ICO_LINK = String.fromCodePoint(0x1F517);

  /* ---- normalización ------------------------------------------
     Una sola fuente: ID.store.normalizar. Esta vista tenía su propia
     tabla de valores por defecto y no coincidía con la del almacén,
     así que el editor y el perfil público podían pintar bloques
     distintos a partir del mismo perfil. Ahora los dos entran por
     la misma puerta. No muta el perfil que recibe.
     ------------------------------------------------------------- */
  function norm(p) { return ID.store.normalizar(p || {}); }

  var tipoBloque = ID.util.tipoBloque;

  /* Contenido propio de una pieza. Si no lo tiene, cae en el campo
     de siempre del perfil, asi que el bloque original no cambia. */
  function contenidoDe(p, id, campo) {
    var c = (p.bcontent || {})[id];
    return c ? c[campo] : undefined;
  }

  /* Que interruptor apaga esta pieza: una copia se apaga sola, el
     bloque original sigue respondiendo a su interruptor de tipo. */
  function interruptorDe(id) {
    return ID.util.esCopia(id) ? id : BLOCK_SWITCH[tipoBloque(id)];
  }

  function stateColor(id) {
    var s = ID.STATUS_STATES.filter(function (x) { return x.id === id; })[0];
    return s ? s.color : '#747F8D';
  }
  function stateName(id) {
    var s = ID.STATUS_STATES.filter(function (x) { return x.id === id; })[0];
    return s ? s.name : 'Desconectado';
  }
  /* mete CSS inline sin pisar el style que el bloque ya tuviera
     (el estado, por ejemplo, lleva --st con su color) */
  function conEstilo(html, css) {
    if (!css) return html;
    var m = html.match(/^<(\w+)([^>]*)>/);
    if (!m) return html;
    var attrs = m[2];
    var reemplazo;
    if (/\sstyle="/.test(attrs)) {
      reemplazo = '<' + m[1] + attrs.replace(/\sstyle="/, ' style="' + css) + '>';
    } else {
      reemplazo = '<' + m[1] + attrs + ' style="' + css + '">';
    }
    return reemplazo + html.slice(m[0].length);
  }

  function fontStack(id) {
    var f = (ID.FONTS || []).filter(function (x) { return x.id === id; })[0];
    return f ? f.stack : '';
  }

  /* ============================================================
     BLOQUES DEL HÉROE
     Cada uno devuelve '' si está apagado o si no hay contenido.
     ============================================================ */

  /* La lista de reproduccion. Un perfil viejo con una sola cancion
     se convierte en una lista de uno: asi el reproductor es siempre
     el mismo codigo. */
  function pistasDe(p) {
    var a = p.audio || {};
    if (a.tracks && a.tracks.length) return a.tracks;
    if (!a.title) return [];
    return [{
      title: a.title, artist: a.artist, cover: a.cover,
      src: a.src || 'manual', yt: a.yt, preview: a.preview,
      url: a.url, length: a.length
    }];
  }

  var B = {};

  B.avatar = function (p) {
    if (!p.avatarUrl && !p.emoji && !p.name) return '';
    var inner = p.avatarUrl
      ? '<img src="' + esc(ID.util.safeMedia(p.avatarUrl)) + '" alt="Avatar de ' + esc(p.name || p.username) + '" loading="lazy">'
      : esc(p.emoji || (p.name || '?').trim().charAt(0).toUpperCase());
    return '<div class="pf-avatar" data-fx="' + esc(p.avatarFx || 'none') + '">' + inner + '</div>';
  };

  function verifiedMark() {
    return '<svg class="pf-verified" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Verificado">' +
      '<path d="M12 1.6 14.6 4l3.5-.3.6 3.4 3 1.8-1.5 3.1 1.5 3.1-3 1.8-.6 3.4-3.5-.3L12 22.4 9.4 20l-3.5.3-.6-3.4-3-1.8L3.8 12 2.3 8.9l3-1.8.6-3.4L9.4 4z"/>' +
      '<path d="m8.6 12.2 2.2 2.2 4.6-4.6" fill="none" stroke="#050505" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* ---- identidad, en piezas sueltas ---------------------------
     Antes nombre, @usuario, oficio y fecha eran UN bloque: no se
     podian mover, vestir ni posicionar por separado. Ahora cada uno
     es una pieza, con su tipografia, su caja y su sitio.

     Siguen envueltos en .pf-idblock para no cambiar ni un pixel de
     como se ven cuando estan seguidos: esa clase es la que les da
     su ritmo vertical.
     ------------------------------------------------------------- */
  B.identity = function (p) {
    if (!p.blocks.name) return '';
    return '<div class="pf-idblock"><h1 class="pf-name">' +
      esc(p.name || p.username) + (p.verified ? verifiedMark() : '') + '</h1></div>';
  };

  B.handle = function (p) {
    if (!p.blocks.handle) return '';
    return '<div class="pf-idblock"><div class="pf-handle">@' +
      esc(p.username || 'usuario') + '</div></div>';
  };

  B.meta = function (p) {
    if (!p.blocks.meta) return '';
    var meta = [
      p.title ? '<b>' + esc(p.title) + '</b>' : '',
      esc(p.location || ''),
      p.pronouns ? esc(p.pronouns) : '',
      p.age ? esc(p.age) + ' años' : ''
    ].filter(Boolean).join(' · ');
    return meta ? '<div class="pf-idblock"><div class="pf-title">' + meta + '</div></div>' : '';
  };

  B.joined = function (p) {
    if (!p.blocks.joined || !p.joined) return '';
    return '<div class="pf-idblock"><div class="pf-joined">Se unió el ' +
      esc(new Date(p.joined).toLocaleDateString('es-CO',
        { day: 'numeric', month: 'short', year: 'numeric' })) + '</div></div>';
  };

  B.fields = function (p) {
    if (!p.fields || !p.fields.length) return '';
    return '<div class="pf-fields">' + p.fields.map(function (f) {
      return '<span class="pf-field"><b>' + esc(f.k) + '</b>' + esc(f.v) + '</span>';
    }).join('') + '</div>';
  };

  B.status = function (p) {
    var st = p.status || {};
    if (!st.activity && !st.state) return '';
    return '<div class="pf-status" style="--st:' + stateColor(st.state) + '">' +
      '<i class="pf-status__dot"></i>' +
      '<span class="pf-status__act"><b>' + esc(st.activity || stateName(st.state)) + '</b>' +
      (st.detail ? ' · ' + esc(st.detail) : '') + '</span></div>';
  };

  /* Presencia de Discord. Sin backend los datos salen del propio
     perfil; con Lanyard o un bot esta funcion recibiria la API. */
  B.discord = function (p) {
    var d = p.discord || {};
    var usuario = d.user || (p.socials || [])
      .filter(function (x) { return x.net === 'discord'; })
      .map(function (x) { return x.label; })[0] || p.username;
    if (!usuario) return '';
    var estado = (p.status || {}).state || 'offline';
    return '<div class="pf-dc">' +
      '<span class="pf-dc__av">' +
        (d.avatar ? '<img src="' + esc(ID.util.safeMedia(d.avatar)) + '" alt="" loading="lazy">' : esc(p.emoji || '◈')) +
        '<i class="pf-dc__dot" style="--st:' + stateColor(estado) + '"></i>' +
      '</span>' +
      '<span class="pf-dc__b">' +
        '<span class="pf-dc__u">' + esc(usuario) +
          (d.badges ? '<span class="pf-dc__bd">' + esc(d.badges) + '</span>' : '') + '</span>' +
        '<span class="pf-dc__s">' + esc(d.seen || stateName(estado)) + '</span>' +
      '</span></div>';
  };

  B.live = function (p) {
    if (!p.live || !p.live.length) return '';
    /* texto de demostración definido por nosotros en data.js */
    return '<div class="pf-live">' + p.live.map(function (r) {
      return '<div class="pf-live__row">' +
        '<span class="pf-live__ico" aria-hidden="true">' + esc(r.ico || '•') + '</span>' +
        '<span class="pf-live__txt">' + (r.text || '') + '</span>' +
        (r.meta ? '<span class="pf-live__meta">' + esc(r.meta) + '</span>' : '') +
        '</div>';
    }).join('') + '</div>';
  };

  B.bio = function (p, id) {
    /* el bloque de texto es la pieza universal del constructor:
       cada copia lleva el suyo */
    var propio = contenidoDe(p, id, 'text');
    var texto = propio !== undefined ? propio : p.bio;
    return texto ? '<p class="pf-bio">' + esc(texto) + '</p>' : '';
  };

  B.badges = function (p) {
    if (!p.badges || !p.badges.length) return '';
    return '<div class="pf-badges" data-style="' + esc(p.badgeStyle) + '">' +
      p.badges.slice(0, 8).map(function (id) {
        var b = ID.BADGES[id];
        if (!b) return '';
        return '<span class="pf-badge" data-rare="' + b.rare + '" title="' + esc(b.label + ' — ' + b.how) + '">' +
          '<i aria-hidden="true">' + b.icon + '</i><b>' + esc(b.label) + '</b></span>';
      }).join('') + '</div>';
  };

  B.socials = function (p, id) {
    var lista = p.socials || [];
    /* una copia puede enseñar solo algunas redes: asi caben dos
       grupos distintos en el mismo perfil */
    var sel = contenidoDe(p, id, 'nets');
    if (sel && sel.length) {
      lista = lista.filter(function (x) { return sel.indexOf(x.net) !== -1; });
    }
    if (!lista.length) return '';
    return '<div class="pf-socials" data-style="' + esc(p.socialStyle) +
      '" data-mono="' + (p.monoIcons === false ? 'off' : 'on') + '">' +
      lista.map(function (s) {
        var net = ID.NETS[s.net];
        if (!net) return '';
        var nombre = s.label || net.label;
        return '<a class="pf-social" href="' + esc(safe(s.url)) + '" target="_blank" ' +
          'rel="noopener noreferrer nofollow" data-net="' + esc(s.net) + '" ' +
          'data-label="' + esc(nombre) + '" style="--brand:' + esc(net.color) + '" ' +
          'title="' + esc(nombre) + '" aria-label="' + esc(nombre) + '">' +
          (s.net === 'custom' && s.emoji
            ? '<span class="pf-social__emoji">' + esc(s.emoji) + '</span>'
            : net.icon) + '</a>';
      }).join('') + '</div>';
  };

  B.music = function (p) {
    var pistas = pistasDe(p);
    if (!pistas.length) return '';
    var t = pistas[0];
    var cover = t.cover || '\u266a';
    var esUrl = /^(https?:|data:)/i.test(String(cover));

    return '<div class="pf-music is-paused" id="pfMusic" data-style="' + esc(p.musicStyle) +
      '" data-src="' + esc(t.src || 'manual') + '">' +

      '<span class="pf-music__cover" id="pfCover" aria-hidden="true">' +
        (esUrl ? '<img src="' + esc(ID.util.safeMedia(cover)) + '" alt="">' : esc(cover)) + '</span>' +

      '<span class="pf-music__meta">' +
        '<span class="pf-music__t" id="pfTit">' + esc(t.title) + '</span>' +
        '<span class="pf-music__a" id="pfArt">' + esc(t.artist || '') + '</span>' +
      '</span>' +

      '<span class="pf-music__time" id="pfNow">0:00</span>' +
      '<span class="pf-music__bar" id="pfBar" role="slider" tabindex="0" ' +
        'aria-label="Posicion de la cancion" aria-valuemin="0" aria-valuemax="100" ' +
        'aria-valuenow="0"><i></i></span>' +
      '<span class="pf-music__time" id="pfTot">' + esc(t.length || '0:00') + '</span>' +

      '<span class="pf-music__viz" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +

      '<span class="pf-music__ctl">' +
        '<button class="pf-music__nav" type="button" id="pfPrev" aria-label="Anterior">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
          '<path d="M7 5h2v14H7zM20 5v14l-10-7z"/></svg></button>' +
        '<button class="pf-music__btn" id="pfMusicBtn" type="button" aria-label="Reproducir">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="pf-ic-play">' +
          '<path d="M7 4.5v15l13-7.5z"/></svg>' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="pf-ic-pause">' +
          '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg></button>' +
        '<button class="pf-music__nav" type="button" id="pfNext" aria-label="Siguiente">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
          '<path d="M15 5h2v14h-2zM4 5v14l10-7z"/></svg></button>' +
      '</span>' +

      '<a class="pf-music__out" id="pfOut" href="#" target="_blank" ' +
        'rel="noopener noreferrer" title="Abrir la cancion" aria-label="Abrir la cancion" ' +
        'hidden>\u2197</a>' +
      '<span class="pf-music__host" aria-hidden="true"></span>' +
      '</div>';
  };

  B.level = function (p) {
    var lv = (p.level != null && p.xpMax)
      ? { level: p.level, xp: p.xp, xpMax: p.xpMax }
      : ID.store.computeLevel(p);
    var pct = Math.max(2, Math.min(100, Math.round((lv.xp / Math.max(1, lv.xpMax)) * 100)));
    return '<div class="pf-level">' +
      '<div class="pf-level__top"><span>Nivel</span><span>' + pct + '%</span></div>' +
      '<div class="pf-level__n">' + lv.level + '</div>' +
      '<div class="pf-xp"><i style="width:' + pct + '%"></i></div>' +
      '<div class="pf-level__foot"><span>' + num(lv.xp) + ' XP</span><span>' + num(lv.xpMax) + ' XP</span></div>' +
      '</div>';
  };

  /* línea discreta de visitas: el estilo dominante en las referencias */
  B.views = function (p) {
    var ojo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>' +
      '<circle cx="12" cy="12" r="2.6"/></svg>';
    return '<div class="pf-views">' + ojo +
      '<span id="pfViews">' + ID.util.full(p.views || 0) + '</span>' +
      (p.location ? '<span class="pf-views__sep">|</span><span>' + esc(p.location) + '</span>' : '') +
      '</div>';
  };

  B.stats = function (p) {
    var days = Math.max(1, Math.floor((Date.now() - new Date(p.joined || Date.now()).getTime()) / 864e5));
    return '<div class="pf-stats">' +
      '<div class="pf-stat"><div class="pf-stat__n" id="pfViewsBox">' + num(p.views || 0) + '</div>' +
      '<div class="pf-stat__l">Visitas</div></div>' +
      '<div class="pf-stat"><div class="pf-stat__n">' + num(p.likes || 0) + '</div>' +
      '<div class="pf-stat__l">Me gusta</div></div>' +
      '<div class="pf-stat"><div class="pf-stat__n">' + num(days) + '</div>' +
      '<div class="pf-stat__l">Días</div></div>' +
      '</div>';
  };

  /* qué interruptor gobierna cada bloque */
  var BLOCK_SWITCH = {
    avatar: 'avatar', identity: 'name', handle: 'handle', meta: 'meta', joined: 'joined',
    fields: 'fields', status: 'status',
    discord: 'discord', live: 'live', bio: 'bio', badges: 'badges',
    socials: 'socials', music: 'music', level: 'level', views: 'views', stats: 'stats'
  };

  /* ============================================================
     SECCIONES BAJO EL HÉROE
     ============================================================ */

  var S = {};

  S.about = function (p) {
    if (!p.about) return '';
    return sec('about', 'Sobre mí', '<p class="pf-sec__about">' + esc(p.about) + '</p>');
  };

  S.links = function (p) {
    if (!p.links || !p.links.length) return '';
    var html = '<div class="pf-links">' + p.links.map(function (l) {
      var v = l.variant || 'classic';
      var open = '<a class="pf-link pf-link--' + esc(v) + '" href="' + esc(safe(l.url)) +
        '" target="_blank" rel="noopener noreferrer nofollow">';
      var arrow = '<span class="pf-link__arrow" aria-hidden="true">↗</span>';
      var title = '<span class="pf-link__t">' + esc(l.title) + '</span>';
      var desc = l.desc ? '<span class="pf-link__d">' + esc(l.desc) + '</span>' : '';
      var ico = '<span class="pf-link__ico" aria-hidden="true">' + esc(l.ico || ICO_LINK) + '</span>';

      if (v === 'minimal') return open + title + arrow + '</a>';
      if (v === 'featured') {
        var cover = l.cover ? ' style="background-image:url(&quot;' + esc(l.cover) + '&quot;)"' : '';
        return open + '<span class="pf-link__cover"' + cover + ' aria-hidden="true">' +
          (l.cover ? '' : esc(l.ico || ICO_LINK)) + '</span>' +
          '<span class="pf-link__body"><span>' + title + desc + '</span>' + arrow + '</span></a>';
      }
      if (v === 'card') return open + ico + title + desc + arrow + '</a>';
      return open + ico + '<span>' + title + desc + '</span>' + arrow + '</a>';
    }).join('') + '</div>';
    return sec('links', 'Enlaces', html);
  };

  S.gallery = function (p) {
    if (!p.gallery || !p.gallery.length) return '';
    var html = '<div class="pf-gallery">' + p.gallery.map(function (g) {
      var isUrl = /^(https?:|data:)/i.test(String(g));
      return '<figure>' + (isUrl
        ? '<img src="' + esc(ID.util.safeMedia(g)) + '" alt="" loading="lazy">'
        : '<span aria-hidden="true">' + esc(g) + '</span>') + '</figure>';
    }).join('') + '</div>';
    return sec('gallery', 'Galería', html);
  };

  S.projects = function (p) {
    if (!p.projects || !p.projects.length) return '';
    var html = '<div class="pf-proj">' + p.projects.map(function (pr) {
      return '<a href="' + esc(safe(pr.url)) + '" target="_blank" rel="noopener noreferrer nofollow">' +
        '<span><span class="pf-proj__t">' + esc(pr.title) + '</span>' +
        (pr.desc ? '<span class="pf-proj__d">' + esc(pr.desc) + '</span>' : '') + '</span>' +
        (pr.tag ? '<span class="pf-proj__tag">' + esc(pr.tag) + '</span>' : '') + '</a>';
    }).join('') + '</div>';
    return sec('projects', 'Proyectos', html);
  };

  S.rate = function (p, preview) {
    return sec('rate', 'Califica este perfil', rateInner(p, preview));
  };

  function rateInner(p, preview) {
    var r = p.ratings || { design: 0, originality: 0, aesthetic: 0, votes: 0 };
    var avg = Math.round(((r.design + r.originality + r.aesthetic) / 3) * 10) / 10;
    var mine = preview ? null : ID.store.myVote(p.username);
    var rows = [['Diseño', r.design], ['Originalidad', r.originality], ['Estética', r.aesthetic]]
      .map(function (row) {
        return '<div class="pf-rate__row">' +
          '<span class="pf-rate__lab">' + row[0] + '</span>' +
          '<span class="pf-rate__bar"><i style="width:' + (row[1] * 10) + '%"></i></span>' +
          '<span class="pf-rate__v">' + row[1].toFixed(1) + '</span></div>';
      }).join('');
    var buttons = '';
    for (var i = 1; i <= 10; i++) {
      buttons += '<button type="button" data-vote="' + i + '"' +
        (mine === i ? ' class="is-mine"' : '') +
        ' aria-label="Calificar ' + i + ' de 10">' + i + '</button>';
    }
    return '<div class="pf-rate">' +
      '<div class="pf-rate__score">' + (avg || '—') +
      '<small>/ 10 · ' + num(r.votes || 0) + ' votos</small></div>' +
      '<div class="pf-rate__rows">' + rows + '</div>' +
      '<div class="pf-vote">' + buttons + '</div></div>';
  }

  function sec(id, titulo, inner) {
    return '<section class="pf-sec" data-sec="' + id + '">' +
      '<div class="pf-sec__in">' +
        '<h2 class="pf-sec__h">' + esc(titulo) + '</h2>' + inner +
      '</div></section>';
  }

  /* ============================================================
     REPRODUCTOR
     Conecta la lista con los controles. La vista no sabe si el
     sonido viene de YouTube o de un fragmento de Spotify.
     ============================================================ */
  function montarReproductor(container, raw, mus, btn) {
    var p = norm(raw);
    var pistas = pistasDe(p);
    if (!pistas.length) return;

    var host  = mus.querySelector('.pf-music__host');
    var elNow = container.querySelector('#pfNow');
    var elTot = container.querySelector('#pfTot');
    var elBar = container.querySelector('#pfBar');
    var elTit = container.querySelector('#pfTit');
    var elArt = container.querySelector('#pfArt');
    var elCov = container.querySelector('#pfCover');
    var elOut = container.querySelector('#pfOut');
    var arrastrando = false;

    var mando = ID.music.crearReproductor(host, pistas, {
      alEstado: function (sonando) {
        mus.classList.toggle('is-paused', !sonando);
        btn.setAttribute('aria-label', sonando ? 'Pausar' : 'Reproducir');
      },
      alAvanzar: function (t, dur) {
        if (arrastrando) return;
        if (elNow) elNow.textContent = ID.music.mmss(t);
        if (elTot && dur) elTot.textContent = ID.music.mmss(dur);
        var pct = dur ? Math.min(100, (t / dur) * 100) : 0;
        if (elBar && elBar.firstElementChild) {
          elBar.firstElementChild.style.width = pct + '%';
          elBar.setAttribute('aria-valuenow', Math.round(pct));
        }
      },
      alPista: function (i, t) {
        if (elTit) elTit.textContent = t.title || '';
        if (elArt) elArt.textContent = t.artist || '';
        if (elCov) {
          var esUrl = /^(https?:|data:)/i.test(String(t.cover || ''));
          elCov.innerHTML = esUrl
            ? '<img src="' + esc(ID.util.safeMedia(t.cover)) + '" alt="">'
            : esc(t.cover || '\u266a');
        }
        /* el enlace externo solo aparece cuando no hay audio propio */
        if (elOut) {
          var sinAudio = !(t.src === 'youtube' && t.yt) && !t.preview && !!t.url;
          elOut.hidden = !sinAudio;
          if (sinAudio) elOut.href = safe(t.url);
        }
        mus.setAttribute('data-src', t.src || 'manual');
      }
    });

    if (!mando) return;
    ID.fx.register(function () { mando.destruir(); });
    mus._mando = mando;

    btn.addEventListener('click', function () { mando.alternar(); });
    var prev = container.querySelector('#pfPrev');
    var next = container.querySelector('#pfNext');
    if (prev) prev.addEventListener('click', function () { mando.anterior(); });
    if (next) next.addEventListener('click', function () { mando.siguiente(); });

    /* barra arrastrable */
    if (elBar) {
      var buscarEn = function (clientX) {
        var r = elBar.getBoundingClientRect();
        var k = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        var dur = mando.duracion();
        if (elBar.firstElementChild) elBar.firstElementChild.style.width = (k * 100) + '%';
        if (elNow && dur) elNow.textContent = ID.music.mmss(k * dur);
        elBar.setAttribute('aria-valuenow', Math.round(k * 100));
        return k * dur;
      };
      elBar.addEventListener('pointerdown', function (e) {
        arrastrando = true;
        try { elBar.setPointerCapture(e.pointerId); } catch (err) { /* da igual */ }
        buscarEn(e.clientX);
      });
      elBar.addEventListener('pointermove', function (e) {
        if (arrastrando) buscarEn(e.clientX);
      });
      var soltar = function (e) {
        if (!arrastrando) return;
        arrastrando = false;
        mando.buscar(buscarEn(e.clientX));
      };
      elBar.addEventListener('pointerup', soltar);
      elBar.addEventListener('pointercancel', soltar);
      elBar.addEventListener('keydown', function (e) {
        var dur = mando.duracion();
        if (!dur) return;
        var ahora = dur * (Number(elBar.getAttribute('aria-valuenow')) / 100);
        if (e.key === 'ArrowRight') { e.preventDefault(); mando.buscar(Math.min(dur, ahora + 5)); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); mando.buscar(Math.max(0, ahora - 5)); }
      });
    }
  }

  /* ============================================================
     ESTILO Y ATRIBUTOS
     Se calculan aparte para poder aplicarlos sobre un perfil ya
     renderizado, sin reconstruirlo.
     ============================================================ */

  function varsDe(p) {
    return [
      p.accent  ? '--p-primary:' + esc(p.accent)  : '',
      p.accent2 ? '--p-accent:'  + esc(p.accent2) : '',
      p.colText ? '--p-text:'    + esc(p.colText) : '',
      p.colBg   ? '--p-bg:'      + esc(p.colBg)   : '',
      p.colBg   ? '--p-bg2:'     + esc(p.colBg)   : '',
      p.colIcon ? '--p-icon:'    + esc(p.colIcon) : '',
      p.font    ? '--u-font:'    + fontStack(p.font) : '',
      /* la fuente de titulos es aparte: emparejar dos caras es lo que
         separa una pagina disenada de una plantilla */
      p.fontDisplay ? '--u-fontd:' + fontStack(p.fontDisplay) : '',
      p.nameWeight  ? '--u-nameW:' + Number(p.nameWeight) : '',
      p.nameCase    ? '--u-nameCase:' + esc(p.nameCase) : '',
      '--p-blur:' + (Number(p.bgBlur) || 0) + 'px',
      '--p-dim-amt:' + ((Number(p.bgDim) || 0) / 100),
      '--p-noise:' + ((Number(p.noise) || 0) / 100),
      '--u-bg-op:' + ((p.bgOpacity == null ? 100 : Number(p.bgOpacity)) / 100),
      '--u-vig:' + ((Number(p.vignette) || 0) / 100),
      '--u-width:' + (Number(p.stackWidth) || 460) + 'px',
      '--u-gap:' + (Number(p.gap) || 16) + 'px',
      '--u-radius:' + (Number(p.radius) || 0) + 'px',
      '--u-av:' + (Number(p.avSize) || 112) + 'px',
      '--u-ico:' + (Number(p.iconSize) || 20) + 'px',
      p.pad != null ? '--u-pad:' + Number(p.pad) + 'px' : '',
      p.nameSize ? '--u-name:' + Number(p.nameSize) + 'px' : '',
      p.bioSize ? '--u-bio:' + Number(p.bioSize) + 'px' : '',
      p.sOpacity != null ? '--u-op:' + Number(p.sOpacity) : '',
      p.sBorder != null ? '--u-bd:' + Number(p.sBorder) : '',
      '--u-sblur:' + (Number(p.sBlur) || 22) + 'px',
      '--u-glow:' + (Number(p.sGlow) || 40),
      p.blockRadius != null ? '--u-brad:' + Number(p.blockRadius) + 'px' : '',
      p.nameSpacing ? '--u-lsp:' + (Number(p.nameSpacing) / 100) + 'em' : '',
      p.lineHeight ? '--u-lh:' + (Number(p.lineHeight) / 100) : ''
    ].filter(Boolean).join(';');
  }

  function atributosDe(p, preview) {
    return {
      'data-theme': p.theme || 'dark',
      'data-align': p.align,
      'data-surface': p.surface,
      'data-avshape': p.avShape,
      'data-avborder': p.avBorder ? 'on' : 'off',
      'data-avglow': p.avGlow ? 'on' : 'off',
      'data-tilt': (p.tilt && p.surface !== 'none') ? 'on' : 'off',
      'data-cursor': p.cursor || 'default',
      'data-bgfixed': (p.bgFixed && !preview) ? 'on' : 'off',
      'data-width': p.widthMode,
      'data-layout': p.layoutMode,
      'data-pos': p.stackPos,
      'data-blockstyle': p.blockStyle,
      'data-hover': p.hoverFx,
      'data-enter': p.enterFx
    };
  }

  /* Caja propia de un bloque: devuelve el fragmento de atributos.
     Si el bloque no define superficie no se emite data-bs, y asi el
     estilo global sigue aplicandose (las reglas globales llevan
     :not([data-bs])). */
  function cajaDe(p, id) {
    var b = (p.bstyle || {})[id];
    if (!b) return { bs: '', anim: '', halo: '', css: '' };
    var css = '';
    /* ancho, tipografia y animacion valen aunque el bloque no tenga
       caja propia: son de la pieza, no de la superficie */
    if (b.w != null) css += '--b-w:' + Number(b.w) + '%;';
    if (b.font) css += '--b-font:' + fontStack(b.font) + ';';
    /* Color propio. No hace falta tocar las veinte reglas que pintan
       texto: todas leen --p-text / --p-dim / --p-icon del tema, y las
       custom properties se heredan. Redefinirlas AQUI, en la pieza,
       tiñe todo su contenido y nada mas.
       El apagado sale del mismo color, no de un gris fijo, para que
       los secundarios sigan perteneciendo a la familia. */
    if (b.color) {
      var c = esc(b.color);
      css += '--p-text:' + c + ';' +
             '--p-icon:' + c + ';' +
             '--p-dim:color-mix(in srgb,' + c + ' 66%, transparent);';
    }
    /* Halo propio, por el mismo camino que el color: la pieza
       redefine --halo y se enciende sola. Vacio = lo que diga el
       tema. */
    var halo = '';
    if (b.halo) { css += '--halo:' + esc(b.halo) + ';'; halo = 'on'; }
    var anim = b.anim || '';
    if (!b.s || b.s === 'inherit') return { bs: '', anim: anim, halo: halo, css: css };
    if (b.op   != null) css += '--b-op:'   + Number(b.op) + ';';
    if (b.bd   != null) css += '--b-bd:'   + Number(b.bd) + ';';
    if (b.blur != null) css += '--b-blur:' + Number(b.blur) + 'px;';
    if (b.rad  != null) css += '--b-rad:'  + Number(b.rad) + 'px;';
    if (b.pad  != null) css += '--b-pad:'  + Number(b.pad) + 'px;';
    if (b.glow != null) css += '--b-glow:' + Number(b.glow) + ';';
    return { bs: b.s, anim: anim, halo: halo, css: css };
  }

  function clasesDe(p) {
    return ['pf'].concat([
      p.gradient     ? 'is-gradient' : '',
      p.animatedName ? 'is-animname' : '',
      p.glowName     ? 'glow-name'   : '',
      p.glowSocials  ? 'glow-social' : '',
      p.glowBadges   ? 'glow-badge'  : ''
    ].filter(Boolean)).join(' ');
  }

  /* ============================================================
     RENDER
     ============================================================ */

  V.profile = {
    norm: norm,

    render: function (raw, opts) {
      opts = opts || {};
      var preview = !!opts.preview;
      var p = norm(raw);

      /* --- variables de usuario --- */
      var vars = varsDe(p);

      /* --- fondo ---
         El valor puede ser una URL, un data URI o una referencia a
         IndexedDB. resolver() devuelve algo pintable en los tres
         casos, y '' si la referencia todavia no esta en memoria: en
         ese caso se cae al fondo liso en vez de dejar un hueco. */
      var bg;
      var fuente = ID.media ? ID.media.resolver(p.bgValue) : p.bgValue;
      if (p.bgType === 'image' && fuente) {
        bg = '<div class="pf-bg pf-bg--media"><img class="pf-bgimg" src="' + esc(fuente) +
          '" alt="" loading="lazy"></div>';
      } else if (p.bgType === 'video' && fuente) {
        bg = '<div class="pf-bg pf-bg--media"><video src="' + esc(fuente) +
          '" autoplay muted loop playsinline></video></div>';
      } else if (p.bgType === 'solid' && p.bgValue) {
        bg = '<div class="pf-bg" style="background:' + esc(p.bgValue) + '"></div>';
      } else {
        bg = '<div class="pf-bg"></div>';
      }
      /* capa propia para el brillo que sigue al raton: asi se anima
         sin tocar el fondo real ni invalidar el arbol */
      if (p.fxGlow) bg += '<div class="pf-glow" aria-hidden="true"></div>';

      /* --- bloques del héroe, en el orden que eligió el usuario --- */
      var piezas = p.blockOrder.map(function (id) {
        var sw = interruptorDe(id);
        if (sw && p.blocks[sw] === false) return null;
        /* el TIPO decide que se pinta; el ID, de quien es */
        var fn = B[tipoBloque(id)];
        var html = fn ? fn(p, id) : '';
        return html ? { id: id, html: html } : null;
      }).filter(Boolean);

      /* Antes habia aqui un modo "cabecera en fila" que fusionaba el
         avatar y el nombre en una sola pieza. Se quito: el modo libre
         hace eso y mucho mas, poniendo cada pieza donde se quiera en
         una rejilla de 12 columnas. Dos formas de hacer lo mismo, y
         una de ellas mas pobre, solo confunden. */

      var bloques = piezas.map(function (x, i) {
        var caja = cajaDe(p, x.id);
        var css = '--i:' + i + ';' + caja.css;
        /* en el editor cada bloque se puede seleccionar con un click */
        var marca = opts.editable ? ' data-block="' + x.id + '"' : '';
        /* en modo libre cada bloque elige columna, ancho y alineación */
        if (p.layoutMode === 'free') {
          var q = p.pos[x.id] || {};
          var col = Math.max(1, Math.min(12, Number(q.col) || 1));
          var span = Math.max(1, Math.min(13 - col, Number(q.span) || 12));
          css += 'grid-column:' + col + '/span ' + span + ';' +
                 'justify-self:' + (q.align || 'stretch') + ';' +
                 'text-align:' + (q.align === 'end' ? 'right'
                   : q.align === 'center' ? 'center'
                   : q.align === 'start' ? 'left' : 'inherit') + ';';
        }
        var html = conEstilo(x.html, css);
        var extra = marca +
          (caja.bs ? ' data-bs="' + esc(caja.bs) + '"' : '') +
          (caja.halo ? ' data-halo="' + esc(caja.halo) + '"' : '') +
          (caja.anim ? ' data-anim="' + esc(caja.anim) + '"' : '');
        if (extra) html = html.replace(/^<(\w+)/, '<$1' + extra);
        return html;
      }).join('');

      var stack =
        '<div class="pf-stack">' +
          '<div class="pf-card__sheen" aria-hidden="true"></div>' +
          bloques +
        '</div>';

      /* --- secciones --- */
      var secciones = p.sections.map(function (id) {
        if (p.sectionsOn[id] === false) return '';
        var fn = S[id];
        return fn ? fn(p, preview) : '';
      }).filter(Boolean).join('');

      var hint = secciones
        ? '<div class="pf-scroll" aria-hidden="true"><span>Scroll</span><span>↓</span></div>'
        : '';

      var gate = (preview || !p.gate) ? '' :
        '<div class="pf-gate" id="pfGate" role="button" tabindex="0" aria-label="Entrar al perfil">' +
        '<div><span>toca para entrar</span><small>click anywhere</small></div></div>';

      var sonido = (preview || !p.audio || !p.audio.title) ? '' :
        '<button class="pf-sound" id="pfSound" type="button" aria-label="Silenciar o activar el sonido">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9.5a4 4 0 0 1 0 5M18.6 7a7.5 7.5 0 0 1 0 10"/>' +
        '</svg></button>';

      var fabs = preview ? '' :
        '<div class="pf-actions">' +
        '<button class="pf-fab" id="pfShare" type="button" title="Copiar enlace" aria-label="Copiar enlace">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg></button>' +
        '<a class="pf-fab" href="#/analytics?u=' + encodeURIComponent(p.username) + '" title="Analytics" aria-label="Ver analytics">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></a>' +
        '</div>';

      var atrs = atributosDe(p, preview);
      var attrHtml = Object.keys(atrs).map(function (k) {
        return ' ' + k + '="' + esc(atrs[k]) + '"';
      }).join('');

      return '<div class="' + clasesDe(p) + '"' + attrHtml +
        ' style="' + vars + '">' +
        bg +
        '<div class="pf-veil" aria-hidden="true"></div>' +
        '<div class="pf-noise" aria-hidden="true"></div>' +
        '<div class="pf-vig" aria-hidden="true"></div>' +
        '<canvas class="pf-particles" id="pfParticles" aria-hidden="true"></canvas>' +
        gate + sonido +
        '<section class="pf-hero">' + stack + hint + '</section>' +
        secciones +
        '<footer class="pf-foot">' +
          '<span>identity.gg/' + esc(p.username || '') + '</span>' +
          (preview || p.premium ? '' : '<a href="#/">Crea tu perfil</a>') +
        '</footer>' +
        fabs +
        '</div>';
    },

    /* ---- actualizar sin reconstruir ---------------------------
       Cubre todo lo que es variable CSS o atributo: colores, tamanos,
       espaciado, superficie, fuentes, efectos, alineacion, modo libre
       y la posicion de cada bloque. Deja el DOM intacto, asi que no
       parpadea, no reinicia las particulas y no pierde el scroll. */
    aplicar: function (container, raw, opts) {
      opts = opts || {};
      var p = norm(raw);
      var root = container.querySelector('.pf');
      if (!root) return false;

      root.className = clasesDe(p);
      root.setAttribute('style', varsDe(p));
      var atrs = atributosDe(p, !!opts.preview);
      Object.keys(atrs).forEach(function (k) { root.setAttribute(k, atrs[k]); });

      /* estilos que viven en los hijos, no en la raiz */
      var soc = root.querySelector('.pf-socials');
      if (soc) {
        soc.setAttribute('data-style', p.socialStyle);
        soc.setAttribute('data-mono', p.monoIcons === false ? 'off' : 'on');
      }
      var mus = root.querySelector('.pf-music');
      if (mus) mus.setAttribute('data-style', p.musicStyle);
      var bdg = root.querySelector('.pf-badges');
      if (bdg) bdg.setAttribute('data-style', p.badgeStyle);
      var av = root.querySelector('.pf-avatar');
      if (av) av.setAttribute('data-fx', p.avatarFx || 'none');

      /* posiciones de la rejilla libre */
      var stack = root.querySelector('.pf-stack');
      if (stack) {
        Array.prototype.forEach.call(stack.children, function (el) {
          if (!el.getAttribute || !el.hasAttribute('data-block')) return;
          var id = el.getAttribute('data-block');

          /* La caja propia va ANTES del corte por modo: aplica igual
             en columna que en rejilla libre. */
          var caja = cajaDe(p, id);
          if (caja.bs) el.setAttribute('data-bs', caja.bs);
          else el.removeAttribute('data-bs');
          if (caja.anim) el.setAttribute('data-anim', caja.anim);
          else el.removeAttribute('data-anim');
          if (caja.halo) el.setAttribute('data-halo', caja.halo);
          else el.removeAttribute('data-halo');
          ['--b-op', '--b-bd', '--b-blur', '--b-rad', '--b-pad', '--b-glow', '--b-w', '--b-font',
           '--p-text', '--p-icon', '--p-dim', '--halo']
            .forEach(function (v) { el.style.removeProperty(v); });
          caja.css.split(';').forEach(function (par) {
            if (!par) return;
            var i = par.indexOf(':');
            if (i > 0) el.style.setProperty(par.slice(0, i), par.slice(i + 1));
          });

          if (p.layoutMode !== 'free') {
            el.style.gridColumn = '';
            el.style.justifySelf = '';
            el.style.textAlign = '';
            return;
          }

          var q = p.pos[id] || {};
          var col = Math.max(1, Math.min(12, Number(q.col) || 1));
          var span = Math.max(1, Math.min(13 - col, Number(q.span) || 12));
          el.style.gridColumn = col + '/span ' + span;
          el.style.justifySelf = q.align || 'stretch';
          el.style.textAlign = q.align === 'end' ? 'right'
            : q.align === 'center' ? 'center'
            : q.align === 'start' ? 'left' : '';
        });
      }
      return true;
    },

    /* ---- efectos y eventos ------------------------------------ */
    mount: function (container, raw, opts) {
      opts = opts || {};
      var preview = !!opts.preview;
      var p = norm(raw);
      var root = container.querySelector('.pf');
      if (!root) return;

      var accent = p.accent ||
        getComputedStyle(root).getPropertyValue('--p-primary').trim() || '#ffffff';
      var small = window.matchMedia && window.matchMedia('(max-width:640px)').matches;

      ID.fx.particles(container.querySelector('#pfParticles'), p.particles, accent, { light: small || preview });
      if (p.tilt && p.surface !== 'none') ID.fx.tilt(root, root.querySelector('.pf-stack'));
      if (!preview) ID.fx.cursor(p.cursor);

      /* efectos de puntero. Cada uno se apaga solo en tactil, con
         prefers-reduced-motion y en equipos modestos. */
      if (p.fxMagnet) ID.fx.magnetismo(root);
      if (p.fxGlow) ID.fx.brillo(root, root.querySelector('.pf-glow'));
      if (p.fxParallax) {
        ID.fx.parallax(root, [
          { el: root.querySelector('.pf-bg'), k: 18 },
          { el: root.querySelector('.pf-stack'), k: -6 }
        ]);
      }

      /* ---- el video de fondo, cuando el navegador se niega ------
         Lleva `autoplay muted loop playsinline`, que es lo que iOS
         exige. Aun asi hay casos en que NO arranca solo:

           - Modo de bajo consumo del iPhone: desactiva el arranque
             automatico, y no hay atributo que lo evite.
           - Ajuste por sitio de Safari: "Reproduccion automatica:
             nunca".
           - Politicas de ahorro de datos en Android.

         El sintoma es feo porque no parece un fallo: se ve el primer
         fotograma congelado, sin ningun control, y quien mira piensa
         que el fondo es una foto.

         Un gesto del usuario levanta todas esas restricciones. Y
         este perfil ya pide uno para entrar, asi que no hay que
         inventarse un boton: se aprovecha ese toque.
         --------------------------------------------------------- */
      var arrancarFondo = function () {
        var v = container.querySelector('.pf-bg video');
        if (!v || !v.paused) return;
        var pr = v.play();
        /* si vuelve a negarse no hay nada mas que hacer, pero una
           promesa rechazada sin capturar ensucia la consola de quien
           visita el perfil */
        if (pr && pr.catch) pr.catch(function () {});
      };

      /* Sin puerta de entrada no hay gesto garantizado, asi que se
         espera al primero que llegue. `once` para no dejar oyentes
         colgando, y en captura para que cuente aunque algo detenga
         la propagacion por el camino. */
      (function () {
        var v = container.querySelector('.pf-bg video');
        if (!v) return;
        var alPrimerGesto = function () {
          arrancarFondo();
          ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
            document.removeEventListener(ev, alPrimerGesto, true);
          });
        };
        var pr = v.play();
        if (pr && pr.catch) {
          pr.catch(function () {
            ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
              document.addEventListener(ev, alPrimerGesto, true);
            });
          });
        }
      })();

      /* puerta de entrada: además desbloquea el audio y el video */
      var gate = container.querySelector('#pfGate');
      if (gate) {
        var abrir = function () {
          gate.classList.add('is-out');
          setTimeout(function () { if (gate.parentNode) gate.remove(); }, 600);
          var mm = container.querySelector('#pfMusic');
          if (mm && mm._mando) mm._mando.play();
          arrancarFondo();
        };
        gate.addEventListener('click', abrir);
        gate.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
        });
      }

      /* reproductor: sin archivo real animamos el visualizador,
         que es justo lo que se ve mientras suena la pista */
      var mus = container.querySelector('#pfMusic');
      var btn = container.querySelector('#pfMusicBtn');
      if (mus && btn && ID.music) montarReproductor(container, p, mus, btn);
      var snd = container.querySelector('#pfSound');
      if (snd && btn) snd.addEventListener('click', function () { btn.click(); });

      if (preview) return;

      var vistas = ID.store.countView(p.username);
      ['#pfViews', '#pfViewsBox'].forEach(function (sel) {
        var el = container.querySelector(sel);
        if (el) ID.fx.countUp(el, vistas);
      });

      var vote = container.querySelector('.pf-vote');
      if (vote) {
        vote.addEventListener('click', function (e) {
          var b = e.target.closest('[data-vote]');
          if (!b) return;
          var score = Number(b.getAttribute('data-vote'));
          if (!ID.store.vote(p.username, score)) return;
          ID.app.toast('Votaste ' + score + '/10 · gracias');
          var fresco = ID.store.get(p.username);
          var panel = container.querySelector('.pf-rate');
          if (panel && fresco) {
            var tmp = document.createElement('div');
            tmp.innerHTML = rateInner(norm(fresco), false);
            panel.replaceWith(tmp.firstChild);
          }
        });
      }

      var share = container.querySelector('#pfShare');
      if (share) {
        share.addEventListener('click', function () {
          ID.app.copy(location.origin + location.pathname + '#/u/' + p.username, 'Enlace copiado');
        });
      }

      root.addEventListener('click', function (e) {
        var a = e.target.closest('[data-net]');
        if (a) ID.app.trackClick(p.username, a.getAttribute('data-net'));
      });
    },

    /* ---- ruta #/u/<usuario> ------------------------------------ */
    route: function (mount, params) {
      var name = ID.util.slug(params.username || '');
      var p = ID.store.get(name);
      /* Aqui se leia `?d=<base64>` y se pintaba el perfil que
         viniera dentro. Era la unica entrada COMPLETAMENTE elegida
         por quien mandaba el enlace: un objeto arbitrario que
         acababa en el DOM de tu dominio.

         Servia para compartir un perfil sin servidor. Con base de
         datos detras, un perfil se comparte por su direccion:
         /u/nombre. Quitarlo no pierde nada y elimina la superficie
         entera en vez de intentar validarla.

         (`store.encode`/`decode` se quedan sin uso; se retiran en
         la fase de configuracion de produccion, no aqui, para no
         mezclar cambios.) */

      if (!p) {
        mount.innerHTML =
          '<div class="page rise"><p class="t-label">Perfil libre</p>' +
          '<h1 class="t-h1" style="margin-top:12px">@' + esc(name) + ' no existe todavía</h1>' +
          '<p class="t-sub" style="margin-top:12px;max-width:44ch">Ese nombre está disponible. ' +
          'Puede ser tuyo en menos de un minuto.</p>' +
          '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">' +
          '<a class="btn btn--primary" href="#/dashboard?claim=' + encodeURIComponent(name) + '">Reclamar @' + esc(name) + '</a>' +
          '<a class="btn btn--ghost" href="#/discover">Explorar perfiles</a></div></div>';
        return;
      }

      document.body.classList.add('is-profile');

      /* los medios se resuelven ANTES de pintar: asi render() sigue
         siendo sincrono y el fondo no aparece a destiempo */
      var pintar = function () {
        mount.innerHTML = V.profile.render(p, {});
        V.profile.mount(mount, p, {});
      };
      if (ID.media && ID.media.refsDe(p).length) {
        ID.media.precargar(p).then(pintar, pintar);
      } else {
        pintar();
      }

      var titulo = (p.name || p.username) + (p.title ? ' — ' + p.title : '');
      ID.app.meta({
        title: titulo + ' · IDENTITY',
        description: (p.bio || 'Perfil de @' + p.username + ' en IDENTITY').slice(0, 160),
        color: p.colBg || p.accent || '#050505',
        url: location.href,
        image: /^https?:/i.test(String(p.avatarUrl || '')) ? p.avatarUrl : ''
      });
    }
  };
})();
