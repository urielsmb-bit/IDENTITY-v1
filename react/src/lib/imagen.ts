/**
 * Preparación de imágenes en el navegador antes de guardarlas.
 *
 * Una foto de móvil son 4 MB y 4000px. Un avatar se ve a 112px: subir el
 * original llena la cuota de localStorage, revienta el límite de tamaño de la
 * fila en la base de datos y tarda una eternidad en cargar. Aquí se reduce y
 * se recomprime antes de que salga de la máquina.
 */

export interface OpcionesImagen {
  /** Lado máximo en píxeles. El aspecto se conserva. */
  lado?: number;
  /** Calidad JPEG/WebP, de 0 a 1 */
  calidad?: number;
  /** Peso máximo aceptado del archivo de entrada, en MB */
  maxEntradaMB?: number;
  /** Tope aparte para los animados, que no se pueden recomprimir */
  maxAnimadoMB?: number;
}

export interface ImagenLista {
  blob: Blob;
  dataUri: string;
  extension: string;
  ancho: number;
  alto: number;
  /** Peso final en KB, para poder avisar */
  pesoKB: number;
  /** true si se guardó sin tocar para conservar la animación */
  animado: boolean;
}

const TIPOS_OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

/**
 * Formatos que hay que dejar pasar tal cual.
 *
 * Un GIF animado dibujado en un canvas sale convertido en un solo fotograma:
 * el canvas no sabe de animación y no existe forma de escribir WebP animado
 * desde el navegador. Así que un GIF se guarda entero o no se guarda.
 */
const ANIMADOS = ['image/gif'];

/** Formato de salida: WebP si el navegador lo sabe escribir, si no JPEG. */
function formatoSalida(): { mime: string; extension: string } {
  const lienzo = document.createElement('canvas');
  lienzo.width = 1;
  lienzo.height = 1;
  const webp = lienzo.toDataURL('image/webp');
  return webp.startsWith('data:image/webp')
    ? { mime: 'image/webp', extension: 'webp' }
    : { mime: 'image/jpeg', extension: 'jpg' };
}

function cargar(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la imagen. ¿Está completa el archivo?'));
    };
    img.src = url;
  });
}

function aDataUri(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const fr = new FileReader();
    fr.onload = () => resolver(String(fr.result));
    fr.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    fr.readAsDataURL(blob);
  });
}

/**
 * Reduce y recomprime una imagen. Lanza un Error con mensaje en claro si el
 * archivo no sirve, para poder enseñarlo tal cual en la interfaz.
 *
 * Los GIF salen intactos: recomprimirlos los dejaría quietos.
 */
export async function prepararImagen(
  archivo: File,
  opciones: OpcionesImagen = {},
): Promise<ImagenLista> {
  const { lado = 512, calidad = 0.85, maxEntradaMB = 12, maxAnimadoMB = 3 } = opciones;

  if (!TIPOS_OK.includes(archivo.type)) {
    throw new Error('Formato no admitido. Usa PNG, JPG, WebP, GIF o AVIF.');
  }
  if (archivo.size > maxEntradaMB * 1024 * 1024) {
    throw new Error(`La imagen pesa más de ${maxEntradaMB} MB. Elige una más ligera.`);
  }

  // ── GIF: se conserva tal cual para no perder la animación ──
  if (ANIMADOS.includes(archivo.type)) {
    if (archivo.size > maxAnimadoMB * 1024 * 1024) {
      throw new Error(
        `Ese GIF pesa ${Math.round(archivo.size / 1024 / 1024)} MB. El tope es ${maxAnimadoMB} MB, ` +
          'porque un GIF no se puede comprimir sin dejarlo quieto.',
      );
    }
    const medidas = await cargar(archivo);
    return {
      blob: archivo,
      dataUri: await aDataUri(archivo),
      extension: 'gif',
      ancho: medidas.naturalWidth,
      alto: medidas.naturalHeight,
      pesoKB: Math.round(archivo.size / 1024),
      animado: true,
    };
  }

  const img = await cargar(archivo);

  // Nunca se agranda: escalar hacia arriba solo añade peso y emborrona.
  const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
  const alto = Math.max(1, Math.round(img.naturalHeight * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Este navegador no permite procesar la imagen.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, ancho, alto);

  const { mime, extension } = formatoSalida();

  const blob = await new Promise<Blob>((resolver, rechazar) => {
    lienzo.toBlob(
      (b) => (b ? resolver(b) : rechazar(new Error('No se pudo comprimir la imagen.'))),
      mime,
      calidad,
    );
  });

  return {
    blob,
    dataUri: await aDataUri(blob),
    extension,
    ancho,
    alto,
    pesoKB: Math.round(blob.size / 1024),
    animado: false,
  };
}
