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
export async function ponerCursorNativo(
  img: string,
  lado: number | null,
  destino: HTMLElement,
): Promise<CursorNativo | null> {
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
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2);
  const antes = destino.style.getPropertyValue('cursor');
  const prioridadAntes = destino.style.getPropertyPriority('cursor');

  /* `important` porque la hoja del perfil dice `cursor:none !important` para
     esconder el puntero cuando lo dibujábamos nosotros. Un estilo en línea
     sin prioridad pierde contra eso, y el resultado sería lo peor de los dos
     mundos: sin puntero del sistema y sin `<div>` tampoco. */
  destino.style.setProperty('cursor', `url("${datos}") ${cx} ${cy}, auto`, 'important');

  return {
    quitar() {
      if (antes) destino.style.setProperty('cursor', antes, prioridadAntes);
      else destino.style.removeProperty('cursor');
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
