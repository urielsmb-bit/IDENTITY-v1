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

  function count() {
    const area = W * H;
    const n = Math.round(area / (opts.light ? 26000 : 14000));
    const cap = opts.light ? 44 : (type === 'matrix' ? 90 : 130);
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
        p.r = Math.random() * 1.5 + 0.4;
        p.a = Math.random() * 0.7 + 0.15;
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
          if (p.a > 0.9 || p.a < 0.12) p.tw *= -1;
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
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
  root.addEventListener('mousemove', onMove);
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

/**
 * Como se comporta cada clase de estela.
 *
 *   deriva  : hacia donde tira (px por fotograma). Negativo en Y = sube.
 *   dispersa: cuanto se separan del trazo al nacer.
 *   vida    : cuanto duran, en ms.
 *   tam     : escala minima y maxima de cada mota.
 *   paso    : multiplica la separacion entre motas.
 */
const ESTELAS: Record<string, {
  deriva: [number, number]; dispersa: number; vida: number;
  tam: [number, number]; paso: number;
}> = {
  chispas:  { deriva: [0.35, -0.22], dispersa: 14, vida: 1100, tam: [0.35, 1.1], paso: 1 },
  puntos:   { deriva: [0, 0],        dispersa: 4,  vida: 700,  tam: [0.6, 0.9],  paso: 1.3 },
  polvo:    { deriva: [0.5, -0.1],   dispersa: 20, vida: 1500, tam: [0.2, 0.55], paso: 0.6 },
  burbujas: { deriva: [0.3, -0.6],   dispersa: 16, vida: 1600, tam: [0.5, 1.3],  paso: 1.6 },
  fuego:    { deriva: [0.5, -0.9],   dispersa: 12, vida: 900,  tam: [0.4, 1.2],  paso: 0.8 },
  nieve:    { deriva: [0.4, 0.55],   dispersa: 18, vida: 1800, tam: [0.35, 0.9], paso: 1.2 },
};

export function cursor(
  type: string,
  opciones: {
    img?: string; size?: number | null;
    trail?: number | null; trailFx?: string;
    /** Si se pasa, solo se deja ver encima de ese elemento. */
    ambito?: HTMLElement | null;
  } = {},
) {
  // Con imagen propia se dibuja aunque el tipo sea "default": la imagen ES
  // la eleccion. Sin imagen y sin tipo, no hay nada que dibujar.
  const img = opciones.img || '';
  if ((!type || type === 'default') && !img) return null;
  if (reduce) return null;
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) return null;

  const el = document.createElement('div');
  el.className = 'cur' + (img ? ' cur--img' : ' cur--' + type);
  if (img) {
    const lado = Math.max(12, Math.min(96, opciones.size || 32));
    const foto = document.createElement('img');
    foto.src = img;
    foto.alt = '';
    foto.width = lado;
    foto.height = lado;
    // Centrada en la punta del raton, como los demas cursores.
    el.style.margin = `${-lado / 2}px 0 0 ${-lado / 2}px`;
    el.appendChild(foto);
  }
  document.body.appendChild(el);

  /* El rastro: chispas que se quedan DONDE paso el raton y se apagan.
     Antes era una cadena de motas colgando del cursor —siempre las mismas,
     siempre pegadas a el—, que es otra cosa: se movia con el puntero en vez
     de marcar el camino recorrido. */
  const DENSIDAD =
    opciones.trail != null
      ? Math.max(0, Math.min(12, opciones.trail))
      : (type === 'dot' || type === 'blade') ? 5 : 0;

  /* Piscina de tamano fijo, reutilizada. Crear y destruir nodos a cada
     movimiento del raton es la forma segura de que el navegador acabe
     recogiendo basura mientras el usuario mueve el cursor. */
  const TIPO = opciones.trailFx || 'chispas';
  const E = ESTELAS[TIPO] ?? ESTELAS.chispas!;

  const MAX_CHISPAS = DENSIDAD * 14;
  /** Cada cuantos pixeles recorridos se suelta una mota. Con la densidad al
   *  maximo salen casi pegadas, que es el aspecto de polvo brillante; con
   *  densidad baja quedan sueltas y se distinguen una a una. */
  const PASO = DENSIDAD > 0 ? Math.max(2.5, 20 - DENSIDAD * 1.5) * E.paso : 0;
  const VIDA = E.vida;

  interface Chispa {
    el: HTMLElement;
    x: number; y: number;
    vx: number; vy: number;
    tam: number;
    nace: number;
    viva: boolean;
  }
  const chispas: Chispa[] = [];
  for (let i = 0; i < MAX_CHISPAS; i++) {
    const c = document.createElement('div');
    c.className = 'cur-chispa cur-chispa--' + TIPO;
    c.style.opacity = '0';
    document.body.appendChild(c);
    chispas.push({ el: c, x: 0, y: 0, vx: 0, vy: 0, tam: 1, nace: 0, viva: false });
  }
  let siguiente = 0;
  let ultimoX = -9999, ultimoY = -9999;

  /**
   * Cuanto se quedan por detras del puntero al nacer.
   *
   * Tiene que salir del TAMANO del cursor, no ser un numero fijo: con 13 px
   * fijos, un aro de 32 o una imagen de 48 se comian las primeras chispas,
   * que nacian encima del propio puntero en vez de detras de el.
   *
   * El halo es la excepcion: mide 220 px pero es un resplandor difuso, no
   * una figura, y empujar el rastro 118 px lo dejaria descolgado.
   */
  const HUELLA: Record<string, number> = {
    dot: 6, ring: 18, blade: 16, glow: 14,
  };
  const radio = img
    ? Math.max(12, Math.min(96, opciones.size || 32)) / 2
    : (HUELLA[type] ?? 8);
  const RETRASO = radio + 9;

  function soltarChispa(x: number, y: number, ahora: number, ux: number, uy: number) {
    const c = chispas[siguiente];
    if (!c) return;
    siguiente = (siguiente + 1) % chispas.length;

    /* Nacen DETRAS del cursor, en el sentido contrario al movimiento.
       Naciendo en el punto exacto del raton, y con la dispersion repartida
       en todas direcciones, la mitad caia por delante: se veian chispas
       adelantando al puntero, que es al reves de lo que hace un rastro.
       Ahora se retrasan en el eje del movimiento y se abren SOLO de lado. */
    const bx = x - ux * RETRASO;
    const by = y - uy * RETRASO;
    // Perpendicular al avance: el rastro tiene grosor, pero no longitud
    // hacia delante.
    const lado = (Math.random() - 0.5) * E.dispersa;
    // Y un poco mas atras, nunca menos.
    const atras = Math.random() * E.dispersa * 0.5;
    c.x = bx + -uy * lado - ux * atras;
    c.y = by + ux * lado - uy * atras;
    // La deriva es lo que separa una brasa (sube deprisa) de la nieve (cae)
    // o de unos puntos que se quedan quietos donde nacieron.
    c.vx = (Math.random() - 0.5) * E.deriva[0];
    c.vy = E.deriva[1] * (0.55 + Math.random() * 0.9);
    c.tam = E.tam[0] + Math.random() * (E.tam[1] - E.tam[0]);
    c.nace = ahora;
    c.viva = true;
  }

  let mx = -100, my = -100;
  /** Desvio del temblor del glitch. Lo pone el fotograma; se compone al
   *  pintar para que el puntero y el temblor no se pisen el transform. */
  let glx = 0, gly = 0;

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
  if (ambito) el.classList.add('cur--fuera');

  /**
   * Se pinta en el EVENTO, no en el fotograma.
   *
   * Antes la posicion se acercaba al raton dentro de un rAF con una
   * constante de 8 ms. Eso es retraso siempre: 8 ms de seguimiento MAS la
   * espera al siguiente fotograma. Y el evento `mousemove` que lo
   * alimentaba lo entrega el navegador a ritmo de pantalla, asi que un
   * raton de 1000 Hz en un monitor de 240 Hz no servia de nada.
   *
   * Ahora la posicion se escribe en cuanto llega, desde `pointerrawupdate`
   * —que si entrega al ritmo del raton, por encima del de la pantalla—. El
   * navegador compone una sola vez por fotograma de todas formas, asi que
   * escribir de mas entre fotogramas no pinta de mas: solo quita espera.
   */
  function pintar() {
    let tr = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    if (glx || gly) {
      tr += ' translate3d(' + glx.toFixed(1) + 'px,' + gly.toFixed(1) + 'px,0)';
    }
    el.style.transform = tr;
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
    const t = e.target as Element | null;
    if (ambito) {
      const d = !!(t && ambito.contains(t));
      if (d !== dentro) {
        dentro = d;
        el.classList.toggle('cur--fuera', !d);
      }
    }
    const over = t && t.closest && t.closest('a,button,.pf-link,.pf-social,.pf-badge');
    el.classList.toggle('is-hot', !!over);
  }

  /* Posicion del fotograma anterior. El glitch mide velocidad POR FOTOGRAMA
     y no por evento: por evento, a 240 Hz los saltos son cuatro veces mas
     cortos y el temblor no llegaba a dispararse nunca. */
  let fx = -100, fy = -100;

  /* Un cursor liso —un punto, un aro, una imagen— ya no necesita fotograma
     ninguno: se pinta solo cuando el raton se mueve. Antes cada cursor
     dejaba un rAF encendido para siempre repitiendo el mismo calculo, y
     eso es tiempo de fotograma que le quitas a todo lo demas de la pagina
     por algo que no cambia. */
  const necesitaFotograma = type === 'glitch' || DENSIDAD > 0;

  const soltar = !necesitaFotograma ? () => {} : ticker(() => {
    if (type === 'glitch') {
      const v = Math.min(1, Math.hypot(mx - fx, my - fy) / 26);
      fx = mx; fy = my;
      el.style.setProperty('--gl', v.toFixed(3));
      glx = (Math.random() - 0.5) * 7 * v;
      gly = (Math.random() - 0.5) * 7 * v;
      pintar();
    }

    if (DENSIDAD > 0 && dentro) {
      const ahora = performance.now();

      // Se suelta por DISTANCIA recorrida, no por tiempo: parado no deja
      // rastro, y moviendose deprisa lo deja igual de tupido.
      const dx = mx - ultimoX, dy = my - ultimoY;
      const dist = Math.hypot(dx, dy);
      if (ultimoX < -9000) { ultimoX = mx; ultimoY = my; }
      else if (dist >= PASO) {
        // Direccion del avance, normalizada: es lo que define donde esta
        // "detras".
        soltarChispa(mx, my, ahora, dx / dist, dy / dist);
        ultimoX = mx; ultimoY = my;
      }

      for (let j = 0; j < chispas.length; j++) {
        const c = chispas[j]!;
        if (!c.viva) continue;
        const t = (ahora - c.nace) / VIDA;
        if (t >= 1) {
          c.viva = false;
          c.el.style.opacity = '0';
          continue;
        }
        c.x += c.vx;
        c.y += c.vy;
        // Se apaga y encoge hacia el final; el brillo cae mas rapido que el
        // tamano, que es como se ve una chispa de verdad.
        const k = 1 - t;
        c.el.style.opacity = (k * k).toFixed(3);
        c.el.style.transform =
          'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) scale(' +
          (c.tam * (0.35 + k * 0.65)).toFixed(2) + ')';
      }
    }
  });

  /* `pointerrawupdate` entrega TODOS los movimientos del raton, sin
     agruparlos por fotograma, que es lo unico que permite aprovechar un
     monitor rapido. Donde no exista, `pointermove` hace de las dos cosas y
     el resultado es el de siempre, no peor. */
  const CRUDO = 'onpointerrawupdate' in window;
  const EVENTO_POS = CRUDO ? 'pointerrawupdate' : 'pointermove';
  window.addEventListener(EVENTO_POS, onPos as EventListener, { passive: true });
  window.addEventListener('pointermove', onEncima as EventListener, { passive: true });

  return register(() => {
    soltar();
    window.removeEventListener(EVENTO_POS, onPos as EventListener);
    window.removeEventListener('pointermove', onEncima as EventListener);
    el.remove();
    chispas.forEach((c) => c.el.remove());
  });
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
