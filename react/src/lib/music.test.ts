import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { idYouTube, miniaturaYouTube, portadaPista } from './music';

/**
 * La imagen del bloque de música.
 *
 * Esto no falla cuando se rompe: sale el `♪` de reserva, que es exactamente
 * lo que sale cuando no hay pista. Nadie lo llama un fallo — lo llaman «no
 * se ve la portada», y hasta que alguien lo mira no hay forma de saber si el
 * problema es que no se guardó, que no se leyó, o que el estilo la escondía.
 */

describe('la portada de la pista', () => {
  const pista = (x: Partial<{ cover: string; yt: string }>) => ({ cover: '', yt: '', ...x });

  it('manda la que tú subiste', () => {
    const p = pista({ cover: 'https://ejemplo/mia.webp', yt: '8JxFMTwFAi8' });
    expect(portadaPista(p)).toBe('https://ejemplo/mia.webp');
  });

  it('si no subiste ninguna, la del vídeo', () => {
    expect(portadaPista(pista({ yt: '8JxFMTwFAi8' })))
      .toBe('https://i.ytimg.com/vi/8JxFMTwFAi8/mqdefault.jpg');
  });

  /* Un campo en blanco no es una portada. Se guarda como cadena vacía al
     quitar la imagen, y con un `||` mal puesto se quedaría en «tiene» y
     taparía la miniatura para siempre. */
  it('una portada en blanco no cuenta como portada', () => {
    expect(portadaPista(pista({ cover: '   ', yt: '8JxFMTwFAi8' })))
      .toBe('https://i.ytimg.com/vi/8JxFMTwFAi8/mqdefault.jpg');
  });

  it('sin nada, nada', () => {
    expect(portadaPista(pista({}))).toBe('');
    expect(portadaPista(null)).toBe('');
    expect(portadaPista(undefined)).toBe('');
  });

  /* `mqdefault` y no `hqdefault`: la segunda llega en 4:3 con franjas negras
     pegadas, y la caja es cuadrada y recorta por el centro. De un vídeo
     apaisado saldría una franja negra. */
  it('la miniatura es la que no lleva franjas', () => {
    expect(miniaturaYouTube('8JxFMTwFAi8')).toContain('mqdefault');
    expect(miniaturaYouTube('8JxFMTwFAi8')).not.toContain('hqdefault');
    expect(miniaturaYouTube('')).toBe('');
  });
});

describe('el id de un enlace de YouTube', () => {
  const casos: [string, string][] = [
    ['https://www.youtube.com/watch?v=8JxFMTwFAi8', '8JxFMTwFAi8'],
    /* Con lista y radio, que es como lo deja el botón de compartir cuando
       vienes de una mezcla. */
    ['https://www.youtube.com/watch?v=8JxFMTwFAi8&list=RD8JxFMTwFAi8&start_radio=1', '8JxFMTwFAi8'],
    ['https://youtu.be/8JxFMTwFAi8', '8JxFMTwFAi8'],
    ['https://www.youtube.com/embed/8JxFMTwFAi8', '8JxFMTwFAi8'],
    ['https://www.youtube.com/shorts/8JxFMTwFAi8', '8JxFMTwFAi8'],
    ['https://www.youtube.com/live/8JxFMTwFAi8', '8JxFMTwFAi8'],
    ['8JxFMTwFAi8', '8JxFMTwFAi8'],
  ];
  for (const [url, id] of casos) {
    it(`reconoce ${url}`, () => expect(idYouTube(url)).toBe(id));
  }

  it('no se inventa uno', () => {
    expect(idYouTube('https://vimeo.com/1226114726')).toBe('');
    expect(idYouTube('')).toBe('');
  });
});

/**
 * Y una guardia sobre el CSS.
 *
 * `minimal` escondía la portada, y ese es el estilo que ponen las plantillas.
 * Subías una imagen, se guardaba bien, y no se veía nunca — con un botón para
 * subirla justo al lado y ninguna forma de cambiar el estilo desde el editor.
 */
describe('los estilos del bloque', () => {
  const CSS = readFileSync(resolve(__dirname, '../styles/profile.css'), 'utf8');

  it('minimal no esconde la portada', () => {
    const esconden = CSS.match(/\.pf-music\[data-style="minimal"\][^{]*\{[^}]*display:\s*none[^}]*\}/g) ?? [];
    const texto = esconden.join(' ');
    expect(texto, 'minimal vuelve a esconder __cover').not.toContain('__cover');
  });
});
