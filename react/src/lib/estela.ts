import { estela as buscarEstela, type DefEstela, type FormaMota } from '@/data/estelas';

/**
 * El rastro del cursor.
 *
 * ────────────────────────────────────────────────────────────────────────
 * UN LIENZO, NO CIENTO SESENTA Y OCHO NODOS
 * ────────────────────────────────────────────────────────────────────────
 *
 * La versión anterior creaba un `<div>` por mota —hasta 168— y en cada
 * fotograma le escribía a cada uno su `transform` y su `opacity`. Eso son
 * más de trescientas escrituras de estilo por fotograma, y cada una obliga
 * al navegador a recalcular estilo y a componer otra capa más. En un
 * portátil se aguanta; en un teléfono de hace tres años, no.
 *
 * Aquí hay UN elemento. Las motas viven en arrays de números y se dibujan de
 * una pasada. El navegador no tiene que recalcular nada: solo pinta. Pasar
 * de treinta motas a trescientas cuesta lo que cuesta dibujar trescientas
 * cosas pequeñas, que es poco, en vez de multiplicar el trabajo del motor de
 * estilos por diez.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y DUERME
 * ────────────────────────────────────────────────────────────────────────
 *
 * Un rastro no tiene nada que hacer si no mueves el ratón. Cuando se apaga
 * la última mota y el puntero lleva quieto un momento, el bucle se PARA del
 * todo —no se queda girando en vacío— y vuelve solo al primer movimiento.
 * Un perfil abierto de fondo no gasta ni un fotograma.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y SE ADAPTA AL APARATO
 * ────────────────────────────────────────────────────────────────────────
 *
 * El tope de motas y la resolución del lienzo salen de lo que el aparato
 * dice de sí mismo. En un teléfono modesto se dibuja menos y a menos
 * resolución, y el efecto sigue siendo el mismo efecto: lo que baja es la
 * densidad, no la idea.
 */

/* ── lo que aguanta este aparato ───────────────────────────── */
const NUCLEOS = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
const MEMORIA = typeof navigator !== 'undefined'
  ? ((navigator as unknown as { deviceMemory?: number }).deviceMemory || 4)
  : 4;
/** Aparato corto de recursos: menos motas y menos resolución. */
const MODESTO = NUCLEOS <= 4 || MEMORIA <= 4;
const TOPE = MODESTO ? 220 : 600;
/** Por encima de 2 no se distingue y se pintan cuatro veces más píxeles. */
const DPR_TOPE = MODESTO ? 1.5 : 2;

const QUIETO =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface OpcionesEstela {
  /** Cuál de las quince. */
  fx: string;
  /** Cuántas, de 0 a 12. Cero es sin rastro. */
  cantidad: number;
  /** Color elegido. Sin él, el de fábrica de esa estela. */
  color?: string;
  /** Tamaño y brillo, en %. 100 es como viene. */
  intensidad?: number;
  /** `seguimiento` deja el rastro detrás; los demás lo empujan. */
  direccion?: 'seguimiento' | 'arriba' | 'abajo' | 'libre';
  /** Si se pasa, solo suelta motas mientras el puntero está encima. */
  ambito?: HTMLElement | null;
  /**
   * Dibujar en ESTE lienzo en vez de crear uno sobre la ventana.
   *
   * Es lo que permite que las tarjetas del selector enseñen el efecto DE
   * VERDAD y no una imitación dibujada aparte. Dos implementaciones de la
   * misma física acaban siempre divergiendo, y entonces eliges una cosa y te
   * llevas otra.
   */
  lienzo?: HTMLCanvasElement | null;
  /**
   * Mover el puntero solo, siguiendo un recorrido fijo.
   *
   * En una tarjeta no hay ratón que seguir: la estela tiene que pasar sola
   * para que se vea qué hace.
   */
  guion?: boolean;
}

export interface Estela {
  actualizar(o: OpcionesEstela): void;
  /** Parar del todo mientras no se ve. */
  pausar(v: boolean): void;
  destruir(): void;
}

/** Un color de CSS convertido a sus tres canales, una sola vez. */
function aRgb(c: string): [number, number, number] {
  const s = c.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const n = h.length === 3
      ? parseInt(h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!, 16)
      : parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/-?\d+(\.\d+)?/g);
  if (m && m.length >= 3) return [+m[0]!, +m[1]!, +m[2]!];
  return [255, 255, 255];
}

export function crearEstela(opciones: OpcionesEstela): Estela | null {
  if (typeof document === 'undefined') return null;
  /* Con menos movimiento, sin rastro. No es un adorno que se pueda atenuar:
     es movimiento continuo siguiendo al puntero, justo lo que se pide no
     tener. */
  if (QUIETO) return null;
  /* Sin puntero no hay rastro que dejar. Un dedo no deja estela. */
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) return null;

  const propio = !opciones.lienzo;
  const cv = opciones.lienzo ?? document.createElement('canvas');
  if (propio) {
    cv.className = 'estela';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
  }
  const guion = !!opciones.guion;
  const ctx0 = cv.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx0) {
    cv.remove();
    return null;
  }
  /* Ya comprobado arriba. Se ata a una constante no anulable para no tener
     que preguntarlo otra vez en cada mota y en cada cuadro. */
  const ctx: CanvasRenderingContext2D = ctx0;

  let dpr = 1;
  let ancho = 0, alto = 0;
  const medir = () => {
    dpr = Math.min(DPR_TOPE, window.devicePixelRatio || 1);
    if (propio) {
      ancho = window.innerWidth;
      alto = window.innerHeight;
      cv.style.width = `${ancho}px`;
      cv.style.height = `${alto}px`;
    } else {
      const r = cv.getBoundingClientRect();
      ancho = Math.max(1, Math.round(r.width));
      alto = Math.max(1, Math.round(r.height));
    }
    cv.width = Math.ceil(ancho * dpr);
    cv.height = Math.ceil(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  medir();

  /* ── las motas, en números y no en objetos ────────────────
     Un array por propiedad. No se crea ni se destruye nada mientras el
     rastro vive, así que el recolector de basura no tiene nada que hacer
     justo mientras mueves el ratón, que es cuando peor viene. */
  const px = new Float32Array(TOPE);
  const py = new Float32Array(TOPE);
  const vx = new Float32Array(TOPE);
  const vy = new Float32Array(TOPE);
  const ox = new Float32Array(TOPE);   // donde nació (para la órbita)
  const oy = new Float32Array(TOPE);
  const nace = new Float32Array(TOPE);
  const tam = new Float32Array(TOPE);
  const ang = new Float32Array(TOPE);
  const semilla = new Float32Array(TOPE);
  const viva = new Uint8Array(TOPE);
  let siguiente = 0;
  let vivas = 0;

  let def: DefEstela | undefined;
  let rgb: [number, number, number] = [255, 255, 255];
  let cantidad = 0;
  let intensidad = 1;
  let direccion: OpcionesEstela['direccion'] = 'seguimiento';
  let ambito: HTMLElement | null = null;

  let mx = -9999, my = -9999;
  let ux = 0, uy = 0;          // dirección del avance, normalizada
  let velocidad = 0;
  let ultimoX = -9999, ultimoY = -9999;
  let dentro = true;
  let ultimoMov = 0;

  function nacer(x: number, y: number, ahora: number) {
    if (!def) return;
    const i = siguiente;
    siguiente = (siguiente + 1) % TOPE;
    if (!viva[i]) vivas++;

    /* Nacen DETRÁS del cursor, en el sentido contrario al movimiento. En el
       punto exacto del ratón, y con la dispersión repartida en todas
       direcciones, la mitad caería por delante: se verían motas adelantando
       al puntero, que es al revés de lo que hace un rastro. */
    const atras = direccion === 'seguimiento' ? 10 : 0;
    const lado = (Math.random() - 0.5) * def.dispersa;
    const bx = x - ux * atras + -uy * lado;
    const by = y - uy * atras + ux * lado;

    px[i] = ox[i] = bx;
    py[i] = oy[i] = by;

    let dvx = (Math.random() - 0.5) * def.deriva[0] * 2;
    let dvy = def.deriva[1] * (0.55 + Math.random() * 0.9);
    if (direccion === 'arriba') dvy = -Math.abs(dvy) - 0.4;
    else if (direccion === 'abajo') dvy = Math.abs(dvy) + 0.4;
    else if (direccion === 'libre') {
      const a = Math.random() * Math.PI * 2;
      dvx = Math.cos(a) * 0.8;
      dvy = Math.sin(a) * 0.8;
    }
    /* Lo que hereda del ratón. Es lo que separa un rastro que se queda
       clavado de uno que sale despedido al frenar en seco. */
    const h = (def.arrastre ?? 0) * Math.min(velocidad, 40) * 0.08;
    vx[i] = dvx + ux * h;
    vy[i] = dvy + uy * h;

    tam[i] = (def.tam[0] + Math.random() * (def.tam[1] - def.tam[0])) * intensidad;
    ang[i] = Math.random() * Math.PI * 2;
    semilla[i] = Math.random();
    nace[i] = ahora;
    viva[i] = 1;
  }

  function dibujar(forma: FormaMota, x: number, y: number, r: number, a: number) {
    switch (forma) {
      case 'estrella': {
        /* Cuatro puntas y no un círculo: a este tamaño un punto se lee como
           suciedad en la pantalla y una estrella se lee como brillo. */
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const t = a + (k * Math.PI) / 4;
          const rr = k % 2 === 0 ? r : r * 0.32;
          const fx = x + Math.cos(t) * rr;
          const fy = y + Math.sin(t) * rr;
          if (k === 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'linea': {
        ctx.lineWidth = Math.max(1, r * 0.28);
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.stroke();
        break;
      }
      case 'burbuja': {
        ctx.lineWidth = Math.max(1, r * 0.14);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.stroke();
        /* El reflejo. Sin él una burbuja es un aro, y un aro no es una
           burbuja: lo que dice «esto es una pompa» es el punto de luz. */
        ctx.beginPath();
        ctx.arc(x - r * 0.33, y - r * 0.33, r * 0.17, 0, 6.283);
        ctx.fill();
        break;
      }
      case 'anillo': {
        ctx.lineWidth = Math.max(1, r * 0.1);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.stroke();
        break;
      }
      case 'triangulo': {
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const t = a + (k * 2.0944);
          const fx = x + Math.cos(t) * r;
          const fy = y + Math.sin(t) * r;
          if (k === 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'cristal': {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a + 1.5708) * r * 0.4, y + Math.sin(a + 1.5708) * r * 0.4);
        ctx.lineTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a - 1.5708) * r * 0.4, y + Math.sin(a - 1.5708) * r * 0.4);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'petalo': {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.45, a, 0, 6.283);
        ctx.fill();
        break;
      }
      case 'humo':
      case 'punto':
      default: {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
        break;
      }
    }
  }

  let latido = 0;
  let durmiendo = true;

  function cuadro() {
    latido = 0;
    if (!def) { durmiendo = true; return; }

    const ahora = performance.now();
    const w = ancho;
    const h = alto;
    ctx.clearRect(0, 0, w, h);

    /* El puntero de mentira de las tarjetas: un ocho tumbado que cruza la
       caja. Recorre siempre lo mismo, así que dos tarjetas se comparan de
       verdad —lo que cambia entre ellas es el efecto, no por dónde pasó. */
    if (guion) {
      const t2 = ahora / 1500;
      mx = w * (0.5 + Math.sin(t2) * 0.33);
      my = h * (0.5 + Math.sin(t2 * 2) * 0.24);
      ultimoMov = ahora;
      dentro = true;
    }

    /* ── soltar ──────────────────────────────────────────── */
    if (cantidad > 0 && dentro) {
      const dx = mx - ultimoX;
      const dy = my - ultimoY;
      const dist = Math.hypot(dx, dy);
      if (ultimoX < -9000) { ultimoX = mx; ultimoY = my; }
      else if (dist > 0.5) {
        velocidad = dist;
        ux = dx / dist; uy = dy / dist;
        /* Por DISTANCIA recorrida, no por tiempo: parado no deja rastro, y
           moviéndose deprisa lo deja igual de tupido. La cantidad acorta el
           paso en vez de soltar más de golpe, que es lo que hace que suba la
           densidad sin que se amontonen. */
        const paso = Math.max(1.2, def.paso * (13 - cantidad) / 7);
        let recorrido = dist;
        let cx = ultimoX, cy = ultimoY;
        /* Tope por cuadro: un salto enorme —cambiar de pestaña y volver— no
           puede soltar doscientas motas de una vez. */
        let sueltas = 0;
        while (recorrido >= paso && sueltas < 24) {
          cx += ux * paso; cy += uy * paso;
          for (let b = 0; b < def.brote; b++) nacer(cx, cy, ahora);
          recorrido -= paso;
          sueltas++;
        }
        ultimoX = mx - ux * recorrido;
        ultimoY = my - uy * recorrido;
        ultimoMov = ahora;
      }
    }

    /* ── mover y pintar ──────────────────────────────────── */
    ctx.globalCompositeOperation = def.aditivo ? 'lighter' : 'source-over';
    const roce = def.roce ?? 1;
    const grav = def.gravedad ?? 0;
    const alfaBase = (def.alfa ?? 1) * Math.min(1.4, intensidad);
    let quedan = 0;

    for (let i = 0; i < TOPE; i++) {
      if (!viva[i]) continue;
      const t = (ahora - nace[i]!) / def.vida;
      if (t >= 1) { viva[i] = 0; continue; }
      quedan++;

      vx[i]! *= roce;
      vy[i]! = vy[i]! * roce + grav;
      px[i]! += vx[i]!;
      py[i]! += vy[i]!;

      let x = px[i]!;
      let y = py[i]!;

      if (def.orbita) {
        const g = semilla[i]! * 6.283 + t * 6.283;
        x = ox[i]! + Math.cos(g) * def.orbita * (0.4 + t * 0.9);
        y = oy[i]! + Math.sin(g) * def.orbita * (0.4 + t * 0.9) * 0.55;
      } else if (def.onda) {
        const [amp, ciclos] = def.onda;
        const s = Math.sin(t * ciclos * 6.283 + semilla[i]! * 6.283) * amp;
        x += -uy * s;
        y += ux * s;
      }

      const k = 1 - t;
      /* El brillo cae más deprisa que el tamaño, que es como se apaga una
         chispa de verdad. */
      const alfa = alfaBase * k * k;
      let r = tam[i]!;
      if (def.crece) r *= 1 + (def.crece - 1) * t;
      if (r < 0.3) continue;

      if (def.tono) {
        const [rr, gg, bb] = rgb;
        /* Girar el tono sin salir a HSL y volver: una rotación de color en
           el espacio RGB, que es una multiplicación y no tres conversiones
           por mota y por cuadro. */
        const a2 = (def.tono * t * Math.PI) / 180;
        const c = Math.cos(a2), sn = Math.sin(a2);
        const m0 = 0.299 + 0.701 * c + 0.168 * sn;
        const m1 = 0.587 - 0.587 * c + 0.330 * sn;
        const m2 = 0.114 - 0.114 * c - 0.497 * sn;
        const nr = Math.min(255, Math.max(0, rr * m0 + gg * m1 + bb * m2));
        const ng = Math.min(255, Math.max(0, rr * (0.299 - 0.299 * c - 0.328 * sn)
          + gg * (0.587 + 0.413 * c + 0.035 * sn) + bb * (0.114 - 0.114 * c + 0.292 * sn)));
        const nb = Math.min(255, Math.max(0, rr * (0.299 - 0.3 * c + 1.25 * sn)
          + gg * (0.587 - 0.588 * c - 1.05 * sn) + bb * (0.114 + 0.886 * c - 0.203 * sn)));
        ctx.fillStyle = ctx.strokeStyle =
          `rgba(${nr | 0},${ng | 0},${nb | 0},${alfa.toFixed(3)})`;
      } else {
        ctx.fillStyle = ctx.strokeStyle =
          `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alfa.toFixed(3)})`;
      }

      const giroAng = def.forma === 'linea' && !def.giro
        ? Math.atan2(uy, ux)
        : ang[i]! + (def.giro ?? 0) * t * 6.283;
      dibujar(def.forma, x, y, r, giroAng);
    }
    vivas = quedan;

    /* ── dormir ──────────────────────────────────────────── */
    if (pausada || (vivas === 0 && ahora - ultimoMov > 250)) {
      durmiendo = true;
      ctx.clearRect(0, 0, w, h);
      return;
    }
    latido = requestAnimationFrame(cuadro);
  }

  function despertar() {
    if (latido || pausada) return;
    durmiendo = false;
    latido = requestAnimationFrame(cuadro);
  }

  let pausada = false;

  function alMover(e: PointerEvent) {
    if (guion) return;
    mx = e.clientX; my = e.clientY;
    if (ambito) {
      /* `instanceof Node` y no solo «existe»: el objetivo de un
         `pointermove` escuchado en `window` no siempre es un elemento. Si el
         puntero no está sobre nada del documento —la barra de desplazamiento,
         un hueco entre marcos— llega `window`, y `contains(window)` no
         devuelve `false`: LANZA. Y lanzar dentro de un manejador de
         `pointermove` es lanzar en cada movimiento del ratón. */
      const t = e.target;
      dentro = t instanceof Node ? ambito.contains(t) : dentro;
    }
    ultimoMov = performance.now();
    if (durmiendo) despertar();
  }

  const alRedimensionar = () => medir();
  const alVisibilidad = () => {
    if (document.hidden && latido) { cancelAnimationFrame(latido); latido = 0; durmiendo = true; }
  };

  if (!guion) window.addEventListener('pointermove', alMover, { passive: true });
  window.addEventListener('resize', alRedimensionar);
  document.addEventListener('visibilitychange', alVisibilidad);

  function actualizar(o: OpcionesEstela) {
    def = buscarEstela(o.fx);
    cantidad = Math.max(0, Math.min(12, o.cantidad || 0));
    intensidad = Math.max(0.25, Math.min(2, (o.intensidad ?? 100) / 100));
    direccion = o.direccion || 'seguimiento';
    ambito = o.ambito ?? null;
    if (!ambito) dentro = true;
    rgb = aRgb(o.color || def?.color || '#ffffff');
    if (def && (cantidad > 0 || guion)) despertar();
  }

  actualizar(opciones);

  return {
    actualizar,
    /**
     * Parar del todo mientras no se ve.
     *
     * Quince tarjetas animándose a la vez cuando en el panel caben seis es
     * pagar por nueve efectos que nadie está mirando. Esto no las atenúa:
     * las APAGA, y el bucle no corre.
     */
    pausar(v: boolean) {
      pausada = v;
      if (v) {
        if (latido) cancelAnimationFrame(latido);
        latido = 0;
        durmiendo = true;
        ctx.clearRect(0, 0, ancho, alto);
      } else {
        despertar();
      }
    },
    destruir() {
      if (latido) cancelAnimationFrame(latido);
      latido = 0;
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('resize', alRedimensionar);
      document.removeEventListener('visibilitychange', alVisibilidad);
      if (propio) cv.remove();
    },
  };
}
