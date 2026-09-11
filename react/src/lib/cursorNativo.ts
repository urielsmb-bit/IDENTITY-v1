/**
 * El cursor de imagen, dibujado por el SISTEMA y no por nosotros.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO NO PUEDE TENER RETRASO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Hasta ahora sharee escondía el puntero (`cursor: none`) y dibujaba un
 * `<div>` que lo perseguía. Por muy fino que esté ese seguimiento —y estaba
 * fino: la posición se escribe en el propio evento, desde `pointerrawupdate`,
 * sin esperar al fotograma— un `<div>` va SIEMPRE al menos un fotograma por
 * detrás de tu mano. El puntero de verdad lo pinta el compositor del sistema
 * operativo fuera de la página; el nuestro tiene que esperar a que la página
 * se componga. Eso son ocho o dieciséis milisegundos que no se pueden quitar
 * afinando, porque no son un fallo: son la arquitectura.
 *
 * `cursor: url(...)` no tiene ese problema porque no hay nada que perseguir:
 * ES el puntero. Lo mueve el sistema, a la velocidad del ratón, aunque la
 * pestaña esté ocupada.
 *
 * Se pierden dos cosas y hay que decirlas:
 *
 *   · los GIF no se animan. Ningún navegador anima un cursor;
 *   · el tamaño máximo es de 128 px. El mando llega hasta 96, así que
 *     entran todos.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ PASA POR UN LIENZO
 * ────────────────────────────────────────────────────────────────────────
 *
 * `cursor: url()` usa la imagen a su tamaño natural y no hay forma de
 * escalarla desde CSS. Una foto de 1024 px no es un cursor grande: es un
 * cursor que el navegador DESCARTA por pasarse de 128, y entonces vuelve la
 * flecha de siempre sin decir nada.
 *
 * Así que la imagen se redibuja en un lienzo al tamaño pedido. Eso además
 * hace que el mando de tamaño signifique algo.
 *
 * Si el lienzo se contamina —imagen de otro dominio sin CORS—, `toDataURL`
 * lanza y esto devuelve `null`. Quien llama entiende ese `null` como «no se
 * pudo» y vuelve al cursor de `<div>`, que funciona siempre. No es lo mismo
 * fallar que quedarse sin cursor.
 */

/** Lo que admite un `cursor: url()`. Por encima, el navegador lo ignora. */
const TOPE = 128;

export interface CursorNativo {
  /** Devuelve el cursor de antes. */
  quitar(): void;
}

/**
 * Pone `img` como puntero de `destino`.
 *
 * Devuelve `null` si no se pudo: la imagen no cargó, o el lienzo quedó
 * contaminado y no se puede leer.
 */
export async function cursorDeImagen(
  img: string,
  lado: number | null,
): Promise<FormaCursor | null> {
  if (!img || typeof document === 'undefined') return null;

  const foto = await cargar(img);
  if (!foto) return null;

  const ancho = foto.naturalWidth || TOPE;
  const alto = foto.naturalHeight || TOPE;
  if (!ancho || !alto) return null;

  /* El lado pedido, o el natural si nadie pidió uno. Y nunca por encima del
     tope: un cursor de 200 px no es grande, es un cursor que no existe. */
  const pedido = Math.min(TOPE, Math.max(8, lado || Math.max(ancho, alto)));
  const escala = pedido / Math.max(ancho, alto);
  const w = Math.max(1, Math.round(ancho * escala));
  const h = Math.max(1, Math.round(alto * escala));

  let datos: string;
  try {
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(foto, 0, 0, w, h);
    datos = lienzo.toDataURL('image/png');
  } catch {
    /* Lienzo contaminado: la imagen viene de otro dominio y sin permiso para
       leerla. No es un error que contar a nadie; es volver al otro camino. */
    return null;
  }
  if (!datos || datos.length < 32) return null;

  /* Centrado en la punta, igual que el cursor de `<div>`: su margen negativo
     era media medida. Un cursor cuyo punto activo está en la esquina se
     siente descolocado aunque se vea bien. */
  return { normal: `url("${datos}") ${Math.round(w / 2)} ${Math.round(h / 2)}` };
}

/**
 * Pone una forma como puntero de `destino`.
 *
 * No se escribe `cursor` directamente: se escriben dos VARIABLES, y las
 * reglas de `profile.css` las usan. Eso es lo que permite que el aro crezca
 * al pasar por encima de un enlace sin una sola línea de JavaScript —lo hace
 * un selector `:is(a, button, …)`—, cuando antes eso era un `closest()` en
 * cada movimiento del ratón.
 */
export function aplicarForma(destino: HTMLElement, forma: FormaCursor): CursorNativo {
  destino.style.setProperty('--cur-nat', forma.normal);
  if (forma.encima) destino.style.setProperty('--cur-nat-hot', forma.encima);
  else destino.style.removeProperty('--cur-nat-hot');
  return {
    quitar() {
      destino.style.removeProperty('--cur-nat');
      destino.style.removeProperty('--cur-nat-hot');
    },
  };
}

function cargar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((listo) => {
    const i = new Image();
    /* Sin esto, una imagen de otro dominio carga igual pero contamina el
       lienzo y `toDataURL` lanza. Con esto, si el servidor manda las
       cabeceras —el nuestro las manda— el lienzo se puede leer. */
    i.crossOrigin = 'anonymous';
    i.onload = () => listo(i);
    i.onerror = () => {
      /* Segundo intento sin CORS: hay imágenes que se niegan a servirse con
         `crossOrigin` y cargan perfectamente sin él. No se podrá leer el
         lienzo, pero eso ya lo resuelve el `catch` de arriba. */
      const j = new Image();
      j.onload = () => listo(j);
      j.onerror = () => listo(null);
      j.src = src;
    };
    i.src = src;
  });
}

/* ══════════════════════════════════════════════════════════════════════
   LAS FORMAS DE SIEMPRE, TAMBIÉN NATIVAS
   ══════════════════════════════════════════════════════════════════════

   El punto, el aro, la hoja y el halo eran `<div>` con CSS, y por tanto
   arrastraban el mismo fotograma de retraso que la imagen. Pero son figuras
   que se pueden DIBUJAR, así que se dibujan una vez en un lienzo y pasan a
   ser el puntero de verdad.

   El aro es el único que reacciona —crece al pasar por encima de un enlace—
   y eso tampoco necesita JavaScript: se generan sus DOS versiones y una
   regla de CSS elige. Antes eso lo hacía un `closest()` en cada movimiento
   del ratón; ahora lo hace el selector `:is(a, button, …)`.

   El que no puede ser nativo es el glitch: su temblor se calcula a partir de
   la velocidad, fotograma a fotograma. Un cursor del sistema es una imagen
   fija; no hay forma de moverla desde la página. Ése sigue con `<div>`.
   ══════════════════════════════════════════════════════════════════════ */

/** Un cursor listo para meter en `cursor:`, con su punto activo. */
export interface FormaCursor {
  /** El normal. */
  normal: string;
  /** El de encima de un enlace, si esa forma cambia. */
  encima?: string;
}

/** Las formas que se saben dibujar. El glitch no está y es a propósito. */
export const FORMAS_NATIVAS = new Set(['dot', 'ring', 'blade', 'glow']);

function aCursor(lienzo: HTMLCanvasElement, cx: number, cy: number): string | null {
  try {
    const d = lienzo.toDataURL('image/png');
    return d && d.length > 32 ? `url("${d}") ${Math.round(cx)} ${Math.round(cy)}` : null;
  } catch {
    return null;
  }
}

function lienzoDe(lado: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const ctx = c.getContext('2d');
  return ctx ? [c, ctx] : null;
}

/**
 * Dibuja una de las formas de siempre como cursor del sistema.
 *
 * `color` es el acento del perfil ya resuelto: aquí no se puede leer una
 * variable de CSS, hay que traerla hecha.
 */
export function formaNativa(tipo: string, color: string): FormaCursor | null {
  if (typeof document === 'undefined' || !FORMAS_NATIVAS.has(tipo)) return null;

  if (tipo === 'dot') {
    /* Nueve píxeles de punto y catorce de resplandor alrededor: la caja
       tiene que dar para los dos o el resplandor sale cortado en cuadrado. */
    const L = 40;
    const par = lienzoDe(L);
    if (!par) return null;
    const [c, x] = par;
    const g = x.createRadialGradient(L / 2, L / 2, 0, L / 2, L / 2, L / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.22, color);
    g.addColorStop(1, 'transparent');
    x.globalAlpha = 0.55;
    x.fillStyle = g;
    x.fillRect(0, 0, L, L);
    x.globalAlpha = 1;
    x.fillStyle = color;
    x.beginPath();
    x.arc(L / 2, L / 2, 4.5, 0, Math.PI * 2);
    x.fill();
    const u = aCursor(c, L / 2, L / 2);
    return u ? { normal: u } : null;
  }

  if (tipo === 'ring') {
    const aro = (lado: number, relleno: boolean) => {
      const L = lado + 6;
      const par = lienzoDe(L);
      if (!par) return null;
      const [c, x] = par;
      if (relleno) {
        x.fillStyle = 'rgba(255,255,255,.08)';
        x.beginPath();
        x.arc(L / 2, L / 2, lado / 2, 0, Math.PI * 2);
        x.fill();
      }
      x.strokeStyle = color;
      x.lineWidth = 1.5;
      x.beginPath();
      x.arc(L / 2, L / 2, lado / 2 - 0.75, 0, Math.PI * 2);
      x.stroke();
      return aCursor(c, L / 2, L / 2);
    };
    const normal = aro(32, false);
    const encima = aro(48, true);
    return normal ? { normal, ...(encima ? { encima } : {}) } : null;
  }

  if (tipo === 'blade') {
    const L = 24;
    const par = lienzoDe(L);
    if (!par) return null;
    const [c, x] = par;
    /* El mismo polígono que el `clip-path` del CSS, sobre 22 px y con el
       punto activo donde lo ponía su margen: dos píxeles dentro. */
    const p: Array<[number, number]> = [[0, 0], [22, 13.64], [9.68, 14.52], [6.6, 22]];
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(p[0]![0], p[0]![1]);
    for (let i = 1; i < p.length; i++) x.lineTo(p[i]![0], p[i]![1]);
    x.closePath();
    x.fill();
    const u = aCursor(c, 2, 2);
    return u ? { normal: u } : null;
  }

  /* glow.
     Medía 220 px y el tope de un cursor del sistema son 128: por encima, el
     navegador lo descarta sin avisar y vuelve la flecha. Así que se dibuja a
     128. Se nota poco —el degradado ya se apagaba del todo al 68 %, o sea
     hacia los 150— y a cambio deja de haber retraso. */
  const L = 128;
  const par = lienzoDe(L);
  if (!par) return null;
  const [c, x] = par;
  const g = x.createRadialGradient(L / 2, L / 2, 0, L / 2, L / 2, L / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.68, 'transparent');
  g.addColorStop(1, 'transparent');
  x.globalAlpha = 0.26;
  x.fillStyle = g;
  x.fillRect(0, 0, L, L);
  const u = aCursor(c, L / 2, L / 2);
  return u ? { normal: u } : null;
}
