/* ============================================================
   IDENTITY — almacén de medios

   Por qué existe: un fondo en vídeo no cabe en localStorage. No por
   poco: base64 crece 4/3 y localStorage guarda UTF-16, así que un
   archivo de 4 MB ocupa casi 11 MB contra un techo de ~5 MB. Medido:
   un 720p de 3 s son 1,59 MB de archivo y 4,35 MB ahí dentro.

   IndexedDB guarda el Blob tal cual, sin inflarlo, y su cuota se
   mide en gigas (2,91 GB en la máquina donde se probó esto). Así el
   vídeo se guarda EXACTAMENTE como lo subió el usuario: sin
   recomprimir y sin perder calidad.

   El perfil deja de llevar el vídeo dentro y lleva una referencia:

     bgValue: "media:m3k9x1-a7f2"   en vez de   "data:video/mp4;base64,…"

   render() sigue siendo síncrono y puro. Para que lo siga siendo,
   los medios se resuelven ANTES con precargar(), y url() sólo mira
   una tabla en memoria.
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID = window.ID || {};

  var BASE = 'identity.media';
  var TIENDA = 'archivos';
  var PREFIJO = 'media:';

  /* Las blob: URL mantienen vivo el Blob en memoria, así que no se
     pueden acumular sin fin. Un perfil enseña un fondo; con ocho
     sobra para moverse entre perfiles sin volver a leer disco. */
  var LIMITE_CACHE = 8;
  var cache = {};      /* ref -> blob URL */
  var orden = [];      /* refs por antigüedad de uso */
  var base = null;     /* promesa de la conexión */

  function abrir() {
    if (base) return base;
    base = new Promise(function (ok, mal) {
      if (!window.indexedDB) { mal(new Error('Este navegador no tiene IndexedDB')); return; }
      var pet = indexedDB.open(BASE, 1);
      pet.onupgradeneeded = function () {
        if (!pet.result.objectStoreNames.contains(TIENDA)) pet.result.createObjectStore(TIENDA);
      };
      pet.onsuccess = function () { ok(pet.result); };
      pet.onerror = function () { mal(pet.error || new Error('No se pudo abrir el almacén')); };
      pet.onblocked = function () { mal(new Error('El almacén está bloqueado por otra pestaña')); };
    });
    /* si falla, que el siguiente intento vuelva a probar */
    base.catch(function () { base = null; });
    return base;
  }

  function conTienda(modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (ok, mal) {
        var t = db.transaction(TIENDA, modo);
        var pet = fn(t.objectStore(TIENDA));
        t.oncomplete = function () { ok(pet ? pet.result : undefined); };
        t.onerror = function () { mal(t.error); };
        t.onabort = function () { mal(t.error || new Error('transacción cancelada')); };
      });
    });
  }

  function recordar(ref, url) {
    if (cache[ref]) URL.revokeObjectURL(cache[ref]);
    cache[ref] = url;
    var i = orden.indexOf(ref);
    if (i > -1) orden.splice(i, 1);
    orden.push(ref);
    while (orden.length > LIMITE_CACHE) {
      var viejo = orden.shift();
      if (cache[viejo]) { URL.revokeObjectURL(cache[viejo]); delete cache[viejo]; }
    }
  }

  var media = ID.media = {

    PREFIJO: PREFIJO,

    disponible: function () { return !!window.indexedDB; },

    esRef: function (v) {
      return typeof v === 'string' && v.indexOf(PREFIJO) === 0;
    },

    nuevaRef: function () {
      return PREFIJO + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    },

    /* ---- escribir y leer ------------------------------------ */

    guardar: function (blob) {
      var ref = media.nuevaRef();
      return conTienda('readwrite', function (t) { return t.put(blob, ref); })
        .then(function () {
          /* el Blob ya está en la mano: al caché directamente, para
             que el render que viene detrás no tenga que ir a buscarlo */
          recordar(ref, URL.createObjectURL(blob));
          return ref;
        });
    },

    obtener: function (ref) {
      if (!media.esRef(ref)) return Promise.resolve(null);
      return conTienda('readonly', function (t) { return t.get(ref); })
        .then(function (b) { return b || null; })
        .catch(function () { return null; });
    },

    borrar: function (ref) {
      if (!media.esRef(ref)) return Promise.resolve(false);
      if (cache[ref]) {
        URL.revokeObjectURL(cache[ref]);
        delete cache[ref];
        var i = orden.indexOf(ref);
        if (i > -1) orden.splice(i, 1);
      }
      return conTienda('readwrite', function (t) { return t.delete(ref); })
        .then(function () { return true; })
        .catch(function () { return false; });
    },

    claves: function () {
      return conTienda('readonly', function (t) { return t.getAllKeys(); })
        .then(function (k) { return k || []; })
        .catch(function () { return []; });
    },

    /* ---- resolver antes de pintar --------------------------- */

    /* todas las referencias que usa un perfil */
    refsDe: function (p) {
      var out = [], visto = {};
      try {
        var txt = JSON.stringify(p) || '';
        var re = /media:[a-z0-9]+-[a-z0-9]+/g, m;
        while ((m = re.exec(txt))) {
          if (!visto[m[0]]) { visto[m[0]] = 1; out.push(m[0]); }
        }
      } catch (e) { /* un perfil con ciclos no debería llegar aquí */ }
      return out;
    },

    /* Deja en memoria todo lo que el perfil necesita. Nunca falla:
       si un medio no está, se dice y el render se cae al fondo liso. */
    precargar: function (p) {
      var refs = media.refsDe(p).filter(function (r) { return !cache[r]; });
      if (!refs.length || !media.disponible()) {
        return Promise.resolve({ cargados: 0, faltan: [] });
      }
      return Promise.all(refs.map(function (r) {
        return media.obtener(r).then(function (b) {
          if (b) { recordar(r, URL.createObjectURL(b)); return null; }
          return r;
        });
      })).then(function (faltan) {
        faltan = faltan.filter(Boolean);
        return { cargados: refs.length - faltan.length, faltan: faltan };
      });
    },

    /* SÍNCRONO a propósito: render() no puede esperar */
    url: function (ref) {
      if (!media.esRef(ref)) return '';
      var u = cache[ref];
      if (u) {
        var i = orden.indexOf(ref);
        if (i > -1) { orden.splice(i, 1); orden.push(ref); }
      }
      return u || '';
    },

    /* lo que sea que traiga el perfil, convertido en algo pintable:
       una referencia se resuelve, cualquier otra cosa pasa tal cual */
    resolver: function (valor) {
      return media.esRef(valor) ? media.url(valor) : (valor || '');
    },

    soltar: function () {
      orden.forEach(function (r) { if (cache[r]) URL.revokeObjectURL(cache[r]); });
      cache = {}; orden = [];
    },

    /* ---- mantenimiento -------------------------------------- */

    /* Borra lo que ya no referencia ningún perfil. Sin esto, cambiar
       de fondo diez veces deja nueve vídeos ocupando disco. */
    recolectar: function (protegidas) {
      var enUso = {};
      (protegidas || []).forEach(function (r) { enUso[r] = 1; });
      var locales = ID.store ? ID.store.local() : {};
      Object.keys(locales).forEach(function (u) {
        media.refsDe(locales[u]).forEach(function (r) { enUso[r] = 1; });
      });
      return media.claves().then(function (todas) {
        var sobran = todas.filter(function (k) { return !enUso[k]; });
        return Promise.all(sobran.map(function (k) { return media.borrar(k); }))
          .then(function () { return { borrados: sobran.length }; });
      });
    },

    espacio: function () {
      if (!navigator.storage || !navigator.storage.estimate) {
        return Promise.resolve(null);
      }
      return navigator.storage.estimate().then(function (e) {
        return {
          usadoMB: +(e.usage / 1048576).toFixed(1),
          cuotaMB: +(e.quota / 1048576).toFixed(1),
          libreMB: +((e.quota - e.usage) / 1048576).toFixed(1),
          pct: e.quota ? +((e.usage / e.quota) * 100).toFixed(1) : 0
        };
      }).catch(function () { return null; });
    },

    /* Sin esto el navegador puede borrar el almacén cuando le falte
       disco. Pedirlo no garantiza nada: puede decir que no. */
    persistir: function () {
      if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
      return navigator.storage.persisted().then(function (ya) {
        return ya ? true : navigator.storage.persist();
      }).catch(function () { return false; });
    },

    /* ---- exportar e importar --------------------------------
       Un .json exportado tiene que seguir siendo autocontenido: si
       se llevara sólo la referencia, el archivo no serviría en otro
       navegador. Al exportar se vuelve a incrustar; al importar se
       vuelve a sacar.
       -------------------------------------------------------- */

    aDataUri: function (ref) {
      return media.obtener(ref).then(function (b) {
        if (!b) return null;
        return new Promise(function (ok) {
          var fr = new FileReader();
          fr.onload = function () { ok(fr.result); };
          fr.onerror = function () { ok(null); };
          fr.readAsDataURL(b);
        });
      });
    },

    desdeDataUri: function (uri) {
      if (typeof uri !== 'string' || uri.indexOf('data:') !== 0) return Promise.resolve(null);
      return fetch(uri).then(function (r) { return r.blob(); })
        .then(function (b) { return media.guardar(b); })
        .catch(function () { return null; });
    },

    /* Copia del perfil con los medios incrustados, lista para
       descargar. Si un medio falta, el campo se queda vacío en vez
       de exportar una referencia rota. */
    inflar: function (p) {
      var copia = JSON.parse(JSON.stringify(p));
      var refs = media.refsDe(copia);
      if (!refs.length) return Promise.resolve(copia);
      return Promise.all(refs.map(function (r) {
        return media.aDataUri(r).then(function (uri) { return { ref: r, uri: uri }; });
      })).then(function (pares) {
        var txt = JSON.stringify(copia);
        pares.forEach(function (par) {
          txt = txt.split('"' + par.ref + '"').join(JSON.stringify(par.uri || ''));
        });
        try { return JSON.parse(txt); } catch (e) { return copia; }
      });
    },

    /* El camino inverso, y también el rescate de un perfil que ya
       tenía el vídeo metido dentro: saca el data URI a IndexedDB y
       devuelve cuánto espacio libera en localStorage. */
    extraer: function (p, campos) {
      campos = campos || ['bgValue'];
      var tareas = campos.filter(function (c) {
        return typeof p[c] === 'string' && p[c].indexOf('data:video') === 0;
      }).map(function (c) {
        var liberadoKB = ID.app ? ID.app.pesoKB(p[c]) : 0;
        return media.desdeDataUri(p[c]).then(function (ref) {
          if (ref) { p[c] = ref; return liberadoKB; }
          return 0;
        });
      });
      if (!tareas.length) return Promise.resolve({ movidos: 0, liberadoKB: 0 });
      return Promise.all(tareas).then(function (kbs) {
        var total = kbs.reduce(function (a, b) { return a + b; }, 0);
        return { movidos: kbs.filter(Boolean).length, liberadoKB: total };
      });
    }
  };
})();
