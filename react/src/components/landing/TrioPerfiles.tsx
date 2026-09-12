import { useEffect, useRef } from 'react';
import cenA1 from '@/assets/portada/centro-340.avif';
import cenA2 from '@/assets/portada/centro-680.avif';
import cenW1 from '@/assets/portada/centro-340.webp';
import cenW2 from '@/assets/portada/centro-680.webp';
import '@/styles/trio.css';

/**
 * Lo que ocupa en pantalla el del centro, para que el navegador elija bien
 * cual de los dos ficheros bajarse.
 *
 * El hueco de la portada llega a 600 px y el telefono se lleva el 38%, o
 * sea 228. Este numero hay que MOVERLO si cambia cualquiera de los dos:
 * si se queda corto, el navegador se baja una imagen pequena y la estira.
 */
const MEDIDAS = '(min-width: 960px) 228px, (min-width: 560px) 38vw, 76vw';

/**
 * Tres perfiles de verdad, en la mano, quietos.
 *
 * ────────────────────────────────────────────────────────────────────────
 * QUE SUSTITUYE Y POR QUE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Aqui habia un carrusel que montaba perfiles DE VERDAD: cuatro
 * `ProfileView` enteros —el componente mas caro de la aplicacion— con sus
 * lienzos, su musica, sus efectos y su fondo de video, girando cada 5,2 s
 * en la primera pantalla que ve alguien que todavia no sabe que es sharee.
 *
 * Se pago por partida triple, y las tres medidas:
 *
 *   · ARRANQUE. En un movil de gama media con la CPU frenada: 3,1 s de hilo
 *     principal ocupado y nada pintado hasta los 11,5 s.
 *   · LA MEDIDA NUNCA CERRABA. El navegador marca como «elemento principal»
 *     el ultimo repintado grande que ve, y cada giro pintaba una tarjeta
 *     nueva. Salia a los 22 s en una pagina lista mucho antes.
 *   · VIMEO CORTABA. Cada giro montaba iframes nuevos del reproductor. Con
 *     el reflejo duplicando los del centro salian ~26 peticiones por
 *     minuto de los mismos tres videos; Vimeo lo lee como abuso y empieza a
 *     responder 503. Se vio en la consola, con decenas de fallos seguidos.
 *
 * Se miro que hacen los demas. guns.lol se baja 2,2 MB de JavaScript —tres
 * veces mas que nosotros— y pinta en 1,29 s; bandi.lol el doble, y pinta en
 * 1,00 s. Los dos tienen CERO lienzos, CERO iframes y CERO animaciones en
 * la portada: lo que ensenan son imagenes.
 *
 * El problema nunca fue el peso. Fue cuanto se EJECUTA antes de pintar.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE TRES FICHEROS Y NO UN MONTAJE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Habia un montaje ya hecho de los tres telefonos en una sola imagen. No se
 * uso: lo genero un modelo a partir de las capturas, y al redibujarlas se
 * invento el texto. Donde el perfil dice «usandote de asiento», el montaje
 * decia «usuariod de esiento». Una portada es la promesa de lo que hay
 * dentro; ensenar una interfaz con las letras inventadas la rompe.
 *
 * Asi que son las capturas tal cual, colocadas con CSS. Sale ademas mejor
 * de lo que salia:
 *
 *   · nitidas a cualquier tamano, porque el giro y la escala los hace el
 *     navegador sobre el pixel original, no sobre un montaje ya aplanado;
 *   · en un movil se sirve SOLO el del centro. Tres telefonos en 340 px de
 *     ancho no se ven: se adivinan. Y son 49 KB en vez de 84.
 *
 * ────────────────────────────────────────────────────────────────────────
 * OJO CON UNA COSA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Esto es una FOTO de tres perfiles de personas reales, tomada un dia. Si
 * manana cambian su perfil —o lo borran— la portada seguira ensenando como
 * era. No se actualiza solo, y ese es el precio de que no cueste nada.
 */

/** Cuanto se inclina la escena, como mucho, en grados. */
const TOPE = 7;

/**
 * La escena sigue al puntero.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE ESTO NO VUELVE A TRAER EL PROBLEMA DE ANTES
 * ────────────────────────────────────────────────────────────────────────
 *
 * Toda esta pantalla se rehizo para quitarle movimiento: el carrusel giraba
 * solo, y como el navegador marca como «elemento principal» el ULTIMO
 * repintado grande que ve, la medida no cerraba nunca. Volver a meter
 * movimiento aqui seria deshacerlo.
 *
 * No lo deshace, por tres motivos:
 *
 *   · no se mueve NADA hasta que alguien mueve el raton, y la medida del
 *     elemento principal se cierra en cuanto hay una interaccion. Cuando
 *     esto empieza, ya no hay medida que correr;
 *   · lo unico que cambia son dos numeros en una variable de CSS, y lo que
 *     leen es una `transform`. Eso lo resuelve el compositor: ni se
 *     recalcula la pagina ni se vuelve a pintar nada;
 *   · con el raton quieto no corre ni un fotograma. No hay bucle.
 *
 * Y no se engancha donde no toca: en un movil no hay puntero que seguir
 * —los de los lados ni existen— y quien pide menos movimiento se queda con
 * la profundidad, que es forma, pero sin el seguimiento.
 */
function useSigueAlPuntero(caja: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const finos = window.matchMedia('(hover: hover) and (pointer: fine)');
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finos.matches || quieto.matches) return;

    let pedido = 0;
    let x = 0, y = 0;

    const pintar = () => {
      pedido = 0;
      el.style.setProperty('--trio-y', `${x.toFixed(2)}deg`);
      el.style.setProperty('--trio-x', `${y.toFixed(2)}deg`);
    };
    /* Se apunta la posicion y se pinta UNA vez por fotograma. Sin esto, un
       raton de 1000 Hz pide mil escrituras por segundo para sesenta
       fotogramas: novecientas cuarenta tiradas. */
    const pedir = () => { if (!pedido) pedido = requestAnimationFrame(pintar); };

    const alMover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      /* De -1 a 1 desde el centro de la caja. */
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      x = Math.max(-1, Math.min(1, dx)) * TOPE;
      /* Al reves: llevar el raton ARRIBA tiene que levantar el borde de
         arriba hacia ti, y eso es un `rotateX` positivo. */
      y = -Math.max(-1, Math.min(1, dy)) * TOPE;
      pedir();
    };
    const alSalir = () => { x = 0; y = 0; pedir(); };

    /* En la seccion entera, no solo encima de los telefonos: la escena
       responde segun te acercas, que es la mitad de la gracia. */
    const zona = el.closest('.hero') ?? el;
    zona.addEventListener('pointermove', alMover as EventListener, { passive: true });
    zona.addEventListener('pointerleave', alSalir);
    return () => {
      zona.removeEventListener('pointermove', alMover as EventListener);
      zona.removeEventListener('pointerleave', alSalir);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, [caja]);
}

export function TrioPerfiles() {
  const escena = useRef<HTMLDivElement>(null);
  useSigueAlPuntero(escena);

  return (
    <div className="trio">
      <div className="trio__escena" ref={escena}>
        <div className="trio__suelo" aria-hidden="true" />

        {/* LOS DE LOS LADOS VAN COMO FONDO DE CSS, Y NO ES UN CAPRICHO.
            Son decorado —cuentan que hay variedad, no se leen— y en un
            movil el CSS los esconde. La idea primera fue dejarlos como
            <img> con `loading="lazy"`, contando con que una imagen
            escondida no llega a pedirse. Se midio: con la cache vacia se la
            salta, pero con los ficheros ya en cache los cargaba igual. O
            sea que dependia del navegador y del momento.
            Un fondo declarado dentro de un `@media` que no encaja NO se
            pide nunca. Eso si esta garantizado, y son 35 KB que en un
            telefono no se bajan jamas. */}
        <div className="trio__tel trio__izq" aria-hidden="true" />
        <div className="trio__tel trio__der" aria-hidden="true" />

        {/* El del centro si es contenido: es la foto del producto. Va con
            sus tamanos, su texto alternativo y pedido el primero. */}
        <picture className="trio__tel trio__centro">
          <source type="image/avif" srcSet={`${cenA1} 340w, ${cenA2} 680w`} sizes={MEDIDAS} />
          <source type="image/webp" srcSet={`${cenW1} 340w, ${cenW2} 680w`} sizes={MEDIDAS} />
          <img
            src={cenW2}
            alt="Un perfil de sharee en el móvil: nombre, avatar, enlaces y el reproductor de música."
            /* Las medidas de verdad del recorte. Van puestas para que el
               hueco este reservado antes de que llegue la imagen: sin esto,
               el telefono aparece de golpe y empuja lo que tiene debajo. */
            width={816}
            height={1662}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>
    </div>
  );
}
