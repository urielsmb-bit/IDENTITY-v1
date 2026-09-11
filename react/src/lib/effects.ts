const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let _cleanups: Array<() => void> = [];

export function register(fn: () => void) {
  if (fn) _cleanups.push(fn);
  return fn;
}

export function clear() {
  for (let i = 0; i < _cleanups.length; i++) {
    try { _cleanups[i]?.(); } catch { /* una limpieza rota no debe frenar las demás */ }
  }
  _cleanups = [];
}

export const equipo = (() => {
  const nav = typeof navigator !== 'undefined' ? navigator : {} as any;
  const nucleos = nav.hardwareConcurrency || 4;
  const memoria = nav.deviceMemory || 4;
  const lento = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(update: slow)').matches) ||
              nucleos <= 2 || memoria <= 2;
  return {
    nucleos, memoria,
    nivel: reduce ? 0 : (lento ? 1 : 2),
    medido: false,
    fps: 60
  };
})();

export function puede(coste: number = 1) {
  return equipo.nivel >= coste;
}

const oyentes: Array<(ahora: number) => void> = [];
let latido = 0;
let pendientes: Array<(time: number) => void> = [];
let oculto = typeof document !== 'undefined' && typeof document.hidden === 'boolean' ? document.hidden : false;
let t0 = 0, cuadros = 0;

function tic(ahora: number) {
  latido = 0;
  if (oculto) return;

  if (!equipo.medido) {
    if (!t0) t0 = ahora;
    cuadros++;
    if (ahora - t0 > 1000) {
      const fps = cuadros * 1000 / (ahora - t0);
      if (fps < 45 && equipo.nivel > 1) equipo.nivel = 1;
      if (fps < 25) equipo.nivel = 0;
      equipo.fps = Math.round(fps);
      equipo.medido = true;
    }
  }

  for (let i = oyentes.length - 1; i >= 0; i--) {
    try { oyentes[i]?.(ahora); } catch { oyentes.splice(i, 1); }
  }
  if (oyentes.length) latido = requestAnimationFrame(tic);
}

export function ticker(fn: (ahora: number) => void) {
  if (!fn) return () => {};
  oyentes.push(fn);
  if (!latido && !oculto) latido = requestAnimationFrame(tic);
  return () => {
    const i = oyentes.indexOf(fn);
    if (i > -1) oyentes.splice(i, 1);
    if (!oyentes.length && latido) { cancelAnimationFrame(latido); latido = 0; }
  };
}

export function raf(fn: (time: number) => void) {
  if (oculto) { pendientes.push(fn); return 0; }
  return requestAnimationFrame(fn);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    oculto = document.hidden;
    if (oculto) {
      if (latido) { cancelAnimationFrame(latido); latido = 0; }
    } else {
      const cola = pendientes; pendientes = [];
      cola.forEach((fn) => requestAnimationFrame(fn));
      if (oyentes.length && !latido) latido = requestAnimationFrame(tic);
    }
  });
}

export function particles(canvas: HTMLCanvasElement | null, type: string, color: string, opts: any = {}) {
  if (!canvas || !type || type === 'none') return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  let W = 0, H = 0, parts: any[] = [], rAF = 0, t = 0, alive = true;

  function resize() {
    const r = canvas!.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas!.width = Math.round(W * dpr);
    canvas!.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  /**
   * Cuantas partículas caben.
   *
   * El divisor estaba en 14000, que en una pantalla de 1356x625 daban
   * SESENTA puntos: uno cada 118 px. Medido sobre el lienzo, el efecto
   * ocupaba el 0,131 % de los píxeles con una opacidad media de 100 sobre
   * 255. O sea: estaba encendido, se movía, y no se veía.
   *
   * `matrix` se queda como estaba: son columnas de caracteres, no puntos, y
   * al doble de densidad se convierten en una pared verde.
   */
  function count() {
    const area = W * H;
    const denso = type === 'matrix' ? 14000 : 7000;
    const n = Math.round(area / (opts.light ? denso * 1.9 : denso));
    const cap = opts.light ? 60 : (type === 'matrix' ? 90 : 220);
    return Math.max(8, Math.min(cap, n));
  }

  function build() {
    parts = [];
    const n = count();
    for (let i = 0; i < n; i++) parts.push(spawn(true));
  }

  function spawn(anywhere: boolean) {
    const p: any = { x: Math.random() * W, y: anywhere ? Math.random() * H : -10 };
    switch (type) {
      case 'stars':
        /* Radio de 0,4 px: eso es medio píxel, y medio píxel a media
           opacidad no es una estrella, es ruido. Y el suelo de opacidad en
           0,15 dejaba la mitad del campo por debajo de lo que distingue un
           ojo sobre negro. */
        p.r = Math.random() * 1.8 + 0.7;
        p.a = Math.random() * 0.65 + 0.32;
        p.tw = Math.random() * 0.04 + 0.008;
        p.vx = (Math.random() - 0.5) * 0.08;
        p.vy = (Math.random() - 0.5) * 0.08;
        break;
      case 'snow':
        p.r = Math.random() * 2.4 + 0.8;
        p.vy = Math.random() * 0.5 + 0.22;
        p.vx = (Math.random() - 0.5) * 0.3;
        p.sw = Math.random() * 2 + 1;
        p.ph = Math.random() * 6.28;
        p.a = Math.random() * 0.5 + 0.3;
        break;
      case 'embers':
        p.x = Math.random() * W; p.y = anywhere ? Math.random() * H : H + 10;
        p.r = Math.random() * 1.8 + 0.6;
        p.vy = -(Math.random() * 0.55 + 0.22);
        p.vx = (Math.random() - 0.5) * 0.28;
        p.life = Math.random() * 0.6 + 0.4;
        p.a = p.life;
        break;
      case 'matrix':
        p.x = Math.floor(Math.random() * (W / 15)) * 15;
        p.y = anywhere ? Math.random() * H : -20;
        p.vy = Math.random() * 2.6 + 1.1;
        p.len = Math.floor(Math.random() * 12) + 5;
        p.ch = [];
        for (let j = 0; j < p.len; j++) p.ch.push(glyph());
        p.tick = 0;
        break;
      case 'bubbles':
        p.y = anywhere ? Math.random() * H : H + 20;
        p.r = Math.random() * 12 + 3;
        p.vy = -(Math.random() * 0.4 + 0.12);
        p.ph = Math.random() * 6.28;
        p.a = Math.random() * 0.22 + 0.05;
        break;
      case 'grid':
        p.r = Math.random() * 1.6 + 0.8;
        p.vx = (Math.random() - 0.5) * 0.22;
        p.vy = (Math.random() - 0.5) * 0.22;
        p.a = Math.random() * 0.5 + 0.2;
        break;
    }
    return p;
  }

  function glyph() {
    const set = 'アイウエオカキクケコサシスセソ0123456789ABCDEF';
    return set[Math.floor(Math.random() * set.length)];
  }

  function hex2rgb(h: string) {
    h = String(h || '#ffffff').replace('#', '');
    if (h.length === 3) h = (h[0] ?? '') + (h[0] ?? '') + (h[1] ?? '') + (h[1] ?? '') + (h[2] ?? '') + (h[2] ?? '');
    const n = parseInt(h, 16);
    if (isNaN(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = hex2rgb(color);
  const C = rgb[0] + ',' + rgb[1] + ',' + rgb[2];

  function draw() {
    if (!alive) return;
    t++;
    ctx!.clearRect(0, 0, W, H);
    let i, p;

    if (type === 'grid') {
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, 6.283);
        ctx!.fillStyle = 'rgba(' + C + ',' + p.a + ')';
        ctx!.fill();
      }
      for (i = 0; i < parts.length; i++) {
        for (let k = i + 1; k < parts.length; k++) {
          const dx = parts[i].x - parts[k].x, dy = parts[i].y - parts[k].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 13000) {
            ctx!.beginPath();
            ctx!.moveTo(parts[i].x, parts[i].y);
            ctx!.lineTo(parts[k].x, parts[k].y);
            ctx!.strokeStyle = 'rgba(' + C + ',' + (0.14 * (1 - d2 / 13000)) + ')';
            ctx!.lineWidth = 0.7;
            ctx!.stroke();
          }
        }
      }
      rAF = raf(draw);
      return;
    }

    if (type === 'matrix') {
      ctx!.font = '13px "JetBrains Mono", monospace';
      ctx!.textBaseline = 'top';
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        p.y += p.vy;
        p.tick++;
        if (p.tick % 7 === 0) p.ch[Math.floor(Math.random() * p.ch.length)] = glyph();
        for (let m = 0; m < p.len; m++) {
          const yy = p.y - m * 15;
          if (yy < -15 || yy > H) continue;
          const a = (1 - m / p.len) * 0.85;
          ctx!.fillStyle = m === 0 ? 'rgba(255,255,255,' + a + ')' : 'rgba(' + C + ',' + a + ')';
          ctx!.fillText(p.ch[m], p.x, yy);
        }
        if (p.y - p.len * 15 > H) parts[i] = spawn(false);
      }
      rAF = raf(draw);
      return;
    }

    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      switch (type) {
        case 'stars':
          p.x += p.vx; p.y += p.vy;
          p.a += p.tw;
          if (p.a > 0.95 || p.a < 0.22) p.tw *= -1;
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
          /* Halo en las grandes.
             Un disco plano se lee como una mota de polvo en la pantalla; lo
             que hace que algo parezca una ESTRELLA es el resplandor
             alrededor. Va como un segundo círculo muy transparente y no con
             `shadowBlur`, que en canvas cuesta un desenfoque de verdad por
             cada punto y por cada fotograma. Y sólo en las grandes: en las
             pequeñas no se distingue y sería trabajo tirado. */
          if (p.r > 1.7) {
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.r * 2.6, 0, 6.283);
            ctx!.fillStyle = 'rgba(' + C + ',' + (p.a * 0.16).toFixed(3) + ')';
            ctx!.fill();
          }
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r, 0, 6.283);
          ctx!.fillStyle = 'rgba(' + C + ',' + p.a + ')';
          ctx!.fill();
          break;

        case 'snow':
          p.ph += 0.012;
          p.y += p.vy;
          p.x += p.vx + Math.sin(p.ph) * 0.4;
          if (p.y > H + 6) { parts[i] = spawn(false); break; }
          if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r, 0, 6.283);
          ctx!.fillStyle = 'rgba(255,255,255,' + p.a + ')';
          ctx!.fill();
          break;

        case 'embers':
          p.y += p.vy;
          p.x += p.vx + Math.sin((t + i * 30) * 0.012) * 0.22;
          p.life -= 0.0035;
          if (p.life <= 0 || p.y < -12) { parts[i] = spawn(false); break; }
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r, 0, 6.283);
          ctx!.fillStyle = 'rgba(' + C + ',' + Math.max(0, p.life) + ')';
          ctx!.shadowBlur = 9;
          ctx!.shadowColor = 'rgba(' + C + ',.8)';
          ctx!.fill();
          ctx!.shadowBlur = 0;
          break;

        case 'bubbles':
          p.ph += 0.014;
          p.y += p.vy;
          p.x += Math.sin(p.ph) * 0.5;
          if (p.y < -p.r * 2) { parts[i] = spawn(false); break; }
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r, 0, 6.283);
          ctx!.strokeStyle = 'rgba(' + C + ',' + (p.a + 0.14) + ')';
          ctx!.lineWidth = 1;
          ctx!.stroke();
          ctx!.fillStyle = 'rgba(' + C + ',' + (p.a * 0.4) + ')';
          ctx!.fill();
          break;
      }
    }
    rAF = raf(draw);
  }

  resize();
  let ro: ResizeObserver | null = null;
  if (typeof window !== 'undefined' && (window as any).ResizeObserver) {
    ro = new (window as any).ResizeObserver(resize);
    ro?.observe(canvas);
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', resize);
  }

  if (reduce) {
    const once = draw;
    alive = true; once(); alive = false; cancelAnimationFrame(rAF);
  } else {
    draw();
  }

  return register(() => {
    alive = false;
    cancelAnimationFrame(rAF);
    if (ro) ro.disconnect();
    else if (typeof window !== 'undefined') window.removeEventListener('resize', resize);
  });
}

export function tilt(root: HTMLElement | null, card: HTMLElement | null, max: number = 9) {
  if (!root || !card || reduce) return null;
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) return null;

  /** La caja contra la que se mide el raton. No es un DOMRect porque se
   *  recorta a lo que se ve. */
  let rect: { left: number; top: number; width: number; height: number } | null = null;
  let rAF = 0, tx = 0, ty = 0, cx = 0, cy = 0, resting = true;

  /**
   * La referencia es lo que OCUPAN las cajas, no el contenedor.
   *
   * Un div puede tener varios cuadros dentro y ser mucho mas grande que
   * ellos —en el lienzo libre la pila mide todo el alto aunque las piezas
   * ocupen un trozo— asi que medir contra el contenedor ponia el punto
   * neutro donde no hay nada y desperdiciaba medio recorrido del raton en
   * espacio vacio. Se toma la union de las cajas de verdad.
   *
   * Se recorta contra la ventana porque el conjunto puede ser mas alto que
   * ella: la parte que no se ve no debe llevarse recorrido.
   */
  function measure() {
    const cuadros = card!.querySelectorAll<HTMLElement>('[data-bloque]');
    let l = Infinity, t = Infinity, r2 = -Infinity, b2 = -Infinity;

    for (const c of cuadros) {
      const q = c.getBoundingClientRect();
      // Una pieza oculta mide 0x0 y arrastraria la union a la esquina.
      if (q.width < 1 || q.height < 1) continue;
      l = Math.min(l, q.left); t = Math.min(t, q.top);
      r2 = Math.max(r2, q.right); b2 = Math.max(b2, q.bottom);
    }

    // Sin piezas marcadas (o todas ocultas) vale la propia tarjeta.
    if (!isFinite(l)) {
      const q = card!.getBoundingClientRect();
      l = q.left; t = q.top; r2 = q.right; b2 = q.bottom;
    }

    const alto = typeof window !== 'undefined' ? window.innerHeight : b2 - t;
    const top = Math.max(0, t);
    const bottom = Math.min(alto, b2);
    rect = {
      left: l,
      top,
      width: Math.max(1, r2 - l),
      height: Math.max(1, bottom - top),
    };
  }

  /** Un poco de aire alrededor de las cajas: el efecto no debe apagarse por
   *  rozar el borde con el raton. */
  const MARGEN = 28;

  function onMove(e: MouseEvent) {
    /* Se remide al ENTRAR, no solo la primera vez.
       Antes se medía una vez al montar y ya. Y al montar el diseño todavía
       no es el definitivo: la entrada está animándose —y un rect incluye la
       transformación, así que las piezas se miden desplazadas—, las fuentes
       y el fondo aún cargan. Con la medida mal, la zona viva caía donde no
       están las cajas y el efecto no arrancaba hasta que algo remedía:
       cambiar de pestaña y volver, por ejemplo.

       `mouseenter` tampoco basta: si el puntero YA estaba dentro del perfil
       —lo normal, se acaba de pulsar la puerta— ese evento no llega a
       dispararse nunca.

       Se remide solo cuando la tarjeta está en reposo. Estando inclinada, su
       rect ya lleva la rotación dentro y medir ahí se realimenta. */
    if (!rect || resting) measure();

    /* Fuera de las cajas, a plano.
       Antes se acotaba a 0..1 y la tarjeta se quedaba CLAVADA en su tope
       mientras el raton anduviera por cualquier otro sitio de la pantalla:
       parecia que el efecto seguia activo en toda la pagina. La zona viva es
       la que ocupan las cajas —con los huecos entre ellas dentro, que para
       eso es la union— y fuera se descansa. */
    if (
      e.clientX < rect!.left - MARGEN ||
      e.clientX > rect!.left + rect!.width + MARGEN ||
      e.clientY < rect!.top - MARGEN ||
      e.clientY > rect!.top + rect!.height + MARGEN
    ) {
      if (!resting) onLeave();
      return;
    }

    const px = (e.clientX - rect!.left) / rect!.width;
    const py = (e.clientY - rect!.top) / rect!.height;
    cx = Math.max(0, Math.min(1, px));
    cy = Math.max(0, Math.min(1, py));
    // El punto donde esta el raton se acerca al que mira, y el opuesto se
    // hunde. Estaba al reves: en CSS un rotateX positivo echa ARRIBA hacia
    // atras, asi que con el raton en la parte de arriba la tarjeta se
    // hundia justo por donde la estabas tocando. Lo mismo en el otro eje
    // con rotateY. Se invierten los dos signos.
    tx = (cy - 0.5) * 2 * max;
    ty = (0.5 - cx) * 2 * max;
    if (resting) { resting = false; card!.classList.remove('is-resting'); }
    if (!rAF) rAF = raf(apply);
  }

  function apply() {
    rAF = 0;
    root!.style.setProperty('--rx', tx.toFixed(2) + 'deg');
    root!.style.setProperty('--ry', ty.toFixed(2) + 'deg');
    card!.style.setProperty('--mx', (cx * 100).toFixed(1) + '%');
    card!.style.setProperty('--my', (cy * 100).toFixed(1) + '%');
  }

  function onLeave() {
    tx = ty = 0; resting = true;
    card!.classList.add('is-resting');
    root!.style.setProperty('--rx', '0deg');
    root!.style.setProperty('--ry', '0deg');
  }

  /* Se escucha en la RAIZ del perfil, no en la tarjeta.
     Escuchando en la tarjeta, cualquier hueco entre bloques —y en el lienzo
     libre hay huecos a proposito— contaba como salir: se disparaba
     `mouseleave`, la inclinacion volvia a cero y el efecto se cortaba al
     pasar por medio. Los angulos se siguen midiendo contra la tarjeta, asi
     que el resultado es el mismo; lo que cambia es donde se deja de
     escuchar, que ahora es al salir del perfil entero. */
  /* `passive`: este manejador solo mide y escribe dos variables CSS, nunca
     llama a `preventDefault`. Los otros cinco `mousemove` de este fichero
     ya lo llevaban; este se quedo sin el. */
  root.addEventListener('mousemove', onMove, { passive: true });
  root.addEventListener('mouseenter', measure);
  root.addEventListener('mouseleave', onLeave);
  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure);

  /* Y al terminar cada animacion de entrada: hasta ese momento las piezas
     estan desplazadas y la union sale donde no van a quedarse. */
  const alTerminarEntrada = () => { if (resting) measure(); };
  card.addEventListener('animationend', alTerminarEntrada);

  /* Cualquier cambio de tamano del contenido —una fuente que acaba de
     cargar, una imagen, el fondo de video— mueve las cajas. */
  let roTilt: ResizeObserver | null = null;
  if (typeof window !== 'undefined' && window.ResizeObserver) {
    roTilt = new ResizeObserver(() => { if (resting) measure(); });
    roTilt.observe(card);
  }

  return register(() => {
    cancelAnimationFrame(rAF);
    root.removeEventListener('mousemove', onMove);
    root.removeEventListener('mouseenter', measure);
    root.removeEventListener('mouseleave', onLeave);
    card.removeEventListener('animationend', alTerminarEntrada);
    roTilt?.disconnect();
    window.removeEventListener('scroll', measure);
    window.removeEventListener('resize', measure);
  });
}

/* La fisica de las estelas vivia aqui, en seis filas. Ahora son quince y
   viven en `data/estelas.ts`, con el motor en `lib/estela.ts`: un lienzo
   en vez de un nodo por mota. */


/**
 * El cursor de respaldo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LO QUE YA NO HACE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Esto era el cursor de sharee y llevaba tres trabajos encima: dibujar la
 * forma, seguir al ratón y arrastrar una piscina de hasta ciento sesenta y
 * ocho nodos de chispa a los que escribía `transform` y `opacity` en cada
 * fotograma. Ya no hace ninguno de los dos últimos:
 *
 *   · la FORMA la pinta ahora el sistema operativo con `cursor: url(...)`
 *     —ver `lib/cursorNativo.ts`—, que es la única manera de que no haya
 *     retraso: un `<div>` va siempre un fotograma por detrás de tu mano;
 *   · la ESTELA vive en un lienzo aparte —ver `lib/estela.ts`—, un solo
 *     elemento en vez de ciento sesenta y ocho.
 *
 * Queda como RESPALDO, y hace falta: si la imagen que has subido viene de
 * otro dominio sin permiso para leerla, el lienzo se contamina y no se puede
 * sacar el `data:` que necesita el cursor del sistema. En ese caso vuelve
 * esto, que funciona siempre. No es lo mismo fallar que quedarse sin cursor.
 *
 * Sin fotograma: se pinta cuando el ratón se mueve y nada más.
 */
export function cursor(
  type: string,
  opciones: {
    img?: string; size?: number | null;
    /** Si se pasa, solo se deja ver encima de ese elemento. */
    ambito?: HTMLElement | null;
  } = {},
) {
  // Con imagen propia se dibuja aunque el tipo sea "default": la imagen ES
  // la eleccion. Sin imagen y sin tipo, no hay nada que dibujar.
  const vacio = !type || type === 'default' || type === 'none';
  if (vacio && !opciones.img) return null;
  if (reduce) return null;
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) return null;

  const el = document.createElement('div');
  let foto: HTMLImageElement | null = null;
  document.body.appendChild(el);

  let mx = -100, my = -100;

  /**
   * El AMBITO: donde se deja ver.
   *
   * En el editor el cursor tiene que verse —es lo que estas eligiendo— pero
   * solo encima de la vista previa. Si se dejara suelto por toda la pagina,
   * los mandos y los paneles se quedarian sin puntero de sistema util y con
   * una marca de perfil encima, que no es de ellos.
   */
  const ambito = opciones.ambito || null;
  let dentro = !ambito;

  function pintar() {
    el.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
  }

  /** Posicion, y nada mas: es lo que corre a 1000 Hz. */
  function onPos(e: MouseEvent) {
    mx = e.clientX; my = e.clientY;
    pintar();
  }

  /* Lo que cuesta —mirar debajo de que se esta— se queda en `pointermove`,
     que va a ritmo de pantalla. Preguntarle `closest()` al DOM mil veces
     por segundo es trabajo tirado: el estado de «encima de un enlace» no
     cambia mas deprisa que un fotograma. */
  function onEncima(e: MouseEvent) {
    /* `instanceof Element` y no un molde: el objetivo de un `pointermove`
       escuchado en `window` no siempre es un elemento —si el puntero no está
       sobre nada del documento llega `window`—, y entonces `contains()` no
       devuelve `false`, LANZA. En cada movimiento del ratón. */
    const t = e.target instanceof Element ? e.target : null;
    if (ambito && t) {
      const d = ambito.contains(t);
      if (d !== dentro) {
        dentro = d;
        el.classList.toggle('cur--fuera', !d);
      }
    }
    const over = t && t.closest('a,button,.pf-link,.pf-social,.pf-badge');
    el.classList.toggle('is-hot', !!over);
  }

  /**
   * Cambia la forma y el tamaño SIN tocar el nodo que ya esta puesto.
   *
   * Es lo que separa arrastrar un deslizador de dar un tiron: antes cada
   * paso reconstruia el cursor entero.
   */
  function actualizar(o: typeof opciones) {
    const img = o.img || '';
    const clase = 'cur' + (img ? ' cur--img' : ' cur--' + type);
    if (el.className !== clase) {
      /* Se conservan las marcas de estado: recalcular la clase no puede
         perder «estoy fuera del ambito» ni «estoy encima de un enlace», que
         los pone otra parte y no volverian hasta el proximo movimiento. */
      const fuera = el.classList.contains('cur--fuera');
      const caliente = el.classList.contains('is-hot');
      el.className = clase + (fuera ? ' cur--fuera' : '') + (caliente ? ' is-hot' : '');
    }

    const lado = Math.max(12, Math.min(96, o.size || 32));
    if (img) {
      if (!foto) {
        foto = document.createElement('img');
        foto.alt = '';
        el.appendChild(foto);
      }
      if (foto.getAttribute('src') !== img) foto.src = img;
      foto.width = lado;
      foto.height = lado;
      /* El tamaño va tambien en la CAJA, no solo en la imagen. El margen
         negativo desplaza al contenedor media medida, asi que solo centra si
         el contenedor mide de verdad `lado`; y `.cur` es fijo y sin ancho,
         o sea que se encogia a su contenido, y su contenido es una imagen
         con `width:100%` — que se resuelve contra el padre que aun no tiene
         ancho—. Salia descentrada y siempre para el mismo lado. */
      el.style.width = `${lado}px`;
      el.style.height = `${lado}px`;
      el.style.margin = `${-lado / 2}px 0 0 ${-lado / 2}px`;
    } else if (foto) {
      foto.remove();
      foto = null;
      el.style.width = el.style.height = el.style.margin = '';
    }
  }

  if (ambito) el.classList.add('cur--fuera');
  actualizar(opciones);

  /* `pointerrawupdate` entrega TODOS los movimientos del raton, sin
     agruparlos por fotograma, que es lo unico que permite aprovechar un
     monitor rapido. Donde no exista, `pointermove` hace de las dos cosas y
     el resultado es el de siempre, no peor. */
  const CRUDO = 'onpointerrawupdate' in window;
  const EVENTO_POS = CRUDO ? 'pointerrawupdate' : 'pointermove';
  window.addEventListener(EVENTO_POS, onPos as EventListener, { passive: true });
  window.addEventListener('pointermove', onEncima as EventListener, { passive: true });

  const destruir = register(() => {
    window.removeEventListener(EVENTO_POS, onPos as EventListener);
    window.removeEventListener('pointermove', onEncima as EventListener);
    el.remove();
  });

  return { destruir, actualizar };
}

function soloPuntero() {
  if (reduce || !puede(1)) return false;
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) return false;
  return true;
}

export function magnetismo(root: HTMLElement | null, opciones: any = {}) {
  if (!root || !soloPuntero()) return null;
  const RADIO = opciones.radio || 90;
  const FUERZA = opciones.fuerza || 0.34;
  const SEL = opciones.sel || '.pf-social, .pf-badge, .pf-link__ico, .pf-music__btn';

  let piezas: any[] = [], mx = -9999, my = -9999, medido = 0;

  function medir() {
    piezas = Array.prototype.map.call(root!.querySelectorAll(SEL), (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { el: el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: 0, y: 0 };
    });
    medido = performance.now();
  }
  medir();

  function onMove(e: MouseEvent) { mx = e.clientX; my = e.clientY; }
  function onSalir() { mx = -9999; my = -9999; }

  const soltar = ticker((ahora) => {
    if (ahora - medido > 500) medir();
    for (let i = 0; i < piezas.length; i++) {
      const p = piezas[i];
      const dx = mx - p.cx, dy = my - p.cy;
      const d = Math.hypot(dx, dy);
      let k = d < RADIO ? (1 - d / RADIO) : 0;
      k = k * k;
      const ox = dx * k * FUERZA, oy = dy * k * FUERZA;
      p.x += (ox - p.x) * 0.18;
      p.y += (oy - p.y) * 0.18;
      if (Math.abs(p.x) < 0.05 && Math.abs(p.y) < 0.05) {
        if (p.el.style.getPropertyValue('--mgx')) {
          p.el.style.removeProperty('--mgx'); p.el.style.removeProperty('--mgy');
        }
        continue;
      }
      p.el.style.setProperty('--mgx', p.x.toFixed(2) + 'px');
      p.el.style.setProperty('--mgy', p.y.toFixed(2) + 'px');
    }
  });

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('scroll', medir, { passive: true });
  document.addEventListener('mouseleave', onSalir);

  return register(() => {
    soltar();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('scroll', medir);
    document.removeEventListener('mouseleave', onSalir);
    piezas.forEach((p) => {
      p.el.style.removeProperty('--mgx'); p.el.style.removeProperty('--mgy');
    });
  });
}

export function brillo(root: HTMLElement | null, capa: HTMLElement | null) {
  if (!root || !capa || !soloPuntero()) return null;
  let mx = 50, my = 50, ax = 50, ay = 50, activo = false;

  function onMove(e: MouseEvent) {
    const r = root!.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width) * 100;
    my = ((e.clientY - r.top) / r.height) * 100;
    if (!activo) { activo = true; capa!.style.opacity = '1'; }
  }
  function onSalir() { activo = false; capa!.style.opacity = '0'; }

  const soltar = ticker(() => {
    ax += (mx - ax) * 0.12;
    ay += (my - ay) * 0.12;
    capa!.style.setProperty('--gx', ax.toFixed(2) + '%');
    capa!.style.setProperty('--gy', ay.toFixed(2) + '%');
  });

  window.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseleave', onSalir);

  return register(() => {
    soltar();
    window.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseleave', onSalir);
  });
}

export function parallax(root: HTMLElement | null, capas: any[]) {
  if (!root || !capas || !capas.length || !soloPuntero() || !puede(2)) return null;
  let mx = 0, my = 0, ax = 0, ay = 0;

  function onMove(e: MouseEvent) {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  const soltar = ticker(() => {
    ax += (mx - ax) * 0.06;
    ay += (my - ay) * 0.06;
    for (let i = 0; i < capas.length; i++) {
      const c = capas[i];
      if (!c.el) continue;
      c.el.style.setProperty('--pxx', (ax * c.k).toFixed(2) + 'px');
      c.el.style.setProperty('--pxy', (ay * c.k).toFixed(2) + 'px');
    }
  });

  window.addEventListener('mousemove', onMove, { passive: true });

  return register(() => {
    soltar();
    window.removeEventListener('mousemove', onMove);
    capas.forEach((c) => {
      if (c.el) { c.el.style.removeProperty('--pxx'); c.el.style.removeProperty('--pxy'); }
    });
  });
}

export function countUp(el: HTMLElement | null, to: number, dur: number = 1100) {
  if (!el) return;
  to = Number(to) || 0;
  if (reduce) { el.textContent = String(to); return; }
  const t0 = performance.now();
  function step(now: number) {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el!.textContent = String(Math.round(to * e));
    if (k < 1) raf(step);
  }
  raf(step);
}

export function reveal(root: HTMLElement | Document | null = document) {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  const els = (root || document).querySelectorAll('[data-reveal]');
  if (!els.length) return null;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('rise');
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
  return register(() => { io.disconnect(); });
}
