import { useEffect, useRef } from 'react';

/**
 * Corriente: energía recorriendo el CONTORNO de tus letras.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE NO PUEDE SER CSS
 * ────────────────────────────────────────────────────────────────────────
 *
 * Todos los demás efectos trabajan sobre la caja del texto: la tiñen, la
 * desplazan, la iluminan. Ninguno sabe QUÉ FORMA tiene el nombre. Y para
 * que una chispa recorra el borde de una «S» hay que saber por dónde va el
 * borde de esa «S», con esa letra, a ese tamaño y con ese espaciado.
 *
 * Eso no se puede preguntar en CSS. Aquí el nombre se dibuja una vez en un
 * lienzo escondido, se leen sus píxeles, y con eso se saca el contorno:
 * toda casilla pintada que tenga al lado una vacía. Después las chispas
 * caminan por ese contorno, eligiendo en cada paso la casilla de borde que
 * menos las desvíe de donde iban. No siguen un camino guardado: lo van
 * encontrando, y por eso dos vueltas nunca son iguales.
 *
 * El texto de verdad sigue estando en el DOM debajo: esto es sólo la luz.
 * Se puede seleccionar, se lee bien y un lector de pantalla no se entera de
 * que hay un lienzo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LO QUE CUESTA, Y LO QUE NO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un lienzo del tamaño de un nombre —unos 300 × 90— y un bucle. A cambio:
 *
 *   · el mapa del contorno se calcula UNA vez por nombre, no por cuadro;
 *   · el bucle para con la pestaña de fondo y cuando el nombre sale de la
 *     pantalla, que es lo normal en cuanto alguien baja un poco;
 *   · con «menos movimiento» no arranca: se dibuja el contorno una vez,
 *     quieto y tenue, y se acabó. Sigue siendo un nombre con filo de luz.
 */

/** Lado de la casilla, en píxeles de dibujo. Más fino no se nota y cuesta. */
const CASILLA = 2;
/** Cuánto se sale la luz de la caja del texto. */
const MARGEN = 14;
/** Chispas a la vez. Tres llenan un nombre corriente sin emborronarlo. */
const CHISPAS = 3;

interface Chispa {
  x: number;
  y: number;
  /** Hacia dónde iba, en radianes. */
  a: number;
  /** Lo que le queda de vida, en cuadros. */
  vida: number;
}

const QUIETO =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function NombreLienzo({ texto, color }: { texto: string; color?: string }) {
  const lienzo = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = lienzo.current;
    const host = cv?.parentElement;
    if (!cv || !host) return;

    const ctx = cv.getContext('2d', { alpha: true });
    if (!ctx) return;

    let bordes: Array<[number, number]> = [];
    let enBorde = new Set<number>();
    let anchoC = 0;
    let altoC = 0;
    let chispas: Chispa[] = [];
    let latido = 0;
    let visible = true;
    let tinte = color || '#8ad8ff';

    /* ── el mapa ──────────────────────────────────────────────
       Se rehace sólo cuando cambia el nombre o su caja. Dentro de un
       cuadro no se toca nada de esto. */
    const mapear = () => {
      const caja = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.ceil(caja.width) + MARGEN * 2;
      const h = Math.ceil(caja.height) + MARGEN * 2;
      if (w < 4 || h < 4) return false;

      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      cv.style.left = `${-MARGEN}px`;
      cv.style.top = `${-MARGEN}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cs = getComputedStyle(host);
      tinte = color || cs.color || '#8ad8ff';

      /* La misma letra que el DOM, o las chispas irían por el contorno de
         otro nombre. El espaciado sólo lo saben poner algunos navegadores;
         donde no, se pierde un pelo de precisión y no se nota. */
      const fuente = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.fontSize} ${cs.fontFamily}`;
      ctx.font = fuente;
      const conEspaciado = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
      if ('letterSpacing' in conEspaciado) conEspaciado.letterSpacing = cs.letterSpacing;

      const m = ctx.measureText(texto);
      /* La línea base. Una caja de línea es más alta que las letras, y el
         sobrante se reparte arriba y abajo: esa mitad es el «medio
         interlineado», y sin sumarla el contorno sale desplazado. */
      const sube = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
      const baja = m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
      const base = MARGEN + (caja.height - (sube + baja)) / 2 + sube;

      ctx.clearRect(0, 0, w, h);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.fillText(texto, MARGEN, base);

      const datos = ctx.getImageData(0, 0, cv.width, cv.height).data;
      anchoC = Math.floor(w / CASILLA);
      altoC = Math.floor(h / CASILLA);

      const lleno = new Uint8Array(anchoC * altoC);
      for (let cy = 0; cy < altoC; cy++) {
        for (let cx = 0; cx < anchoC; cx++) {
          /* El centro de la casilla, en píxeles del lienzo de verdad. */
          const px = Math.floor((cx * CASILLA + CASILLA / 2) * dpr);
          const py = Math.floor((cy * CASILLA + CASILLA / 2) * dpr);
          const a = datos[(py * cv.width + px) * 4 + 3] ?? 0;
          if (a > 120) lleno[cy * anchoC + cx] = 1;
        }
      }

      /* El contorno: pintada con al menos una vecina vacía. Recorrer el
         borde y no el relleno no es un ahorro, es la decisión visual: por
         dentro la luz sería una mancha; por el borde DIBUJA la letra. */
      bordes = [];
      enBorde = new Set();
      for (let cy = 0; cy < altoC; cy++) {
        for (let cx = 0; cx < anchoC; cx++) {
          if (!lleno[cy * anchoC + cx]) continue;
          const hueco =
            !lleno[cy * anchoC + cx - 1] ||
            !lleno[cy * anchoC + cx + 1] ||
            !lleno[(cy - 1) * anchoC + cx] ||
            !lleno[(cy + 1) * anchoC + cx];
          if (hueco) {
            bordes.push([cx, cy]);
            enBorde.add(cy * anchoC + cx);
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      return bordes.length > 8;
    };

    const nacer = (): Chispa => {
      const [x, y] = bordes[Math.floor(Math.random() * bordes.length)] ?? [0, 0];
      return { x, y, a: Math.random() * Math.PI * 2, vida: 90 + Math.random() * 150 };
    };

    /* Adónde va desde aquí: entre las casillas de borde que tiene cerca, la
       que menos la desvíe. Con un pelo de azar en el desempate, que es lo
       que hace que la misma letra no se recorra dos veces igual. */
    const siguiente = (c: Chispa): boolean => {
      let mejor = -1;
      let mejorCoste = Infinity;
      let mejorA = c.a;
      for (let i = 0; i < 12; i++) {
        const ang = c.a + (i - 6) * 0.42 + (Math.random() - 0.5) * 0.25;
        const nx = Math.round(c.x + Math.cos(ang) * 2);
        const ny = Math.round(c.y + Math.sin(ang) * 2);
        if (nx < 0 || ny < 0 || nx >= anchoC || ny >= altoC) continue;
        if (!enBorde.has(ny * anchoC + nx)) continue;
        const coste = Math.abs(i - 6);
        if (coste < mejorCoste) {
          mejorCoste = coste;
          mejor = ny * anchoC + nx;
          mejorA = ang;
        }
      }
      if (mejor < 0) return false;
      c.x = mejor % anchoC;
      c.y = Math.floor(mejor / anchoC);
      c.a = mejorA;
      return true;
    };

    const cuadro = () => {
      latido = requestAnimationFrame(cuadro);
      const w = cv.width;
      const h = cv.height;

      /* La estela. En vez de guardar los puntos de cada chispa, se borra un
         poco de TODO cada cuadro: lo viejo se apaga solo y la memoria no
         crece. Y al borrar por alfa, la estela se apaga en degradado. */
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (let i = 0; i < chispas.length; i++) {
        const c = chispas[i]!;
        const x0 = c.x * CASILLA + CASILLA / 2;
        const y0 = c.y * CASILLA + CASILLA / 2;
        c.vida -= 1;
        if (c.vida <= 0 || !siguiente(c)) {
          chispas[i] = nacer();
          continue;
        }
        const x1 = c.x * CASILLA + CASILLA / 2;
        const y1 = c.y * CASILLA + CASILLA / 2;

        /* Tres trazos, del más ancho y tenue al más fino y blanco. Es lo
           que hace que parezca que la luz TIENE una temperatura: un solo
           trazo de color sale como una raya de rotulador. */
        ctx.strokeStyle = tinte;
        ctx.globalAlpha = 0.16;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const quieto = () => {
      /* Sin movimiento: el contorno una vez, tenue. Sigue siendo un nombre
         con filo de luz, que era la idea; lo que se va es el recorrido. */
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = tinte;
      ctx.globalAlpha = 0.5;
      for (const [x, y] of bordes) {
        ctx.fillRect(x * CASILLA, y * CASILLA, CASILLA, CASILLA);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const arrancar = () => {
      if (latido || !visible || document.hidden) return;
      latido = requestAnimationFrame(cuadro);
    };
    const parar = () => {
      if (!latido) return;
      cancelAnimationFrame(latido);
      latido = 0;
    };

    const rehacer = () => {
      parar();
      if (!mapear()) return;
      chispas = Array.from({ length: CHISPAS }, nacer);
      if (QUIETO) quieto();
      else arrancar();
    };

    rehacer();

    /* Fuera de la pantalla no se dibuja. En un perfil largo el nombre se va
       arriba en cuanto alguien baja un dedo, y seguir gastando cuadros en
       algo que nadie mira es lo que convierte un efecto bonito en un
       ventilador encendido. */
    const mirilla = new IntersectionObserver(
      ([e]) => {
        visible = !!e?.isIntersecting;
        if (visible && !QUIETO) arrancar();
        else parar();
      },
      { rootMargin: '60px' },
    );
    mirilla.observe(host);

    const alVisibilidad = () => (document.hidden || !visible ? parar() : !QUIETO && arrancar());
    document.addEventListener('visibilitychange', alVisibilidad);

    const ro = new ResizeObserver(rehacer);
    ro.observe(host);

    return () => {
      parar();
      mirilla.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', alVisibilidad);
    };
  }, [texto, color]);

  return <canvas ref={lienzo} className="fxn__lienzo" aria-hidden="true" />;
}
