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
  /* El caso del primer video real: 4K. Aunque pese poco, descodificar esa
     medida en cada fotograma es el trabajo que atasca a las maquinas sin
     aceleracion. Manda por encima de cualquier cuenta de bitrate. */
  it('4K siempre, aunque pese poco y venga bien comprimido', () => {
    expect(hayQueTocarlo(bytesDe(3), 3840, 2160, 20).si).toBe(true);
  });

  /* El liston sube con el tope: 12,6 Mbps es normal para un 2K (objetivo
     11,1, liston 15,5) y derroche para un 1080p (objetivo 6,2, liston
     8,7). Con un tope plano los dos recibian el mismo veredicto. */
  it('el mismo bitrate se juzga distinto segun la medida', () => {
    expect(hayQueTocarlo(bytesDe(30), 2560, 1440, 20).si).toBe(false);
    expect(hayQueTocarlo(bytesDe(30), 1920, 1080, 20).si).toBe(true);
  });

  it('justo en el limite de ancho no se toca, un pixel mas si', () => {
    expect(hayQueTocarlo(bytesDe(3), 2560, 1440, 20).si).toBe(false);
    expect(hayQueTocarlo(bytesDe(3), 2562, 1440, 20).si).toBe(true);
  });

  /* LO QUE SE PIDIO: que lo que ya viene a 2K se quede a 2K, y solo se
     reduzca lo que pasa de ahi. Antes el tope era 1920, asi que un 2K
     entraba al codificador solo por ser mas ancho de la cuenta y salia a
     1080p aunque estuviera perfecto. */
  it('un 2K bien comprimido se queda tal cual, no baja a 1080p', () => {
    // 2560x1440, 20 s, 20 MB -> 8,4 Mbps, por debajo de 11,1 x 1,4
    const r = hayQueTocarlo(bytesDe(20), 2560, 1440, 20);
    expect(r.si).toBe(false);
    if (!r.si) expect(r.motivo).toContain('2560×1440');
  });

  it('un video diminuto se deja en paz', () => {
    const r = hayQueTocarlo(bytesDe(3), 1920, 1080, 10);
    expect(r.si).toBe(false);
    if (!r.si) expect(r.motivo).toContain('ya pesaba poco');
  });

  /* LA REGRESION QUE MOTIVO TODO ESTO.
     El umbral era de PESO TOTAL, 10 MB. Un video de 26 segundos a unos
     razonables 4,2 Mbps son 13,7 MB, asi que cruzaba el umbral y se
     recodificaba un archivo que estaba perfectamente — y salia peor, que
     es lo que se vio publicado. El peso total crece con la duracion; la
     duracion no dice nada de si algo esta bien comprimido. */
  it('uno largo pero bien comprimido NO se toca, aunque pese mucho', () => {
    // 1920x1080, 26 s, 13,7 MB -> 4,4 Mbps, por debajo de 6,2 x 1,4
    const r = hayQueTocarlo(bytesDe(13.7), 1920, 1080, 26);
    expect(r.si).toBe(false);
    if (!r.si) expect(r.motivo).toContain('ya venia bien comprimido');
  });

  it('uno corto pero derrochando SI se toca', () => {
    // 1920x1080, 10 s, 25 MB -> 21 Mbps, muy por encima
    expect(hayQueTocarlo(bytesDe(25), 1920, 1080, 10).si).toBe(true);
  });

  /* El objetivo escala con el tamaño: lo que es derroche a 720p es
     normal a 1080p. Con un numero plano los dos recibian lo mismo. */
  it('el liston depende de la medida, no es uno solo', () => {
    // 5 Mbps: normal para 1080p (objetivo 6,2), derroche para 720p (2,8)
    expect(hayQueTocarlo(bytesDe(12.5), 1920, 1080, 20).si).toBe(false);
    expect(hayQueTocarlo(bytesDe(12.5), 1280, 720, 20).si).toBe(true);
  });

  /* LOS DOS QUE SE PUBLICARON EMBORRONADOS, con sus medidas de verdad
     leidas de produccion. Ya salieron del codificador, asi que vuelven a
     entrar a 2,2 y 2,5 Mbps: la regla nueva NO los toca, que es lo
     correcto —recodificar algo ya aplastado solo lo aplasta mas—. Para
     que se arreglen hay que volver a subir el ORIGINAL. */
  it('no vuelve a pasar por el codificador lo que ya salio de el', () => {
    // juanbeltran: 1920x1080, 26,03 s, 6,89 MB -> 2,22 Mbps
    expect(hayQueTocarlo(7222780, 1920, 1080, 26.03).si).toBe(false);
    // shark: 1920x816, 19,47 s, 5,75 MB -> 2,48 Mbps
    expect(hayQueTocarlo(6026612, 1920, 816, 19.47).si).toBe(false);
  });

  /* Sin duracion no hay bitrate que calcular. Recodificar es la respuesta
     segura: como mucho se gasta tiempo, y nunca se deja pasar un archivo
     enorme por no poder medirlo. */
  it('sin duracion legible, se recodifica', () => {
    expect(hayQueTocarlo(bytesDe(30), 1920, 1080, 0).si).toBe(true);
    expect(hayQueTocarlo(bytesDe(30), 1920, 1080, Infinity).si).toBe(true);
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
