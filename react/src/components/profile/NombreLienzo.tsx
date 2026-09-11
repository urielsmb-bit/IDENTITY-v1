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

/**
 * TODO va en proporción a la letra, y esto es lo primero que hubo que
 * arreglar.
 *
 * La primera versión tenía las medidas en píxeles fijos, calibradas para un
 * nombre de unos cuarenta. En una tarjeta del selector, que va a veinte, el
 * resultado era un borrón blanco encima de las primeras letras, y por dos
 * motivos a la vez:
 *
 *   · la casilla del contorno medía dos píxeles y el trazo de la letra
 *     medía tres, así que TODA casilla pintada tenía una vecina vacía. El
 *     «contorno» era la letra entera y la chispa recorría el relleno;
 *   · el trazo ancho del resplandor medía siete sobre una letra de veinte.
 *     Un tercio de la altura del nombre, en aditivo: dos pasadas por el
 *     mismo sitio y aquello ya era blanco puro.
 *
 * Con todo referido al cuerpo de la letra, el mismo efecto vale para una
 * tarjeta de veinte y para un nombre de sesenta sin tocar un número.
 */
function medidas(f: number) {
  return {
    /* Casilla. Cuanto más fina, mejor sigue el contorno, y lo que cuesta es
       cuadrático: a la dieciochoava parte del cuerpo salen unas dos casillas
       por trazo de letra, que es el mínimo para que haya un DENTRO. */
    casilla: Math.max(1, Math.round(f / 18)),
    /* Lo que se sale la luz de la caja. */
    margen: Math.max(8, Math.round(f * 0.34)),
    /* Los tres trazos: el aire, el cuerpo y el filo. */
    ancho: [f * 0.15, f * 0.05, Math.max(0.8, f * 0.02)] as const,
    /* Lo que avanza por cuadro, en casillas. */
    paso: 2,
    /* Cuánto se borra cada cuadro, o sea lo que dura la estela.
       En letra PEQUEÑA se borra menos, y no es una manía: el contorno de un
       nombre de veinte se recorre entero en un suspiro, así que con el mismo
       borrado la estela cabría en dos letras y lo que se vería sería un
       punto de luz, no un recorrido. Durando más, el arco llega a leerse
       como movimiento incluso ahí. */
    desvanece: 0.07 + 0.1 * Math.min(1, f / 44),
  };
}

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
    let M = medidas(40);
    /* El color de la energía y el del texto NO son el mismo, y ahí estaba la
       otra mitad del borrón: la chispa salía del color del nombre —casi
       blanco— y encima de un nombre casi blanco no se lee como energía, se
       lee como una mancha. Con el acento del perfil, la luz tiene color
       propio y el filo blanco de encima se distingue de ella. */
    let tinte = color || '#8ad8ff';
    let nucleo = '#ffffff';

    /* ── el mapa ──────────────────────────────────────────────
       Se rehace sólo cuando cambia el nombre o su caja. Dentro de un
       cuadro no se toca nada de esto. */
    const mapear = () => {
      const caja = host.getBoundingClientRect();
      const cs = getComputedStyle(host);
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      /* Lo PRIMERO, el cuerpo de la letra: de él salen la casilla, el margen
         y los tres trazos. Antes esto venía de tres constantes y por eso el
         efecto sólo estaba bien a un tamaño. */
      const cuerpo = parseFloat(cs.fontSize) || 40;
      M = medidas(cuerpo);

      const w = Math.ceil(caja.width) + M.margen * 2;
      const h = Math.ceil(caja.height) + M.margen * 2;
      if (w < 4 || h < 4) return false;

      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      cv.style.left = `${-M.margen}px`;
      cv.style.top = `${-M.margen}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* El acento del perfil, no el color del texto. Una energía del mismo
         color que el nombre encima del nombre no se lee como energía: se lee
         como que el nombre está sucio. */
      tinte = color || cs.getPropertyValue('--p-primary').trim() || cs.color || '#8ad8ff';
      nucleo = cs.color || '#ffffff';

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
      const base = M.margen + (caja.height - (sube + baja)) / 2 + sube;

      ctx.clearRect(0, 0, w, h);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.fillText(texto, M.margen, base);

      const datos = ctx.getImageData(0, 0, cv.width, cv.height).data;
      anchoC = Math.floor(w / M.casilla);
      altoC = Math.floor(h / M.casilla);

      const lleno = new Uint8Array(anchoC * altoC);
      for (let cy = 0; cy < altoC; cy++) {
        for (let cx = 0; cx < anchoC; cx++) {
          /* El centro de la casilla, en píxeles del lienzo de verdad. */
          const px = Math.floor((cx * M.casilla + M.casilla / 2) * dpr);
          const py = Math.floor((cy * M.casilla + M.casilla / 2) * dpr);
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
        const nx = Math.round(c.x + Math.cos(ang) * M.paso);
        const ny = Math.round(c.y + Math.sin(ang) * M.paso);
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
      /* Se borra MÁS de lo que se borraba. En aditivo, si lo que se pinta
         cada cuadro no se apaga al menos igual de rápido, el mismo píxel
         acaba saturado: la estela deja de ser una estela y es una mancha
         blanca, que es exactamente lo que pasaba. */
      ctx.fillStyle = `rgba(0,0,0,${M.desvanece})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (let i = 0; i < chispas.length; i++) {
        const c = chispas[i]!;
        const x0 = c.x * M.casilla + M.casilla / 2;
        const y0 = c.y * M.casilla + M.casilla / 2;
        c.vida -= 1;
        if (c.vida <= 0 || !siguiente(c)) {
          chispas[i] = nacer();
          continue;
        }
        const x1 = c.x * M.casilla + M.casilla / 2;
        const y1 = c.y * M.casilla + M.casilla / 2;

        /* Tres trazos, del más ancho y tenue al más fino y claro, y los
           tres en proporción al cuerpo de la letra. Es lo que hace que la
           luz parezca tener temperatura: un solo trazo de color sale como
           una raya de rotulador.

           El ancho va en `M.ancho` y el alfa es bajo a propósito. Lo que
           pintó el borrón no fue el color, fue que un trazo grueso en
           aditivo se suma consigo mismo cada vez que la chispa vuelve a
           pasar por el mismo sitio, y por un contorno pequeño se vuelve a
           pasar enseguida. */
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);

        ctx.strokeStyle = tinte;
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = M.ancho[0];
        ctx.stroke();

        ctx.globalAlpha = 0.32;
        ctx.lineWidth = M.ancho[1];
        ctx.stroke();

        ctx.strokeStyle = nucleo;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = M.ancho[2];
        ctx.stroke();

        /* La cabeza. Un punto en la punta es lo que convierte una raya que
           se apaga en ALGO QUE VA: sin él la estela no tiene de dónde salir
           y se lee como un trazo pintado, no como un recorrido. */
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(x1, y1, M.ancho[1], 0, Math.PI * 2);
        ctx.fill();
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
        ctx.fillRect(x * M.casilla, y * M.casilla, M.casilla, M.casilla);
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
