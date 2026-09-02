/* ============================================================
   IDENTITY — la capa que habla con Supabase

   TODO lo de aquí devuelve promesas. Es la única parte del
   proyecto que sabe que existe una red.

   `store.js` sigue siendo síncrono y no cambia de forma: lee de
   una caché en memoria que este archivo rellena, y escribe en esa
   caché encolando el envío. Las vistas no se enteran de nada, que
   era la condición.

   Traducción entre los dos mundos:
     · en el navegador un perfil es un objeto plano con `username`
       dentro;
     · en Postgres el `username` es columna (hay un índice único
       que lo protege) y el resto vive en un `jsonb` llamado
       `apariencia`.
   `aPerfil` y `aFila` hacen ese viaje, y son el único sitio donde
   hay que tocar si el esquema cambia.
   ============================================================ */
(function () {
  'use strict';
  var ID = (window.ID = window.ID || {});
  var back = (ID.backend = {});

  var db = null;
  var arrancado = false;

  /* Copia viva de la sesion. Hace falta poder preguntar "hay
     sesion?" de forma SINCRONA, porque store.local() lo consulta en
     cada lectura y no puede esperar a una promesa. */
  var sesionViva = null;

  /* Abierto con doble clic en vez de por un servidor. OAuth no
     puede funcionar asi: el proveedor tiene que devolverte a una
     direccion http, y desde file:// se genera redirect_to=file:///
     que Supabase rechaza. Mejor decirlo que dejar que falle con un
     JSON crudo en pantalla. */
  back.esArchivoLocal = function () {
    return location.protocol === 'file:';
  };

  /* ---- arranque ------------------------------------------------
     No revienta si falta la biblioteca o la configuración: el
     proyecto tiene que seguir abriéndose en modo local, que es
     como se ha desarrollado hasta hoy. */
  back.iniciar = function () {
    if (arrancado) return !!db;
    arrancado = true;
    if (!ID.CONFIG || !ID.CONFIG.hayBackend()) return false;
    if (!window.supabase || !window.supabase.createClient) {
      console.warn('[backend] falta supabase-js; sigo en modo local');
      return false;
    }
    db = window.supabase.createClient(
      ID.CONFIG.SUPABASE_URL,
      ID.CONFIG.SUPABASE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );

    /* La sesion se sigue desde el arranque. onAuthStateChange
       dispara tambien al cargar con una sesion ya guardada, asi que
       esto se rellena solo. */
    db.auth.getSession().then(function (r) {
      sesionViva = (r.data && r.data.session) || null;
    });
    db.auth.onAuthStateChange(function (evento, s) {
      sesionViva = s || null;
    });

    return true;
  };

  /* Sincrono a proposito: lo consulta store en cada lectura. */
  back.haySesion = function () { return !!sesionViva; };
  back.sesionViva = function () { return sesionViva; };

  back.hay = function () { return !!db; };
  back.cliente = function () { return db; };

  /* Una sola forma de armar la direccion de una funcion de borde.
     Estaba escrita a mano y con un replace que no hacia nada
     ('.supabase.co' por '.supabase.co'), que es la clase de resto
     que sobrevive a un copiar y pegar y luego confunde. */
  function urlFuncion(nombre) {
    return ID.CONFIG.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/' + nombre;
  }

  /* ---- traducción entre el perfil y la fila ------------------- */

  /* Campos que son columna, no apariencia. Si algún día se añade
     otra columna, se pone aquí y ya. */
  var COLUMNAS = ['username', 'estado', 'creado', 'actualizado'];

  function aPerfil(fila) {
    if (!fila) return null;
    var p = Object.assign({}, fila.apariencia || {});
    p.username = fila.username;
    p.joined = fila.creado || p.joined;
    /* marcas internas: el resto del código no las mira, pero
       hacen falta para detectar ediciones simultáneas */
    p._id = fila.id;
    p._actualizado = fila.actualizado;
    return ID.store ? ID.store.normalizar(p) : p;
  }

  function aFila(p) {
    var ap = {};
    Object.keys(p).forEach(function (k) {
      if (k.charAt(0) === '_') return;            /* nada interno viaja */
      if (COLUMNAS.indexOf(k) !== -1) return;
      ap[k] = p[k];
    });
    return { username: p.username, apariencia: ap };
  }

  back.aPerfil = aPerfil;

  /* ---- sesión -------------------------------------------------- */

  back.sesion = function () {
    if (!db) return Promise.resolve(null);
    return db.auth.getSession().then(function (r) {
      return (r.data && r.data.session) || null;
    });
  };

  back.usuario = function () {
    return back.sesion().then(function (s) { return s ? s.user : null; });
  };

  back.entrar = function (correo, clave) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return db.auth.signInWithPassword({ email: correo, password: clave })
      .then(function (r) {
        if (r.error) throw traducir(r.error);
        return r.data.session;
      });
  };

  back.registrar = function (correo, clave) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return db.auth.signUp({ email: correo, password: clave })
      .then(function (r) {
        if (r.error) throw traducir(r.error);
        /* Sin sesión = Supabase espera la confirmación del correo.
           Quien llama tiene que enseñarlo, no dar por hecho que
           ya está dentro. */
        return { sesion: r.data.session || null, confirmar: !r.data.session };
      });
  };

  /* Discord y Spotify entran por aquí: Supabase hace el
     intercambio del token con su secreto, que es la parte que no
     puede vivir en el navegador. */
  back.conProveedor = function (proveedor, permisos) {
    if (!db) return Promise.reject(new Error('sin backend'));
    if (back.esArchivoLocal()) {
      return Promise.reject(new Error(
        'Has abierto el archivo con doble clic. Para entrar hace falta ' +
        'servirlo: ejecuta "python serve.py" y abre http://localhost:8765'));
    }
    return db.auth.signInWithOAuth({
      provider: proveedor,
      options: {
        scopes: permisos || undefined,
        redirectTo: location.origin + '/'
      }
    }).then(function (r) {
      if (r.error) throw traducir(r.error);
      return r.data;
    });
  };

  /* Cierra la sesion en TODOS los dispositivos, no solo en este.
     El valor por defecto de supabase-js es 'local': invalida el
     token de aqui y deja vivos los de las demas sesiones. Quien
     pulsa "cerrar sesion" porque cree que le han entrado en la
     cuenta espera lo contrario. */
  back.salir = function () {
    if (!db) return Promise.resolve();
    return db.auth.signOut({ scope: 'global' }).then(function (r) {
      /* Si el token ya estaba caducado el servidor responde con
         error, pero la sesion local SI se limpia. No es un fallo
         que deba parar nada. */
      if (r && r.error) console.warn('[backend] signOut', r.error.message);
      return true;
    });
  };

  /* ---- recuperar la contrasena --------------------------------
     Supabase responde lo mismo exista o no el correo, a proposito:
     si respondiera distinto, este formulario seria un comprobador
     de que cuentas existen. Quien llama tiene que enseñar el mismo
     mensaje en los dos casos o deshace esa proteccion. */
  back.recuperarClave = function (correo) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return db.auth.resetPasswordForEmail(correo, {
      /* SIN hash. Supabase devuelve el token en el fragmento de la
         URL, y si el redirectTo ya trae '#/entrar' salen dos '#' en
         la misma direccion: ni el router lo entiende ni supabase-js
         encuentra su token. Se vuelve a la raiz, se consume el
         token, y el evento PASSWORD_RECOVERY lleva a la pantalla. */
      redirectTo: location.origin + location.pathname
    }).then(function (r) {
      if (r.error) throw traducir(r.error);
      return true;
    });
  };

  /* ---- cambiar la contrasena ----------------------------------
     Sirve para los dos casos: con sesion normal (cambiarla desde
     los ajustes) y con sesion de recuperacion (llegar desde el
     enlace del correo). Supabase exige sesion valida en ambos, que
     es lo que impide cambiarle la clave a otro. */
  back.cambiarClave = function (nueva, actual) {
    if (!db) return Promise.reject(new Error('sin backend'));

    var previo = Promise.resolve();

    /* Si se pasa la contrasena actual, se COMPRUEBA antes de
       cambiar nada.
       Sin esto, cualquiera que pillara un navegador con la sesion
       abierta —un movil desbloqueado un minuto, un ordenador de
       biblioteca -- podia poner una contrasena nueva y quedarse la
       cuenta para siempre, sin saber la anterior. Supabase no lo
       exige por su cuenta: updateUser solo mira que haya sesion.

       En el flujo de recuperacion NO se pasa, y es correcto: ahi la
       prueba de identidad es el enlace del correo, y quien lo usa
       es precisamente quien no recuerda la contrasena. */
    if (actual) {
      previo = back.usuario().then(function (u) {
        if (!u || !u.email) {
          /* Cuenta creada con Discord o Google: no hay contrasena
             anterior que comprobar. */
          return null;
        }
        return db.auth.signInWithPassword({ email: u.email, password: actual })
          .then(function (r) {
            if (r.error) throw new Error('La contrasena actual no es correcta.');
            return null;
          });
      });
    }

    return previo.then(function () {
      return db.auth.updateUser({ password: nueva });
    }).then(function (r) {
      if (r.error) throw traducir(r.error);
      return true;
    });
  };

  /* ---- borrar la cuenta ---------------------------------------
     No se puede hacer desde el navegador: borrar un usuario de auth
     exige la clave de servicio. Va por la funcion de borde, que es
     el unico sitio donde esa clave existe. El JWT viaja en la
     cabecera y la funcion decide a quien borra a partir de EL, no
     de lo que diga el cuerpo. */
  back.borrarCuenta = function (confirmacion) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return back.sesion().then(function (s) {
      if (!s) throw new Error('Hay que entrar en la cuenta primero');
      return fetch(urlFuncion('borrar-cuenta'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer ' + s.access_token,
          'apikey': ID.CONFIG.SUPABASE_KEY
        },
        body: JSON.stringify({ confirmacion: confirmacion })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.error || 'No se pudo borrar la cuenta');
          return true;
        });
      });
    });
  };

  /* ---- que proveedores estan de verdad encendidos ---------------
     Supabase publica su configuracion en /auth/v1/settings. Sin
     consultarla, la pantalla ofrece botones que llevan a una pagina
     con un JSON de error ("provider is not enabled") FUERA de la
     aplicacion: el usuario se queda ahi tirado sin saber que ha
     pasado ni como volver.

     Mejor no enseñar una puerta que no abre.
     ---------------------------------------------------------------- */
  var provsCache = null;

  back.proveedores = function () {
    if (!db) return Promise.resolve({});
    if (provsCache) return Promise.resolve(provsCache);
    return fetch(ID.CONFIG.SUPABASE_URL + '/auth/v1/settings',
                 { headers: { apikey: ID.CONFIG.SUPABASE_KEY } })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) {
        provsCache = (j && j.external) || {};
        return provsCache;
      })
      .catch(function () {
        /* Sin respuesta no se inventa nada: se devuelve vacio, y la
           pantalla se queda solo con el correo. Es el fallo seguro. */
        return {};
      });
  };

  back.alCambiarSesion = function (fn) {
    if (!db) return function () {};
    var s = db.auth.onAuthStateChange(function (evento, sesion) { fn(evento, sesion); });
    return function () { try { s.data.subscription.unsubscribe(); } catch (e) {} };
  };

  /* ---- perfiles ------------------------------------------------ */

  /* Lee de la VISTA publica, no de la tabla.
     La tabla `perfiles` incluye `dueno` (el id de la cuenta) y el
     registro de aceptacion de los terminos, y la RLS es por fila:
     dejar leer la fila dejaba leer eso tambien. La vista expone
     solo lo que es contenido publico.

     El respaldo a la tabla existe por el desfase entre dos
     sistemas: este archivo se despliega en Vercel y la vista vive
     en Supabase, y no se aplican a la vez. Cualquiera que sea el
     orden hay una ventana en la que uno de los dos va por delante.
     El respaldo la cubre, y AVISA por consola para que no se quede
     ahi para siempre. Cuando la migracion 0004 este aplicada, este
     bloque sobra. */
  var avisadoDeLaVista = false;

  back.cargarPerfil = function (username) {
    if (!db) return Promise.resolve(null);

    function porLaTabla() {
      if (!avisadoDeLaVista) {
        avisadoDeLaVista = true;
        console.warn('[backend] La vista perfiles_publicos no existe todavia. ' +
          'Se lee de la tabla, que expone `dueno` y el registro de aceptacion. ' +
          'Aplica supabase/migrations/0004_exposicion.sql.');
      }
      return db.from('perfiles')
        .select('id,username,apariencia,creado,actualizado')
        .eq('username', username)
        .maybeSingle()
        .then(function (r) {
          if (r.error) throw traducir(r.error);
          return aPerfil(r.data);
        });
    }

    return db.from('perfiles_publicos')
      .select('id,username,apariencia,creado,actualizado')
      .eq('username', username)
      .maybeSingle()
      .then(function (r) {
        /* "La relacion no existe" tiene DOS formas aqui, y da la
           casualidad de que la que llega es la que no esperaba:
             42P01   lo dice Postgres
             PGRST205 lo dice PostgREST, que responde desde su cache
                      de esquema sin llegar a preguntarle a la base.
           Medido, no supuesto: la primera version solo miraba 42P01
           y el respaldo no llegaba a saltar.

           Solo esos dos codigos. Un fallo de permisos o de red NO
           puede hacernos volver por la puerta ancha. */
        if (r.error && (r.error.code === '42P01' ||
                        r.error.code === 'PGRST205' ||
                        /does not exist|schema cache/i.test(r.error.message || ''))) {
          return porLaTabla();
        }
        if (r.error) throw traducir(r.error);
        return aPerfil(r.data);
      });
  };

  back.cargarMio = function () {
    if (!db) return Promise.resolve(null);
    return back.usuario().then(function (u) {
      if (!u) return null;
      return db.from('perfiles')
        .select('id,username,apariencia,estado,creado,actualizado')
        .eq('dueno', u.id)
        .maybeSingle()
        .then(function (r) {
          if (r.error) throw traducir(r.error);
          return aPerfil(r.data);
        });
    });
  };

  back.nombreDisponible = function (nombre) {
    if (!db) return Promise.resolve(true);
    return db.rpc('nombre_disponible', { p_nombre: nombre })
      .then(function (r) {
        if (r.error) throw traducir(r.error);
        return r.data === true;
      });
  };

  back.crearPerfil = function (p) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return back.usuario().then(function (u) {
      if (!u) throw new Error('Hay que entrar en la cuenta primero');
      var fila = aFila(p);
      fila.dueno = u.id;
      fila.acepto_en = new Date().toISOString();
      fila.acepto_version = (ID.CONFIG && ID.CONFIG.VERSION_LEGAL) || null;
      return db.from('perfiles').insert(fila)
        .select('id,username,apariencia,estado,creado,actualizado').single()
        .then(function (r) {
          if (r.error) throw traducir(r.error);
          return aPerfil(r.data);
        });
    });
  };

  /* ============================================================
     GUARDAR, CON BLOQUEO OPTIMISTA Y CON SALIDA
     ============================================================
     La escritura solo se aplica si la marca de tiempo sigue siendo
     la que traiamos. Sin eso, dos pestañas abiertas se pisan sin
     decir nada.

     Pero un bloqueo sin salida no protege: atrapa. Antes, si la
     marca local se quedaba rancia el guardado se rechazaba, y como
     una copia con cambios sin confirmar ya no se refresca al
     hidratar —eso es a proposito, es lo que impide perder trabajo—
     la marca no volvia a ponerse al dia NUNCA. Resultado: el
     perfil quedaba imposible de guardar para siempre. Un candado
     puesto para no perder trabajo acababa impidiendo guardarlo.

     Asi que cuando el rechazo llega, se mira por que:

       la fila no existe  -> error de verdad, se dice y se para.
       la fila existe     -> la marca estaba rancia. Se reintenta
                             UNA vez con la del servidor.

     Ese reintento hace que gane lo que hay en el editor. Es una
     decision, no un descuido: quien esta escribiendo ahora ve lo
     que va a guardar, y lo que se desplaza es un cambio anterior
     hecho en otro sitio que esa persona ya no tiene delante.
     Perder lo que alguien acaba de escribir es peor. Pero no pasa
     en silencio: vuelve marcado y la interfaz lo cuenta.
     ============================================================ */
  back.guardarPerfil = function (p) {
    if (!db) return Promise.reject(new Error('sin backend'));
    if (!p._id) return back.crearPerfil(p);

    function escribir(marca) {
      var q = db.from('perfiles').update(aFila(p)).eq('id', p._id);
      if (marca) q = q.eq('actualizado', marca);
      return q.select('id,username,apariencia,estado,creado,actualizado')
        .maybeSingle()
        .then(function (r) {
          if (r.error) throw traducir(r.error);
          return r.data ? aPerfil(r.data) : null;   /* null = 0 filas */
        });
    }

    return escribir(p._actualizado).then(function (guardado) {
      if (guardado) return guardado;

      /* Cero filas. Puede ser la marca rancia, o que la fila no sea
         nuestra: hay que distinguirlo antes de insistir. */
      return db.from('perfiles').select('actualizado').eq('id', p._id)
        .maybeSingle()
        .then(function (r) {
          if (r.error) throw traducir(r.error);
          if (!r.data) {
            var e = new Error('Este perfil ya no esta en tu cuenta.');
            e.code = 'sin-fila';
            throw e;
          }
          return escribir(r.data.actualizado).then(function (g2) {
            if (!g2) {
              var e2 = new Error('No se pudo guardar: el perfil cambia mas rapido de lo que se puede escribir.');
              e2.code = 'conflicto';
              throw e2;
            }
            g2._desplazo = true;   /* para que la interfaz lo cuente */
            return g2;
          });
        });
    });
  };

  back.borrarPerfil = function (id) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return db.from('perfiles').delete().eq('id', id).then(function (r) {
      if (r.error) throw traducir(r.error);
      return true;
    });
  };

  /* ---- descubrir y ranking ------------------------------------ */

  back.descubrir = function (opciones) {
    if (!db) return Promise.resolve([]);
    opciones = opciones || {};
    var q = db.from('descubrir').select('*');

    /* El criterio de orden va a parar al parametro `order` de
       PostgREST. Hoy ninguna vista pasa uno —solo `limite`— pero
       el hueco esta abierto: bastaria con que manana alguien lo
       enganchara a un selector de la interfaz para que el nombre
       de una columna viniera de fuera. Lista blanca ahora, que
       cuesta cuatro lineas, y no una investigacion despues. */
    var ORDENES = {
      puntuacion: 'puntuacion',
      vistas: 'vistas',
      nota: 'nota',
      nuevos: 'actualizado'
    };
    var orden = ORDENES[opciones.orden] || 'puntuacion';
    q = q.order(orden, { ascending: false, nullsFirst: false });
    return q.limit(opciones.limite || 30).then(function (r) {
      if (r.error) throw traducir(r.error);
      return (r.data || []).map(function (f) {
        var p = aPerfil(f);
        p.views = f.vistas;
        p.nota = f.nota;
        p.numNotas = f.num_notas;
        return p;
      });
    });
  };

  /* ---- visitas -------------------------------------------------
     No se cuenta desde aquí directamente: `registrar_vista` tiene
     revocado el permiso a propósito. Solo la función de borde ve
     la IP de verdad, y si el navegador pudiera llamarla, subir en
     Descubrir sería escribir un bucle en la consola. */
  back.contarVista = function (username) {
    if (!db) return Promise.resolve();
    return fetch(ID.CONFIG.FN_VISTAS || urlFuncion('registrar-vista'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + ID.CONFIG.SUPABASE_KEY
      },
      body: JSON.stringify({ username: username })
    }).then(function () { /* da igual el resultado */ })
      .catch(function () { /* que una visita no contada no rompa la pagina */ });
  };

  /* ---- archivos ------------------------------------------------
     La ruta es SIEMPRE  <id de la cuenta>/<nombre>  porque la
     politica de Storage compara esa primera carpeta con la sesion.
     El cliente no elige donde escribe: elige el nombre dentro de
     su carpeta y nada mas.

     Y los nombres son deterministas —avatar, fondo, video— asi que
     subir uno nuevo PISA al anterior. Esa era la regla pedida ("al
     cambiar el video se borra el que estaba"), y sale gratis: no
     hace falta ninguna tarea de limpieza porque nunca llega a
     existir un segundo archivo. */
  back.subirMedio = function (blob, tipo, extension) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return back.usuario().then(function (u) {
      if (!u) throw new Error('Hay que entrar en la cuenta para subir archivos');
      var cubo = (ID.CONFIG && ID.CONFIG.BUCKET_MEDIA) || 'media';
      var ext = String(extension || '').replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase() || 'bin';
      var nombre = String(tipo).replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'archivo';
      var ruta = u.id + '/' + nombre + '.' + ext;

      return db.storage.from(cubo).upload(ruta, blob, {
        upsert: true,
        contentType: blob.type || undefined,
        cacheControl: '3600'
      }).then(function (r) {
        if (r.error) throw traducir(r.error);
        var pub = db.storage.from(cubo).getPublicUrl(ruta);
        var url = pub && pub.data && pub.data.publicUrl;
        if (!url) throw new Error('No se pudo obtener la direccion del archivo');
        /* La marca de tiempo obliga al navegador y a la CDN a
           recoger la version nueva. Sin esto, cambiar el avatar
           parece no hacer nada durante una hora. */
        return url + '?v=' + Date.now();
      });
    });
  };

  back.borrarMedio = function (tipo, extension) {
    if (!db) return Promise.resolve(false);
    return back.usuario().then(function (u) {
      if (!u) return false;
      var cubo = (ID.CONFIG && ID.CONFIG.BUCKET_MEDIA) || 'media';
      var ruta = u.id + '/' + tipo + '.' + extension;
      return db.storage.from(cubo).remove([ruta]).then(function () { return true; });
    }).catch(function () { return false; });
  };

  /* ---- valorar y denunciar ------------------------------------ */

  back.valorar = function (perfilId, nota) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return back.usuario().then(function (u) {
      if (!u) throw new Error('Hay que entrar para valorar');
      return db.from('valoraciones')
        .upsert({ perfil_id: perfilId, autor_id: u.id, nota: nota })
        .then(function (r) {
          if (r.error) throw traducir(r.error);
          return true;
        });
    });
  };

  back.denunciar = function (perfilId, motivo, detalle) {
    if (!db) return Promise.reject(new Error('sin backend'));
    return db.from('denuncias')
      .insert({ perfil_id: perfilId, motivo: motivo, detalle: detalle || null })
      .then(function (r) {
        if (r.error) throw traducir(r.error);
        return true;
      });
  };

  /* ---- mensajes de error ---------------------------------------
     Postgres dice "new row violates row-level security policy",
     que es exacto y no le sirve a nadie. Aquí se traduce a lo que
     de verdad ha pasado. Los códigos vienen de Postgres:
       23505 duplicado · 23514 restriccion · 42501 sin permiso
     ------------------------------------------------------------- */
  function traducir(e) {
    var m = (e && e.message) || '';
    var c = (e && e.code) || '';
    var salida;

    if (c === '23505' || /duplicate key/i.test(m)) {
      salida = /username/i.test(m)
        ? 'Ese nombre de usuario ya esta cogido.'
        : 'Eso ya existe.';
    } else if (/no esta disponible/i.test(m)) {
      salida = 'Ese nombre de usuario esta reservado.';
    } else if (/maximo de perfiles/i.test(m)) {
      salida = 'Ya tienes un perfil en esta cuenta.';
    } else if (c === '23514' || /violates check constraint/i.test(m)) {
      salida = /apariencia_tamano/.test(m)
        ? 'El perfil ocupa demasiado. Quita alguna imagen pesada.'
        : /username_forma/.test(m)
          ? 'El nombre solo admite letras, numeros y guion bajo, de 3 a 20.'
          : 'Hay un dato que no cumple las reglas.';
    } else if (c === '42501' || /row-level security/i.test(m)) {
      salida = 'No tienes permiso para hacer eso.';
    } else if (c === 'PT429' || (e && e.status === 429) || /rate limit/i.test(m)) {
      /* Los limites de la base traen su propio texto, escrito para
         quien lo lee. Si lo hay, se usa ese; el generico es para
         los limites de Supabase, que vienen en ingles. */
      salida = (m && !/rate limit/i.test(m))
        ? m
        : 'Demasiados intentos seguidos. Espera un momento.';
    } else if (/invalid login credentials/i.test(m)) {
      salida = 'El correo o la contrasena no son correctos.';
    } else if (/email not confirmed/i.test(m)) {
      salida = 'Confirma tu correo antes de entrar.';
    } else if (/failed to fetch|networkerror|load failed/i.test(m)) {
      salida = 'Sin conexion. Lo guardado sigue aqui; se enviara al volver.';
    } else {
      salida = m || 'Algo ha fallado.';
    }

    var err = new Error(salida);
    err.code = c;
    err.original = m;
    return err;
  }

  back.traducir = traducir;
})();
