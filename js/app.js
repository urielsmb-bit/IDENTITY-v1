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

    /* ============================================================
       CONVERTIR EL VIDEO A ALGO QUE VEA TODO EL MUNDO
       ============================================================
       El caso que lo motivo, medido: un video grabado con iPhone
       -QuickTime con H.265- se veia en el propio iPhone y en un PC
       moderno, y salia NEGRO en un Android de 2018. El archivo
       llegaba entero; el aparato no sabia decodificarlo.

       Decirle a alguien "convierte tu video a H.264" es pasarle un
       problema que no es suyo. Asi que lo hace la pagina.

       Como, sin librerias ni paso de compilacion: el navegador
       reproduce el original, cada fotograma se pinta en un <canvas>
       y `MediaRecorder` graba de ahi en H.264. Se re-codifica en
       tiempo real, asi que un video de seis segundos tarda seis.

       Dos limites que hay que decir en voz alta:

         · Hace falta que ESTE navegador sepa leer el original. Si
           tampoco puede, no hay conversion posible aqui y se dice.
         · `captureStream()` de un canvas no lleva audio. Para un
           fondo -que va en silencio y en bucle- da igual, y por eso
           esto solo se usa para el fondo.
       ============================================================ */
    SALIDAS_VIDEO: ['video/mp4;codecs=avc1', 'video/mp4;codecs=h264', 'video/mp4'],

    _puedeConvertirVideo: function () {
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
      for (var i = 0; i < app.SALIDAS_VIDEO.length; i++) {
        if (MediaRecorder.isTypeSupported(app.SALIDAS_VIDEO[i])) return app.SALIDAS_VIDEO[i];
      }
      return null;
    },

    _convertirVideo: function (f, alProgreso) {
      return new Promise(function (resolver, rechazar) {
        var tipo = app._puedeConvertirVideo();
        if (!tipo) {
          return rechazar(new Error('Este navegador no sabe crear MP4 en H.264. ' +
            'Abre IDENTITY en Chrome o Edge para convertirlo, o sube un MP4 ya convertido.'));
        }

        var url = URL.createObjectURL(f);
        var v = document.createElement('video');
        v.src = url; v.muted = true; v.playsInline = true; v.preload = 'auto';
        /* En el documento y con tamaño real, aunque sea de 2px: hay
           navegadores que no decodifican un video suelto o con
           `display:none`. Fuera de pantalla, no oculto. */
        v.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:.01;pointer-events:none';
        document.body.appendChild(v);

        var acabado = false;
        var limpiar = function () {
          try { v.pause(); } catch (e) {}
          try { v.remove(); } catch (e) {}
          try { URL.revokeObjectURL(url); } catch (e) {}
        };
        var fallar = function (msg) {
          if (acabado) return;
          acabado = true; limpiar(); rechazar(new Error(msg));
        };

        v.onerror = function () {
          fallar('Este navegador no puede leer ese video, asi que tampoco ' +
            'puede convertirlo. Prueba desde un ordenador, o conviertelo antes de subirlo.');
        };

        v.onloadeddata = function () {
          if (acabado) return;
          if (!v.videoWidth || !v.videoHeight) {
            return fallar('No se pudo decodificar el video en este dispositivo.');
          }

          /* 1280 en el lado largo: suficiente para un fondo a
             pantalla completa y bastante mas ligero que 4K. */
          var lienzo = document.createElement('canvas');
          var esc = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
          lienzo.width  = Math.max(2, Math.round(v.videoWidth  * esc / 2) * 2);
          lienzo.height = Math.max(2, Math.round(v.videoHeight * esc / 2) * 2);
          var ctx = lienzo.getContext('2d');

          var trozos = [];
          var mr;
          try {
            mr = new MediaRecorder(lienzo.captureStream(30), {
              mimeType: tipo, videoBitsPerSecond: 2500000
            });
          } catch (e) { return fallar('No se pudo iniciar la conversion: ' + e.message); }

          mr.ondataavailable = function (e) { if (e.data && e.data.size) trozos.push(e.data); };
          mr.onerror = function () { fallar('La conversion fallo a mitad.'); };
          mr.onstop = function () {
            if (acabado) return;
            acabado = true; limpiar();
            var blob = new Blob(trozos, { type: 'video/mp4' });
            if (blob.size < 1024) {
              return rechazar(new Error('La conversion no produjo nada. ' +
                'Suele pasar si la pestaña queda en segundo plano: dejala visible e intentalo otra vez.'));
            }
            resolver(blob);
          };

          var pintados = 0;
          var pintar = function () {
            if (acabado || v.paused || v.ended) return;
            if (v.readyState >= 2) { ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height); pintados++; }
            if (alProgreso && v.duration) alProgreso(Math.min(1, v.currentTime / v.duration));
          };

          /* `requestVideoFrameCallback` va por fotograma decodificado
             y es lo correcto aqui. Donde no exista, rAF. */
          var bucle;
          if (v.requestVideoFrameCallback) {
            bucle = function () { pintar(); if (!acabado && !v.ended) v.requestVideoFrameCallback(bucle); };
          } else {
            bucle = function () { pintar(); if (!acabado && !v.ended) requestAnimationFrame(bucle); };
          }

          /* Si en cuatro segundos no ha avanzado ni un fotograma, no
             va a avanzar: casi siempre es la pestaña en segundo
             plano, donde el navegador para el video. Mejor decirlo
             que dejar una barra de progreso quieta para siempre. */
          var vigilante = setTimeout(function () {
            if (!acabado && pintados < 2) {
              try { mr.stop(); } catch (e) {}
              fallar('La conversion no arranco. Deja esta pestaña visible ' +
                'mientras convierte y vuelve a intentarlo.');
            }
          }, 4000);

          var terminar = function () {
            clearTimeout(vigilante);
            setTimeout(function () { try { mr.stop(); } catch (e) {} }, 250);
          };
          v.onended = terminar;
          /* red de seguridad: nunca mas de dos minutos */
          setTimeout(function () { if (!acabado) terminar(); }, 120000);

          mr.start(250);
          v.play().then(bucle).catch(function () {
            clearTimeout(vigilante);
            fallar('El navegador no dejo reproducir el video para convertirlo.');
          });
        };
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
        var nombres = (info && info.codecs || []).map(function (c) {
          return app.CODECS_CONOCIDOS[c] || c;
        }).join(' y ');

        /* Si el codec no lo ve todo el mundo se convierte AQUI, en
           vez de mandar a la persona a buscarse un programa. Decirle
           "conviertelo a H.264" es pasarle un problema que no es
           suyo. */
        if (info && !info.compatible && app._puedeConvertirVideo()) {
          app.toast('Ese video esta en ' + nombres + ' y muchos moviles no lo ' +
            'reproducen. Convirtiendolo a H.264… deja esta pestaña visible.');
          var ultimo = -1;
          return app._convertirVideo(f, function (p) {
            var pct = Math.round(p * 100);
            if (pct >= ultimo + 20) { ultimo = pct; app.toast('Convirtiendo… ' + pct + '%'); }
          }).then(function (nuevo) {
            app.toast('Convertido · ' + (f.size/1048576).toFixed(1) + ' MB → ' +
              (nuevo.size/1048576).toFixed(1) + ' MB · ahora se ve en cualquier dispositivo');
            app._videoSigue(nuevo, cb);
          }).catch(function (e) {
            /* Sin conversion se sigue con el original: quedarse sin
               fondo es peor que un fondo que algunos no veran. */
            app.toast(e.message, true);
            app.toast('Se sube el original. Se vera en la mayoria de ' +
              'dispositivos, pero no en todos.');
            app._videoSigue(f, cb);
          });
        }

        if (info && !info.compatible) {
          app.toast('Aviso: ese video esta en ' + nombres + ' y este navegador ' +
            'no puede convertirlo. En Firefox y en equipos antiguos puede salir ' +
            'en negro. Subelo desde Chrome o Edge y se convertira solo.');
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
        /* Al entrar puede haber trabajo hecho sin sesion esperando a
           subir. Antes se quedaba esperando a que la persona pulsara
           guardar otra vez, sin ninguna señal de que hiciera falta. */
        if (ID.store && ID.store.reintentarPendientes) {
          var n = ID.store.reintentarPendientes();
          if (n) app.toast('Subiendo los cambios que quedaron pendientes…');
        }
      });
    }

    /* ============================================================
       DECIR LA VERDAD SOBRE SI SE GUARDO
       ============================================================
       `store.alSincronizar` existia desde el principio y NADIE lo
       escuchaba: los avisos de 'error' se emitian al vacio. Por eso
       un guardado podia fallar y la aplicacion se quedaba tan
       tranquila; peor aun, el editor decia que habia publicado.

       Solo se habla cuando hay algo que decir. Un aviso en cada
       autoguardado seria ruido —el editor guarda solo cada pocos
       segundos— y el ruido se aprende a ignorar, que es justo lo
       que no queremos el dia que el mensaje importe.
       ============================================================ */
    if (ID.store && ID.store.alSincronizar) {
      var avisado = 0;
      ID.store.alSincronizar(function (estado, dato) {
        if (estado === 'error') {
          /* Como mucho uno cada diez segundos: si se cae la red, el
             editor reintentaria en cada tecla y taparia la pantalla
             de avisos identicos. */
          var ahora = Date.now();
          if (ahora - avisado < 10000) return;
          avisado = ahora;
          app.toast('No se pudo guardar en tu cuenta' +
            ((dato && dato.message) ? ' (' + dato.message + ')' : '') +
            '. Tus cambios siguen aqui y se reintentan al guardar otra vez.', true);
        } else if (estado === 'desplazado') {
          app.toast((dato && dato.message) || 'Guardado.');
        } else if (estado === 'conflicto') {
          app.toast((dato && dato.message) ||
            'Este perfil cambio en otro sitio. Se conserva lo de aqui.', true);
        }
      });
    }

    ID.router.start();
  });
})();
