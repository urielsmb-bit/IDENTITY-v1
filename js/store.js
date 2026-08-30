/* ============================================================
   IDENTITY — almacén
   Persistencia en localStorage + reglas de negocio del cliente.
   El día que exista backend, este archivo es el único que cambia:
   las vistas sólo hablan con ID.store.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;

  var K_PROFILES = 'identity.profiles.v2';
  var K_STATS    = 'identity.stats.v1';
  var K_MINE     = 'identity.mine.v1';
  var K_VOTES    = 'identity.votes.v1';
  var K_SEEN     = 'identity.seen.v1';

  /* ---- utilidades ------------------------------------------ */
  var util = ID.util = {
    esc: function (str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    /* Referencia de medio segura para meter en un src.
       `esc()` escapa comillas pero NO impide `javascript:`, y el
       avatar acababa en src tal cual. Aqui se delega en el mismo
       filtro que usa el validador: http(s), media:, blob: y data:
       de imagen o video. Cualquier otra cosa, nada. */
    safeMedia: function (u) {
      if (ID.validar && ID.validar.medio) return ID.validar.medio(u);
      return /^(https?:|data:image\/|blob:|media:)/i.test(String(u || '')) ? String(u) : '';
    },

    /* sólo permitimos esquemas seguros en enlaces de usuario */
    safeUrl: function (u) {
      u = String(u || '').trim();
      if (!u) return '#';
      if (/^(https?:|mailto:|tel:|#)/i.test(u)) return u;
      if (/^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return 'https://' + u;
      return '#';
    },
    /* ---- identidad de los bloques ---------------------------
       Un bloque deja de ser "un tipo" para ser "una pieza". El id
       de una copia es tipo#n ('bio#2'), asi que:

         - el TIPO sigue diciendo que se pinta (B[tipo])
         - el ID dice de quien es el estilo, la posicion, el ancho,
           la animacion y el contenido

       Todo lo que ya estaba indexado por id (pos, bstyle, blocks)
       funciona igual sin cambiar de forma: un perfil de antes no
       tiene '#' en ningun id, asi que nada de esto le afecta.
       -------------------------------------------------------- */
    tipoBloque: function (id) {
      id = String(id || '');
      var i = id.indexOf('#');
      return i === -1 ? id : id.slice(0, i);
    },

    esCopia: function (id) { return String(id || '').indexOf('#') !== -1; },

    /* siguiente id libre para ese tipo dentro de una lista */
    nuevaCopia: function (tipo, lista) {
      var n = 2;
      while (lista.indexOf(tipo + '#' + n) !== -1) n++;
      return tipo + '#' + n;
    },

    slug: function (s) {
      return String(s || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '').slice(0, 24);
    },
    num: function (n) {
      n = Number(n) || 0;
      if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K';
      return String(n);
    },
    full: function (n) { return (Number(n) || 0).toLocaleString('es-CO'); },
    /* PRNG determinista: la misma semilla da siempre la misma serie,
       así las analíticas no bailan entre renders. */
    seed: function (str) {
      var h = 2166136261 >>> 0;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return function () {
        h += 0x6D2B79F5; h |= 0;
        var t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    read: function (k, dflt) {
      try {
        var v = localStorage.getItem(k);
        return v ? JSON.parse(v) : dflt;
      } catch (e) { return dflt; }
    },
    write: function (k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
        util.ultimoError = null;
        return true;
      } catch (e) {
        util.ultimoError = util.errorDeEscritura(e);
        return false;
      }
    },

    /* el ultimo fallo de escritura, para quien quiera contarlo */
    ultimoError: null,

    /* traduce la excepcion del navegador a algo que se pueda decir
       en pantalla. Sin esto la interfaz solo sabe "false". */
    errorDeEscritura: function (e) {
      var n = (e && e.name) || '';
      var c = e && e.code;
      if (n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          c === 22 || c === 1014) {
        return { code: 'lleno',
          message: 'No queda espacio en este navegador. Quita una imagen o un video pesado y vuelve a intentarlo.' };
      }
      if (n === 'SecurityError' || n === 'InvalidAccessError') {
        return { code: 'bloqueado',
          message: 'Este navegador no permite guardar datos aqui (modo privado o permisos bloqueados).' };
      }
      return { code: 'fallo',
        message: 'No se pudo guardar: ' + ((e && e.message) || 'error desconocido') };
    }
  };

  /* ---- version del esquema -----------------------------------
     Un perfil sin `v` es anterior a este campo: el objeto plano que
     vivia en identity.profiles.v2. migrar() lo trae al dia.
     Ver IDENTITY_SCHEMA.md.
     ------------------------------------------------------------ */
  var VERSION = 4;

  /* ---- valores por defecto de los campos sueltos --------------
     UNICA tabla de defaults del proyecto. Antes estaba repetida en
     store.blank(), store.normalizar() y en la vista de perfil, y las
     tres no coincidian: el editor y el perfil publico pintaban
     bloques distintos con el mismo perfil.
     ------------------------------------------------------------ */
  var DEFAULTS = {
    align: 'center', surface: 'none',
    avShape: 'circle', avSize: 112, avBorder: true, avGlow: true,
    socialStyle: 'icons', musicStyle: 'compact', badgeStyle: 'full',
    font: '', fontDisplay: '', nameWeight: '', nameCase: '',
    stackWidth: 460, gap: 16, pad: null, radius: 18,
    nameSize: 0, bioSize: 0, iconSize: 20,
    sOpacity: null, sBorder: null, sBlur: 22, sGlow: 40,
    bgOpacity: 100, vignette: 0, bgFixed: true,
    monoIcons: true,
    /* efectos de puntero: apagados salvo que se pidan */
    fxMagnet: false, fxGlow: false, fxParallax: false,
    widthMode: 'fixed',
    layoutMode: 'stack', stackPos: 'center',
    blockStyle: 'inherit', blockRadius: null,
    hoverFx: 'lift', enterFx: 'rise',
    nameSpacing: 0, lineHeight: 0
  };

  var COLECCIONES = ['socials', 'links', 'projects', 'gallery',
    'tags', 'live', 'fields', 'badges'];

  /* ============================================================
     EL ESPEJO

     store sigue siendo sincrono. Esa fue la condicion: las vistas
     llaman a store en 24 metodos y unos 60 sitios, y hacerlos
     asincronos habria significado tocarlos todos.

     La solucion es un espejo en memoria. Con backend:
       · leer    -> del espejo, instantaneo, igual que antes;
       · escribir-> al espejo al momento, y se envia en paralelo;
       · hidratar-> el router espera a que llegue el perfil antes
                    de pintar. Son cuatro sitios, no sesenta.

     Sin backend configurado no existe: todo sigue yendo a
     localStorage exactamente como hasta hoy.
     ============================================================ */
  var espejo = {
    mapa: {},          /* username -> perfil, lo que store.local() ve */
    oyentes: [],
    enVuelo: 0,

    /* LEER y ESCRIBIR son dos decisiones distintas, y meterlas en
       una sola condicion costo caro: al hacer que el espejo
       dependiera de la sesion, `hidratar()` dejo de consultar el
       backend para quien no habia entrado. O sea que NINGUN
       visitante podia ver NINGUN perfil — el producto entero.

         leer    -> basta con que haya backend. Los perfiles son
                    publicos: para verlos no hace falta cuenta.
         empujar -> hace falta sesion. Sin ella no hay a donde
                    guardar, y lo escrito se queda de borrador en
                    este navegador hasta que la haya.
     */
    activo: function () {
      return !!(ID.backend && ID.backend.hay());
    },

    puedeEmpujar: function () {
      return espejo.activo() && ID.backend.haySesion();
    },

    /* Los borradores de quien aun no ha entrado viven en este
       navegador. Al arrancar el espejo se siembra con ellos, o al
       recargar se perderia de vista lo que se estaba montando. */
    sembrado: false,
    sembrar: function () {
      if (espejo.sembrado) return;
      espejo.sembrado = true;
      var local = util.read(K_PROFILES, {});
      Object.keys(local).forEach(function (k) {
        if (!espejo.mapa[k]) espejo.mapa[k] = local[k];
      });
    },

    /* ============================================================
       LA UNICA PUERTA POR LA QUE ENTRA LO QUE BAJA DE LA NUBE
       ============================================================
       Antes cada hidratacion hacia `espejo.mapa[u] = p` a pelo, y
       eso destruia el trabajo sin guardar.

       Reproducido: se edita el nombre, `save()` devuelve true y
       `ultimoError` es null; se abre el perfil —que hidrata— y el
       cambio ha desaparecido. El usuario ve que guardo bien y luego
       ve que no. No hay nada peor que eso.

       La regla es una sola: LO QUE EL SERVIDOR NO HA CONFIRMADO
       TODAVIA NO SE PISA. Un perfil marcado `_sucio` tiene cambios
       que el servidor aun no ha aceptado —porque no hay sesion, o
       porque el envio fallo, o porque sigue en vuelo—, y esos
       cambios valen mas que una copia remota: lo que se acaba de
       escribir es lo que la persona tiene en la cabeza.
       ============================================================ */
    recibir: function (p) {
      if (!p || !p.username) return p;
      var previo = espejo.mapa[p.username];

      if (previo && previo._sucio) {
        /* Si ademas la copia remota es mas nueva, hay un choque de
           verdad: alguien edito en otro sitio. Se avisa, pero NO se
           resuelve pisando: lo local se queda y el proximo envio
           mandara. Perder lo que alguien acaba de escribir para
           quedarte con lo que escribio en otro dispositivo hace
           media hora no es resolver un conflicto, es elegir mal. */
        if (p._actualizado && previo._actualizado &&
            new Date(p._actualizado) > new Date(previo._actualizado)) {
          espejo.avisar('conflicto', {
            username: p.username,
            message: 'Este perfil cambio en otro sitio. Se conserva lo de aqui.'
          });
        }
        return previo;
      }

      espejo.mapa[p.username] = p;
      return p;
    },

    avisar: function (estado, error) {
      espejo.oyentes.forEach(function (fn) {
        try { fn(estado, error); } catch (e) { /* un oyente roto no para el resto */ }
      });
    },

    /* Se envia el perfil que se acaba de escribir. El editor ya
       trae su propio retardo en autoguardar(), asi que aqui no
       hace falta otro: llegaria tarde dos veces. */
    empujar: function (p) {
      if (!espejo.activo() || !p || !p.username) return;
      espejo.enVuelo++;
      espejo.avisar('enviando');
      ID.backend.guardarPerfil(p).then(function (guardado) {
        /* El servidor devuelve la fila con su nueva marca de
           tiempo. Sin recogerla, el siguiente guardado creeria que
           alguien mas lo edito y avisaria de un conflicto que no
           existe. */
        if (guardado) {
          var actual = espejo.mapa[guardado.username];
          if (actual) {
            actual._id = guardado._id;
            actual._actualizado = guardado._actualizado;
            /* Confirmado por el servidor: ya se puede dejar pisar.
               Solo aqui se limpia la marca. Si el envio falla, sigue
               sucio y la copia local aguanta. */
            delete actual._sucio;
            store._respaldar();
          }
          /* El servidor acepto, pero hubo que pasar por encima de un
             cambio hecho en otro sitio. Se guarda lo de aqui —que es
             lo que la persona tiene delante— y se dice. */
          if (guardado._desplazo) {
            espejo.avisar('desplazado', {
              username: guardado.username,
              message: 'Guardado. Habia un cambio hecho en otro sitio y se ha sustituido por lo de aqui.'
            });
          }
        }
        espejo.enVuelo--;
        espejo.avisar(espejo.enVuelo ? 'enviando' : 'guardado');
      }).catch(function (e) {
        espejo.enVuelo--;
        espejo.avisar('error', e);
      });
    }
  };

  /* ---- el almacén ------------------------------------------- */
  var store = ID.store = {

    /* Con backend, el espejo. Sin el, este navegador, como siempre. */
    local: function () {
      if (!espejo.activo()) return util.read(K_PROFILES, {});
      espejo.sembrar();
      return espejo.mapa;
    },

    /* métricas acumuladas, separadas del perfil */
    stats: function () { return util.read(K_STATS, {}); },

    /* semilla + locales + métricas.
       El perfil base puede cambiar (una semilla nueva, una edición)
       sin perder las visitas ni los votos que ya tenía. */
    all: function () {
      var st = store.stats();
      var out = {}, i;

      function conMetricas(base) {
        var m = st[base.username];
        return m ? Object.assign({}, base, m) : base;
      }

      for (i = 0; i < ID.SEED.length; i++) {
        out[ID.SEED[i].username] = conMetricas(ID.SEED[i]);
      }
      var loc = store.local();
      for (var k in loc) {
        if (Object.prototype.hasOwnProperty.call(loc, k)) out[k] = conMetricas(loc[k]);
      }
      return out;
    },

    list: function () {
      var m = store.all(), arr = [];
      for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) arr.push(m[k]);
      return arr;
    },

    /* Devuelve el perfil TAL COMO esta guardado, sin normalizar: es
       un objeto compartido (las semillas viven en ID.SEED). Quien lo
       vaya a pintar o a editar pasa por store.normalizar(). */
    get: function (username) {
      return store.all()[String(username || '').toLowerCase()] || null;
    },

    /* copia propia, migrada y normalizada: segura de editar */
    getEditable: function (username) {
      var p = store.get(username);
      return p ? store.normalizar(JSON.parse(JSON.stringify(p))) : null;
    },

    exists: function (username) { return !!store.get(username); },

    /* ---- escritura ------------------------------------------
       save() devuelve true SOLO si el perfil quedo escrito. Si el
       navegador rechaza la escritura (cuota llena, modo privado) el
       motivo queda en store.ultimoError y quien llama tiene que
       contarlo. Nunca se responde true "por si acaso": esa era la
       via por la que el editor decia "Guardado" sin haber guardado.
       -------------------------------------------------------- */
    ultimoError: null,

    save: function (p) {
      store.ultimoError = null;
      if (!p) {
        store.ultimoError = { code: 'vacio', message: 'No hay perfil que guardar.' };
        return false;
      }
      p.username = util.slug(p.username);
      if (!p.username) {
        store.ultimoError = { code: 'sin-usuario',
          message: 'Elige un nombre de usuario antes de guardar.' };
        return false;
      }
      /* Se valida al ESCRIBIR, no solo al pintar.
         Antes solo pasaba por la lista blanca lo que llegaba a
         `normalizar()`, y eso lo llama la vista de perfil... pero
         no Descubrir, ni Ranking, ni la portada, que leen de
         `store.list()` en crudo. Resultado: un `javascript:` en el
         avatar llegaba al DOM de esas tres vistas.
         Validando aqui, lo malo no llega a guardarse nunca, y da
         igual quien lo lea despues. */
      p = store.normalizar(p);

      var loc = store.local();
      p.v = VERSION;
      p.badges = store.evaluateBadges(p);
      /* Sucio hasta que el servidor diga lo contrario. Mientras lo
         este, ninguna hidratacion puede pisarlo. */
      p._sucio = true;
      loc[p.username] = p;
      if (!store._escribir(loc, p)) return false;
      return true;
    },

    /* Unico punto de escritura del mapa de perfiles. Con backend va
       al espejo y se envia; sin el, a localStorage. Tenerlo en un
       solo sitio es lo que hace que save, saveRaw y remove no
       tengan que saber cual de los dos mundos esta activo. */
    _escribir: function (loc, perfilAEnviar) {
      if (espejo.activo()) {
        espejo.mapa = loc;
        if (espejo.puedeEmpujar()) {
          /* Respaldo en disco ANTES de enviar, no despues.
             Aqui solo se escribia en el espejo, que vive en memoria,
             y se enviaba a la red sin esperar respuesta. Si la
             pestana se cerraba o la red fallaba en ese hueco, el
             trabajo no estaba en ningun sitio: ni arriba, porque no
             llego, ni abajo, porque nadie lo escribio. */
          store._respaldar();
          if (perfilAEnviar) espejo.empujar(perfilAEnviar);
          return true;
        }
        /* Sin sesion no hay a donde enviar: se guarda de borrador
           en este navegador, igual que en modo local. Al entrar,
           hidratarMio() lo recoge y el primer guardado lo sube. */
        if (!util.write(K_PROFILES, loc)) {
          store.ultimoError = util.ultimoError;
          return false;
        }
        return true;
      }
      if (!util.write(K_PROFILES, loc)) {
        store.ultimoError = util.ultimoError;
        return false;
      }
      return true;
    },

    /* Copia en disco de lo que el servidor todavia no ha aceptado.
       Solo eso: guardar el espejo entero meteria en localStorage las
       miniaturas de Descubrir y llenaria la cuota con perfiles
       ajenos. Cuando el servidor confirma, la entrada se retira. */
    _respaldar: function () {
      if (!espejo.activo()) return;
      var enDisco = util.read(K_PROFILES, {});
      Object.keys(espejo.mapa).forEach(function (u) {
        var p = espejo.mapa[u];
        if (p && p._sucio) enDisco[u] = p;
        else if (enDisco[u]) delete enDisco[u];
      });
      if (!util.write(K_PROFILES, enDisco)) store.ultimoError = util.ultimoError;
    },

    /* guarda sin pasar por evaluateBadges ni tocar el usuario activo.
       Lo usan el generador y las plantillas, que escriben borradores. */
    saveRaw: function (username, perfil) {
      store.ultimoError = null;
      var loc = store.local();
      if (perfil && typeof perfil === 'object') {
        perfil = store.normalizar(perfil);   /* misma puerta que save() */
        perfil.v = VERSION;
      }
      loc[username] = perfil;
      return store._escribir(loc, perfil);
    },

    remove: function (username) {
      store.ultimoError = null;
      var loc = store.local();
      var iba = loc[username];
      delete loc[username];
      if (!store._escribir(loc, null)) return false;
      /* borrar de verdad, no solo del espejo */
      if (espejo.activo() && iba && iba._id) {
        ID.backend.borrarPerfil(iba._id).catch(function (e) {
          espejo.avisar('error', e);
        });
      }
      return true;
    },

    /* ============================================================
       LO ASINCRONO

       Los cuatro metodos que SI devuelven promesas. Los llama el
       router antes de pintar; las vistas no los tocan.
       ============================================================ */

    /* Trae un perfil de la nube al espejo. Devuelve el perfil, o
       null si no existe. Sin backend no hace nada y responde con
       lo que ya haya. */
    hidratar: function (username) {
      /* Consulta el backend siempre que exista, con sesion o sin
         ella: un perfil publico se ve sin cuenta. */
      if (!espejo.activo()) return Promise.resolve(store.get(username));
      espejo.sembrar();
      return ID.backend.cargarPerfil(username).then(function (p) {
        return p ? espejo.recibir(p) : p;
      });
    },

    /* El perfil de la sesion abierta. Ademas apunta cual es el mio,
       para que store.mine() siga funcionando sin cambios. */
    hidratarMio: function () {
      /* Este SI necesita sesion: sin ella no hay "mio" que traer,
         solo el borrador que ya esta en este navegador. */
      if (!espejo.puedeEmpujar()) return Promise.resolve(store.mine());
      return ID.backend.cargarMio().then(function (p) {
        if (p) {
          var quedo = espejo.recibir(p);
          util.write(K_MINE, quedo.username);
          return quedo;
        }
        /* Hay sesion pero todavia no hay perfil en la nube. Si esta
           persona venia trabajando sin cuenta, su borrador esta en
           este navegador: se sube al espejo para que el editor lo
           encuentre donde lo dejo, y el primer guardado lo crea
           arriba. Sin esto, entrar borraria de la vista todo lo que
           habia hecho antes de registrarse. */
        var borradores = util.read(K_PROFILES, {});
        var cual = util.read(K_MINE, null);
        var borrador = cual ? borradores[cual] : null;
        if (borrador) {
          espejo.mapa[borrador.username] = borrador;
          return borrador;
        }
        return null;
      });
    },

    /* Trae los perfiles de Descubrir. Los mete en el espejo para
       que store.list() los vea. */
    hidratarDescubrir: function (opciones) {
      if (!espejo.activo()) return Promise.resolve(store.list());
      espejo.sembrar();
      return ID.backend.descubrir(opciones).then(function (lista) {
        lista.forEach(function (p) {
          /* Descubrir devuelve una MINIATURA: nombre, avatar, tema
             y poco mas. Meterla tal cual en el espejo pisaria un
             perfil completo que ya estuviera cargado -- y si es el
             tuyo, el siguiente guardado subiria la version recortada
             y te borraria la bio, los enlaces y todo lo demas.
             Solo entra si no habia nada, y marcada como parcial. */
          var previo = espejo.mapa[p.username];
          if (previo && !previo._parcial) return;
          p._parcial = true;
          espejo.mapa[p.username] = p;
        });
        return lista;
      });
    },

    /* Para pintar "Guardando... / Guardado / Error". El editor ya
       tiene el hueco donde enseñarlo desde la Fase 0. */
    alSincronizar: function (fn) {
      espejo.oyentes.push(fn);
      return function () {
        var i = espejo.oyentes.indexOf(fn);
        if (i !== -1) espejo.oyentes.splice(i, 1);
      };
    },

    /* true cuando hay backend Y sesion, o sea cuando lo que se
       guarde va a salir de este navegador. Las vistas lo usan para
       saber si estan trabajando en borrador. */
    enLinea: function () { return espejo.puedeEmpujar(); },

    /* true cuando hay backend, con o sin sesion: se pueden LEER
       perfiles publicos. */
    hayNube: function () { return espejo.activo(); },

    /* ---- el perfil que estoy editando ---------------------- */
    mineName: function () { return util.read(K_MINE, null); },

    mine: function () {
      var n = store.mineName();
      var p = n ? store.get(n) : null;
      var copia = p ? JSON.parse(JSON.stringify(p)) : store.blank();
      return store.normalizar(copia);
    },

    /* ---- migración ------------------------------------------
       Trae un perfil viejo al esquema actual. Es idempotente:
       migrar(migrar(p)) da lo mismo que migrar(p), porque en cuanto
       el perfil lleva la version corriente se devuelve tal cual.
       Nunca borra datos del usuario.
       -------------------------------------------------------- */
    VERSION: VERSION,

    migrar: function (p) {
      if (!p || typeof p !== 'object') return p;
      var v = Number(p.v) || 0;

      /* ya esta al dia: no se toca nada */
      if (v === VERSION) return p;
      /* viene de una version mas nueva: no se degrada, se deja pasar */
      if (v > VERSION) return p;

      var out = Object.assign({}, p);

      /* --- v3 -> v4 -----------------------------------------
         El bloque de identidad se partio en piezas sueltas: nombre,
         @usuario, oficio y fecha. Las tres nuevas van INMEDIATAMENTE
         detras del nombre; si se dejaran a normalizar(), las
         anadiria al final del orden y el @usuario apareceria al pie
         del perfil en todo lo ya guardado. */
      if (v >= 3 && v < 4) {
        var orden = (out.blockOrder || []).slice();
        if (orden.length) {
          ['handle', 'meta', 'joined'].forEach(function (id, k) {
            if (orden.indexOf(id) === -1) {
              var i = orden.indexOf('identity');
              orden.splice(i === -1 ? k : i + 1 + k, 0, id);
            }
          });
          out.blockOrder = orden;
        }
        out.v = 4;
        return out;
      }

      /* --- sin version -> v3 --------------------------------
         El modelo plano no cambia de forma. Lo que aporta v3 es que
         el perfil declara su esquema y que la estructura minima
         queda garantizada por normalizar(). No se renombra ni se
         elimina ningun campo: los que quedaron sueltos (showStats,
         showRate, discordWidget) se siguen leyendo como heredados.
         Este es el sitio donde ira cualquier cambio de forma. */
      if (v < 3) {
        /* de golpe hasta la corriente: se sella v3 y se vuelve a
           entrar para que se aplique el paso v3 -> v4 */
        out.v = 3;
        return store.migrar(out);
      }

      return out;
    },

    /* ---- normalización · ÚNICA fuente de verdad --------------
       Aqui se decide que significa que un campo falte. Nadie mas
       define valores por defecto: ni la vista de perfil, ni el
       editor, ni blank(). El perfil publico y el editor pintan el
       mismo estado porque los dos entran por esta funcion.

       No muta el argumento: devuelve una copia normalizada, asi se
       puede llamar sobre un perfil compartido (las semillas de
       ID.SEED) sin ensuciarlo.
       -------------------------------------------------------- */
    normalizar: function (p) {
      p = store.migrar(p || {});

      /* LISTA BLANCA antes de nada. Antes esto era
             Object.assign({}, DEFAULTS, p)
         y se quedaba con todo lo que trajera `p`, con el tipo que
         trajera: un numero podia ser un objeto, una cadena medir
         diez megas, y una clave inventada entraba sin mas.

         Como TODO perfil pasa por aqui -- del navegador, de la
         base, o de un enlace -- validar en este punto cubre las
         tres entradas de una vez. */
      var out = ID.validar
        ? ID.validar.perfil(p, DEFAULTS)
        : Object.assign({}, DEFAULTS, p);

      /* orden del heroe: se completa con lo que falte del catalogo y
         se descarta lo que ya no existe, por si el catalogo cambia.
         Se razona por TIPO, no por id, para que las copias (bio#2)
         sobrevivan y no se dupliquen los tipos ya presentes. */
      var base = ID.BLOCK_ORDER.slice();
      var orden = (p.blockOrder && p.blockOrder.length) ? p.blockOrder.slice() : base.slice();
      var tipos = {};
      orden.forEach(function (id) { tipos[util.tipoBloque(id)] = 1; });
      base.forEach(function (id) { if (!tipos[id]) orden.push(id); });
      out.blockOrder = orden.filter(function (id) {
        return base.indexOf(util.tipoBloque(id)) !== -1;
      });

      /* pos, bstyle y bcontent los deja ya limpios ID.validar.
         Aqui estaban asignandose OTRA VEZ desde `p`, en crudo, y
         eso deshacia la validacion: los valores del atacante
         volvian a entrar tres lineas despues de haberlos filtrado.
         Solo se rellenan si el validador no llego a correr. */
      if (!ID.validar) {
        out.pos = p.pos || {};
        out.bstyle = p.bstyle || {};
        out.bcontent = p.bcontent || {};
      }

      /* Las secciones son nombres del catalogo, no texto libre:
         cualquier otra cosa se descarta. */
      var SEC = (ID.PAGE_SECTIONS || []).map(function (x) {
        return typeof x === 'string' ? x : x.id;
      });
      if (!SEC.length) SEC = ['links', 'about', 'gallery', 'projects', 'rate'];
      var pedidas = Array.isArray(p.sections) ? p.sections : [];
      out.sections = pedidas.filter(function (x) { return SEC.indexOf(x) !== -1; });
      if (!out.sections.length) out.sections = SEC.slice();

      /* Interruptores: solo las claves conocidas, y solo booleanos.
         Antes un Object.assign metia cualquier clave que trajera el
         objeto, y con cualquier valor. */
      function soloInterruptores(base, dados) {
        var salida = Object.assign({}, base);
        if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
          Object.keys(base).forEach(function (k) {
            if (Object.prototype.hasOwnProperty.call(dados, k)) {
              /* la misma regla que el validador, no una copia que
                 acabe divergiendo */
              salida[k] = ID.validar ? ID.validar.bool(dados[k])
                                     : dados[k] === true;
            }
          });
        }
        return salida;
      }

      out.sectionsOn = soloInterruptores({
        about: !!p.about, links: true, gallery: true,
        projects: true, rate: p.showRate !== false
      }, p.sectionsOn);

      out.blocks = soloInterruptores({
        avatar: true, name: true, handle: true, meta: true, joined: false,
        fields: true, status: true, discord: !!p.discordWidget, live: true,
        bio: true, badges: true, socials: true, music: true,
        level: p.layout === 'gamecard', views: false, stats: p.showStats !== false
      }, p.blocks);

      COLECCIONES.forEach(function (k) {
        if (!Array.isArray(out[k])) out[k] = [];
      });
      if (!out.status) out.status = { state: 'online', activity: '', detail: '' };
      if (!out.ratings) out.ratings = { design: 0, originality: 0, aesthetic: 0, votes: 0 };

      out.v = VERSION;
      return out;
    },

    setMine: function (username) {
      if (util.write(K_MINE, username)) return true;
      store.ultimoError = util.ultimoError;
      return false;
    },

    /* ---- relleno de vista previa -----------------------------
       Una miniatura de un perfil vacio son once rectangulos negros:
       inutil justo para quien acaba de empezar, que es quien mas
       necesita ver la diferencia.

       Esto NO es un perfil falso: nunca aparece en Descubrir, ni en
       el ranking, ni tiene usuario. Es lo mismo que el texto de
       muestra de una carta de colores. Y solo rellena lo que falta:
       en cuanto escribes tu nombre, la miniatura ensena el tuyo.
       -------------------------------------------------------- */
    muestra: function (p) {
      var q = JSON.parse(JSON.stringify(p || store.blank()));
      var vacio = function (v) { return v == null || v === '' ; };

      if (vacio(q.name) || q.name === 'Tu nombre') q.name = 'Alex Rivera';
      if (vacio(q.title) || q.title === 'Lo que haces') q.title = 'Fotografia y direccion de arte';
      if (vacio(q.location)) q.location = 'Bogota';
      if (vacio(q.bio) || q.bio.indexOf('Escribe algo') === 0) {
        q.bio = 'Hago imagenes que se quedan. Trabajo con marcas y con gente que tiene algo que decir.';
      }
      if (!(q.socials || []).length) {
        q.socials = [{ net: 'instagram', url: '#' }, { net: 'x', url: '#' },
                     { net: 'github', url: '#' }, { net: 'spotify', url: '#' }];
      }
      if (!(q.badges || []).length) q.badges = ['creator', 'og'];
      if (!q.views) q.views = 1240;
      if (!q.likes) q.likes = 86;

      /* una miniatura no secuestra el puntero ni pide entrar */
      q.gate = false;
      q.cursor = 'default';
      q.tilt = false;
      q.showRate = false;
      return q;
    },

    /* ---- perfil de partida ----------------------------------
       blank() NO es una segunda tabla de defaults: es un perfil
       concreto que pasa por normalizar() como cualquier otro. Solo
       declara lo que un perfil nuevo tiene de propio, y los pocos
       valores en los que el punto de partida se aparta a proposito
       de lo que significa "campo ausente".
       -------------------------------------------------------- */
    blank: function () {
      return store.normalizar({
        username: '', name: 'Tu nombre', title: 'Lo que haces',
        location: '', emoji: '◈', accent: '#D8FF47',
        bio: 'Escribe algo que valga la pena leer dos veces.',
        theme: 'dark', layout: 'card3d', avatarFx: 'none',
        cursor: 'default', particles: 'stars',
        tilt: false, gate: true,
        colText: '', colBg: '', colIcon: '', gradient: false,
        animatedName: false,
        glowName: false, glowSocials: false, glowBadges: false,
        noise: 0,
        about: '', age: '',

        /* --- composición v2: sin caja por defecto ------------
           El perfil nace integrado con el fondo. La caja es una
           opción que el usuario enciende, no el punto de partida.
           (surface:'none' y preset:'center' ya son el default del
           esquema; aqui solo queda lo que se aparta de el.) */
        widthMode: 'auto',

        /* el perfil nuevo enseña el contador de visitas y esconde el
           bloque de estadisticas. Es una decision sobre el perfil
           inicial, no sobre lo que significa un campo ausente: por
           eso vive aqui y no en normalizar(). */
        blocks: { views: true, stats: false },

        bgType: 'gradient', bgValue: '', bgBlur: 0, bgDim: 45,
        avatarUrl: '', audio: null,
        status: { state: 'online', activity: 'Disponible', detail: '' },
        level: 1, xp: 0, xpMax: 1000,
        views: 0, likes: 0, joined: new Date().toISOString().slice(0, 10),
        discoverable: true, verified: false, premium: false,
        showStats: true, showRate: true, showLevel: true
      });
    },

    /* ---- visitas -------------------------------------------
       Una visita por perfil y por sesión de navegador. Sin
       backend no hay forma honesta de contar visitantes únicos
       reales; esto es lo más cercano que se puede hacer aquí.
       -------------------------------------------------------- */
    countView: function (username) {
      var p = store.get(username);
      if (!p) return 0;

      var seen = util.read(K_SEEN, {});
      var key = username + '|' + new Date().toISOString().slice(0, 10);
      if (seen[key]) return p.views || 0;

      seen[key] = 1;
      util.write(K_SEEN, seen);

      var st = store.stats();
      st[username] = st[username] || {};
      st[username].views = (p.views || 0) + 1;
      /* serie diaria REAL: sin esto la grafica de evolucion habria
         que inventarla, que es justo lo que se ha quitado */
      var hoy = new Date().toISOString().slice(0, 10);
      st[username].dias = st[username].dias || {};
      st[username].dias[hoy] = (st[username].dias[hoy] || 0) + 1;
      util.write(K_STATS, st);
      return st[username].views;
    },

    /* ---- progreso del perfil ---------------------------------
       Cada punto es accionable: si no está hecho, el panel sabe
       a qué sección llevar al usuario. Es el mejor motor de
       retención que tiene un producto de perfiles.
       -------------------------------------------------------- */
    completion: function (p) {
      var items = [
        { id: 'user',    ok: !!p.username, label: 'Elige tu nombre de usuario', sec: 'overview' },
        { id: 'name',    ok: !!(p.name && p.name !== 'Tu nombre'), label: 'Pon tu nombre visible', sec: 'overview' },
        { id: 'avatar',  ok: !!(p.avatarUrl || (p.emoji && p.emoji !== '◈')), label: 'Sube un avatar', sec: 'overview' },
        { id: 'bio',     ok: !!(p.bio && p.bio.length > 24 &&
                          p.bio.indexOf('Escribe algo') === -1), label: 'Escribe una biografía', sec: 'overview' },
        { id: 'socials', ok: (p.socials || []).length >= 2, label: 'Vincula al menos 2 redes', sec: 'links' },
        { id: 'links',   ok: (p.links || []).length >= 1, label: 'Añade un enlace propio', sec: 'links' },
        { id: 'theme',   ok: !!(p.theme && p.theme !== 'dark') || !!p.accent, label: 'Personaliza la apariencia', sec: 'appearance' },
        { id: 'views',   ok: (p.views || 0) >= 10, label: 'Alcanza 10 visitas', sec: 'analytics' }
      ];
      var hechos = items.filter(function (x) { return x.ok; }).length;
      return {
        items: items,
        done: hechos,
        total: items.length,
        pct: Math.round(hechos / items.length * 100)
      };
    },

    /* ---- badges automáticos ---------------------------------
       Las reglas viven aquí para que un badge nunca sea sólo
       decorativo: siempre responde a algo que el perfil hizo.
       -------------------------------------------------------- */
    evaluateBadges: function (p) {
      var manual = ['founder', 'og', 'staff', 'top10', 'supporter', 'artist', 'early'];
      var keep = (p.badges || []).filter(function (b) { return manual.indexOf(b) !== -1; });
      var add = [];

      var nets = (p.socials || []).map(function (s) { return s.net; });
      if (nets.indexOf('github') !== -1) add.push('dev');
      if (nets.indexOf('discord') !== -1 || nets.indexOf('steam') !== -1 || nets.indexOf('twitch') !== -1) add.push('gamer');
      if ((p.projects || []).length >= 3) add.push('creator');
      if ((p.views || 0) >= 10000) add.push('views10k');
      if ((p.views || 0) >= 100000) add.push('views100k');
      if (p.premium) add.push('premium');
      if (p.verified) add.push('verified');

      var r = p.ratings || {};
      var avg = ((r.design || 0) + (r.originality || 0) + (r.aesthetic || 0)) / 3;
      if (avg >= 9 && (r.votes || 0) >= 50) add.push('rated9');

      var days = Math.floor((Date.now() - new Date(p.joined || Date.now()).getTime()) / 864e5);
      if (days >= 100) add.push('streak100');
      if (days >= 365) add.push('og');

      var out = keep.concat(add), uniq = [];
      for (var i = 0; i < out.length; i++) if (uniq.indexOf(out[i]) === -1) uniq.push(out[i]);
      return uniq;
    },

    /* nivel derivado de la actividad, no un número inventado */
    computeLevel: function (p) {
      var pts = Math.floor((p.views || 0) / 400)
        + (p.badges || []).length * 12
        + (p.links || []).length * 4
        + (p.projects || []).length * 6
        + (p.socials || []).length * 3;
      var lvl = Math.max(1, Math.floor(Math.sqrt(pts) * 1.4));
      var floor = Math.pow((lvl - 1) / 1.4, 2);
      var ceil = Math.pow(lvl / 1.4, 2);
      return { level: lvl, xp: Math.round(pts - floor), xpMax: Math.max(1, Math.round(ceil - floor)) };
    },

    /* ---- votación ------------------------------------------- */
    myVote: function (username) { return util.read(K_VOTES, {})[username] || null; },

    vote: function (username, score) {
      var votes = util.read(K_VOTES, {});
      var had = votes[username];
      votes[username] = score;
      util.write(K_VOTES, votes);

      var p = store.get(username);
      if (!p) return null;

      var r = Object.assign({ design: 0, originality: 0, aesthetic: 0, votes: 0 }, p.ratings || {});
      var n = r.votes || 0;
      var newN = had ? n : n + 1;
      /* media móvil sobre las tres dimensiones */
      ['design', 'originality', 'aesthetic'].forEach(function (dim, i) {
        var cur = r[dim] || 0;
        var objetivo = Math.max(0, Math.min(10, score + (i - 1) * 0.2));
        r[dim] = Math.round(((cur * n + objetivo) / Math.max(1, newN)) * 10) / 10;
      });
      r.votes = newN;

      var st = store.stats();
      st[username] = st[username] || {};
      st[username].ratings = r;
      util.write(K_STATS, st);
      return r;
    },

    /* ---- analíticas ----------------------------------------
       Serie derivada del usuario + su total de visitas. Es una
       simulación coherente, no telemetría real: sin servidor no
       existen países ni referentes que medir.
       -------------------------------------------------------- */
    /* ---- analiticas ------------------------------------------
       SOLO lo que se ha medido. Antes esta funcion fabricaba con un
       PRNG la serie por dia, los paises, los referentes, los
       dispositivos y el tiempo medio de visita. Era coherente y no
       bailaba entre renders, pero era inventado: el dueño del perfil
       leia "42% Colombia" de un numero que nadie habia contado.

       Lo que se mide de verdad en el navegador:
         visitas    contadas, 1 por perfil/dia/navegador
         serie      las visitas de cada dia, tal cual se contaron
         clics      por red, contados al pulsar
         votos      reales

       Lo que NO se puede medir sin servidor —pais, referente,
       dispositivo, tiempo de permanencia— ya no se enseña. Vuelve
       con la Leccion 31, con datos de verdad.
       -------------------------------------------------------- */
    analytics: function (username, days) {
      days = days || 30;
      var p = store.get(username);
      if (!p) return null;

      var st = store.stats()[username] || {};
      var dias = st.dias || {};

      var series = [], i, hoy = new Date();
      for (i = days - 1; i >= 0; i--) {
        var d = new Date(hoy.getTime() - i * 864e5);
        series.push({ date: d, v: dias[d.toISOString().slice(0, 10)] || 0 });
      }

      var mitad = Math.floor(series.length / 2);
      var a = series.slice(0, mitad).reduce(function (x, y) { return x + y.v; }, 0);
      var b = series.slice(mitad).reduce(function (x, y) { return x + y.v; }, 0);
      var trend = a ? Math.round((b - a) / a * 100) : (b ? 100 : 0);

      var medidas = series.reduce(function (x, y) { return x + y.v; }, 0);
      var clics = ID.app ? ID.app.clicksFor(username) : {};
      var clicks = Object.keys(clics).map(function (net) {
        return { net: net, label: (ID.NETS[net] || {}).label || net, n: clics[net] };
      }).sort(function (x, y) { return y.n - x.n; });

      return {
        series: series,
        trend: trend,
        total: p.views || 0,
        medidas: medidas,          /* cuantas visitas hay en la serie */
        clicks: clicks,
        peak: series.reduce(function (m, x) { return x.v > m.v ? x : m; }, series[0]),
        /* lo que hace falta un servidor para saber */
        sinDatos: ['geo', 'refs', 'devices', 'avgTime']
      };
    },

    /* ---- ranking -------------------------------------------- */
    leaderboard: function (cat) {
      var arr = store.list().filter(function (p) { return p.discoverable !== false; });
      var score = {
        views:  function (p) { return p.views || 0; },
        rating: function (p) {
          var r = p.ratings || {};
          return ((r.design || 0) + (r.originality || 0) + (r.aesthetic || 0)) / 3 * ((r.votes || 0) > 20 ? 1 : 0.5);
        },
        likes:  function (p) { return p.likes || 0; },
        growth: function (p) {
          var a = store.analytics(p.username, 7);
          return a ? a.trend : 0;
        },
        level:  function (p) { return p.level || 0; },
        premium:function (p) { return (p.premium ? 1e9 : 0) + (p.views || 0); }
      }[cat] || function (p) { return p.views || 0; };

      return arr.map(function (p) { return { p: p, s: score(p) }; })
        .sort(function (a, b) { return b.s - a.s; });
    },

    /* perfil del día: determinista por fecha, rota cada 24h */
    profileOfDay: function () {
      var arr = store.list().filter(function (p) { return p.discoverable !== false; });
      if (!arr.length) return null;
      var day = new Date().toISOString().slice(0, 10);
      var rnd = util.seed('potd:' + day);
      return arr[Math.floor(rnd() * arr.length)];
    },

    /* ---- compartir: el perfil viaja dentro de la URL --------- */
    encode: function (p) {
      try {
        var json = JSON.stringify(p);
        var bytes = new TextEncoder().encode(json);
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } catch (e) { return ''; }
    },

    /* Sin uso desde la Fase 4: era la puerta de `?d=`. Se conserva
       la funcion —no molesta y `encode` sigue siendo util para
       depurar— pero NINGUNA vista la llama ya. Si vuelve a
       llamarse, el perfil que devuelve pasa por store.normalizar()
       como cualquier otro, y ahi lo espera la lista blanca. */
    decode: function (str) {
      try {
        var b = str.replace(/-/g, '+').replace(/_/g, '/');
        while (b.length % 4) b += '=';
        var bin = atob(b);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch (e) { return null; }
    }
  };
})();
