import { describe, it, expect, afterEach, vi } from 'vitest';
import { sePuedeEncoger, hayQueTocarlo, encogerVideo } from './comprimirVideo';

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

/** Un archivo de N megas, de D segundos: lo que define su bitrate. */
function bytesDe(mb: number): number {
  return Math.round(mb * 1024 * 1024);
}

describe('hayQueTocarlo', () => {
  /**
   * SOLO DECIDE LA MEDIDA. Y llegar aqui costo tres subidas de verdad.
   *
   * Antes habia una segunda puerta: si el archivo traia mucho mas bitrate
   * del que le pondriamos nosotros, se recodificaba. El margen se subio de
   * 1,4 a 3 y no basto, porque el problema no era el margen:
   *
   *     se pidieron 3,50 Mbps -> salieron 2,22
   *     se pidieron 6,22 Mbps -> salieron 1,67
   *     se pidieron 6,22 Mbps -> salieron 3,19
   *
   * El codificador del navegador nunca gasta lo que se le pide, y no hay
   * donde decirselo. Asi que recodificar solo se sostiene para lo unico
   * que no se arregla de otra forma: bajar el numero de pixeles. Para el
   * peso ya esta el tope de subida.
   */
  it('lo que pasa de 2K se reduce, pese lo que pese', () => {
    expect(hayQueTocarlo(bytesDe(3), 3840, 2160).si).toBe(true);
    expect(hayQueTocarlo(bytesDe(200), 2562, 1440).si).toBe(true);
  });

  it('justo en el limite no se toca, un pixel mas si', () => {
    expect(hayQueTocarlo(bytesDe(3), 2560, 1440).si).toBe(false);
    expect(hayQueTocarlo(bytesDe(3), 2562, 1440).si).toBe(true);
  });

  /* LO QUE MOTIVO EL CAMBIO, fijado para que no vuelva. Un 1080p generoso
     —el caso que el dueño subio tres veces y tres veces salio peor— pasa
     entero. Pesa mas y se ve como lo subieron. */
  it('un 1080p, pese lo que pese, pasa entero', () => {
    for (const mb of [5, 20, 50, 64]) {
      const r = hayQueTocarlo(bytesDe(mb), 1920, 1080);
      expect(r.si).toBe(false);
      if (!r.si) expect(r.motivo).toContain('se sube tal cual');
    }
  });

  it('y un 720p tambien, que el bitrate ya no decide nada', () => {
    expect(hayQueTocarlo(bytesDe(60), 1280, 720).si).toBe(false);
  });

  /* Los dos fondos que se publicaron emborronados, con sus medidas reales.
     Ya salieron del codificador: volver a pasarlos solo los aplastaria
     mas. */
  it('no vuelve a pasar por el codificador lo que ya salio de el', () => {
    expect(hayQueTocarlo(7222780, 1920, 1080).si).toBe(false);
    expect(hayQueTocarlo(6026612, 1920, 816).si).toBe(false);
  });

  it('el motivo dice la medida y el peso, para poder mirarlo luego', () => {
    const r = hayQueTocarlo(bytesDe(12), 1920, 1080);
    expect(r.si).toBe(false);
    if (!r.si) {
      expect(r.motivo).toContain('1920×1080');
      expect(r.motivo).toContain('12.0 MB');
    }
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
