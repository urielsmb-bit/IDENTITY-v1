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

/**
 * Girar el tono, sin salir a HSL y volver.
 *
 * Es una rotacion de color en el propio espacio RGB: una multiplicacion,
 * frente a dos conversiones por mota y por cuadro. Escribe en un hueco fijo
 * y lo devuelve, en vez de crear una tupla nueva — esto se llama una vez por
 * mota viva y por cuadro, y ahi crear basura es crearla a sesenta por
 * segundo. Quien lo llama tiene que USAR el resultado antes de volver a
 * llamar; no se puede guardar.
 */
const TINTE: [number, number, number] = [0, 0, 0];
function girarTono(
  r: number, g: number, b: number, grados: number,
): [number, number, number] {
  const a = (grados * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  TINTE[0] = Math.min(255, Math.max(0,
    r * (0.299 + 0.701 * c + 0.168 * s)
    + g * (0.587 - 0.587 * c + 0.330 * s)
    + b * (0.114 - 0.114 * c - 0.497 * s))) | 0;
  TINTE[1] = Math.min(255, Math.max(0,
    r * (0.299 - 0.299 * c - 0.328 * s)
    + g * (0.587 + 0.413 * c + 0.035 * s)
    + b * (0.114 - 0.114 * c + 0.292 * s))) | 0;
  TINTE[2] = Math.min(255, Math.max(0,
    r * (0.299 - 0.300 * c + 1.250 * s)
    + g * (0.587 - 0.588 * c - 1.050 * s)
    + b * (0.114 + 0.886 * c - 0.203 * s))) | 0;
  return TINTE;
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

  /* ── por dónde has pasado ─────────────────────────────────
     La cinta necesita el RECORRIDO, no solo la posición de ahora. Son las
     últimas posiciones del ratón, en un anillo: `cabeza` apunta a la más
     reciente y `guardadas` dice cuántas hay. Un anillo y no una lista porque
     esto se escribe sesenta veces por segundo y una lista significaría
     crear y tirar un array en cada fotograma. */
  const TOPE_HIST = 48;
  const hx = new Float32Array(TOPE_HIST);
  const hy = new Float32Array(TOPE_HIST);
  let cabeza = 0;
  let guardadas = 0;
  /* Las dos orillas de la cinta, y la normal de cada punto. Se llenan una vez
     por cuadro y las tres capas las reaprovechan: la trigonometría de la
     perpendicular es lo caro, y no cambia de una capa a otra. */
  const nx = new Float32Array(TOPE_HIST);
  const ny = new Float32Array(TOPE_HIST);
  const nt = new Float32Array(TOPE_HIST);
  const ax = new Float32Array(TOPE_HIST);
  const ay = new Float32Array(TOPE_HIST);
  const bx = new Float32Array(TOPE_HIST);
  const by = new Float32Array(TOPE_HIST);

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

  /**
   * `r` es el tamaño de AHORA y `base` el de partida. Hacen falta los dos:
   * una onda que se expande necesita saber cuánto ha crecido para poder
   * adelgazar en la misma medida.
   */
  function dibujar(forma: FormaMota, x: number, y: number, r: number, a: number, base: number) {
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
        const g = ctx.globalAlpha;
        /* La PELÍCULA. Una pompa no es un aro vacío: tiene una lámina
           finísima que tiñe lo que hay detrás. Casi no se ve, y es la
           diferencia entre una pompa y un círculo dibujado. */
        ctx.globalAlpha = g * 0.13;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
        ctx.globalAlpha = g;

        ctx.lineWidth = Math.max(1, r * 0.13);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.stroke();

        /* El reflejo de arriba: lo que dice «esto es una pompa». */
        ctx.beginPath();
        ctx.arc(x - r * 0.34, y - r * 0.34, r * 0.17, 0, 6.283);
        ctx.fill();

        /* Y el rebote de abajo: la luz que entra por el otro lado y sale
           devuelta por la pared del fondo. Es lo que la vuelve ESFERA en
           vez de circunferencia. */
        ctx.globalAlpha = g * 0.5;
        ctx.lineWidth = Math.max(0.8, r * 0.1);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.72, 0.55, 2.05);
        ctx.stroke();
        ctx.globalAlpha = g;
        break;
      }
      case 'anillo': {
        /* Una onda se ADELGAZA al expandirse: la misma energía repartida en
           una circunferencia cada vez más larga. Antes el grosor salía del
           radio, así que engordaba al crecer — y una onda que engorda no es
           una onda, es un donut. */
        const fino = Math.max(0.7, base * 0.55 * (base / Math.max(base, r)));
        ctx.lineWidth = fino;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.stroke();
        /* Y la segunda cresta, por dentro y más tenue. Una onda nunca viene
           sola; una sola circunferencia es un aro dibujado. */
        const g = ctx.globalAlpha;
        ctx.globalAlpha = g * 0.42;
        ctx.lineWidth = Math.max(0.6, fino * 0.66);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.76, 0, 6.283);
        ctx.stroke();
        ctx.globalAlpha = g;
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
        /* El cristal de dentro. Sin él son tres rayas sueltas y se lee como
           un boceto; con él, el alambre es el BORDE de algo. */
        const g = ctx.globalAlpha;
        ctx.globalAlpha = g * 0.20;
        ctx.fill();
        ctx.globalAlpha = g;
        /* Y un alambre que se vea: a un décimo del radio, en una mota de
           cuatro píxeles, el trazo era medio píxel. */
        ctx.lineWidth = Math.max(1, r * 0.17);
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

  /* ────────────────────────────────────────────────────────────────────
     EL PÉTALO SE COCE UNA VEZ
     ────────────────────────────────────────────────────────────────────

     Un pétalo de verdad no es una silueta rellena de un color: tiene una
     cara donde da la luz, un pliegue en sombra donde se curva, y un borde
     tan fino que la luz lo ATRAVIESA. Eso son degradados — y un degradado
     por mota y por cuadro no se puede pagar.

     Así que se cuece uno solo, a tamaño grande y en un lienzo aparte, cada
     vez que cambia el color. Después cada pétalo es UN `drawImage` girado:
     una orden de dibujo, menos de las tres que costaba la silueta a mano, y
     con un material dentro en vez de una mancha plana.

     Y al llevar su propia sombra dentro, se ve tanto sobre un fondo oscuro
     como sobre una foto a pleno sol, que es donde el relleno plano
     desaparecía. */
  const LADO_SPRITE = 72;
  /* TRES siluetas, no una.
     Un solo pétalo repetido cuarenta veces se nota: son cuarenta copias de
     la misma cosa girada, y el ojo lo caza enseguida. Tres cambian el ancho,
     lo afilada que es la punta y hacia qué lado carga —ningún pétalo de
     verdad es simétrico—, y se eligen por la semilla de cada mota. Van en
     UN lienzo, una al lado de otra: sigue siendo un horneado y una sola
     textura. */
  const VARIANTES = [
    { ancho: 0.42, punta: 1.60, sesgo: 1.18 },
    { ancho: 0.33, punta: 1.78, sesgo: 0.86 },
    { ancho: 0.50, punta: 1.44, sesgo: 1.05 },
  ];
  let sprite: HTMLCanvasElement | null = null;
  let spriteDe = '';

  /** El mismo color, más claro o más oscuro. Hacia el blanco o hacia el negro. */
  function mezcla(k: number) {
    const d = k >= 0 ? 255 : 0;
    const f = Math.abs(k);
    return `${Math.round(rgb[0] + (d - rgb[0]) * f)},`
      + `${Math.round(rgb[1] + (d - rgb[1]) * f)},`
      + `${Math.round(rgb[2] + (d - rgb[2]) * f)}`;
  }

  function cocerPetalo() {
    const clave = rgb.join(',') + '|' + dpr;
    if (sprite && spriteDe === clave) return;
    const l = Math.round(LADO_SPRITE * dpr);
    const c = sprite ?? document.createElement('canvas');
    c.width = l * VARIANTES.length;
    c.height = l;
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);

    VARIANTES.forEach((v, k) => {
      g.setTransform(dpr, 0, 0, dpr, k * l, 0);
      const cx = LADO_SPRITE / 2, cy = LADO_SPRITE / 2;
      /* Margen: el trazo del borde se sale medio grosor, y sin margen
         quedaría cortado a cuchillo contra el canto de la casilla. */
      const largo = cx - 2;
      const ancho = largo * v.ancho;

      /* La silueta: dos curvas que se encuentran en punta, y con una más
         llena que la otra. Una elipse no vale — una elipse no tiene puntas,
         y sin puntas es una lenteja. */
      const silueta = () => {
        g.beginPath();
        g.moveTo(cx - largo, cy);
        g.quadraticCurveTo(cx, cy - ancho * v.punta * v.sesgo, cx + largo, cy);
        g.quadraticCurveTo(cx, cy + ancho * v.punta / v.sesgo, cx - largo, cy);
        g.closePath();
      };

      /* El material, a lo ANCHO: del borde fino por el que pasa la luz, a la
         cara iluminada, al pliegue en sombra del otro lado. Es lo que hace
         que parezca que tiene una curva y no que es una pegatina. */
      const mat = g.createLinearGradient(0, cy - ancho, 0, cy + ancho);
      mat.addColorStop(0, `rgba(${mezcla(0.55)},0.30)`);
      mat.addColorStop(0.28, `rgba(${mezcla(0.42)},0.96)`);
      mat.addColorStop(0.58, `rgba(${mezcla(0)},0.92)`);
      mat.addColorStop(1, `rgba(${mezcla(-0.45)},0.88)`);
      silueta();
      g.fillStyle = mat;
      g.fill();

      /* El canto. Es lo que le da SILUETA sobre un fondo claro: sin él, un
         pétalo pálido sobre un cielo a pleno sol desaparece. */
      silueta();
      g.strokeStyle = `rgba(${mezcla(-0.58)},0.62)`;
      g.lineWidth = 1.25;
      g.stroke();

      /* El nervio, sin llegar a las puntas: un pétalo tiene una sola línea
         por el medio y muere antes del borde. */
      g.beginPath();
      g.moveTo(cx - largo * 0.66, cy + ancho * 0.16);
      g.quadraticCurveTo(cx, cy - ancho * 0.10, cx + largo * 0.72, cy - ancho * 0.04);
      g.strokeStyle = `rgba(${mezcla(-0.35)},0.4)`;
      g.lineWidth = 0.9;
      g.stroke();
    });

    sprite = c;
    spriteDe = clave;
  }

  /**
   * La cinta.
   *
   * Se dibuja como UN POLÍGONO relleno, no como veinte trazos seguidos: se
   * recorre el camino por un lado calculando la perpendicular, y se vuelve
   * por el otro. Sale un relleno por pasada en vez de veinte trazos, y —lo
   * que importa— se puede ESTRECHAR hacia la cola, que es lo que hace que se
   * lea como movimiento y no como un tubo.
   *
   * El desvanecido no hay que pintarlo: la cinta acaba en punta, y una punta
   * ya se desvanece sola.
   */
  function dibujarCinta() {
    const c = def?.cinta;
    if (!c || guardadas < 4) return;
    const n = Math.min(guardadas, c.largo, TOPE_HIST);
    const capas = c.capas ?? 1;
    const anchoBase = (c.ancho / 2) * intensidad;

    /* Si la estela gira el tono, la cinta lo gira TAMBIEN a lo largo. Sin
       esto Iris seria un tubo de un solo color con las motas de otro por
       encima, que es justo lo que Iris no es: lo suyo es el color. La cabeza
       sale del color de fabrica y la cola llega girada del todo — el mismo
       recorrido que hace cada mota al envejecer, pero en el espacio en vez
       de en el tiempo.

       Un degradado por cuadro y no por capa: la opacidad de cada capa se
       pone aparte, con `globalAlpha`. */
    let pintura: string | CanvasGradient = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    const cola = (cabeza - (n - 1) + TOPE_HIST) % TOPE_HIST;
    if (def!.tono && Math.hypot(hx[cabeza]! - hx[cola]!, hy[cabeza]! - hy[cola]!) > 1) {
      const gr = ctx.createLinearGradient(hx[cabeza]!, hy[cabeza]!, hx[cola]!, hy[cola]!);
      for (let s = 0; s <= 3; s++) {
        const tinte = girarTono(rgb[0], rgb[1], rgb[2], def!.tono * (s / 3));
        gr.addColorStop(s / 3, `rgb(${tinte[0]},${tinte[1]},${tinte[2]})`);
      }
      pintura = gr;
    }
    ctx.fillStyle = pintura;

    /* Las perpendiculares, UNA vez. El punto i de la orilla es el punto
       del recorrido desplazado media anchura hacia su lado; lo que cambia de
       una capa a otra es cuánto, no hacia dónde. */
    for (let i = 0; i < n; i++) {
      const j = (cabeza - i + TOPE_HIST) % TOPE_HIST;
      const jn = (cabeza - Math.min(i + 1, n - 1) + TOPE_HIST) % TOPE_HIST;
      const dx = hx[j]! - hx[jn]!;
      const dy = hy[j]! - hy[jn]!;
      const l = Math.hypot(dx, dy) || 1;
      nx[i] = -dy / l;
      ny[i] = dx / l;
      /* Al cuadrado: estrecha despacio al principio y se va a la punta al
         final, que es como se afila una estela y no como se corta un tubo. */
      const t = 1 - i / n;
      nt[i] = t * t;
    }

    for (let capa = 0; capa < capas; capa++) {
      /* De fuera adentro: la ancha y tenue primero, el filo el último. Con
         el aditivo encima, donde se solapan las tres es donde más luz hay,
         o sea en el centro — que es exactamente donde tiene que estar. */
      const k = 1 - capa / capas;
      const w = anchoBase * (0.35 + k * 0.65);
      ctx.globalAlpha = (def!.alfa ?? 1) * (capa === capas - 1 ? 0.85 : 0.22);

      for (let i = 0; i < n; i++) {
        const j = (cabeza - i + TOPE_HIST) % TOPE_HIST;
        const g = w * nt[i]!;
        const ex = nx[i]! * g, ey = ny[i]! * g;
        ax[i] = hx[j]! + ex; ay[i] = hy[j]! + ey;
        bx[i] = hx[j]! - ex; by[i] = hy[j]! - ey;
      }

      /* CURVAS, no tramos rectos.

         Las posiciones del ratón llegan una por cuadro: unirlas con `lineTo`
         deja una cinta de facetas, con esquinas visibles en cada giro — se
         ve que está hecha de trozos. Cada punto se usa como TIRADOR de una
         curva que pasa por los puntos medios: el camino sale liso y cuesta
         lo mismo, una orden de trazado por punto igual que antes. */
      ctx.beginPath();
      ctx.moveTo(ax[0]!, ay[0]!);
      for (let i = 1; i < n - 1; i++) {
        ctx.quadraticCurveTo(ax[i]!, ay[i]!, (ax[i]! + ax[i + 1]!) / 2, (ay[i]! + ay[i + 1]!) / 2);
      }
      ctx.lineTo(ax[n - 1]!, ay[n - 1]!);
      /* Se cruza por la punta y se vuelve por la otra orilla. */
      ctx.lineTo(bx[n - 1]!, by[n - 1]!);
      for (let i = n - 2; i > 0; i--) {
        ctx.quadraticCurveTo(bx[i]!, by[i]!, (bx[i]! + bx[i - 1]!) / 2, (by[i]! + by[i - 1]!) / 2);
      }
      ctx.closePath();
      ctx.fill();
    }
    /* Devuelto a uno: lo que se pinte despues —las motas— tiene su propia
       opacidad en el color, y heredar la de la ultima capa las dejaria
       casi invisibles. */
    ctx.globalAlpha = 1;
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
        if (sueltas >= 24) {
          /* Se llego al tope: esto no fue un movimiento, fue un SALTO —
             volver a la pestaña, el raton reapareciendo en la otra punta—.
             Guardar el sobrante haria que los cuadros siguientes siguieran
             soltando motas por la linea del salto, y se veria una hilera
             cruzando la pantalla hacia donde estas, despacio, sin que hayas
             pasado por ahi. Se tira el sobrante y se empieza aqui. */
          ultimoX = mx;
          ultimoY = my;
        } else {
          ultimoX = mx - ux * recorrido;
          ultimoY = my - uy * recorrido;
        }
        /* AQUÍ NO se apunta «hubo movimiento», y quitarlo fue arreglar un
           fallo de los que no dan la cara.

           Al soltar motas queda un SOBRANTE: el trozo de camino que no
           llegaba a un paso entero. `ultimoX` se deja retrasado ese sobrante
           para que el siguiente tramo empalme sin costura, y eso significa
           que en el fotograma siguiente la distancia medida ya no es cero
           aunque el ratón no se haya movido ni un píxel.

           Con la marca aquí, esa distancia de nada contaba como movimiento
           en CADA fotograma: la cinta no se vaciaba nunca, el bucle no se
           dormía nunca, y el rastro se quedaba congelado en la pantalla para
           siempre. Quien lo mira lo llama «se ha quedado pegado»; en la
           consola no hay nada.

           El movimiento de verdad lo apunta `alMover`, que es el único que
           sabe si has movido el ratón. */
      }
    }

    /* ── el recorrido ────────────────────────────────────── */
    if (def.cinta) {
      const salto = Math.hypot(mx - hx[cabeza]!, my - hy[cabeza]!);
      if (!dentro) {
        /* Fuera del ámbito la cinta se retira, igual que dejan de salir
           motas. En el editor el ámbito es la vista previa: si siguiera
           apuntando, al pasar por los mandos quedaría una tira de luz
           cruzando el panel, que no es de nadie. */
        if (guardadas > 0) guardadas--;
      } else if (guardadas > 0 && salto > 260) {
        /* Un SALTO, no un movimiento: volver a la pestaña, entrar otra vez
           en la vista previa por el otro lado, o el ratón reapareciendo en
           la otra punta. Unir los dos puntos dibujaría una raya recta
           atravesando la pantalla. Se empieza de nuevo desde aquí. */
        guardadas = 0;
      } else if (guardadas === 0 || salto > 2.5) {
        cabeza = (cabeza + 1) % TOPE_HIST;
        hx[cabeza] = mx;
        hy[cabeza] = my;
        if (guardadas < TOPE_HIST) guardadas++;
      } else if (ahora - ultimoMov > 60) {
        /* Parado, la cinta SE VACÍA: se va soltando la cola hasta que no
           queda nada. Sin esto se quedaría clavada en la pantalla como una
           mancha, que es lo contrario de un rastro. */
        guardadas--;
      }
    }

    /* ── mover y pintar ──────────────────────────────────── */
    ctx.globalCompositeOperation = def.aditivo ? 'lighter' : 'source-over';
    /* La cinta va DEBAJO: las motas son lo que se ve suelto y tienen que
       quedar por encima de la luz, no tapadas por ella. */
    dibujarCinta();
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

      /* El color de ESTA mota. Con `tono`, girado segun lo vivida que esta:
         la estela sale degradada de principio a fin en vez de ser de un
         color. El halo de abajo usa el mismo — si usara el de fabrica, en
         Iris y en Glitch la mota iria de un color y su luz de otro. */
      let cr = rgb[0], cg = rgb[1], cb = rgb[2];
      if (def.tono) {
        const tinte = girarTono(cr, cg, cb, def.tono * t);
        cr = tinte[0]; cg = tinte[1]; cb = tinte[2];
      }
      ctx.fillStyle = ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alfa.toFixed(3)})`;

      const giroAng = def.forma === 'linea' && !def.giro
        ? Math.atan2(uy, ux)
        : ang[i]! + (def.giro ?? 0) * t * 6.283;

      /* EL HALO, debajo. Una mota sin él es un recorte de papel de color;
         con él, algo que ilumina. Es un círculo más ancho y muy tenue, y
         cuesta un `arc` más: la diferencia entre las dos cosas por menos de
         lo que cuesta añadir una mota. */
      if (def.brillo) {
        const guardaF = ctx.fillStyle, guardaT = ctx.strokeStyle;
        const tenue = `rgba(${cr},${cg},${cb},${(alfa * 0.16).toFixed(3)})`;
        ctx.fillStyle = ctx.strokeStyle = tenue;
        if (def.forma === 'linea') {
          /* El halo sigue a la FORMA. En una raya de treinta píxeles de
             largo, un halo redondo de radio r·brillo es un manchón del
             tamaño de la raya entera: se comía el efecto y lo dejaba en un
             borrón de color. Aquí es la misma raya, más gorda y más tenue. */
          ctx.lineWidth = Math.max(1.5, r * 0.28 * def.brillo);
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(giroAng) * r, y - Math.sin(giroAng) * r);
          ctx.lineTo(x + Math.cos(giroAng) * r, y + Math.sin(giroAng) * r);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r * def.brillo, 0, 6.283);
          ctx.fill();
        }
        ctx.fillStyle = guardaF;
        ctx.strokeStyle = guardaT;
      }

      if (def.forma === 'petalo' && sprite) {
        /* EL VOLTEO.

           Un pétalo que cae no gira como una rueda: se VOLTEA, y al ponerse
           de canto se ve casi como una línea antes de volver a abrirse. Eso
           es lo único que separa «una hoja cayendo» de «un dibujo de hoja
           girando», y sale de aplastar el eje corto con el coseno de su
           propia fase. Nunca llega a cero: de canto sigue viéndose el filo.

           Sin `save`/`restore`: la matriz se escribe entera y se devuelve
           después. Es la misma cuenta que hace `rotate` por dentro, sin la
           pila. */
        const fase = semilla[i]! * 6.283 + t * 6.283 * (def.giro ?? 0.4) * 2.6;
        const q = 0.16 + 0.84 * Math.abs(Math.cos(fase));
        const e = (r * 2.1) / LADO_SPRITE;
        const co = Math.cos(giroAng) * e, si = Math.sin(giroAng) * e;
        ctx.globalAlpha = Math.min(1, alfa);
        ctx.setTransform(
          dpr * co, dpr * si,
          dpr * -si * q, dpr * co * q,
          dpr * x, dpr * y,
        );
        const casilla = Math.min(VARIANTES.length - 1, (semilla[i]! * VARIANTES.length) | 0);
        const lado = sprite.height;
        ctx.drawImage(
          sprite, casilla * lado, 0, lado, lado,
          -LADO_SPRITE / 2, -LADO_SPRITE / 2, LADO_SPRITE, LADO_SPRITE,
        );
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
      } else {
        dibujar(def.forma, x, y, r, giroAng, tam[i]!);
      }
    }
    vivas = quedan;

    /* ── dormir ──────────────────────────────────────────── */
    if (pausada || (vivas === 0 && guardadas === 0 && ahora - ultimoMov > 250)) {
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

  const alRedimensionar = () => {
    medir();
    /* Arrastrar la ventana a otra pantalla cambia la densidad de píxeles, y
       el pétalo está cocido a la de antes: se vería borroso hasta que
       tocaras un ajuste. */
    if (def?.forma === 'petalo') cocerPetalo();
  };
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
    /* El pétalo lleva el color DENTRO, así que cambiar de color es volver a
       cocerlo. Pasa cuando arrastras el selector, no sesenta veces por
       segundo. */
    if (def?.forma === 'petalo') cocerPetalo();
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
