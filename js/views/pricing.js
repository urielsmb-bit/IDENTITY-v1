/* ============================================================
   IDENTITY — precios y marketplace
   ============================================================ */
(function () {
  'use strict';
  var ID = window.ID;
  var V = ID.views = ID.views || {};
  var esc = ID.util.esc;

  var TIERS = [
    {
      id: 'free', name: 'Free', price: '$0', note: 'para siempre',
      sub: 'Suficiente para tener un perfil del que no te avergüences.',
      feats: [
        'Perfil en <b>identity.gg/tunombre</b>',
        '5 enlaces y todas las redes',
        '6 temas base',
        'Badges y nivel',
        'Estadísticas básicas'
      ],
      cta: 'Empezar gratis', hot: false
    },
    {
      id: 'pro', name: 'Pro', price: '$29.900', note: 'COP · pago único',
      sub: 'Se paga una vez. No es una suscripción más.',
      feats: [
        '<b>Los 14 temas</b> y todas las disposiciones',
        'Fondo de video y audio',
        'Partículas, cursores y efectos',
        'Enlaces destacados con portada',
        'Analytics completo',
        'Generador de perfiles',
        'Sin marca de IDENTITY'
      ],
      cta: 'Pasar a Pro', hot: true
    },
    {
      id: 'creator', name: 'Creator', price: '$79.900', note: 'COP · pago único',
      sub: 'Para quien vive de esto.',
      feats: [
        'Todo lo de Pro',
        '<b>Dominio propio</b> (tudominio.com)',
        'Perfil destacado en Descubrir',
        'Más almacenamiento de media',
        'Vender temas en el marketplace',
        'Insignia de Creator'
      ],
      cta: 'Ser Creator', hot: false
    }
  ];

  V.pricing = {
    route: function (mount) {
      mount.innerHTML =
        '<div class="page rise">' +
          '<header class="page__head" style="text-align:center;max-width:640px;margin-inline:auto">' +
            '<p class="t-label">Precios</p>' +
            '<h1 class="t-h1" style="margin-top:10px">Paga una vez. Úsalo siempre.</h1>' +
            '<p class="t-sub" style="margin-top:12px">' +
              'Cobrar una mensualidad por un perfil personal nos parece abusivo. ' +
              'Pagas una vez y es tuyo.</p>' +
          '</header>' +

          '<div class="tiers">' +
            TIERS.map(function (t) {
              return '<article class="tier' + (t.hot ? ' tier--hot' : '') + '">' +
                (t.hot ? '<span class="tier__tag">Más elegido</span>' : '') +
                '<div class="tier__n">' + esc(t.name) + '</div>' +
                '<div class="tier__p">' + esc(t.price) + ' <small>' + esc(t.note) + '</small></div>' +
                '<p class="tier__sub">' + esc(t.sub) + '</p>' +
                '<ul>' + t.feats.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>' +
                '<button class="btn ' + (t.hot ? 'btn--primary' : 'btn--ghost') +
                  ' btn--block" type="button" data-tier="' + t.id + '">' + esc(t.cta) + '</button>' +
                '</article>';
            }).join('') +
          '</div>' +

          '<section style="margin-top:64px">' +
            '<div class="band__head">' +
              '<div><h2 class="t-h2">Marketplace de temas</h2>' +
              '<p>Diseñadores publican temas, tú los compras, ellos cobran el 70%.</p></div>' +
            '</div>' +
            '<div class="market">' +
              ID.MARKET.map(function (m) {
                return '<article class="mitem">' +
                  '<div class="mitem__pre ' + m.swatch + '"></div>' +
                  '<div class="mitem__b">' +
                    '<div><div class="mitem__t">' + esc(m.name) + '</div>' +
                    '<div class="mitem__a">' + esc(m.author) + '</div></div>' +
                    '<div class="mitem__p">$' + m.price + '</div>' +
                  '</div>' +
                  '</article>';
              }).join('') +
            '</div>' +
          '</section>' +

          '<div class="note">' +
            '<b>Los pagos no están conectados.</b> Los botones no cobran nada: no hay pasarela ' +
            'integrada ni cuenta de comercio. Para que esto cobre de verdad hace falta un backend ' +
            'con Wompi, Mercado Pago o Stripe, y ahí sí un servidor que valide la compra. ' +
            'Los precios en COP son una propuesta, no una decisión.' +
          '</div>' +
        '</div>';

      mount.querySelectorAll('[data-tier]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-tier');
          if (id === 'free') { location.hash = '#/dashboard'; return; }
          ID.app.toast('Sin pasarela de pago conectada todavía', true);
        });
      });
    }
  };
})();
