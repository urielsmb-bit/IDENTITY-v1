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
 * Aqui ponia «calidad VISIBLE, nada», y era mentira. El fondo de
 * juanbeltran salio emborronado a pantalla completa y se veia desde el
 * primer vistazo. Lo que fallaba no era la idea —tirar pixeles que no se
 * miran sigue siendo correcto— sino los numeros: iban calculados para el
 * caso comodo y este es el incomodo, un blanco y negro oscuro y con
 * grano, que es justo donde un bitrate corto se nota mas.
 *
 * Lo que se tira, con los numeros de ahora, son pixeles por encima de
 * 1080p y bits de un bitrate de camara pensado para editar, no para
 * servir. Y ya no se toca lo que llega bien: recodificar algo que ya
 * paso por un codificador es una segunda generacion, y cada generacion
 * alisa. Esa es la parte que de verdad emborronaba.
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
 * Se sube el original. Encoger es una mejora; que alguien no pueda poner su
 * fondo porque su navegador no sabe recodificar sería cambiar lo importante
 * por lo accesorio.
 *
 * Pero se dice POR QUE. La primera version devolvia `null` a secas, y la
 * primera subida real despues de escribirla salio con el archivo intacto
 * —41.545.350 bytes, los mismos— sin una sola pista de si es que no se
 * intento, si fallo, o si el navegador tenia la version vieja en cache.
 * Media hora mirando. Un fallo que no se puede distinguir de «no hacia
 * falta» es el mismo error que este proyecto ya ha pagado con la vista
 * publica muda y con las insignias que no cargaban.
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

   Con el primer intento se apunto a 0,056 —«entre los dos»— y salio 0,036,
   porque el numero que se le da al codificador es un techo y no lo llena.
   Apuntar a la mitad del camino y quedarse corto acaba abajo del todo. Se
   apunta ahora al de guns.lol, que es el unico de los tres que se mira
   para decir «se ve bien».
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
 * Bits por pixel y fotograma.
 *
 * ────────────────────────────────────────────────────────────────────────
 * DE DONDE SALE, Y POR QUE CAMBIO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Aqui habia un numero plano —3,5 Mbps para cualquier medida— colocado
 * «entre los dos de la tabla», y con el se publicaron dos fondos. Medidos
 * en produccion:
 *
 *     juanbeltran   1920x1080   26,0s   6,89 MB   2,22 Mbps
 *     shark         1920x816    19,5s   5,75 MB   2,48 Mbps
 *
 * Ninguno llego a los 3,5 que se le pedian. Y se ve: el de juanbeltran es
 * un blanco y negro oscuro y con grano, y sale emborronado a pantalla
 * completa. El comentario de antes ya lo predecia sin saberlo —«mas bajo
 * empieza a verse el bloqueo en los degradados oscuros, que es justo lo
 * que mas abunda en estos videos»— y aun asi se quedo corto.
 *
 * El fallo de raiz es que `videoBitsPerSecond` es un TECHO, no un
 * objetivo. El codificador gasta lo que le parece y se para antes; con
 * ruido sintetico llega al tope (medido: 3,47 de 3,5) y con video real,
 * que ya viene comprimido y por tanto alisado, se queda en dos tercios.
 * Poner un techo justo es pedirle al codificador que decida la calidad,
 * y decide mal.
 *
 * Asi que el numero se ata a lo medido en quien se ve bien, y se escala
 * con el tamaño en vez de ser plano —un 720p no necesita los bits de un
 * 1080p—:
 *
 *     guns.lol .......... 0,100 bits/px/fotograma   <- este
 *     bandi.lol H264 .... 0,030
 *     bandi.lol AV1 ..... 0,019
 *
 *     1920x1080 -> 6,2 Mbps      1920x816 -> 4,7 Mbps
 *     1280x720  -> 2,8 Mbps
 *
 * Subir el techo cuesta bytes de descarga, NO cuesta descodificacion: eso
 * lo manda el numero de pixeles, que no se toca. Y el egreso de R2 es
 * gratis. En segundos por megabyte quedamos donde guns.lol.
 */
const BITS_POR_PIXEL = 0.1;
const FPS = 30;

/** Los bits por segundo que se le piden a un tamaño dado. */
function bitratePara(ancho: number, alto: number): number {
  return Math.round(ancho * alto * FPS * BITS_POR_PIXEL);
}

/**
 * Cuanto puede pasarse el original antes de que recodificar compense.
 *
 * Recodificar SIEMPRE pierde: es una segunda generacion sobre algo que ya
 * paso por un codificador. Si el archivo que llega ya esta cerca de donde
 * lo dejariamos nosotros, tocarlo solo lo empeora.
 */
const HOLGURA = 1.4;

/**
 * Por debajo de esto no se toca nada, pese lo que pese el calculo.
 *
 * OJO CON LEER ESTO COMO UN LIMITE DE PESO. Lo era, y estaba mal: un
 * video de 26 segundos a unos razonables 4 Mbps son 13 MB y cruzaba el
 * umbral, asi que se recodificaba un archivo que estaba perfectamente. El
 * peso total crece con la DURACION, y la duracion no tiene nada que ver
 * con si un video esta bien comprimido. Lo que decide es el bitrate; esto
 * solo evita molestar a un archivo diminuto.
 */
const DESDE_MB = 4;

export interface VideoEncogido {
  encogido: true;
  blob: Blob;
  extension: 'mp4' | 'webm';
  ancho: number;
  alto: number;
  /** Lo que ocupaba antes, para poder contarlo. */
  antesMB: number;
  despuesMB: number;
}

/** No se encogio, y el motivo. Quien llama sube el original igual, pero
 *  ahora puede DECIRLO en vez de dejar un silencio indistinguible de que
 *  todo fuera bien. */
export interface SinEncoger {
  encogido: false;
  motivo: string;
}

export type ResultadoEncoger = VideoEncogido | SinEncoger;

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
  /* EL PERFIL SE PIDE, NO SE HEREDA. Pidiendo `avc1` a secas, Chrome
     devuelve Baseline —lo dice el `avcC` de los dos fondos publicados:
     byte de perfil 0x42, o sea 66—, que es H.264 sin B-frames y sin
     CABAC. `avc1.640028` es High 4.0, y `isTypeSupported` no basta para
     saber si lo respeta, asi que se comprobo codificando de verdad:

         avc1 .......... perfil 66  (Baseline)
         avc1.4D0028 ... perfil 77  (Main)
         avc1.640028 ... perfil 100 (High)

     Lo honesto es decir que en esa misma prueba High NO salio mejor a
     igual bitrate: 37,30 de detalle frente a 37,33, que es ruido. Puede
     ser que el codificador por hardware ignore las herramientas de mas,
     o que el contenido de la prueba —grano aleatorio— sea justo donde
     menos ayudan. Se pide igualmente porque no cuesta nada y porque
     donde si se usen, ayudan; pero el arreglo de verdad es el bitrate,
     no esto. */
  const candidatos = [
    'video/mp4;codecs=avc1.640028',
    'video/mp4;codecs=avc1.4D0028',
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

/**
 * Si merece la pena tocar ESTE archivo, sabiendo ya lo que mide y lo que
 * dura. Se llama desde dentro, cuando el navegador ya ha leido la
 * cabecera: antes solo se tenia el peso y una proporcion.
 *
 * Habia una version exportada que recibia `(archivo, ancho)` y el ancho
 * se lo inventaba quien llamaba —`Math.round(ratio * 1080)`, o sea la
 * proporcion multiplicada por un alto supuesto—. Para un 3840x1632 eso da
 * 2540, que no es su ancho ni se le parece. Decidir con un numero
 * inventado es peor que no decidir.
 */
export function hayQueTocarlo(
  bytes: number,
  ancho: number,
  alto: number,
  duracion: number,
): { si: true } | { si: false; motivo: string } {
  /* Demasiados pixeles que descodificar en cada fotograma. Esto manda por
     encima de todo lo demas: es el motivo por el que existe esto. */
  if (ancho > ANCHO_MAX) return { si: true };

  if (bytes <= DESDE_MB * 1024 * 1024) {
    return { si: false, motivo: `ya pesaba poco (${(bytes / 1048576).toFixed(1)} MB)` };
  }

  if (!duracion || !isFinite(duracion)) return { si: true };

  const suyo = (bytes * 8) / duracion;
  const nuestro = bitratePara(ancho, alto);
  if (suyo <= nuestro * HOLGURA) {
    return {
      si: false,
      motivo:
        `ya venia bien comprimido (${ancho}×${alto} a ` +
        `${(suyo / 1e6).toFixed(1)} Mbps)`,
    };
  }
  return { si: true };
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

/** Se devuelve Y se deja dicho en la consola. Quien mire un caso raro va a
 *  mirar ahí antes que en ningún otro sitio. */
function noSePudo(motivo: string): SinEncoger {
  console.warn('[fondo] No se aligeró el vídeo: ' + motivo);
  return { encogido: false, motivo };
}

export async function encogerVideo(
  archivo: File,
  opciones: OpcionesEncoger = {},
): Promise<ResultadoEncoger> {
  const tipo = tipoDeSalida();
  if (!sePuedeEncoger() || !tipo) {
    return noSePudo('este navegador no sabe recodificar vídeo');
  }

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

    /* AHORA se decide, que es cuando se sabe. Antes lo decidia quien
       llamaba con el peso y un ancho supuesto; aqui estan el ancho, el
       alto y la duracion de verdad. */
    const veredicto = hayQueTocarlo(
      archivo.size,
      v.videoWidth,
      v.videoHeight,
      v.duration,
    );
    if (!veredicto.si) return noSePudo(veredicto.motivo);

    const { w, h } = medidaDestino(v.videoWidth, v.videoHeight);
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const pincel = lienzo.getContext('2d', { alpha: false });
    if (!pincel) return noSePudo('el navegador no dio un lienzo donde pintar');

    /* Nunca por encima de lo que traia el original: pedir mas bits de los
       que tenia no inventa detalle, solo engorda el archivo guardando el
       ruido de la primera compresion. */
    const suyo = v.duration && isFinite(v.duration)
      ? (archivo.size * 8) / v.duration
      : Infinity;
    const bitrate = Math.round(Math.min(bitratePara(w, h), suyo));

    const flujo = lienzo.captureStream(FPS);
    const grabadora = new MediaRecorder(flujo, {
      mimeType: tipo,
      videoBitsPerSecond: bitrate,
    });
    const trozos: Blob[] = [];
    let fallo = '';
    grabadora.ondataavailable = (e) => {
      if (e.data.size) trozos.push(e.data);
    };
    /* Sin esto, una grabadora que revienta no avisa a nadie: `onstop` no
       llega, la promesa de abajo no se resuelve, y la subida se queda
       colgada para siempre con la barra a medias. */
    grabadora.onerror = (e: Event) => {
      fallo = String((e as ErrorEvent).error ?? 'la grabadora falló');
    };

    const acabado = new Promise<void>((listo) => {
      grabadora.onstop = () => listo();
      grabadora.addEventListener('error', () => listo());
      /* Y el reloj de seguridad. Va en tiempo real, asi que el doble de lo
         que dura el video mas diez segundos es de sobra incluso en un
         movil lento. Colgarse aqui seria dejar a alguien mirando una barra
         que no se mueve, sin manera de salir. */
      const tope = Math.max(20_000, (v.duration || 30) * 2000 + 10_000);
      setTimeout(() => {
        if (grabadora.state !== 'inactive') {
          fallo = fallo || 'tardó más de la cuenta y se dejó a medias';
          try { grabadora.stop(); } catch { /* ya estaba */ }
        }
        listo();
      }, tope);
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
    try {
      await v.play();
    } catch {
      /* El navegador puede negarse a reproducir sin que nadie haya tocado
         nada. Va `muted`, que es justo lo que suele bastar para que lo
         permita, pero en modo ahorro de batería a veces no. */
      return noSePudo('el navegador no dejó reproducir el vídeo para copiarlo');
    }
    pintar();
    await acabado;

    if (opciones.signal?.aborted) return noSePudo('se canceló');
    if (fallo) return noSePudo(fallo);

    const blob = new Blob(trozos, { type: tipo.split(';')[0] });
    if (!blob.size) return noSePudo('la grabadora no devolvió ni un byte');
    /* Si sale MAS grande no ha servido de nada, y el original es mejor.
       Pasa con vídeos ya bien comprimidos y muy cortos. */
    if (blob.size >= archivo.size) {
      return noSePudo(
        `el resultado no mejoraba (${(blob.size / 1048576).toFixed(1)} MB frente a ` +
          `${(archivo.size / 1048576).toFixed(1)} MB)`,
      );
    }

    opciones.alAvanzar?.(100);
    return {
      encogido: true,
      blob,
      extension: tipo.startsWith('video/mp4') ? 'mp4' : 'webm',
      ancho: w,
      alto: h,
      antesMB: archivo.size / 1048576,
      despuesMB: blob.size / 1048576,
    };
  } catch (e) {
    /* Cualquier cosa: formato que no lee, permiso denegado, grabadora que
       no arranca. Se sube el original, pero con el motivo en la mano. */
    return noSePudo(e instanceof Error ? e.message : String(e));
  } finally {
    limpiar();
  }
}
