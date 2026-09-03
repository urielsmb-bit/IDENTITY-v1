import type { ReactNode } from 'react';

/**
 * Los dibujos de las opciones del editor.
 *
 * Antes casi todo se elegía con pastillas de texto: «Normal · Split ·
 * Minimal», «Izquierda · Centro · Derecha». Para elegir había que leer las
 * cuatro, imaginarse cada una y decidir. Estas opciones **tienen forma**, y
 * enseñarla se lee de un vistazo en vez de traducirse en la cabeza.
 *
 * Viven aquí y no en `data/themes.ts` a propósito: allí hay datos, y un
 * catálogo que exporta JSX deja de poder usarse fuera de React. El puente es
 * el id, que es lo único que las dos partes comparten.
 *
 * Todos comparten lienzo —54×34— y trazo, para que una fila de tarjetas se
 * lea como una fila y no como un muestrario de estilos distintos.
 */

/** Pares y ternas de coordenadas. Tipadas como tuplas porque el proyecto
 *  corre con `noUncheckedIndexedAccess`: sin esto, desestructurar un
 *  `number[][]` da `number | undefined` en cada componente. */
type P2 = readonly [number, number];
type P3 = readonly [number, number, number];

function L(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 54 34"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** El marco de la tarjeta, para los dibujos que representan una pieza dentro. */
const marco = <rect x="3" y="3" width="48" height="28" rx="2.5" strokeWidth="1.4" opacity=".3" />;

/* ---------------------------------------------------------------- */

export const DIBUJOS: Record<string, Record<string, ReactNode>> = {
  /* ---- forma del avatar: se dibuja la forma, sin rodeos ---- */
  AV_SHAPES: {
    square: L(<rect x="19" y="7" width="16" height="16" fill="currentColor" stroke="none" />),
    rounded: L(<rect x="19" y="7" width="16" height="16" rx="5" fill="currentColor" stroke="none" />),
    circle: L(<circle cx="27" cy="15" r="8" fill="currentColor" stroke="none" />),
    // «Imagen» es sin recorte: se enseña un encuadre de foto.
    bare: L(
      <>
        <rect x="16" y="6" width="22" height="18" rx="1.5" strokeWidth="1.6" />
        <path d="M16 20l6-5 4.5 3.5L31 15l7 5.5" strokeWidth="1.6" />
        <circle cx="22" cy="11.5" r="1.7" fill="currentColor" stroke="none" />
      </>,
    ),
  },

  /* ---- dónde cae el avatar dentro de la tarjeta ---- */
  AV_POS: {
    left: L(
      <>
        {marco}
        <circle cx="14" cy="13" r="5" fill="currentColor" stroke="none" />
        <path d="M9 23h20M9 27h11" strokeWidth="1.8" opacity=".75" />
      </>,
    ),
    center: L(
      <>
        {marco}
        <circle cx="27" cy="13" r="5" fill="currentColor" stroke="none" />
        <path d="M17 23h20M22 27h11" strokeWidth="1.8" opacity=".75" />
      </>,
    ),
    right: L(
      <>
        {marco}
        <circle cx="40" cy="13" r="5" fill="currentColor" stroke="none" />
        <path d="M25 23h20M33 27h11" strokeWidth="1.8" opacity=".75" />
      </>,
    ),
    // «Nombre al lado»: el texto deja de ir debajo y se pone a la derecha.
    side: L(
      <>
        {marco}
        <circle cx="15" cy="17" r="6.5" fill="currentColor" stroke="none" />
        <path d="M26 14h18M26 21h12" strokeWidth="1.8" opacity=".75" />
      </>,
    ),
  },

  /* ---- alineación del texto: tres renglones como quedarían ---- */
  ALIGNS: {
    left: L(<path d="M8 10h38M8 17h25M8 24h32" />),
    center: L(<path d="M8 10h38M14 17h25M11 24h32" />),
    right: L(<path d="M8 10h38M21 17h25M14 24h32" />),
  },

  /* ---- columna o lienzo ---- */
  LAYOUT_MODES: {
    stack: L(
      <>
        <rect x="14" y="5" width="26" height="6" rx="2" fill="currentColor" stroke="none" />
        <rect x="14" y="14" width="26" height="6" rx="2" fill="currentColor" stroke="none" opacity=".6" />
        <rect x="14" y="23" width="26" height="6" rx="2" fill="currentColor" stroke="none" opacity=".35" />
      </>,
    ),
    free: L(
      <>
        <rect x="5" y="4" width="20" height="7" rx="2" fill="currentColor" stroke="none" />
        <rect x="30" y="10" width="18" height="7" rx="2" fill="currentColor" stroke="none" opacity=".6" />
        <rect x="11" y="21" width="24" height="7" rx="2" fill="currentColor" stroke="none" opacity=".35" />
      </>,
    ),
  },

  /* ---- la caja: se dibuja la caja ---- */
  SURFACES: {
    none: L(
      <>
        <rect x="8" y="6" width="38" height="22" rx="3" strokeWidth="1.4" strokeDasharray="3 3" opacity=".45" />
        <path d="M17 14h20M17 21h12" strokeWidth="1.8" />
      </>,
    ),
    glass: L(
      <>
        <rect x="8" y="6" width="38" height="22" rx="3" fill="currentColor" fillOpacity=".16" strokeWidth="1.4" opacity=".8" />
        <path d="M17 14h20M17 21h12" strokeWidth="1.8" />
      </>,
    ),
    solid: L(
      <>
        <rect x="8" y="6" width="38" height="22" rx="3" fill="currentColor" fillOpacity=".55" stroke="none" />
        <path d="M17 14h20M17 21h12" strokeWidth="1.8" />
      </>,
    ),
    outline: L(
      <>
        <rect x="8" y="6" width="38" height="22" rx="3" strokeWidth="2.2" />
        <path d="M17 14h20M17 21h12" strokeWidth="1.8" opacity=".7" />
      </>,
    ),
    glow: L(
      <>
        <rect x="5" y="3" width="44" height="28" rx="5" fill="currentColor" fillOpacity=".13" stroke="none" />
        <rect x="8" y="6" width="38" height="22" rx="3" strokeWidth="1.6" />
        <path d="M17 14h20M17 21h12" strokeWidth="1.8" opacity=".7" />
      </>,
    ),
    // Sólo en los bloques: «lo que diga el perfil».
    inherit: L(
      <>
        <path d="M27 4v9" strokeWidth="1.6" opacity=".6" />
        <path d="M23.5 10l3.5 3.5 3.5-3.5" strokeWidth="1.6" opacity=".6" />
        <rect x="10" y="16" width="34" height="13" rx="3" strokeWidth="1.6" strokeDasharray="3 3" />
      </>,
    ),
  },

  /* ---- iconos de redes, en su estilo ---- */
  SOCIAL_STYLES: {
    icons: L(
      <>
        <circle cx="17" cy="17" r="4" fill="currentColor" stroke="none" />
        <circle cx="27" cy="17" r="4" fill="currentColor" stroke="none" />
        <circle cx="37" cy="17" r="4" fill="currentColor" stroke="none" />
      </>,
    ),
    boxed: L(
      <>
        {[15, 27, 39].map((x) => (
          <rect key={x} x={x - 5} y="11" width="11" height="12" rx="3" strokeWidth="1.6" />
        ))}
        {[15, 27, 39].map((x) => (
          <circle key={`p${x}`} cx={x} cy="17" r="2.2" fill="currentColor" stroke="none" />
        ))}
      </>,
    ),
    glow: L(
      <>
        {[16, 27, 38].map((x) => (
          <circle key={`h${x}`} cx={x} cy="17" r="7" fill="currentColor" fillOpacity=".18" stroke="none" />
        ))}
        {[16, 27, 38].map((x) => (
          <circle key={x} cx={x} cy="17" r="3.4" fill="currentColor" stroke="none" />
        ))}
      </>,
    ),
    text: L(<path d="M10 17h9M24 17h7M36 17h8" strokeWidth="2.4" />),
  },

  /* ---- insignias, mismo juego ---- */
  BADGE_STYLES: {
    icons: L(
      <>
        {[17, 27, 37].map((x) => (
          <path key={x} d={`M${x} 12l3.4 5-3.4 5-3.4-5z`} fill="currentColor" stroke="none" />
        ))}
      </>,
    ),
    plain: L(
      <>
        <path d="M15 12l3.4 5-3.4 5-3.4-5z" fill="currentColor" stroke="none" />
        <path d="M22 17h9" strokeWidth="2.2" />
        <path d="M38 12l3.4 5-3.4 5-3.4-5z" fill="currentColor" stroke="none" />
      </>,
    ),
    text: L(<path d="M11 17h11M27 17h6M38 17h6" strokeWidth="2.4" />),
    boxed: L(
      <>
        {[15, 27, 39].map((x) => (
          <rect key={x} x={x - 6} y="11" width="12" height="12" rx="3" strokeWidth="1.6" />
        ))}
        {[15, 27, 39].map((x) => (
          <path key={`d${x}`} d={`M${x} 14l2.4 3-2.4 3-2.4-3z`} fill="currentColor" stroke="none" />
        ))}
      </>,
    ),
    default: L(
      <>
        {[15, 27, 39].map((x) => (
          <rect key={x} x={x - 6} y="11" width="12" height="12" rx="3" fill="currentColor" fillOpacity=".4" stroke="none" />
        ))}
        {[15, 27, 39].map((x) => (
          <path key={`d${x}`} d={`M${x} 14l2.4 3-2.4 3-2.4-3z`} fill="currentColor" stroke="none" />
        ))}
      </>,
    ),
  },

  /* ---- de dónde entra la pieza ---- */
  ANIM_DIRS: {
    up: L(
      <>
        <rect x="16" y="4" width="22" height="9" rx="2" strokeWidth="1.5" opacity=".5" />
        <path d="M27 29V17M22 22l5-5 5 5" />
      </>,
    ),
    down: L(
      <>
        <rect x="16" y="21" width="22" height="9" rx="2" strokeWidth="1.5" opacity=".5" />
        <path d="M27 5v12M22 12l5 5 5-5" />
      </>,
    ),
    left: L(
      <>
        <rect x="4" y="9" width="9" height="16" rx="2" strokeWidth="1.5" opacity=".5" />
        <path d="M45 17H21M26 12l-5 5 5 5" />
      </>,
    ),
    right: L(
      <>
        <rect x="41" y="9" width="9" height="16" rx="2" strokeWidth="1.5" opacity=".5" />
        <path d="M9 17h24M28 12l5 5-5 5" />
      </>,
    ),
  },

  /* ---- la curva, dibujada ----
     Cada trazo son los puntos de control de su propia `cubic-bezier`
     llevados al lienzo: la tarjeta ES la definicion de la curva. */
  ANIM_EASINGS: {
    suave: L(<path d="M8 28C14.1 6 19.4 6 46 6" strokeWidth="2.2" />),
    lineal: L(<path d="M8 28L46 6" strokeWidth="2.2" />),
    entrada: L(<path d="M8 28C28.9 26.7 33.8 23.8 46 6" strokeWidth="2.2" />),
    salida: L(<path d="M8 28C16.4 14.6 21.7 6 46 6" strokeWidth="2.2" />),
    muelle: L(<path d="M8 28C19 3 25 1 31 5c5 3.5 6 3 8 1.6 2-1.4 4-1.6 7-.6" strokeWidth="2.2" />),
  },

  /* ---- partículas del fondo ---- */
  PARTICLES: {
    none: L(<path d="M14 24L40 10" strokeWidth="1.6" opacity=".55" />),
    stars: L(
      <>
        <path d="M14 9l1.4 3 3 1.4-3 1.4L14 18l-1.4-3.2-3-1.4 3-1.4z" fill="currentColor" stroke="none" />
        <path d="M35 16l1.1 2.4L38.5 19.5l-2.4 1.1L35 23l-1.1-2.4-2.4-1.1 2.4-1.1z" fill="currentColor" stroke="none" />
        <circle cx="43" cy="10" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="22" cy="25" r="1.2" fill="currentColor" stroke="none" />
      </>,
    ),
    snow: L(
      <>
        {([[13, 9], [27, 14], [40, 8], [20, 23], [34, 25], [46, 20]] as P2[]).map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="currentColor" stroke="none" opacity=".85" />
        ))}
      </>,
    ),
    embers: L(
      <>
        {([[16, 25], [25, 19], [33, 24], [41, 14], [21, 11]] as P2[]).map(([x, y], i) => (
          <path key={i} d={`M${x} ${y}c1.2-2 .4-3 0-3.6.6.4 2.4 1.4 2.4 3.2A2.4 2.4 0 0 1 ${x} ${y}z`} fill="currentColor" stroke="none" />
        ))}
      </>,
    ),
    matrix: L(
      <>
        <path d="M13 4v10M22 8v13M31 4v9M40 10v12" strokeWidth="2.6" strokeDasharray="3 3" />
      </>,
    ),
    bubbles: L(
      <>
        <circle cx="16" cy="22" r="4.5" strokeWidth="1.6" />
        <circle cx="29" cy="13" r="3.2" strokeWidth="1.6" />
        <circle cx="40" cy="23" r="2.4" strokeWidth="1.6" />
      </>,
    ),
    grid: L(
      <>
        <path d="M8 12h38M8 22h38M18 5v24M36 5v24" strokeWidth="1.4" opacity=".75" />
      </>,
    ),
  },

  /* ---- el cursor ---- */
  CURSORS: {
    default: L(<path d="M22 7l11 20-4.6-1.4-2.6 5.4L22 24z" fill="currentColor" stroke="none" />),
    dot: L(<circle cx="27" cy="17" r="4" fill="currentColor" stroke="none" />),
    ring: L(<circle cx="27" cy="17" r="7" strokeWidth="2.4" />),
    glow: L(
      <>
        <circle cx="27" cy="17" r="10" fill="currentColor" fillOpacity=".16" stroke="none" />
        <circle cx="27" cy="17" r="4.5" fill="currentColor" stroke="none" />
      </>,
    ),
    blade: L(<path d="M19 26L35 8" strokeWidth="3.4" />),
  },

  /* ---- la estela: forma y densidad, que es lo que las separa ---- */
  TRAIL_FX: {
    chispas: L(
      <>
        <path d="M40 11l1.6 3.4 3.4 1.6-3.4 1.6L40 21l-1.6-3.4-3.4-1.6 3.4-1.6z" fill="currentColor" stroke="none" />
        <path d="M26 20l1 2.2 2.2 1-2.2 1L26 26.4l-1-2.2-2.2-1 2.2-1z" fill="currentColor" stroke="none" opacity=".7" />
        <path d="M13 12l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="currentColor" stroke="none" opacity=".45" />
      </>,
    ),
    puntos: L(
      <>
        {([[42, 12, 3.4], [33, 17, 2.7], [24, 21, 2.1], [16, 24, 1.5], [10, 26, 1]] as P3[]).map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="currentColor" stroke="none" opacity={1 - i * 0.17} />
        ))}
      </>,
    ),
    polvo: L(
      <>
        {([[43, 11, 1.8], [36, 14, 1.4], [30, 19, 1.2], [24, 16, 1], [19, 22, .9], [13, 20, .8], [9, 25, .7]] as P3[]).map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="currentColor" stroke="none" opacity={0.9 - i * 0.11} />
        ))}
      </>,
    ),
    burbujas: L(
      <>
        <circle cx="41" cy="12" r="4" strokeWidth="1.5" />
        <circle cx="30" cy="18" r="3" strokeWidth="1.5" opacity=".75" />
        <circle cx="20" cy="23" r="2.2" strokeWidth="1.5" opacity=".5" />
        <circle cx="12" cy="26" r="1.5" strokeWidth="1.5" opacity=".35" />
      </>,
    ),
    fuego: L(
      <>
        {([[42, 12, 1], [34, 16, .82], [27, 20, .64], [20, 23, .46], [13, 26, .3]] as P3[]).map(([x, y, o], i) => (
          <path key={i} d={`M${x} ${y}c1.4-2.2.5-3.4 0-4 .7.4 2.8 1.6 2.8 3.6A2.8 2.8 0 0 1 ${x} ${y}z`} fill="currentColor" stroke="none" opacity={o} />
        ))}
      </>,
    ),
    nieve: L(
      <>
        {([[42, 10], [35, 15], [28, 13], [22, 20], [15, 18], [10, 25]] as P2[]).map(([x, y], i) => (
          <g key={i} opacity={0.95 - i * 0.13}>
            <path d={`M${x - 2.6} ${y}h5.2M${x} ${y - 2.6}v5.2`} strokeWidth="1.4" />
          </g>
        ))}
      </>,
    ),
  },

  /* ---- el reproductor ---- */
  MUSIC_STYLES: {
    minimal: L(
      <>
        <path d="M22 10l10 7-10 7z" fill="currentColor" stroke="none" />
      </>,
    ),
    compact: L(
      <>
        <rect x="7" y="11" width="40" height="12" rx="4" strokeWidth="1.6" />
        <path d="M15 14l5 3-5 3z" fill="currentColor" stroke="none" />
        <path d="M25 17h15" strokeWidth="1.6" opacity=".6" />
      </>,
    ),
    card: L(
      <>
        <rect x="9" y="5" width="36" height="24" rx="3" strokeWidth="1.6" />
        <rect x="13" y="9" width="13" height="13" rx="2" fill="currentColor" fillOpacity=".45" stroke="none" />
        <path d="M30 12h11M30 18h7" strokeWidth="1.6" opacity=".7" />
      </>,
    ),
    transparent: L(
      <>
        <path d="M16 12l6 5-6 5z" fill="currentColor" stroke="none" />
        <path d="M29 11v12M35 13v8M41 15v4" strokeWidth="2.2" opacity=".65" />
      </>,
    ),
  },

  /* ---- animaciones de entrada: el gesto, no el nombre ---- */
  BLOCK_ANIMS: {
    '': L(
      <>
        <path d="M27 4v9" strokeWidth="1.6" opacity=".6" />
        <path d="M23.5 10l3.5 3.5 3.5-3.5" strokeWidth="1.6" opacity=".6" />
        <rect x="12" y="17" width="30" height="11" rx="3" strokeWidth="1.6" strokeDasharray="3 3" />
      </>,
    ),
    none: L(<rect x="12" y="11" width="30" height="12" rx="3" strokeWidth="1.8" />),
    fade: L(
      <>
        <rect x="10" y="11" width="10" height="12" rx="2.5" fill="currentColor" stroke="none" opacity=".2" />
        <rect x="22" y="11" width="10" height="12" rx="2.5" fill="currentColor" stroke="none" opacity=".5" />
        <rect x="34" y="11" width="10" height="12" rx="2.5" fill="currentColor" stroke="none" />
      </>,
    ),
    rise: L(
      <>
        <rect x="17" y="6" width="20" height="9" rx="2.5" strokeWidth="1.8" />
        <path d="M27 29v-8M22.5 25.5L27 21l4.5 4.5" strokeWidth="1.8" />
      </>,
    ),
    slide: L(
      <>
        <rect x="34" y="10" width="16" height="14" rx="2.5" strokeWidth="1.8" />
        <path d="M6 17h20M21 12l5 5-5 5" strokeWidth="1.8" opacity=".8" />
      </>,
    ),
    zoom: L(
      <>
        <rect x="21" y="13" width="12" height="8" rx="2" fill="currentColor" stroke="none" />
        <path d="M12 8l-4-4M42 8l4-4M12 26l-4 4M42 26l4 4" strokeWidth="1.8" opacity=".8" />
      </>,
    ),
    blur: L(
      <>
        <rect x="10" y="11" width="12" height="12" rx="3" fill="currentColor" stroke="none" opacity=".22" />
        <rect x="21" y="11" width="12" height="12" rx="3" fill="currentColor" stroke="none" opacity=".5" />
        <rect x="32" y="11" width="12" height="12" rx="3" strokeWidth="1.8" />
      </>,
    ),
    rotate: L(
      <>
        <path d="M39 17a12 12 0 1 0-4 9" strokeWidth="2" />
        <path d="M35 20v6h6" strokeWidth="2" />
      </>,
    ),
    bounce: L(
      <>
        <circle cx="14" cy="9" r="3.4" fill="currentColor" stroke="none" />
        <path d="M14 14c0 6 6 10 10 6s4-8 8-4 4 8 8 6" strokeWidth="1.8" opacity=".75" />
      </>,
    ),
    flip: L(
      <>
        <path d="M19 8l-6 5 6 5z" fill="currentColor" stroke="none" opacity=".45" />
        <path d="M35 8l6 5-6 5z" fill="currentColor" stroke="none" />
        <path d="M27 5v24" strokeWidth="1.6" strokeDasharray="3 3" opacity=".6" />
      </>,
    ),
    // Solo de la superficie: las piezas entran una detras de otra.
    stagger: L(
      <>
        <rect x="8" y="6" width="34" height="5" rx="2" fill="currentColor" stroke="none" />
        <rect x="8" y="15" width="34" height="5" rx="2" fill="currentColor" stroke="none" opacity=".6" />
        <rect x="8" y="24" width="34" height="5" rx="2" fill="currentColor" stroke="none" opacity=".28" />
        <path d="M46 8v3M46 17v3M46 26v3" strokeWidth="1.6" opacity=".5" />
      </>,
    ),
    glitch: L(
      <>
        <rect x="12" y="8" width="26" height="6" rx="1.5" fill="currentColor" stroke="none" opacity=".45" />
        <rect x="18" y="15" width="26" height="6" rx="1.5" fill="currentColor" stroke="none" />
        <rect x="9" y="22" width="26" height="6" rx="1.5" fill="currentColor" stroke="none" opacity=".65" />
      </>,
    ),
  },
};
