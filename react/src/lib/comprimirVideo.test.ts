import { describe, it, expect, afterEach, vi } from 'vitest';
import { sePuedeEncoger, conviene, encogerVideo } from './comprimirVideo';

/**
 * Pruebas del encogido de vídeos.
 *
 * El trabajo de verdad —decodificar y recodificar— no se puede probar
 * aquí: necesita `MediaRecorder`, un lienzo que pinte de verdad y un vídeo
 * que exista. Lo que sí se puede probar, y es lo que rompe en silencio, es
 * la parte que DECIDE:
 *
 *   · que un vídeo ya pequeño no se toque (recodificar por recodificar
 *     solo quita calidad y hace esperar)
 *   · que uno de 4K sí, aunque pese poco
 *   · y sobre todo que, cuando el navegador no sabe hacerlo, se conteste
 *     `null` en vez de lanzar — porque quien llama sube el original con
 *     ese `null`, y una excepción aquí dejaría a alguien sin poder poner
 *     su fondo por una mejora que es opcional.
 */

function archivoDe(mb: number): File {
  return new File([new Uint8Array(Math.round(mb * 1024 * 1024))], 'fondo.mp4', {
    type: 'video/mp4',
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('conviene', () => {
  it('un vídeo ya ligero y a 1080p se deja en paz', () => {
    expect(conviene(archivoDe(6), 1920)).toBe(false);
  });

  it('pesado, aunque sea 1080p', () => {
    expect(conviene(archivoDe(12), 1920)).toBe(true);
  });

  /* El caso del primer vídeo real que se subió: 4K. Aunque pesara poco,
     descodificar esa medida en cada fotograma es el trabajo que atasca a
     las máquinas sin aceleración. */
  it('4K siempre, aunque pese poco', () => {
    expect(conviene(archivoDe(3), 3840)).toBe(true);
  });

  it('justo en el límite de ancho, no', () => {
    expect(conviene(archivoDe(1), 1920)).toBe(false);
    expect(conviene(archivoDe(1), 1922)).toBe(true);
  });
});

describe('sePuedeEncoger', () => {
  it('sin MediaRecorder, no', () => {
    expect(sePuedeEncoger()).toBe(false);
  });

  it('con MediaRecorder pero sin ningún formato que sepa hacer, tampoco', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false });
    expect(sePuedeEncoger()).toBe(false);
  });

  it('con MediaRecorder y un formato, sí', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (t: string) => t.startsWith('video/webm') });
    /* Un objeto pelado y no una clase: aquí no hay DOM, y `sePuedeEncoger`
       solo mira que exista `HTMLCanvasElement.prototype.captureStream` y
       que sea una función. Con eso basta para probar la decisión, que es
       lo único que vive en este fichero. */
    vi.stubGlobal('HTMLCanvasElement', { prototype: { captureStream: () => ({}) } });
    expect(sePuedeEncoger()).toBe(true);
  });
});

describe('encogerVideo', () => {
  /* LA PRUEBA QUE IMPORTA. Quien llama hace `if (chico) …` y sube el
     original si no. Lanzar en vez de devolver `null` le costaría el fondo
     a alguien cuyo navegador simplemente no sabe recodificar. */
  it('si el navegador no sabe, lo dice y no lanza', async () => {
    const r = await encogerVideo(archivoDe(40));
    expect(r.encogido).toBe(false);
    /* Y con MOTIVO. Devolver un `null` pelado fue el fallo de la primera
       version: la subida salia con el archivo intacto y no habia forma de
       distinguir «fallo» de «no hacia falta». */
    expect(r.encogido === false && r.motivo).toMatch(/no sabe recodificar/i);
  });
});
