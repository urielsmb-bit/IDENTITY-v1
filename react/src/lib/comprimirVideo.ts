/**
 * Encoger un vídeo de fondo antes de subirlo, en el navegador de quien sube.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE HACE FALTA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Vimeo recomprimía lo que le echaras. R2 no: guarda el archivo tal cual y
 * lo sirve tal cual. La primera subida real lo enseñó sin piedad —medido
 * en producción:
 *
 *     3840 × 1632 · 41,5 MB · 7,7 s de descarga
 *
 * Contra los 8 MB a 1080p de guns.lol. Y eso se paga dos veces:
 *
 *   · en datos    cada visitante se baja 41 MB, muchos desde el móvil
 *   · en CPU      descodificar 4K en cada fotograma es EXACTAMENTE lo que
 *                 atasca a las máquinas sin aceleración por hardware
 *
 * Lo segundo es lo grave: se quitó el `iframe` de Vimeo para que fuera más
 * fluido y a cambio entró un vídeo con el doble de trabajo por fotograma.
 * Sin esto, la mejora se la come el primer archivo que alguien suba
 * directo del móvil.
 *
 * ────────────────────────────────────────────────────────────────────────
 * QUE SE PIERDE Y QUE NO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Calidad VISIBLE, nada. Este vídeo se pinta detrás de una tarjeta, bajo
 * un velo oscuro, en una pantalla que casi nunca pasa de 1080p. Lo que se
 * tira son píxeles que no se miran y bits de un bitrate de cámara pensado
 * para editar, no para servir.
 *
 * Y el audio se tira ENTERO, a propósito: un fondo va mudo por definición
 * —el `video` lleva `muted` y el navegador no lo dejaría sonar de todos
 * modos— así que esa pista eran bytes que nadie iba a oír nunca.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE `MediaRecorder` Y NO `WebCodecs`
 * ────────────────────────────────────────────────────────────────────────
 *
 * WebCodecs es más rápido —no va en tiempo real— pero devuelve trozos
 * sueltos, no un archivo: hay que empaquetarlos en un MP4 a mano, con su
 * librería y sus casos raros.
 *
 * `MediaRecorder` devuelve el archivo hecho, en una cuarta parte de
 * código, y saca `video/mp4;codecs=avc1` donde se puede — H.264, el único
 * códec con descodificador por hardware en todo lo que existe desde hace
 * diez años. Para un bucle de fondo de unos segundos, ir en tiempo real es
 * una espera aceptable a cambio de esa simplicidad.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y SI ALGO FALLA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Se devuelve `null` y se sube el original. Encoger es una mejora; que
 * alguien no pueda poner su fondo porque su navegador no sabe recodificar
 * sería cambiar lo importante por lo accesorio.
 */

/* ────────────────────────────────────────────────────────────────────────
   LOS NUMEROS SALEN DE MEDIR A LA COMPETENCIA, NO DE LA INTUICION

   Leidos de sus propios archivos, con el navegador:

     quien             medida        dura    peso     bitrate
     ───────────────────────────────────────────────────────────
     guns.lol          1920x1080     10,2s   7,6 MB   6,24 Mbps
     bandi.lol (AV1)   2560x1440     60,0s  15,2 MB   2,13 Mbps
     bandi.lol (H264)  2560x1440     60,0s  23,8 MB   3,33 Mbps
     ───────────────────────────────────────────────────────────
     sharee, el 1er
     video subido a R2 3840x1632     19,2s  39,6 MB  17,27 Mbps

   Lo que enseña esa tabla no es que el nuestro fuera grande: es que iba a
   CINCO VECES el bitrate de los dos. Bandi mete sesenta segundos a 1440p
   —tres veces la duracion— en la mitad de peso.

   Puesto en bits por pixel y fotograma, que es lo comparable entre
   medidas distintas:

     guns.lol .......... 0,100
     bandi.lol H264 .... 0,030
     bandi.lol AV1 ..... 0,019
     lo de aqui ........ 0,056   <- entre los dos, mas cerca del holgado
   ──────────────────────────────────────────────────────────────────── */

/**
 * Lo ancho que se deja. Por encima, a 1080p.
 *
 * Bandi sirve 1440p y se ve magnifico, pero bandi optimiza para que se vea
 * espectacular y aqui el problema es OTRO: que vaya fluido en equipos sin
 * aceleracion por hardware. 1440p son 1,8 veces mas pixeles que descodificar
 * en cada fotograma, y detras de una tarjeta y bajo un velo oscuro esa
 * diferencia no se ve. 1080p es la medida de guns.lol, que es el que va
 * fino en todo.
 */
const ANCHO_MAX = 1920;

/**
 * Bits por segundo del resultado.
 *
 * Entre los dos de la tabla: por encima del H.264 de bandi por pixel, por
 * debajo de guns.lol. Mas alto no se nota debajo del velo; mas bajo empieza
 * a verse el bloqueo en los degradados oscuros, que es justo lo que mas
 * abunda en estos videos.
 *
 * Con esto, el video de 19,2 s que disparo todo esto pasa de 39,6 MB a unos
 * 8,4 — que es exactamente donde esta guns.lol.
 */
const BITRATE = 3_500_000;

/**
 * A partir de aquí merece la pena. Un vídeo ya pequeño se sube tal cual:
 * recodificar por recodificar solo quita calidad y hace esperar.
 */
const DESDE_MB = 10;

export interface VideoEncogido {
  blob: Blob;
  extension: 'mp4' | 'webm';
  ancho: number;
  alto: number;
  /** Lo que ocupaba antes, para poder contarlo. */
  antesMB: number;
  despuesMB: number;
}

export interface OpcionesEncoger {
  /** 0-100. Va por el tiempo del vídeo, que es lo que tarda de verdad. */
  alAvanzar?: (pct: number) => void;
  signal?: AbortSignal;
}

/**
 * El mejor envase que sepa hacer este navegador. MP4 primero: es el que se
 * reproduce en todas partes sin preguntar.
 */
function tipoDeSalida(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidatos = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidatos.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/** Si este navegador sabe hacerlo. */
export function sePuedeEncoger(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    tipoDeSalida() !== null
  );
}

/** Si merece la pena para ESTE archivo. */
export function conviene(archivo: File, ancho: number): boolean {
  return archivo.size > DESDE_MB * 1024 * 1024 || ancho > ANCHO_MAX;
}

/**
 * El tamaño de destino, conservando la proporción y en números pares: los
 * codificadores de vídeo trabajan en bloques y un lado impar se redondea
 * solo, a veces con una franja de un píxel.
 */
function medidaDestino(ancho: number, alto: number): { w: number; h: number } {
  if (!ancho || !alto) return { w: ANCHO_MAX, h: Math.round((ANCHO_MAX * 9) / 16) };
  const escala = Math.min(1, ANCHO_MAX / ancho);
  const par = (n: number) => Math.max(2, Math.round((n * escala) / 2) * 2);
  return { w: par(ancho), h: par(alto) };
}

export async function encogerVideo(
  archivo: File,
  opciones: OpcionesEncoger = {},
): Promise<VideoEncogido | null> {
  const tipo = tipoDeSalida();
  if (!sePuedeEncoger() || !tipo) return null;

  const url = URL.createObjectURL(archivo);
  const v = document.createElement('video');
  v.src = url;
  v.muted = true;
  v.playsInline = true;
  /* `auto` y no `metadata`: hay que reproducirlo entero, y pedir solo la
     cabecera hace que luego se pare a buscar cada trozo. */
  v.preload = 'auto';

  const limpiar = () => {
    v.pause();
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
  };

  try {
    await new Promise<void>((listo, fallo) => {
      v.onloadedmetadata = () => listo();
      v.onerror = () => fallo(new Error('El navegador no sabe leer ese vídeo.'));
    });

    const { w, h } = medidaDestino(v.videoWidth, v.videoHeight);
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const pincel = lienzo.getContext('2d', { alpha: false });
    if (!pincel) return null;

    const flujo = lienzo.captureStream(30);
    const grabadora = new MediaRecorder(flujo, {
      mimeType: tipo,
      videoBitsPerSecond: BITRATE,
    });
    const trozos: Blob[] = [];
    grabadora.ondataavailable = (e) => {
      if (e.data.size) trozos.push(e.data);
    };

    const acabado = new Promise<void>((listo) => {
      grabadora.onstop = () => listo();
    });

    /* Un dibujo por cada fotograma DE VERDAD del vídeo. Con un
       `requestAnimationFrame` se copiaría al ritmo de la pantalla, que no
       es el del archivo: en un vídeo a 24 salen fotogramas repetidos y en
       uno a 60 se pierde uno de cada dos. */
    const porFotograma = (
      v as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }
    ).requestVideoFrameCallback?.bind(v);

    let parado = false;
    const parar = () => {
      if (parado) return;
      parado = true;
      if (grabadora.state !== 'inactive') grabadora.stop();
    };
    opciones.signal?.addEventListener('abort', () => {
      parado = true;
      v.pause();
      if (grabadora.state !== 'inactive') grabadora.stop();
    });

    const pintar = () => {
      if (parado) return;
      pincel.drawImage(v, 0, 0, w, h);
      if (opciones.alAvanzar && v.duration) {
        opciones.alAvanzar(Math.min(99, Math.round((v.currentTime / v.duration) * 100)));
      }
      if (porFotograma) porFotograma(pintar);
      else requestAnimationFrame(pintar);
    };

    v.onended = parar;
    grabadora.start(1000);
    await v.play();
    pintar();
    await acabado;

    if (opciones.signal?.aborted) return null;

    const blob = new Blob(trozos, { type: tipo.split(';')[0] });
    /* Si sale MAS grande no ha servido de nada, y el original es mejor.
       Pasa con vídeos ya bien comprimidos y muy cortos. */
    if (!blob.size || blob.size >= archivo.size) return null;

    opciones.alAvanzar?.(100);
    return {
      blob,
      extension: tipo.startsWith('video/mp4') ? 'mp4' : 'webm',
      ancho: w,
      alto: h,
      antesMB: archivo.size / 1048576,
      despuesMB: blob.size / 1048576,
    };
  } catch {
    /* Cualquier cosa: formato que no lee, permiso denegado, grabadora que
       no arranca. Se sube el original. */
    return null;
  } finally {
    limpiar();
  }
}
