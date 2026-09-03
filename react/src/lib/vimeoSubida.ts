import { CONFIG } from '@/config';
import { supabase } from './supabase';

/**
 * Subida de un fondo a la cuenta de Vimeo de IDENTITY.
 *
 * El navegador NUNCA ve el token: la función de borde `vimeo-subida` pide el
 * ticket en su nombre y devuelve un enlace de un solo uso. El archivo va
 * directo de aquí a Vimeo con ese enlace, sin pasar por la función — son
 * decenas de MB y hacerlos rebotar sería pagar el tráfico dos veces.
 *
 * El protocolo es tus 1.0.0, que es el que pide Vimeo: se manda el archivo en
 * trozos indicando en qué byte va cada uno, y si se corta la conexión se
 * pregunta por el byte alcanzado y se sigue desde ahí en vez de empezar de
 * cero. Un fondo de 40 MB por una red de móvil se corta más de lo que parece.
 */

const TROZO = 8 * 1024 * 1024;
const TUS = '1.0.0';

export interface AvanceSubida {
  enviados: number;
  total: number;
  /** 0–100, ya redondeado */
  pct: number;
}

export interface ResultadoVimeo {
  id: string;
  /** ancho/alto, cuando Vimeo ya lo sabe */
  ratio: number;
}

function urlFuncion(nombre: string): string {
  return CONFIG.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/' + nombre;
}

/** Llama a la función de borde con la sesión de quien está editando: sin
 *  sesión la función responde 401, que es lo que queremos. */
async function llamar(cuerpo: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('Esta copia no tiene servidor configurado.');
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('Hay que entrar en la cuenta para subir un vídeo.');

  const r = await fetch(urlFuncion('vimeo-subida'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + jwt },
    body: JSON.stringify(cuerpo),
  });

  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(d.error ?? 'No se pudo hablar con Vimeo.'));
  return d;
}

/** Dónde se quedó una subida interrumpida. */
async function desplazamiento(enlace: string): Promise<number> {
  const r = await fetch(enlace, {
    method: 'HEAD',
    headers: { 'Tus-Resumable': TUS, Accept: 'application/vnd.vimeo.*+json;version=3.4' },
  });
  if (!r.ok) throw new Error('Vimeo no reconoce esta subida.');
  return Number(r.headers.get('upload-offset') ?? 0) || 0;
}

/**
 * Un trozo. Va con XMLHttpRequest y no con fetch a propósito: fetch no
 * informa del progreso de SUBIDA, y sin barra un archivo grande parece
 * colgado.
 */
function enviarTrozo(
  enlace: string,
  trozo: Blob,
  desde: number,
  total: number,
  alAvanzar?: (a: AvanceSubida) => void,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((cumplir, fallar) => {
    const x = new XMLHttpRequest();
    x.open('PATCH', enlace, true);
    x.setRequestHeader('Tus-Resumable', TUS);
    x.setRequestHeader('Upload-Offset', String(desde));
    x.setRequestHeader('Content-Type', 'application/offset+octet-stream');

    x.upload.onprogress = (e) => {
      const enviados = desde + e.loaded;
      alAvanzar?.({ enviados, total, pct: Math.round((enviados / total) * 100) });
    };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        cumplir(Number(x.getResponseHeader('upload-offset') ?? desde + trozo.size));
      } else {
        fallar(new Error(`Vimeo devolvió ${x.status} al recibir el vídeo.`));
      }
    };
    x.onerror = () => fallar(new Error('Se cortó la conexión con Vimeo.'));
    x.onabort = () => fallar(new DOMException('Subida cancelada', 'AbortError'));

    signal?.addEventListener('abort', () => x.abort(), { once: true });
    x.send(trozo);
  });
}

/**
 * Sube el archivo y espera a que Vimeo lo transcodifique.
 *
 * Lo segundo importa: recién subido el vídeo NO se puede reproducir todavía.
 * Si se guarda el id y se pinta el fondo en ese momento, el perfil sale en
 * negro durante unos minutos y parece roto.
 */
export async function subirFondoVimeo(
  archivo: File,
  opciones: {
    alAvanzar?: (a: AvanceSubida) => void;
    alProcesar?: () => void;
    signal?: AbortSignal;
  } = {},
): Promise<ResultadoVimeo> {
  const { alAvanzar, alProcesar, signal } = opciones;

  const ticket = await llamar({ accion: 'ticket', tamano: archivo.size });
  const id = String(ticket.id ?? '');
  const enlace = String(ticket.enlace ?? '');
  if (!id || !enlace) throw new Error('Vimeo no devolvió el enlace de subida.');

  let desde = 0;
  while (desde < archivo.size) {
    if (signal?.aborted) throw new DOMException('Subida cancelada', 'AbortError');
    try {
      desde = await enviarTrozo(
        enlace,
        archivo.slice(desde, Math.min(desde + TROZO, archivo.size)),
        desde,
        archivo.size,
        alAvanzar,
        signal,
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // Un corte no tiene por qué perder lo enviado: se le pregunta a Vimeo
      // por dónde iba y se sigue. Si tampoco eso responde, se rinde.
      desde = await desplazamiento(enlace);
    }
  }

  alProcesar?.();

  // Vimeo transcodifica en segundo plano. Se pregunta con espera creciente
  // para no castigar su API con un bucle cerrado.
  for (let intento = 0; intento < 40; intento++) {
    if (signal?.aborted) throw new DOMException('Subida cancelada', 'AbortError');
    await new Promise((r) => setTimeout(r, Math.min(2000 + intento * 500, 8000)));

    const e = await llamar({ accion: 'estado', id });
    const estado = String(e.estado ?? '');
    if (estado === 'complete') {
      const ancho = Number(e.ancho) || 16;
      const alto = Number(e.alto) || 9;
      return { id, ratio: Math.round((ancho / alto) * 1000) / 1000 };
    }
    if (estado === 'error') throw new Error('Vimeo no pudo procesar ese vídeo.');
  }

  throw new Error('Vimeo está tardando más de lo normal. El vídeo sigue subido: vuelve en unos minutos.');
}
