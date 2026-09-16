import { CONFIG } from '@/config';
import { supabase } from './supabase';
import type { AvanceSubida } from './vimeoSubida';

/**
 * Subida de un fondo a R2, el almacenamiento de Cloudflare.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE R2 Y NO VIMEO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Vimeo no sirve un archivo de vídeo: sirve su REPRODUCTOR, y hay que
 * meterlo en un `iframe`. Y un iframe de otro dominio no es una etiqueta:
 * es un navegador entero dentro del tuyo, con su HTML, su JavaScript, su
 * configuración y su manifiesto antes de que empiece el primer fotograma.
 *
 * Medido en producción, con la conexión ya caliente:
 *
 *     marco creado ...........     0 ms
 *     marco cargado ..........   991 ms
 *     el vídeo se mueve ...... 1.324 ms
 *
 * Con un archivo propio eso es un `<video src>`: empieza a pintar con los
 * primeros bytes. Es literalmente lo que hacen guns.lol y bandi.lol —
 * medido también: los dos sirven `<video>` nativo desde su propio dominio
 * y no tienen un solo iframe en la página.
 *
 * Y el dinero, que era la razón de estar en Vimeo: en R2 la SALIDA de
 * datos no se cobra. Nunca. Lo que limita es el almacenamiento, y el
 * gratis son 10 GB — unos mil vídeos de fondo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LO QUE NO CAMBIA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Nada de lo que ya está subido. Un perfil con su fondo en Vimeo lo sigue
 * teniendo en Vimeo y se sigue pintando con su `iframe`; uno con el vídeo
 * en el cubo de Supabase lo sigue leyendo de ahí. Esto solo decide a dónde
 * van las subidas NUEVAS, y lo que devuelve es una dirección `https://`
 * normal — o sea que cae en el mismo `<video>` que ya existía. No hay una
 * rama nueva que pintar ni un formato nuevo que entender.
 */

/** Si esta copia tiene R2 configurado. */
export function hayR2(): boolean {
  return CONFIG.R2 && !!CONFIG.SUPABASE_URL;
}

export interface OpcionesR2 {
  alAvanzar?: (a: AvanceSubida) => void;
  signal?: AbortSignal;
}

interface Permiso {
  subirA: string;
  url: string;
  contentType: string;
}

/**
 * El permiso, de la función de borde.
 *
 * Las claves de R2 no viajan al navegador: aquí solo llega una dirección
 * firmada que sirve para UN archivo, de UN tamaño y de UN tipo, durante
 * diez minutos.
 */
async function pedirPermiso(
  archivo: Blob,
  tipo: 'fondo' | 'poster',
  contentType: string,
): Promise<Permiso> {
  if (!supabase) throw new Error('Esta copia no tiene servidor configurado.');
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('Hay que entrar en la cuenta para subir un vídeo.');

  const r = await fetch(
    CONFIG.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/r2-subida',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ tipo, contentType, tamano: archivo.size }),
    },
  );
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(d.error ?? 'No se pudo preparar la subida.'));
  return d as unknown as Permiso;
}

/**
 * El archivo, derecho a R2.
 *
 * Con `XMLHttpRequest` y no con `fetch` por una razón sola: `fetch` no sabe
 * decir cuánto lleva SUBIDO. Para una imagen da igual; para un vídeo de
 * cuarenta megas por una red de móvil, una barra que no se mueve es
 * indistinguible de una subida colgada, y la gente la cancela y lo vuelve
 * a intentar — que es la peor manera de gastar la conexión de alguien.
 */
function enviar(
  destino: string,
  archivo: Blob,
  contentType: string,
  opciones: OpcionesR2,
): Promise<void> {
  return new Promise((listo, fallo) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', destino, true);
    /* El MISMO que se firmó. Si aquí fuera otro, R2 contesta 403: forma
       parte de la firma justamente para que no se pueda cambiar. */
    xhr.setRequestHeader('content-type', contentType);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !opciones.alAvanzar) return;
      opciones.alAvanzar({
        enviados: e.loaded,
        total: e.total,
        pct: Math.round((e.loaded / e.total) * 100),
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return listo();
      /* R2 contesta en XML. Se recorta porque lo que importa es el código;
         el cuerpo entero en un aviso de la interfaz no lo lee nadie. */
      fallo(new Error(`R2 devolvió ${xhr.status}. ${String(xhr.responseText || '').slice(0, 120)}`));
    };
    xhr.onerror = () => fallo(new Error('Se cortó la conexión al subir el archivo.'));
    xhr.onabort = () => fallo(new DOMException('Subida cancelada.', 'AbortError'));

    if (opciones.signal) {
      if (opciones.signal.aborted) {
        xhr.abort();
        return;
      }
      opciones.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(archivo);
  });
}

/**
 * Sube un archivo y devuelve su dirección pública.
 *
 * `contentType` sale del propio archivo. Cuando el navegador no sabe decir
 * de qué tipo es —pasa con algunos `.mov` y con blobs recién hechos— se
 * deduce del nombre, porque la función de borde exige un tipo de la lista
 * blanca y sin él rechazaría una subida perfectamente válida.
 */
export async function subirAR2(
  archivo: File | Blob,
  tipo: 'fondo' | 'poster',
  opciones: OpcionesR2 = {},
): Promise<string> {
  const nombre = (archivo as File).name || '';
  const porExtension: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  };
  /* `?? ''` y no `[0]` a secas: con `noUncheckedIndexedAccess` un indice
     puede ser `undefined` aunque aqui `split` siempre devuelva algo. Lo
     pillo `tsc -b`, que es el que corre en la construccion; `tsc --noEmit`
     con la configuracion de siempre lo dejaba pasar. */
  const delArchivo = (archivo.type || '').split(';')[0] ?? '';
  const laExtension = (nombre.split('.').pop() ?? '').toLowerCase();
  const contentType =
    delArchivo.trim().toLowerCase() || porExtension[laExtension] || '';

  const permiso = await pedirPermiso(archivo, tipo, contentType);
  await enviar(permiso.subirA, archivo, permiso.contentType, opciones);
  return permiso.url;
}
