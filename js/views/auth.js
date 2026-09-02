/* ============================================================
   IDENTITY — entrar y crear cuenta

   Sin backend configurado esta vista no aparece: no hay cuentas
   que crear, todo vive en este navegador y el editor funciona
   directamente, como se ha desarrollado hasta hoy.
   ============================================================ */
(function () {
  'use strict';
  var ID = (window.ID = window.ID || {});
  ID.views = ID.views || {};

  var esc = function (s) { return ID.util.esc(s); };

  var quitarOyente = null;

  /* null = todavia no sabemos cuales hay. Distinto de {} = no hay
     ninguno: mientras no se sepa no se enseña ni se descarta nada. */
  var proveedores = null;

  var estado = {
    volver: '',          /* a donde iba antes de que le pidieramos cuenta */
    correo: '',          /* sobrevive al cambio entre entrar y crear */
    modo: 'entrar',      /* entrar | crear | recuperar | nueva */
    ocupado: false,
    aviso: null,         /* { texto, malo } */
    sesion: null
  };

  /* Avisar NO puede repintar el formulario.
     Lo hacia, y cada error de validacion borraba lo que la persona
     habia escrito: te equivocabas en la contrasena y perdias
     tambien el correo. Ahora solo se toca el parrafo del aviso; los
     campos se quedan donde estaban, con lo que hubiera dentro. */
  function aviso(texto, malo, mount) {
    estado.aviso = texto ? { texto: texto, malo: !!malo } : null;
    if (!mount) return;
    var caja = mount.querySelector('.auth__caja');
    if (!caja) return;
    var el = caja.querySelector('.auth__aviso');
    if (!texto) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('p');
      el.className = 'auth__aviso';
      el.setAttribute('role', 'alert');
      var tras = caja.querySelector('#auForm');
      if (tras) tras.insertAdjacentElement('afterend', el);
      else caja.appendChild(el);
    }
    el.classList.toggle('is-mal', !!malo);
    el.textContent = texto;
  }

  /* Igual con el boton: deshabilitarlo no puede costar un repintado. */
  function ocupar(mount, si) {
    estado.ocupado = si;
    var b = mount.querySelector('#auEnviar');
    if (!b) return;
    b.disabled = si;
    b.textContent = si ? 'Un momento\u2026'
      : (estado.modo === 'crear' ? 'Crear cuenta' : 'Entrar');
  }

  /* ---- lo que se pinta ---------------------------------------- */

  function pantallaDentro(u) {
    return '' +
      '<div class="auth">' +
        '<div class="auth__caja">' +
          '<h1 class="auth__t">Tu cuenta</h1>' +
          '<p class="auth__d">' +
            esc(u.email || 'Entraste con un proveedor externo') + '</p>' +
          '<div class="auth__acts">' +
            '<a class="btn btn--primary btn--block" href="#' +
              esc(estado.volver || '/dashboard') + '">Ir a mi perfil</a>' +
            '<button class="btn btn--ghost btn--block" type="button" id="auSalir">' +
              'Cerrar sesion en todos los dispositivos</button>' +
          '</div>' +

          '<div class="auth__sep"></div>' +

          '<h2 class="auth__h2">Cambiar la contrasena</h2>' +
          '<form class="auth__f" id="auCambio" novalidate>' +
            '<label class="f__l" for="auActual"><span>Contrasena actual</span></label>' +
            '<input class="inp" id="auActual" type="password" ' +
              'autocomplete="current-password" placeholder="la de ahora">' +
            '<label class="f__l" for="auNueva" style="margin-top:12px">' +
              '<span>Nueva contrasena</span><em>minimo 8 caracteres</em></label>' +
            '<input class="inp" id="auNueva" type="password" ' +
              'autocomplete="new-password" placeholder="elige una nueva">' +
            '<button class="btn btn--ghost btn--block" type="submit" ' +
              'style="margin-top:12px">Cambiar</button>' +
          '</form>' +

          '<div class="auth__sep"></div>' +

          '<h2 class="auth__h2 is-peligro">Borrar la cuenta</h2>' +
          '<p class="auth__d">Se borran tu perfil, tus imagenes y tu video. ' +
            '<b>No se puede deshacer.</b></p>' +
          '<form class="auth__f" id="auBorrado" novalidate>' +
            '<label class="f__l" for="auConfirmar"><span>Escribe tu nombre de ' +
              'usuario para confirmar</span></label>' +
            '<input class="inp" id="auConfirmar" autocomplete="off" ' +
              'placeholder="tu nombre de usuario">' +
            '<button class="btn btn--peligro btn--block" type="submit" ' +
              'style="margin-top:12px">Borrar mi cuenta</button>' +
          '</form>' +
        '</div>' +
      '</div>';
  }

  /* ---- recuperar la contrasena ------------------------------- */
  function pantallaRecuperar() {
    return '' +
      '<div class="auth">' +
        '<div class="auth__caja">' +
          '<h1 class="auth__t">Recuperar la cuenta</h1>' +
          '<p class="auth__d">Escribe tu correo y te enviamos un enlace para ' +
            'poner una contrasena nueva.</p>' +
          '<form class="auth__f" id="auRecu" novalidate>' +
            '<label class="f__l" for="auMail"><span>Correo</span></label>' +
            '<input class="inp" id="auMail" type="email" autocomplete="email" ' +
              'inputmode="email" required placeholder="tu@correo.com" ' +
              'value="' + esc(estado.correo || '') + '">' +
            '<button class="btn btn--primary btn--block" type="submit" ' +
              'id="auEnviar" style="margin-top:16px">Enviar el enlace</button>' +
          '</form>' +
          '<p class="auth__cambio">' +
            '<button type="button" class="lnk" data-modo="entrar">Volver a entrar</button>' +
          '</p>' +
        '</div>' +
      '</div>';
  }

  /* ---- poner la contrasena nueva -----------------------------
     Se llega aqui desde el enlace del correo. supabase-js ya ha
     consumido el token y hay sesion, asi que updateUser funciona. */
  function pantallaNueva() {
    return '' +
      '<div class="auth">' +
        '<div class="auth__caja">' +
          '<h1 class="auth__t">Elige una contrasena nueva</h1>' +
          '<p class="auth__d">Has llegado desde el enlace del correo. ' +
            'Escribe la contrasena que quieras usar a partir de ahora.</p>' +
          '<form class="auth__f" id="auNuevaF" novalidate>' +
            '<label class="f__l" for="auNueva"><span>Nueva contrasena</span>' +
              '<em>minimo 8 caracteres</em></label>' +
            '<input class="inp" id="auNueva" type="password" required ' +
              'autocomplete="new-password" placeholder="elige una">' +
            '<button class="btn btn--primary btn--block" type="submit" ' +
              'id="auEnviar" style="margin-top:16px">Guardar y entrar</button>' +
          '</form>' +
        '</div>' +
      '</div>';
  }

  function pantallaFuera() {
    var crear = estado.modo === 'crear';
    return '' +
      '<div class="auth">' +
        '<div class="auth__caja">' +
          '<h1 class="auth__t">' + (crear ? 'Crea tu cuenta' : 'Entra en IDENTITY') + '</h1>' +
          '<p class="auth__d">' + (estado.volver
            ? 'Para crear tu perfil hace falta una cuenta: es lo que hace que sea tuyo y que nadie mas pueda editarlo.'
            : (crear
              ? 'Con una cuenta tu perfil deja de vivir solo en este navegador: se ve desde cualquier sitio.'
              : 'Entra para editar tu perfil.')) + '</p>' +

          bloqueProveedores() +

          '<form class="auth__f" id="auForm" novalidate>' +
            '<label class="f__l" for="auMail"><span>Correo</span></label>' +
            '<input class="inp" id="auMail" type="email" autocomplete="email" ' +
              'inputmode="email" required placeholder="tu@correo.com" ' +
              'value="' + esc(estado.correo || '') + '">' +

            '<label class="f__l" for="auPass" style="margin-top:12px"><span>Contrasena</span>' +
              (crear ? '<em>minimo 8 caracteres</em>' : '') + '</label>' +
            '<input class="inp" id="auPass" type="password" required ' +
              'autocomplete="' + (crear ? 'new-password' : 'current-password') + '" ' +
              'placeholder="' + (crear ? 'elige una' : 'la tuya') + '">' +

            /* El texto va DENTRO de un span. La etiqueta es un
               contenedor flexible, asi que cada trozo suelto de
               texto y cada enlace se convertian en piezas
               independientes de la fila: "los", "terminos y",
               "politica de privacidad" y el punto acababan
               colocados cada uno por su cuenta. Con el span solo
               hay dos piezas: la casilla y la frase. */
            (crear
              ? '<label class="auth__legal"><input type="checkbox" id="auLegal" required>' +
                '<span>He leido y acepto los <a href="#/terminos">terminos</a> y la ' +
                '<a href="#/privacidad">politica de privacidad</a>.</span></label>'
              : '') +

            '<button class="btn btn--primary btn--block" type="submit" id="auEnviar" ' +
              'style="margin-top:16px"' + (estado.ocupado ? ' disabled' : '') + '>' +
              (estado.ocupado ? 'Un momento…' : (crear ? 'Crear cuenta' : 'Entrar')) +
            '</button>' +
          '</form>' +

          (estado.aviso
            ? '<p class="auth__aviso' + (estado.aviso.malo ? ' is-mal' : '') + '" role="alert">' +
                esc(estado.aviso.texto) + '</p>'
            : '') +

          '<p class="auth__cambio">' +
            (crear
              ? 'Ya tienes cuenta? <button type="button" class="lnk" data-modo="entrar">Entra</button>'
              : 'No tienes cuenta? <button type="button" class="lnk" data-modo="crear">Creala</button>') +
          '</p>' +
          (crear ? '' :
            '<p class="auth__cambio">' +
              '<button type="button" class="lnk" data-modo="recuperar">' +
                'Olvidaste tu contrasena?</button>' +
            '</p>') +
        '</div>' +
      '</div>';
  }

  /* Discord primero y a proposito: para mucha gente es un clic en
     vez de inventarse otra contrasena, y ademas es de donde saldran
     el avatar y su decoracion. */
  var PROVEEDORES = [
    { id: 'discord', nombre: 'Discord', icono: iconoDiscord },
    { id: 'google',  nombre: 'Google',  icono: iconoGoogle }
  ];

  function bloqueProveedores() {
    if (!proveedores) return '';          /* aun preguntando */
    var hay = PROVEEDORES.filter(function (p) { return proveedores[p.id] === true; });
    if (!hay.length) return '';           /* ninguno: solo correo, y sin separador */
    return '<div class="auth__prov">' +
      hay.map(function (p) {
        return '<button class="btn btn--prov" type="button" data-prov="' + p.id + '">' +
          '<span class="auth__pico" aria-hidden="true">' + p.icono() + '</span>' +
          'Continuar con ' + p.nombre + '</button>';
      }).join('') +
      '</div>' +
      '<div class="auth__o"><span>o con tu correo</span></div>';
  }

  function iconoDiscord() {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' +
      '<path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.3.5a18 18 0 0 1 4.3 1.4 16.6 16.6 0 0 0-13-.5l.2-.4A19.6 19.6 0 0 0 3.7 4.4 20.6 20.6 0 0 0 .5 18.3a19.9 19.9 0 0 0 6 3 15 15 0 0 0 1.3-2.1 12.9 12.9 0 0 1-2-1c.2-.1.3-.2.5-.4a14 14 0 0 0 12.1 0l.5.4a12.9 12.9 0 0 1-2 1 15 15 0 0 0 1.3 2.1 19.9 19.9 0 0 0 6-3 20.6 20.6 0 0 0-3.9-13.9zM8.3 14.9c-1.2 0-2.2-1.1-2.2-2.4S7 10 8.3 10s2.2 1.1 2.2 2.4-1 2.5-2.2 2.5zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4S14.5 10 15.7 10s2.2 1.1 2.2 2.4-1 2.5-2.2 2.5z"/></svg>';
  }
  function iconoGoogle() {
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/>' +
      '<path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9a7 7 0 0 1-10.4-3.7H1.7v3A12 12 0 0 0 12 24z"/>' +
      '<path fill="#FBBC05" d="M5.5 14.6a7.1 7.1 0 0 1 0-4.6v-3H1.7a12 12 0 0 0 0 10.6l3.8-3z"/>' +
      '<path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.3-3.3A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.7 7l3.8 3A7.1 7.1 0 0 1 12 4.8z"/></svg>';
  }

  /* ---- eventos ------------------------------------------------ */

  /* Repintar no puede costarle a nadie lo que estaba escribiendo.
     Antes de tirar el DOM se recoge lo que hay en los campos, y se
     devuelve al nuevo. Asi da igual quien dispare un repintado ni
     cuando: buscar y tapar cada disparador uno por uno es perseguir
     sintomas; que la operacion sea inofensiva es arreglar la causa.

     La contrasena se restaura por PROPIEDAD, nunca como atributo
     value: no tiene por que quedarse escrita en el HTML de la
     pagina. */
  function pintar(mount) {
    var mailViejo = mount.querySelector('#auMail');
    var claveVieja = mount.querySelector('#auPass');
    if (mailViejo) estado.correo = mailViejo.value;
    var clave = claveVieja ? claveVieja.value : '';

    var cuerpo;
    /* 'nueva' manda sobre todo lo demas: si se llega desde el
       enlace del correo hay sesion, pero lo que toca es poner la
       contrasena, no ver los ajustes. */
    if (estado.modo === 'nueva') cuerpo = pantallaNueva();
    else if (estado.sesion) cuerpo = pantallaDentro(estado.sesion.user);
    else if (estado.modo === 'recuperar') cuerpo = pantallaRecuperar();
    else cuerpo = pantallaFuera();

    mount.innerHTML = '<div class="page page--corta">' + cuerpo + '</div>';

    var campoClave = mount.querySelector('#auPass');
    if (campoClave && clave) campoClave.value = clave;

    enganchar(mount);
  }

  /* Una sola comprobacion de contrasena para los tres formularios
     que la piden. Tenerla repetida es como acaban divergiendo. */
  function claveValida(campo, mount) {
    var v = campo ? campo.value : '';
    if (v.length < 8) {
      aviso('La contrasena necesita 8 caracteres como minimo.', true, mount);
      if (campo) campo.focus();
      return null;
    }
    return v;
  }

  function enganchar(mount) {
    /* Los cambios de pantalla van PRIMERO, antes de cualquier
       `return` temprano. Al ponerlos despues, la pantalla de
       recuperar salia sin enganchar su boton "Volver a entrar":
       el return del formulario de recuperacion se ejecutaba antes
       y dejaba el resto sin atar. */
    mount.querySelectorAll('[data-modo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = mount.querySelector('#auMail');
        if (m) estado.correo = m.value;
        estado.modo = b.getAttribute('data-modo');
        estado.aviso = null;
        pintar(mount);
        var f = mount.querySelector('#auMail');
        if (f) f.focus();
      });
    });

    /* ---- recuperar: enviar el enlace ---- */
    var recu = mount.querySelector('#auRecu');
    if (recu) {
      recu.addEventListener('submit', function (e) {
        e.preventDefault();
        var correo = mount.querySelector('#auMail').value.trim();
        estado.correo = correo;
        if (!correo || correo.indexOf('@') === -1) {
          aviso('Escribe un correo valido.', true, mount); return;
        }
        ocupar(mount, true);
        ID.backend.recuperarClave(correo).then(function () {
          ocupar(mount, false);
          /* MISMO mensaje exista o no la cuenta. Si dijera "no
             existe", este formulario seria un comprobador gratuito
             de que correos estan registrados. Supabase ya responde
             igual en los dos casos; decirlo distinto aqui deshace
             esa proteccion. */
          aviso('Si hay una cuenta con ese correo, te llega un enlace en unos ' +
                'minutos. Mira tambien la carpeta de spam.', false, mount);
        }).catch(function (err) {
          ocupar(mount, false);
          aviso(err.message || 'No se pudo enviar', true, mount);
        });
      });
      return;
    }

    /* ---- contrasena nueva desde el enlace del correo ---- */
    var nuevaF = mount.querySelector('#auNuevaF');
    if (nuevaF) {
      nuevaF.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = claveValida(mount.querySelector('#auNueva'), mount);
        if (!v) return;
        ocupar(mount, true);
        ID.backend.cambiarClave(v).then(function () {
          estado.modo = 'entrar';
          ID.app.toast('Contrasena actualizada');
          location.hash = '#' + (estado.volver || '/dashboard');
        }).catch(function (err) {
          ocupar(mount, false);
          aviso(err.message || 'No se pudo cambiar', true, mount);
        });
      });
      return;
    }

    var salir = mount.querySelector('#auSalir');
    if (salir) {
      salir.addEventListener('click', function () {
        ID.backend.salir().then(function () {
          estado.sesion = null;
          estado.aviso = { texto: 'Sesion cerrada en todos los dispositivos.', malo: false };
          pintar(mount);
          if (ID.app.pintarSesion) ID.app.pintarSesion();
        });
      });

      var cambio = mount.querySelector('#auCambio');
      if (cambio) {
        cambio.addEventListener('submit', function (e) {
          e.preventDefault();
          var v = claveValida(mount.querySelector('#auNueva'), mount);
          if (!v) return;
          var actual = (mount.querySelector('#auActual') || {}).value || '';
          var boton = cambio.querySelector('button');
          boton.disabled = true;
          ID.backend.cambiarClave(v, actual).then(function () {
            boton.disabled = false;
            mount.querySelector('#auNueva').value = '';
            if (mount.querySelector('#auActual')) mount.querySelector('#auActual').value = '';
            aviso('Contrasena cambiada.', false, mount);
          }).catch(function (err) {
            boton.disabled = false;
            aviso(err.message || 'No se pudo cambiar', true, mount);
          });
        });
      }

      var borrado = mount.querySelector('#auBorrado');
      if (borrado) {
        borrado.addEventListener('submit', function (e) {
          e.preventDefault();
          var campo = mount.querySelector('#auConfirmar');
          var texto = campo.value.trim();
          if (!texto) {
            aviso('Escribe tu nombre de usuario para confirmar.', true, mount);
            campo.focus(); return;
          }
          /* Segunda barrera, ademas de la que exige la funcion de
             borde. Un borrado no se deshace: que cueste dos gestos
             es la diferencia entre una decision y un resbalon. */
          if (!confirm('Se borrara tu cuenta y todo su contenido. Esto NO se puede ' +
                       'deshacer.\n\nContinuar?')) return;
          var boton = borrado.querySelector('button');
          boton.disabled = true;
          ID.backend.borrarCuenta(texto).then(function () {
            /* la sesion ya no vale para nada: fuera del navegador */
            return ID.backend.salir().catch(function () {});
          }).then(function () {
            try { localStorage.clear(); } catch (er) {}
            ID.app.toast('Cuenta borrada');
            location.hash = '#/';
            location.reload();
          }).catch(function (err) {
            boton.disabled = false;
            aviso(err.message || 'No se pudo borrar la cuenta', true, mount);
          });
        });
      }
      return;
    }

    var campoMail = mount.querySelector('#auMail');
    if (campoMail) {
      campoMail.addEventListener('input', function () { estado.correo = campoMail.value; });
    }


    mount.querySelectorAll('[data-prov]').forEach(function (b) {
      b.addEventListener('click', function () {
        var prov = b.getAttribute('data-prov');
        /* identify da avatar, decoracion, banner y badges. NO da
           mensajes ni servidores, y no queremos que los de.
           'email' se pide ademas por una razon concreta: identify
           por si solo NO devuelve correo, y sin correo Supabase no
           puede crear la cuenta salvo que se le permita crear
           usuarios sin el. Y una cuenta sin correo es una cuenta
           que no se puede recuperar: el dia que pierdas el acceso a
           tu Discord, pierdes tu perfil para siempre. */
        var permisos = prov === 'discord' ? 'identify email' : undefined;
        ID.backend.conProveedor(prov, permisos).catch(function (e) {
          aviso(e.message || 'No se pudo continuar', true, mount);
        });
      });
    });

    var form = mount.querySelector('#auForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (estado.ocupado) return;

      var correo = mount.querySelector('#auMail').value.trim();
      var clave = mount.querySelector('#auPass').value;
      var legal = mount.querySelector('#auLegal');

      estado.correo = correo;

      if (!correo || correo.indexOf('@') === -1) {
        aviso('Escribe un correo valido.', true, mount);
        mount.querySelector('#auMail').focus();
        return;
      }
      if (estado.modo === 'crear') {
        /* 8, no los 6 que pide Supabase: el minimo del proveedor no
           tiene por que ser el nuestro. */
        if (clave.length < 8) {
          aviso('La contrasena necesita 8 caracteres como minimo.', true, mount);
          mount.querySelector('#auPass').focus();
          return;
        }
        if (legal && !legal.checked) {
          aviso('Hay que aceptar los terminos para crear la cuenta.', true, mount);
          legal.focus();
          return;
        }
      }

      aviso(null, false, mount);
      ocupar(mount, true);

      var accion = estado.modo === 'crear'
        ? ID.backend.registrar(correo, clave)
        : ID.backend.entrar(correo, clave).then(function (s) { return { sesion: s }; });

      accion.then(function (r) {
        ocupar(mount, false);
        if (r && r.confirmar) {
          /* Sin sesion = Supabase espera la confirmacion. Decirlo,
             en vez de dejar al usuario mirando una pantalla que no
             cambia. */
          estado.modo = 'entrar';
          estado.aviso = { texto: 'Te hemos enviado un correo para confirmar la cuenta. '
                                + 'Abrelo y vuelve aqui.', malo: false };
          pintar(mount);
          return;
        }
        estado.sesion = (r && r.sesion) || null;
        ID.app.toast('Hola de nuevo');
        location.hash = '#' + (estado.volver || '/dashboard');
      }).catch(function (e) {
        ocupar(mount, false);
        aviso(e.message || 'No se pudo completar', true, mount);
      });
    });
  }

  /* ---- la vista ----------------------------------------------- */

  ID.views.auth = {
    route: function (mount, params) {
      if (!ID.backend || !ID.backend.hay()) {
        /* Sin backend no hay cuentas. En vez de una pantalla que no
           lleva a ningun sitio, al editor, que es lo que la persona
           venia a hacer. */
        location.hash = '#/dashboard';
        return;
      }
      estado.modo = (params && params.modo === 'crear') ? 'crear' : estado.modo;
      /* Solo rutas de esta misma aplicacion. Sin esta comprobacion,
         un enlace con ?volver=https://otro-sitio convierte la
         pantalla de entrar en un trampolin para llevarse a la gente
         a donde quiera quien mande el enlace. */
      var v = (params && params.volver) || '';
      estado.volver = /^\/[\w\-/?=&%.]*$/.test(v) ? v : '';
      pintar(mount);

      /* Llegada desde el enlace de recuperacion. supabase-js
         consume el token de la URL y dispara PASSWORD_RECOVERY;
         hasta ese momento no hay forma de saberlo. Se comprueba
         tambien el fragmento por si el evento ya paso antes de
         llegar a esta vista. */
      if (/type=recovery/.test(location.hash) || /type=recovery/.test(location.search)) {
        estado.modo = 'nueva';
        pintar(mount);
      }
      if (!quitarOyente) {
        quitarOyente = ID.backend.alCambiarSesion(function (evento, s) {
          if (evento === 'PASSWORD_RECOVERY') {
            estado.modo = 'nueva';
            estado.sesion = s;
            pintar(mount);
          }
        });
      }

      /* Al llegar la lista se repinta para añadir los botones que
         si funcionan. pintar() conserva lo escrito, asi que hacerlo
         a mitad de escritura no cuesta nada. */
      if (!proveedores) {
        ID.backend.proveedores().then(function (p) {
          proveedores = p || {};
          pintar(mount);
        });
      }

      /* La sesion se consulta al entrar, y tarda. Repintar cuando
         llega la respuesta borraba lo que la persona hubiera
         empezado a escribir en ese segundo. Si no hay sesion, la
         pantalla que ya esta pintada es la correcta: no se toca. */
      ID.backend.sesion().then(function (s) {
        var cambia = (!!s) !== (!!estado.sesion) ||
                     (s && estado.sesion && s.user.id !== estado.sesion.user.id);
        estado.sesion = s;
        if (cambia) pintar(mount);
      });
    }
  };
})();
