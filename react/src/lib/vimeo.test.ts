import { describe, it, expect } from 'vitest';
import { idVimeo, hashVimeo, esVimeo, urlFondoVimeo } from './vimeo';

/**
 * Pruebas del enlace de Vimeo.
 *
 * Lo que se rompe aquí no falla: devuelve cadena vacía, y lo que ve quien
 * pega el enlace es «no reconozco ese enlace de Vimeo» sobre una URL que es
 * perfectamente válida. Nadie lo llama un fallo del programa; lo llaman «no
 * me funciona el vídeo».
 *
 * Por eso las formas van todas escritas: son las que de verdad copia la
 * gente, no las que salen en la documentación.
 */

describe('el id de un enlace de Vimeo', () => {
  const valen: [string, string][] = [
    ['https://vimeo.com/1225041540', '1225041540'],
    ['https://vimeo.com/76979871', '76979871'],
    /* El de la pantalla de gestión: el que está en la barra del navegador
       mientras editas el vídeo, que es cuando lo copias. */
    ['https://vimeo.com/manage/videos/1225041540', '1225041540'],
    ['https://vimeo.com/channels/staffpicks/1225041540', '1225041540'],
    ['https://vimeo.com/groups/motion/videos/1225041540', '1225041540'],
    ['https://vimeo.com/album/1234/video/1225041540', '1225041540'],
    ['https://player.vimeo.com/video/1225041540', '1225041540'],
    /* El privado, con su código y con la coletilla que añade el botón de
       copiar de Vimeo. */
    ['https://vimeo.com/1225041540/abc123def4', '1225041540'],
    ['https://vimeo.com/1225041540/abc123def4?share=copy', '1225041540'],
    ['  https://vimeo.com/1225041540  ', '1225041540'],
    ['1225041540', '1225041540'],
  ];

  for (const [url, id] of valen) {
    it(`reconoce ${url.trim()}`, () => {
      expect(idVimeo(url)).toBe(id);
      expect(esVimeo(url)).toBe(true);
    });
  }

  it('no se inventa un id donde no lo hay', () => {
    /* Una dirección personalizada no lleva el número por ninguna parte: sin
       preguntarle a Vimeo no hay forma de saber cuál es, y decir que no se
       reconoce es la respuesta honesta. */
    expect(idVimeo('https://vimeo.com/usuario/miviaje')).toBe('');
    expect(idVimeo('https://youtube.com/watch?v=1225041540')).toBe('');
    expect(idVimeo('')).toBe('');
    expect(idVimeo(null)).toBe('');
    expect(idVimeo('https://vimeo.com/12345')).toBe('');
  });
});

describe('el código del enlace privado', () => {
  it('sale cuando está y no cuando no', () => {
    expect(hashVimeo('https://vimeo.com/1225041540/abc123def4')).toBe('abc123def4');
    expect(hashVimeo('https://vimeo.com/1225041540')).toBe('');
  });
});

describe('la URL del reproductor', () => {
  it('pide el modo fondo y lleva el código si el vídeo es privado', () => {
    const u = urlFondoVimeo('https://vimeo.com/1225041540/abc123def4');
    expect(u).toContain('https://player.vimeo.com/video/1225041540?');
    for (const p of ['background=1', 'autoplay=1', 'loop=1', 'muted=1', 'dnt=1']) {
      expect(u, p).toContain(p);
    }
    /* Sin el código, un vídeo no listado responde con el aviso de privacidad
       en vez del vídeo. */
    expect(u).toContain('h=abc123def4');
  });

  it('no lleva código si el vídeo no lo tiene', () => {
    expect(urlFondoVimeo('https://vimeo.com/1225041540')).not.toContain('h=');
  });

  it('devuelve vacío si el enlace no es de Vimeo', () => {
    expect(urlFondoVimeo('https://example.com/video.mp4')).toBe('');
  });
});
