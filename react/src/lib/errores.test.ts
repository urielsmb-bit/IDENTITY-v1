import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* Un proyecto de mentira: sin esto `hayBackend()` depende del `.env` de
   quien corra las pruebas. */
vi.mock('@/config', () => ({
  CONFIG: {
    SUPABASE_URL: 'https://abcd.supabase.co',
    SUPABASE_KEY: 'clave-anonima',
    hayBackend: () => true,
  },
}));

import { avisarError, esRuido, aTexto, _reiniciarParaPruebas } from './errores';

/**
 * El aviso de errores.
 *
 * Lo que se prueba es que avise de lo que importa y SOLO de eso: un fallo
 * de verdad llega una vez; el ruido, los repetidos y el exceso no llegan. Y
 * que nunca mande la direccion entera, que es donde viajan los tokens.
 */

function almacen(datos: Record<string, string> = {}) {
  return { getItem: (k: string) => datos[k] ?? null } as Storage;
}

let envios: Array<{ url: string; cabeceras: Record<string, string>; cuerpo: Record<string, unknown> }>;

beforeEach(() => {
  _reiniciarParaPruebas();
  envios = [];
  vi.stubEnv('DEV', false);
  vi.stubGlobal('window', { location: { pathname: '/shark', search: '?code=secreto', hash: '#access_token=x' } });
  vi.stubGlobal('localStorage', almacen());
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      envios.push({
        url,
        cabeceras: init.headers as Record<string, string>,
        cuerpo: JSON.parse(String(init.body)),
      });
      return new Response(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('avisar de un fallo', () => {
  it('manda un fallo de verdad, con la ruta y sin el ? ni el #', () => {
    avisarError(new TypeError("Cannot read properties of undefined (reading 'x')"));
    expect(envios).toHaveLength(1);
    expect(envios[0]!.url).toBe('https://abcd.supabase.co/rest/v1/rpc/registrar_error');
    expect(envios[0]!.cuerpo).toMatchObject({
      p_mensaje: "TypeError: Cannot read properties of undefined (reading 'x')",
      p_donde: '/shark',
      p_origen: 'error',
    });
    expect(JSON.stringify(envios[0]!.cuerpo)).not.toContain('secreto');
    expect(JSON.stringify(envios[0]!.cuerpo)).not.toContain('access_token');
  });

  it('el mismo fallo dos veces es un aviso', () => {
    const e = new Error('se rompio');
    avisarError(e);
    avisarError(e);
    expect(envios).toHaveLength(1);
  });

  /* Un bucle que revienta cien veces por segundo es UN problema. */
  it('no pasa de cinco avisos por visita', () => {
    for (let i = 0; i < 20; i++) avisarError(new Error(`fallo ${i}`));
    expect(envios).toHaveLength(5);
  });

  it('en desarrollo no manda nada', () => {
    vi.stubEnv('DEV', true);
    avisarError(new Error('en local'));
    expect(envios).toHaveLength(0);
  });

  it('nunca lanza, aunque falle hasta el envio', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('sin red');
    });
    expect(() => avisarError(new Error('x'))).not.toThrow();
  });
});

describe('la sesion', () => {
  const llave = 'sb-abcd-auth-token';

  it('con sesion viva, va con su token: la cuenta la pone el servidor', () => {
    const vence = Math.floor(Date.now() / 1000) + 3600;
    vi.stubGlobal('localStorage', almacen({ [llave]: JSON.stringify({ access_token: 'tok', expires_at: vence }) }));
    avisarError(new Error('con sesion'));
    expect(envios[0]!.cabeceras.authorization).toBe('Bearer tok');
  });

  /* Con un token caducado el servidor contesta 401 y el aviso se pierde. */
  it('con la sesion caducada, va con la clave anonima', () => {
    const vencio = Math.floor(Date.now() / 1000) - 60;
    vi.stubGlobal('localStorage', almacen({ [llave]: JSON.stringify({ access_token: 'viejo', expires_at: vencio }) }));
    avisarError(new Error('caducada'));
    expect(envios[0]!.cabeceras.authorization).toBe('Bearer clave-anonima');
  });
});

describe('lo que es ruido', () => {
  it('lo que revienta dentro de una extension no es nuestro', () => {
    expect(esRuido('TypeError: x', 'Error\n    at f (chrome-extension://abc/content.js:1:2)')).toBe(true);
  });

  it('«Script error.», el aviso de ResizeObserver y los cortes de red', () => {
    expect(esRuido('Script error.', '')).toBe(true);
    expect(esRuido('ResizeObserver loop completed with undelivered notifications.', '')).toBe(true);
    expect(esRuido('TypeError: Failed to fetch', '')).toBe(true);
    expect(esRuido('AbortError: The user aborted a request.', '')).toBe(true);
  });

  it('un fallo nuestro no es ruido', () => {
    expect(esRuido("TypeError: Cannot read properties of undefined (reading 'x')", 'at f (https://sharee.fun/assets/index-abc.js:1:2)')).toBe(false);
  });
});

describe('convertir lo que llegue en texto', () => {
  it('un throw de un texto suelto', () => {
    expect(aTexto('algo raro').mensaje).toBe('algo raro');
  });

  it('una promesa rechazada con un objeto', () => {
    expect(aTexto({ code: 42 }).mensaje).toBe('{"code":42}');
  });
});
