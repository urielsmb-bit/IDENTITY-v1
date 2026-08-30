/* ============================================================
   IDENTITY — arranque y utilidades de aplicación
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;

  var app = ID.app = {
    toastTimer: 0,

    toast: function (msg, warn) {
      var el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.toggle('toast--warn', !!warn);
      el.classList.add('on');
      clearTimeout(app.toastTimer);
      app.toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2600);
    },

    /* clics en redes: alimenta el panel de analytics de forma local */
    trackClick: function (username, net) {
      var k = 'identity.clicks.v1';
      var all = ID.util.read(k, {});
      all[username] = all[username] || {};
      all[username][net] = (all[username][net] || 0) + 1;
      ID.util.write(k, all);
    },

    clicksFor: function (username) {
      return ID.util.read('identity.clicks.v1', {})[username] || {};
    },

    /* copia al portapapeles con aviso */
    copy: function (text, msg) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(
          function () { app.toast(msg || 'Copiado'); },
          function () { app.toast(text); }
        );
      } else {
        app.toast(text);
      }
    },

    /* descarga un objeto como archivo JSON */
    download: function (obj, filename) {
      try {
        var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        app.toast('Descargado ' + filename);
      } catch (e) {
        app.toast('No se pudo descargar', true);
      }
    },

    /* ---- metadatos por perfil ------------------------------
       Se actualizan al vuelo para el navegador y para quien
       comparta el enlace desde el propio sitio.

       AVISO: los rastreadores y las tarjetas de Twitter/Discord
       leen el HTML del servidor, no el DOM ya modificado. Para que
       las previsualizaciones al compartir funcionen de verdad hace
       falta renderizar estas etiquetas en el servidor. Está anotado
       en el README como pendiente.
       -------------------------------------------------------- */
    meta: function (datos) {
      document.title = datos.title;
      app._meta('name', 'description', datos.description);
      app._meta('name', 'theme-color', datos.color || '#050505');
      app._meta('property', 'og:title', datos.title);
      app._meta('property', 'og:description', datos.description);
      app._meta('property', 'og:type', datos.type || 'profile');
      app._meta('property', 'og:url', datos.url || location.href);
      app._meta('name', 'twitter:card', datos.image ? 'summary_large_image' : 'summary');
      app._meta('name', 'twitter:title', datos.title);
      app._meta('name', 'twitter:description', datos.description);
      if (datos.image) {
        app._meta('property', 'og:image', datos.image);
        app._meta('name', 'twitter:image', datos.image);
      } else {
        app._quitarMeta('property', 'og:image');
        app._quitarMeta('name', 'twitter:image');
      }
    },

    _meta: function (attr, nombre, valor) {
      var el = document.head.querySelector('meta[' + attr + '="' + nombre + '"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, nombre);
        document.head.appendChild(el);
      }
      el.setAttribute('content', valor || '');
    },

    _quitarMeta: function (attr, nombre) {
      var el = document.head.querySelector('meta[' + attr + '="' + nombre + '"]');
      if (el) el.remove();
    },

    /* ---- medios ---------------------------------------------
       Un avatar o un fondo acaban como data URI dentro de
       localStorage. Sin tocarlos, una foto de movil de 4 MB ocupa
       ~5,5 MB ahi dentro y se lleva por delante el perfil entero.

       Cada destino tiene su presupuesto: lo que de verdad se ve en
       pantalla, no lo que trae el archivo. Un avatar se pinta a
       112 px; guardarlo a 4000 px no lo mejora, solo llena el
       almacen.
       -------------------------------------------------------- */
    MEDIA: {
      avatar:  { lado:  512, calidad: 0.82, kb: 220 },
      fondo:   { lado: 1920, calidad: 0.78, kb: 900 },
      galeria: { lado: 1024, calidad: 0.80, kb: 320 },
      cover:   { lado:  640, calidad: 0.80, kb: 200 },
      /* El video NO se recomprime ni se recorta: se guarda tal cual
         en IndexedDB (ver js/media.js), donde un Blob no paga el
         4/3 de base64 ni el x2 de UTF-16 y la cuota se mide en
         gigas. El unico tope es el sentido comun: un fondo de mas
         de 64 MB no mejora nada y castiga a quien lo mire desde el
         movil. Si no hay IndexedDB, se cae al camino viejo con un
         tope mucho mas estrecho. */
      video:      { mb: 64 },
      videoSinIdb: { kb: 3072 }
    },

    /* KB que ocupa una cadena dentro de localStorage (UTF-16) */
    pesoKB: function (str) { return ((str || '').length * 2) / 1024; },

    humano: function (kb) {
      return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
    },

    _webp: null,
    soportaWebp: function () {
      if (app._webp === null) {
        var c = document.createElement('canvas');
        c.width = c.height = 1;
        app._webp = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      }
      return app._webp;
    },

    /* Reduce una imagen hasta que entre en su presupuesto.
       Devuelve una promesa con { uri, antesKB, despuesKB, nota }. */
    comprimirImagen: function (file, destino) {
      var cfg = app.MEDIA[destino] || app.MEDIA.galeria;

      function leerTal(cual) {
        return new Promise(function (ok, mal) {
          var fr = new FileReader();
          fr.onload = function () { ok(fr.result); };
          fr.onerror = function () { mal(new Error('No se pudo leer el archivo')); };
          fr.readAsDataURL(cual);
        });
      }

      /* SVG y GIF no pasan por el lienzo si caben: rasterizar un SVG
         le quita lo que lo hace bueno, y dibujar un GIF animado se
         queda con un solo fotograma. */
      var intacto = file.type === 'image/svg+xml' || file.type === 'image/gif';
      if (intacto) {
        return leerTal(file).then(function (uri) {
          var kb = app.pesoKB(uri);
          if (kb <= cfg.kb) {
            return { uri: uri, antesKB: kb, despuesKB: kb, nota: 'sin tocar' };
          }
          if (file.type === 'image/svg+xml') {
            throw new Error('Ese SVG pesa ' + app.humano(kb) +
              ' y el limite aqui son ' + app.humano(cfg.kb) + '. Simplificalo y vuelve a intentarlo.');
          }
          return app._porLienzo(file, cfg).then(function (r) {
            r.nota = 'el GIF era demasiado grande: se guardo como imagen fija';
            return r;
          });
        });
      }

      return app._porLienzo(file, cfg);
    },

    /* lo que un archivo costaria dentro de localStorage: base64 crece
       4/3, y ahi cada caracter ocupa 2 bytes. Un video de 4 MB no son
       4 MB de almacen: son casi 11. */
    costeEnAlmacenKB: function (bytes) { return (bytes / 1024) * 1.37 * 2; },

    /* dibuja, escala y vuelve a codificar bajando la calidad hasta
       entrar en el presupuesto */
    _porLienzo: function (file, cfg) {
      return new Promise(function (ok, mal) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); ok(img); };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          mal(new Error('Ese archivo no parece una imagen que el navegador sepa abrir'));
        };
        img.src = url;
      }).then(function (img) {
        var tipo = app.soportaWebp() ? 'image/webp' : 'image/jpeg';
        var lado = cfg.lado, calidad = cfg.calidad, uri = '', kb = 0;

        for (var intento = 0; intento < 7; intento++) {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var esc = Math.min(1, lado / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * esc));
          var ch = Math.max(1, Math.round(h * esc));

          var lienzo = document.createElement('canvas');
          lienzo.width = cw; lienzo.height = ch;
          var ctx = lienzo.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          /* sin webp no hay canal alfa: se pinta sobre negro, que es
             el fondo del producto, en vez de dejar bordes en blanco */
          if (tipo === 'image/jpeg') {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, cw, ch);
          }
          ctx.drawImage(img, 0, 0, cw, ch);

          uri = lienzo.toDataURL(tipo, calidad);
          kb = app.pesoKB(uri);
          if (kb <= cfg.kb) break;

          calidad = Math.max(0.4, calidad - 0.12);
          if (intento % 2 === 1) lado = Math.round(lado * 0.78);
        }

        if (kb > cfg.kb) {
          throw new Error('No se pudo dejar esa imagen por debajo de ' +
            app.humano(cfg.kb) + '. Prueba con una mas pequena.');
        }
        var antes = app.costeEnAlmacenKB(file.size);
        /* Si el original ya cabia y ademas ocupa menos que lo que
           acabamos de generar, se queda el original: recodificar una
           imagen pequena la puede engordar, y encima le quita calidad
           a cambio de nada. */
        if (antes <= cfg.kb && antes < kb) {
          return new Promise(function (ok2) {
            var fr = new FileReader();
            fr.onload = function () {
              var orig = fr.result, kbOrig = app.pesoKB(orig);
              ok2(kbOrig < kb
                ? { uri: orig, antesKB: antes, despuesKB: kbOrig, nota: 'ya estaba bien' }
                : { uri: uri, antesKB: antes, despuesKB: kb, nota: '' });
            };
            fr.onerror = function () { ok2({ uri: uri, antesKB: antes, despuesKB: kb, nota: '' }); };
            fr.readAsDataURL(file);
          });
        }
        return { uri: uri, antesKB: antes, despuesKB: kb, nota: '' };
      });
    },

    /* ---- subir a la nube, si la hay ---------------------------
       Devuelve la direccion publica del archivo, o null si no hay
       sesion (entonces se sigue con el camino local de siempre).

       NUNCA rechaza: si la subida falla se queda el archivo local y
       se avisa. Perder el avatar que alguien acaba de elegir porque
       la red parpadeo seria un intercambio pesimo — el objetivo es
       que el archivo viaje, no que la operacion sea atomica.
       ---------------------------------------------------------- */
    _aLaNube: function (blob, tipo, ext) {
      if (!ID.store || !ID.store.enLinea() || !ID.backend || !ID.backend.subirMedio) {
        return Promise.resolve(null);
      }
      return ID.backend.subirMedio(blob, tipo, ext).catch(function (e) {
        app.toast('No se pudo subir el archivo (' +
          (e.message || 'error') + '). Se queda en este navegador.', true);
        return null;
      });
    },

    /* De un tipo MIME a una extension. Se usa para el nombre del
       archivo en Storage, que es determinista a proposito. */
    _extDe: function (blob, porDefecto) {
      var t = (blob && blob.type) || '';
      var m = {
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
        'image/gif': 'gif', 'image/avif': 'avif',
        'video/mp4': 'mp4', 'video/webm': 'webm'
      };
      return m[t.split(';')[0]] || porDefecto || 'bin';
    },

    /* Un video de calidad pesa, y eso esta bien: va a IndexedDB tal
       como lo subio el usuario. Solo se comprueba que quepa de
       verdad, con el espacio real del dispositivo, no con un numero
       inventado. */
    /* ---- de que esta hecho el video ---------------------------
       El sintoma que motivo esto: un video se subia bien, se
       guardaba bien y se servia bien... y no se veia en otro
       dispositivo. No era la red ni los permisos: era H.265.

       Los moviles y los Mac graban en HEVC (`hvc1`) dentro de un
       contenedor QuickTime. Eso lo reproduce Safari, pero Chrome
       solo con soporte por hardware y Firefox practicamente no. El
       archivo LLEGA; el navegador no sabe decodificarlo.

       Y lo peor no era el fallo, era el mensaje: la aplicacion
       decia "ya se ve desde cualquier sitio". Prometia algo que no
       podia cumplir, asi que quien lo subia no tenia forma de
       enterarse hasta que alguien se lo dijera.

       Se mira la caja `moov` y no el archivo entero: los cuatro
       bytes del codec pueden aparecer por azar dentro de los datos
       de video, y un falso positivo aqui rechaza un video que si
       funcionaba.
       ---------------------------------------------------------- */
    CODECS_QUE_VEN_TODOS: ['avc1', 'avc3', 'vp09', 'vp08', 'av01'],
    CODECS_CONOCIDOS: {
      hvc1: 'H.265 (HEVC)', hev1: 'H.265 (HEVC)',
      ap4h: 'ProRes', apcn: 'ProRes', apch: 'ProRes', apcs: 'ProRes',
      mp4v: 'MPEG-4 parte 2', avc1: 'H.264', avc3: 'H.264',
      vp09: 'VP9', vp08: 'VP8', av01: 'AV1'
    },

    _inspeccionarVideo: function (f) {
      return new Promise(function (resolver) {
        var fr = new FileReader();
        fr.onerror = function () { resolver(null); };   /* sin datos, no se opina */
        fr.onload = function () {
          try {
            var b = new Uint8Array(fr.result);
            var dv = new DataView(fr.result);
            var leer4 = function (o) {
              return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
            };

            /* recorrer las cajas de nivel superior */
            var off = 0, marca = '', moov = null, orden = [];
            while (off + 8 <= b.length) {
              var sz = dv.getUint32(off);
              var tipo = leer4(off + 4);
              if (sz === 1) {
                if (off + 16 > b.length) break;
                /* tamanos de 64 bits: la parte alta es 0 en la practica */
                sz = dv.getUint32(off + 8) * 4294967296 + dv.getUint32(off + 12);
              }
              if (sz < 8 || off + sz > b.length) break;
              orden.push(tipo);
              if (tipo === 'ftyp' && off + 12 <= b.length) marca = leer4(off + 8);
              if (tipo === 'moov') moov = { desde: off, hasta: off + sz };
              off += sz;
            }
            if (!moov) return resolver(null);

            /* buscar el codec SOLO dentro de moov */
            var codecs = [], vistos = {};
            for (var i = moov.desde; i < moov.hasta - 4; i++) {
              var c = leer4(i);
              if (app.CODECS_CONOCIDOS[c] && !vistos[c]) { vistos[c] = 1; codecs.push(c); }
            }
            var iMoov = orden.indexOf('moov'), iMdat = orden.indexOf('mdat');
            resolver({
              marca: marca,
              codecs: codecs,
              /* sin ningun codec reconocido no se bloquea: puede ser
                 un contenedor que no sabemos leer y si funcione */
              compatible: !codecs.length || codecs.some(function (c) {
                return app.CODECS_QUE_VEN_TODOS.indexOf(c) >= 0;
              }),
              faststart: !(iMoov >= 0 && iMdat >= 0 && iMoov > iMdat)
            });
          } catch (e) { resolver(null); }
        };
        fr.readAsArrayBuffer(f);
      });
    },

    _video: function (f, cb) {
      app._inspeccionarVideo(f).then(function (info) {
        /* AVISO, no rechazo. Medido: un video en hvc1 se reproduce
           en Safari y tambien en Chrome cuando el equipo trae
           decodificacion por hardware, que hoy es casi todos. Donde
           falla de verdad es en Firefox y en equipos antiguos.
           Bloquearlo habria impedido subir un video que funciona
           para la mayoria — el detector estaba calibrado a partir de
           una suposicion, no de una medida. */
        if (info && !info.compatible) {
          var nombres = info.codecs.map(function (c) {
            return app.CODECS_CONOCIDOS[c] || c;
          }).join(' y ');
          app.toast('Aviso: ese video esta en ' + nombres + '. Se ve en la ' +
            'mayoria de moviles y ordenadores, pero en Firefox y en equipos ' +
            'antiguos puede salir en negro. Si quieres que lo vea todo el ' +
            'mundo, conviertelo a H.264.');
        }
        if (info && !info.faststart) {
          app.toast('Aviso: este video hay que descargarlo entero antes de ' +
            'que empiece. Tarda en aparecer con conexiones lentas.');
        }
        app._videoSigue(f, cb);
      });
    },

    _videoSigue: function (f, cb) {
      var mbArchivo = f.size / 1048576;

      /* sin IndexedDB no hay milagro: se vuelve al data URI y a su
         tope estrecho, diciendo por que */
      if (!ID.media || !ID.media.disponible()) {
        var kbv = app.costeEnAlmacenKB(f.size);
        var tope = app.MEDIA.videoSinIdb.kb;
        if (kbv > tope) {
          app.toast('Este navegador no puede guardar videos grandes (sin IndexedDB). ' +
            'El maximo aqui son ' + app.humano(tope) + '. Pega el enlace del video en el campo de arriba.', true);
          return;
        }
        var fr = new FileReader();
        fr.onload = function () { cb(fr.result, f, { antesKB: kbv, despuesKB: app.pesoKB(fr.result) }); };
        fr.readAsDataURL(f);
        return;
      }

      if (mbArchivo > app.MEDIA.video.mb) {
        app.toast('Ese video son ' + mbArchivo.toFixed(0) + ' MB. El maximo son ' +
          app.MEDIA.video.mb + ' MB: mas alla el fondo tarda en cargar y se come los datos ' +
          'de quien te visite desde el movil.', true);
        return;
      }

      /* Con sesion, el video va a Storage y NO a IndexedDB: es el
         unico camino por el que se ve desde otro dispositivo.
         El nombre es fijo, asi que subir uno nuevo pisa al
         anterior — que era la regla pedida. */
      if (ID.store && ID.store.enLinea()) {
        var tope = 8;   /* el mismo que impone el cubo, en MB */
        if (mbArchivo > tope) {
          app.toast('Ese video son ' + mbArchivo.toFixed(1) + ' MB y el maximo ' +
            'son ' + tope + ' MB. Recortalo o baja la calidad antes de subirlo.', true);
          return;
        }
        app.toast('Subiendo video\u2026');
        app._aLaNube(f, 'video', app._extDe(f, 'mp4')).then(function (url) {
          if (url) {
            cb(url, f, { antesKB: f.size / 1024, despuesKB: f.size / 1024 });
            app.toast('Video subido \u00b7 ya se ve desde cualquier sitio');
          } else {
            /* la subida fallo y ya se aviso: al menos que quede
               local para no perder lo que acaba de elegir */
            app._videoLocal(f, cb, mbArchivo);
          }
        });
        return;
      }

      app._videoLocal(f, cb, mbArchivo);
    },

    /* El camino de siempre: IndexedDB. Se usa sin sesion (borrador)
       y como red si la subida falla. */
    _videoLocal: function (f, cb, mbArchivo) {
      app.toast('Guardando video\u2026');
      ID.media.espacio().then(function (esp) {
        if (esp && esp.libreMB < mbArchivo * 1.2) {
          throw new Error('No queda sitio: el video son ' + mbArchivo.toFixed(1) +
            ' MB y en este dispositivo quedan ' + esp.libreMB.toFixed(0) + ' MB.');
        }
        return ID.media.persistir();
      }).then(function () {
        return ID.media.guardar(f);
      }).then(function (ref) {
        cb(ref, f, { antesKB: f.size / 1024, despuesKB: f.size / 1024, ref: ref });
        return ID.media.espacio().then(function (esp) {
          app.toast('Video guardado sin recomprimir \u00b7 ' + mbArchivo.toFixed(1) + ' MB' +
            (esp ? ' \u00b7 quedan ' + (esp.libreMB / 1024).toFixed(1) + ' GB' : ''));
        });
      }).catch(function (e) {
        app.toast(e.message || 'No se pudo guardar el video', true);
      });
    },

    /* ---- selector de archivo --------------------------------
       opciones.media: 'avatar' | 'fondo' | 'galeria' | 'cover'
       Con eso, las imagenes se comprimen y los videos se rechazan
       ANTES de entrar al perfil, no cuando ya no cabe nada.
       -------------------------------------------------------- */
    pickFile: function (accept, cb, opciones) {
      opciones = opciones || {};
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (!f) return;

        var esImagen = /^image\//.test(f.type) || accept.indexOf('image') === 0;
        var esVideo  = /^video\//.test(f.type) || accept.indexOf('video') === 0;

        /* el video no se recomprime: se guarda tal cual */
        if (esVideo) { app._video(f, cb); return; }

        if (esImagen && opciones.media) {
          app.toast('Optimizando imagen\u2026');
          app.comprimirImagen(f, opciones.media).then(function (r) {
            /* Se pinta YA con la version local, y la subida corre
               por detras. Quien elige una foto quiere verla al
               instante; esperar a la red para enseñarla no aporta
               nada. Cuando llega la direccion publica, se cambia. */
            cb(r.uri, f, r);
            app.toast('Imagen lista \u00b7 ocupa ' + app.humano(r.despuesKB) +
              ' en vez de ' + app.humano(r.antesKB) +
              (r.nota ? ' \u00b7 ' + r.nota : ''));

            if (!ID.store || !ID.store.enLinea()) return;
            var nombre = opciones.media === 'galeria'
              ? 'galeria-' + Math.random().toString(36).slice(2, 8)
              : opciones.media;      /* avatar | fondo | cover */
            app.toast('Subiendo\u2026');
            fetch(r.uri).then(function (x) { return x.blob(); })
              .then(function (blob) {
                return app._aLaNube(blob, nombre, app._extDe(blob, 'webp'));
              })
              .then(function (url) {
                if (!url) return;
                cb(url, f, r);      /* ahora si viaja a otros dispositivos */
                app.toast('Imagen subida \u00b7 ya se ve desde cualquier sitio');
              });
          }).catch(function (e) {
            app.toast(e.message || 'No se pudo procesar la imagen', true);
          });
          return;
        }

        var fr = new FileReader();
        fr.onload = function () { cb(fr.result, f); };
        if (esImagen || esVideo) fr.readAsDataURL(f);
        else fr.readAsText(f);
      });
      inp.click();
    }
  };

  /* ---- barra: sombra al desplazar ---------------------------- */
  function navShadow() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var on = false;
    window.addEventListener('scroll', function () {
      var should = window.scrollY > 8;
      if (should !== on) { on = should; nav.classList.toggle('is-scrolled', on); }
    }, { passive: true });
  }

  /* Aqui vivia navAutoHide(), que despertaba la barra al subir el
     puntero. Se quito con el atenuado: dentro de un perfil la barra
     ya no existe, asi que no hay nada que despertar, y un listener
     de mousemove en toda la ventana no es gratis. */

  /* ---- la sesion, en la barra de arriba ---------------------
     Sin esto la pantalla de entrar existe pero no hay por donde
     llegar a ella: estaba escrita y era inalcanzable.
     Se repinta sola cuando la sesion cambia, asi que entrar o salir
     se nota sin recargar.
     ------------------------------------------------------------- */
  function pintarSesion() {
    var hueco = document.getElementById('navSesion');
    if (!hueco) return;

    /* Sin backend no hay cuentas que ofrecer: el hueco se queda
       oculto y la barra se ve como siempre. */
    if (!ID.backend || !ID.backend.hay()) { hueco.hidden = true; return; }

    hueco.hidden = false;
    if (ID.backend.haySesion()) {
      hueco.innerHTML = '<button class="btn btn--quiet btn--sm" type="button" ' +
        'id="navSalir">Salir</button>';
      var b = document.getElementById('navSalir');
      b.addEventListener('click', function () {
        ID.backend.salir().then(function () {
          app.toast('Sesion cerrada');
          pintarSesion();
          ID.router.reload();
        });
      });
    } else {
      hueco.innerHTML = '<a class="btn btn--quiet btn--sm" href="#/entrar">Entrar</a>';
    }
  }

  app.pintarSesion = pintarSesion;

  /* ---- "esto necesita cuenta" -------------------------------
     Crear un perfil implica ser su dueño, asi que se pide la
     cuenta antes de empezar. Se guarda a donde ibas y se vuelve
     alli al entrar: mandarte a la puerta y luego dejarte en el
     recibidor es la mitad del trabajo.

     Sin backend configurado no hay cuentas, y esto deja pasar:
     el modo local tiene que seguir funcionando igual.

     Devuelve true si ha desviado, para que quien llama pare. */
  app.requiereSesion = function (destino) {
    if (!ID.backend || !ID.backend.hay()) return false;
    if (ID.backend.haySesion()) return false;
    var vuelta = destino || location.hash.replace(/^#/, '') || '/dashboard';
    location.hash = '#/entrar?volver=' + encodeURIComponent(vuelta);
    return true;
  };

  /* Los enlaces de la barra son <a href>, no pasan por JS. En vez
     de reescribirlos, se interceptan aqui: un solo sitio, y sirve
     tambien para los que pinten las vistas mas tarde. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#/dashboard"]');
    if (!a) return;
    if (app.requiereSesion(a.getAttribute('href').replace(/^#/, ''))) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    /* Lo primero de todo: si hay backend configurado, conectarlo.
       Tiene que ir ANTES del router, porque store.local() decide
       segun esto de donde lee. Si no hay configuracion, o si
       supabase-js no ha cargado, devuelve false y IDENTITY sigue
       funcionando en este navegador como hasta ahora. */
    if (ID.backend) ID.backend.iniciar();
    pintarSesion();

    /* si volvemos del permiso de Spotify, canjeamos el código */
    if (ID.music && ID.music.spotify) {
      ID.music.spotify.volver().then(function (t) {
        if (t) app.toast('Spotify conectado');
      }).catch(function (e) {
        app.toast(e.message || 'No se pudo conectar con Spotify', true);
      });
    }
    navShadow();

    /* Entrar y salir cambian la barra sin recargar. Tambien salta
       al volver de Discord o Google, que es cuando la sesion
       aparece de golpe a mitad de carga. */
    if (ID.backend && ID.backend.hay()) {
      ID.backend.alCambiarSesion(function () {
        pintarSesion();
      });
    }

    ID.router.start();
  });
})();
