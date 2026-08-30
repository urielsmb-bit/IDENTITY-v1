/* ============================================================
   IDENTITY — los documentos legales, como páginas

   El alta pide aceptar los términos y la política. Antes esos
   enlaces no llevaban a ninguna parte: `#/terminos` caía en la
   ruta de perfil y ofrecía «Reclamar @terminos». Pedirle a alguien
   que acepte un documento que no puede leer no vale nada.

   Los textos NO se copian aquí: se leen del mismo `.md` que se
   edita en el repositorio. Una sola fuente, sin dos versiones que
   se separan con el tiempo.

   Lo que sí se recorta al publicarlos son las «Notas para ti», que
   son recordatorios internos —rellena esto, consulta aquello— y no
   tienen por qué leerlas los usuarios.
   ============================================================ */
(function () {
  'use strict';
  var ID = (window.ID = window.ID || {});
  ID.views = ID.views || {};

  var DOCS = {
    terminos:   { archivo: 'IDENTITY_TERMINOS.md',   titulo: 'Términos del servicio' },
    privacidad: { archivo: 'IDENTITY_PRIVACIDAD.md', titulo: 'Política de privacidad' },
    copyright:  { archivo: 'IDENTITY_COPYRIGHT.md',  titulo: 'Derechos de autor y DMCA' }
  };

  var cache = {};

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- markdown, lo justo -------------------------------------
     No es un intérprete completo ni pretende serlo: cubre lo que
     usan estos tres documentos. Se escapa el HTML ANTES de aplicar
     nada, así que el marcado del .md nunca puede inyectar etiquetas.
     ------------------------------------------------------------- */
  function enLinea(t) {
    return esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, txt, url) {
        /* solo enlaces internos o https: nada de javascript: */
        if (/^https?:\/\//i.test(url)) {
          /* url y txt vienen de enLinea(), que ya escapo la cadena
             entera antes de aplicar el markdown. Se vuelve a filtrar
             igualmente: depender del orden de dos funciones para que
             un href sea seguro es depender de que nadie las reordene. */
          return '<a href="' + esc(ID.util.safeUrl(url)) + '" target="_blank" ' +
                 'rel="noopener noreferrer">' + txt + '</a>';
        }
        var otro = url.replace(/^\.?\/?IDENTITY_/, '').replace(/\.md$/, '').toLowerCase();
        if (DOCS[otro]) return '<a href="#/' + otro + '">' + txt + '</a>';
        return txt;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  }

  /* ---- lo que NO se publica ------------------------------------
     Los .md llevan recordatorios para mi: "rellena el correo",
     "consulta esto con un abogado", "el registro cuesta 6 dolares".
     Publicarlos seria enseñarle al usuario la cocina.

     No basta con cortar por "## Notas para ti": el documento de
     copyright tiene ademas una seccion titulada "Por que existe
     este documento (nota para ti, borrar antes de publicar)" y
     varias citas sueltas "> **Nota para ti:** ...". Se quitan las
     tres formas.
     ------------------------------------------------------------- */
  function limpiar(md) {
    md = md.split(/\n#{1,3} Notas para ti/)[0];

    /* secciones cuyo titulo se delata */
    md = md.replace(
      /^(#{1,4})\s+[^\n]*(?:para ti|borrar antes de publicar)[^\n]*\n[\s\S]*?(?=^#{1,4}\s|\Z)/gim,
      '');

    /* citas sueltas de aviso interno */
    md = md.replace(/^> \*\*(?:Nota para ti|Borrador|Ojo con esto)[\s\S]*?(?=\n\n)/gim, '');
    md = md.replace(/^>[^\n]*(?:para ti|Nota para ti)[^\n]*\n(?:^>[^\n]*\n)*/gim, '');

    return md;
  }

  function aHtml(md) {
    md = limpiar(md);

    var out = [], lista = null, tabla = null;
    var buffer = [], modo = null;        /* 'p' | 'li' | 'cita' */
    var lineas = md.split('\n');

    /* Todo lo que puede ocupar varias lineas se ACUMULA en crudo y
       se formatea al cerrarlo. Formatear linea a linea rompia las
       negritas partidas por un salto:
           ...y en particular **cualquier sexualizacion de
           menores**, que ademas...
       Mirando una linea sola esos asteriscos no casan, y salian
       impresos tal cual. Pasaba en parrafos, en elementos de lista
       y en citas: por eso ahora es un solo mecanismo para los tres.
    */
    function soltar() {
      if (!buffer.length) { modo = null; return; }
      var txt = enLinea(buffer.join(' '));
      if (modo === 'li') out.push('<li>' + txt + '</li>');
      else if (modo === 'cita') out.push('<blockquote>' + txt + '</blockquote>');
      else out.push('<p>' + txt + '</p>');
      buffer = []; modo = null;
    }

    function cerrar() {
      soltar();
      if (lista) { out.push('</' + lista + '>'); lista = null; }
      if (tabla) { out.push('</tbody></table></div>'); tabla = null; }
    }

    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i];

      if (/^\s*$/.test(l)) { cerrar(); continue; }
      if (/^---+$/.test(l.trim())) { cerrar(); out.push('<hr>'); continue; }

      var h = /^(#{1,4})\s+(.*)$/.exec(l);
      if (h) {
        cerrar();
        var n = Math.min(h[1].length + 1, 4);   /* # del doc -> h2 de la pagina */
        out.push('<h' + n + '>' + enLinea(h[2]) + '</h' + n + '>');
        continue;
      }

      if (/^\|/.test(l)) {
        soltar();
        if (lista) { out.push('</' + lista + '>'); lista = null; }
        if (/^[\s|:-]+$/.test(l)) continue;                      /* linea de guiones */
        var celdas = l.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
        if (!tabla) {
          out.push('<div class="lg__tabla"><table><thead><tr>' +
            celdas.map(function (c) { return '<th>' + enLinea(c) + '</th>'; }).join('') +
            '</tr></thead><tbody>');
          tabla = true;
        } else {
          out.push('<tr>' + celdas.map(function (c) {
            return '<td>' + enLinea(c) + '</td>';
          }).join('') + '</tr>');
        }
        continue;
      }

      if (/^\s*>/.test(l)) {
        if (modo !== 'cita') { cerrar(); modo = 'cita'; }
        buffer.push(l.replace(/^\s*>\s?/, ''));
        continue;
      }

      var li = /^\s*[-*]\s+(.*)$/.exec(l);
      var ol = /^\s*\d+\.\s+(.*)$/.exec(l);
      if (li || ol) {
        soltar();
        if (tabla) { out.push('</tbody></table></div>'); tabla = null; }
        var quiero = li ? 'ul' : 'ol';
        if (lista && lista !== quiero) { out.push('</' + lista + '>'); lista = null; }
        if (!lista) { out.push('<' + quiero + '>'); lista = quiero; }
        modo = 'li';
        buffer.push((li || ol)[1]);
        continue;
      }

      /* Linea sangrada dentro de una lista o de una cita: es la
         continuacion de lo anterior, no algo nuevo. */
      if (modo && /^\s{2,}\S/.test(l)) { buffer.push(l.trim()); continue; }

      if (lista || tabla) cerrar();
      if (modo !== 'p') { soltar(); modo = 'p'; }
      buffer.push(l.trim());
    }

    cerrar();
    return out.join('\n');
  }

  function pintar(mount, cual, html, error) {
    var doc = DOCS[cual];
    mount.innerHTML =
      '<div class="page lg">' +
        '<nav class="lg__tabs" aria-label="Documentos legales">' +
          Object.keys(DOCS).map(function (k) {
            return '<a href="#/' + k + '"' + (k === cual ? ' class="on" aria-current="page"' : '') +
              '>' + esc(DOCS[k].titulo) + '</a>';
          }).join('') +
        '</nav>' +
        (error
          ? '<h1 class="lg__t">' + esc(doc.titulo) + '</h1>' +
            '<p class="lg__err">No se ha podido cargar el documento. ' +
            'Escríbenos y te lo enviamos.</p>'
          : '<article class="lg__doc">' + html + '</article>') +
      '</div>';
  }

  ID.views.legal = {
    route: function (mount, params) {
      var cual = (params && params.doc) || 'terminos';
      if (!DOCS[cual]) cual = 'terminos';

      if (cache[cual]) { pintar(mount, cual, cache[cual]); return; }

      mount.innerHTML = '<div class="page lg"><p class="lg__cargando">Cargando…</p></div>';

      fetch(DOCS[cual].archivo)
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        })
        .then(function (md) {
          cache[cual] = aHtml(md);
          pintar(mount, cual, cache[cual]);
        })
        .catch(function () {
          pintar(mount, cual, '', true);
        });

      ID.app.meta({
        title: DOCS[cual].titulo + ' · IDENTITY',
        description: 'Las reglas y los datos de IDENTITY, en claro.',
        type: 'website'
      });
    }
  };
})();
