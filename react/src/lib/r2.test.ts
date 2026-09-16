import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Pruebas de la subida a R2.
 *
 * Lo que se vigila aquí no es que funcione el camino feliz —eso se ve a la
 * primera— sino las dos cosas que fallan en silencio:
 *
 *   · que el `content-type` que se MANDA sea el mismo que se FIRMÓ. Va
 *     dentro de la firma a propósito, para que un permiso pedido para un
 *     mp4 no sirva para dejar un `.html` en un dominio de sharee. Si el
 *     cliente manda otro, R2 contesta 403 — o sea que un descuido aquí se
 *     ve como «no se pudo subir» y no como lo que es.
 *
 *   · que lo que se guarda en el perfil sea la dirección PÚBLICA y no la
 *     firmada. La firmada lleva las credenciales en la query y caduca a
 *     los diez minutos: guardarla sería publicar un permiso de escritura
 *     y además tener el fondo roto al rato.
 */

vi.mock('@/config', () => ({
  CONFIG: {
    SUPABASE_URL: 'https://proyecto.supabase.co',
    SUPABASE_KEY: 'clave-anonima',
    R2: true,
  },
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-de-prueba' } } }) },
  },
}));

const PERMISO = {
  subirA: 'https://cuenta.r2.cloudflarestorage.com/cubo/fondos/abc.mp4?X-Amz-Signature=xxx',
  url: 'https://cdn.sharee.fun/fondos/abc.mp4',
  contentType: 'video/mp4',
};

let pedidas: Array<{ url: string; cuerpo: unknown }> = [];
let enviados: Array<{ url: string; cabeceras: Record<string, string> }> = [];

/** Un XMLHttpRequest de mentira, que es lo que usa la subida para poder
 *  contar el avance. */
class XHRdeMentira {
  static estado = 200;
  upload = { onprogress: null as null | ((e: ProgressEvent) => void) };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  onabort: null | (() => void) = null;
  status = 0;
  responseText = '';
  private url = '';
  private cabeceras: Record<string, string> = {};

  open(_m: string, url: string) { this.url = url; }
  setRequestHeader(k: string, v: string) { this.cabeceras[k] = v; }
  abort() { this.onabort?.(); }
  send(_cuerpo: unknown) {
    enviados.push({ url: this.url, cabeceras: this.cabeceras });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);
    this.status = XHRdeMentira.estado;
    this.responseText = XHRdeMentira.estado >= 300 ? '<Error>NoSuchBucket</Error>' : '';
    this.onload?.();
  }
}

beforeEach(() => {
  pedidas = [];
  enviados = [];
  XHRdeMentira.estado = 200;
  vi.resetModules();
  vi.stubGlobal('XMLHttpRequest', XHRdeMentira);
  vi.stubGlobal('fetch', async (url: string, opciones?: RequestInit) => {
    pedidas.push({ url: String(url), cuerpo: JSON.parse(String(opciones?.body ?? '{}')) });
    return { ok: true, status: 200, json: async () => PERMISO } as Response;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('subirAR2', () => {
  it('pide el permiso a la función de borde con la sesión', async () => {
    const { subirAR2 } = await import('./r2');
    await subirAR2(new File(['x'.repeat(10)], 'fondo.mp4', { type: 'video/mp4' }), 'fondo');

    expect(pedidas).toHaveLength(1);
    expect(pedidas[0]!.url).toBe('https://proyecto.supabase.co/functions/v1/r2-subida');
    expect(pedidas[0]!.cuerpo).toEqual({ tipo: 'fondo', contentType: 'video/mp4', tamano: 10 });
  });

  it('manda el content-type que se firmó, no el que le parezca', async () => {
    const { subirAR2 } = await import('./r2');
    await subirAR2(new File(['x'], 'fondo.mp4', { type: 'video/mp4' }), 'fondo');
    expect(enviados[0]!.cabeceras['content-type']).toBe(PERMISO.contentType);
    expect(enviados[0]!.url).toBe(PERMISO.subirA);
  });

  it('devuelve la dirección pública, nunca la firmada', async () => {
    const { subirAR2 } = await import('./r2');
    const url = await subirAR2(new File(['x'], 'f.mp4', { type: 'video/mp4' }), 'fondo');
    expect(url).toBe('https://cdn.sharee.fun/fondos/abc.mp4');
    expect(url).not.toContain('X-Amz-Signature');
  });

  /* Algunos `.mov` llegan sin tipo, y un blob recién hecho por el canvas
     también. La función de borde exige un tipo de la lista blanca, así que
     sin deducirlo rechazaría una subida perfectamente válida. */
  it('deduce el tipo por la extensión cuando el navegador no lo dice', async () => {
    const { subirAR2 } = await import('./r2');
    await subirAR2(new File(['x'], 'fondo.mov', { type: '' }), 'fondo');
    expect((pedidas[0]!.cuerpo as { contentType: string }).contentType).toBe('video/quicktime');
  });

  it('un fallo de R2 no se traga', async () => {
    XHRdeMentira.estado = 403;
    const { subirAR2 } = await import('./r2');
    await expect(
      subirAR2(new File(['x'], 'f.mp4', { type: 'video/mp4' }), 'fondo'),
    ).rejects.toThrow(/403/);
  });

  it('va contando lo que lleva subido', async () => {
    const { subirAR2 } = await import('./r2');
    const pasos: number[] = [];
    await subirAR2(new File(['x'], 'f.mp4', { type: 'video/mp4' }), 'fondo', {
      alAvanzar: (a) => pasos.push(a.pct),
    });
    expect(pasos).toContain(50);
  });
});
