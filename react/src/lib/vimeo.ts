/**
 * Vimeo como alojamiento de los vídeos de fondo.
 *
 * Un vídeo no se sube al proyecto: pesa demasiado para el almacenamiento y
 * para el límite de tamaño de la fila del perfil. Se aloja en Vimeo y aquí
 * solo viaja el enlace.
 *
 * Vimeo NO sirve un archivo de vídeo directo: hay que incrustar su reproductor
 * en un iframe. Por eso el fondo de vídeo no puede pintarse con <video>.
 */

/**
 * Saca el id numérico de una URL de Vimeo. Acepta las formas habituales:
 * vimeo.com/123, vimeo.com/channels/x/123, player.vimeo.com/video/123 y los
 * enlaces privados vimeo.com/123/abcdef.
 */
export function idVimeo(url: string | null | undefined): string {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^\d{6,12}$/.test(u)) return u;

  const m =
    u.match(/player\.vimeo\.com\/video\/(\d{6,12})/) ||
    u.match(/vimeo\.com\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|album\/\d+\/video\/)?(\d{6,12})/);
  return m && m[1] ? m[1] : '';
}

/**
 * Enlace privado (unlisted): vimeo.com/123456789/abc123def. Ese hash hace
 * falta para que el reproductor acepte mostrarlo.
 */
export function hashVimeo(url: string | null | undefined): string {
  const m = String(url || '').match(/vimeo\.com\/\d{6,12}\/([0-9a-f]{6,32})/i);
  return m && m[1] ? m[1] : '';
}

export function esVimeo(url: string | null | undefined): boolean {
  return idVimeo(url) !== '';
}

/**
 * URL del reproductor en modo fondo: sin controles, sin sonido, en bucle.
 * `dnt=1` le pide a Vimeo que no rastree a quien visita el perfil.
 */
export function urlFondoVimeo(url: string): string {
  const id = idVimeo(url);
  if (!id) return '';
  const h = hashVimeo(url);
  const params = new URLSearchParams({
    background: '1',
    autoplay: '1',
    loop: '1',
    muted: '1',
    autopause: '0',
    dnt: '1',
  });
  if (h) params.set('h', h);
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}

/** Lo que Vimeo cuenta de un vídeo sin necesidad de clave. */
export interface InfoVimeo {
  /** ancho / alto. 16:9 sale 1.778; un panorámico 2048x870, 2.354 */
  ratio: number;
  miniatura: string;
  titulo: string;
}

/**
 * Pregunta a Vimeo por el vídeo con oEmbed, que es público y no lleva clave.
 *
 * Hacen falta dos cosas de ahí. La proporción, porque el fondo se escala
 * para CUBRIR la pantalla y para eso hay que saber la forma del vídeo: dando
 * por hecho 16:9, un panorámico se quedaba con franjas arriba y abajo. Y la
 * miniatura oficial, que antes se pedía a vumbnail.com — un tercero ajeno a
 * Vimeo del que no hace falta depender para algo que Vimeo ya da.
 *
 * Se llama SOLO en el editor, al pegar el enlace: el resultado se guarda en
 * el perfil, así que ver un perfil no dispara ninguna petición a Vimeo.
 */
export async function infoVimeo(
  url: string,
  signal?: AbortSignal,
): Promise<InfoVimeo | null> {
  const id = idVimeo(url);
  if (!id) return null;

  // Se manda la URL completa, con el hash del enlace privado si lo lleva:
  // sin él, oEmbed responde 403 en los vídeos no listados.
  const h = hashVimeo(url);
  const canonica = h
    ? `https://vimeo.com/${id}/${h}`
    : `https://vimeo.com/${id}`;

  const peticion =
    'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(canonica);

  const r = await fetch(peticion, { signal });
  if (!r.ok) return null;

  const d: unknown = await r.json();
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;

  const w = Number(o.width);
  const alto = Number(o.height);
  if (!isFinite(w) || !isFinite(alto) || w <= 0 || alto <= 0) return null;

  return {
    ratio: Math.round((w / alto) * 1000) / 1000,
    miniatura: typeof o.thumbnail_url === 'string' ? o.thumbnail_url : '',
    titulo: typeof o.title === 'string' ? o.title : '',
  };
}
