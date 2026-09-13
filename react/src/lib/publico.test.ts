import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Pruebas del lector público.
 *
 * Esto sustituyó al SDK de Supabase en la ruta que recibe las visitas, y la
 * forma de romperse que tiene es silenciosa: si una URL de PostgREST se
 * construye mal —un filtro sin `eq.`, un `select` con una columna que no
 * existe, el nombre de la vista cambiado— no salta ningún error. Llega una
 * lista vacía, y una lista vacía es indistinguible de «ese perfil no existe».
 * El visitante ve un 404 y en la consola no hay nada.
 *
 * El SDK, por muy pesado que fuera, al menos hacía esto por ti. Al quitarlo
 * hay que quedarse con la parte que importaba, y esa parte es esta.
 */

const URL_BASE = 'https://proyecto.supabase.co';

vi.mock('@/config', () => ({
  CONFIG: {
    SUPABASE_URL: URL_BASE,
    SUPABASE_KEY: 'clave-anonima',
    FN_VISTAS: '',
    hayBackend: () => true,
  },
}));

/* El HTML precargado no existe en las pruebas, y esa es la rama que
   interesa: la que de verdad sale a la red. */
vi.mock('./precarga', () => ({ filaPrecargada: () => null }));

let llamadas: Array<{ url: string; opciones: RequestInit | undefined }> = [];

function responder(cuerpo: unknown, estado = 200) {
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => cuerpo,
  } as Response;
}

beforeEach(() => {
  llamadas = [];
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Deja preparada una respuesta por llamada, en orden. */
function fingirRed(...respuestas: Array<() => Response>) {
  let i = 0;
  vi.stubGlobal('fetch', (url: string, opciones?: RequestInit) => {
    llamadas.push({ url: String(url), opciones });
    const r = respuestas[Math.min(i, respuestas.length - 1)]!;
    i += 1;
    return Promise.resolve(r());
  });
}

const FILA = {
  id: 'abc',
  username: 'shark',
  apariencia: { name: 'Uriel', nameFx: 'obsidiana' },
  creado: '2026-01-01',
  actualizado: '2026-02-02',
  vistas: 42,
};

describe('cargarPerfil', () => {
  it('pide la vista pública con el filtro y la clave', async () => {
    fingirRed(() => responder([FILA]));
    const { cargarPerfil } = await import('./publico');
    const p = await cargarPerfil('shark');

    expect(llamadas).toHaveLength(1);
    const { url, opciones } = llamadas[0]!;
    expect(url).toContain(`${URL_BASE}/rest/v1/perfiles_publicos?`);
    // `eq.` no es adorno: sin el prefijo, PostgREST no filtra y devuelve
    // la primera fila de la tabla, o sea el perfil de otra persona.
    expect(url).toContain('username=eq.shark');
    expect(url).toContain('limit=1');
    const h = opciones?.headers as Record<string, string>;
    expect(h.apikey).toBe('clave-anonima');
    expect(h.authorization).toBe('Bearer clave-anonima');

    expect(p.username).toBe('shark');
    expect(p.name).toBe('Uriel');
    // Las cifras viven fuera de `apariencia` y se copian a mano: sin eso el
    // contador del perfil sale a cero aunque la base tenga el número bueno.
    expect(p.views).toBe(42);
  });

  it('un nombre que no existe es una respuesta, no un error', async () => {
    fingirRed(() => responder([]));
    const { cargarPerfil } = await import('./publico');
    await expect(cargarPerfil('nadie')).resolves.toBeNull();
  });

  /* Sin esto, un proyecto donde la migración de la vista no esté aplicada se
     queda sin perfiles y el fallo parece «no existe nadie». */
  it('si la vista pública no está, lee de la tabla', async () => {
    fingirRed(
      () => responder({ message: 'not found' }, 404),
      () => responder([{ ...FILA, vistas: undefined }]),
    );
    const { cargarPerfil } = await import('./publico');
    const p = await cargarPerfil('shark');
    expect(llamadas).toHaveLength(2);
    expect(llamadas[1]!.url).toContain('/rest/v1/perfiles?');
    expect(p.username).toBe('shark');
  });

  it('un 500 no se traga: es un fallo de verdad', async () => {
    fingirRed(() => responder({}, 500));
    const { cargarPerfil } = await import('./publico');
    await expect(cargarPerfil('shark')).rejects.toThrow();
  });

  /* El nombre viene de la URL, o sea de fuera. Sin escapar, un nombre con
     `&` o `#` partiría la consulta y el filtro se perdería. */
  it('escapa el nombre antes de meterlo en la consulta', async () => {
    fingirRed(() => responder([]));
    const { cargarPerfil } = await import('./publico');
    await cargarPerfil('a&b#c');
    expect(llamadas[0]!.url).toContain('username=eq.a%26b%23c');
  });
});

describe('concedidasDe', () => {
  const VACIO = { ids: [], caducaPlan: null };

  it('filtra por el id del perfil', async () => {
    fingirRed(() => responder([
      { insignia: 'premium', expira: null },
      { insignia: 'staff', expira: null },
    ]));
    const { concedidasDe } = await import('./publico');
    const r = await concedidasDe('abc');
    expect(llamadas[0]!.url).toContain('/rest/v1/insignias_de_perfil?');
    expect(llamadas[0]!.url).toContain('perfil_id=eq.abc');
    expect(r.ids).toEqual(['premium', 'staff']);
  });

  /* `expira` hay que PEDIRLO. Si alguien recorta el `select` para «pedir
     menos», la cuenta atras de la prueba desaparece sin que falle nada:
     el plan sigue viendose, solo que nadie avisa de que se acaba. */
  it('pide también la caducidad, no solo el nombre', async () => {
    fingirRed(() => responder([]));
    const { concedidasDe } = await import('./publico');
    await concedidasDe('abc');
    expect(decodeURIComponent(llamadas[0]!.url)).toContain('select=insignia,expira');
  });

  it('saca la caducidad del diamante, no la de otra insignia', async () => {
    fingirRed(() => responder([
      { insignia: 'staff', expira: '2026-01-01T00:00:00Z' },
      { insignia: 'premium', expira: '2026-09-19T12:00:00Z' },
    ]));
    const { concedidasDe } = await import('./publico');
    const r = await concedidasDe('abc');
    expect(r.caducaPlan).toBe('2026-09-19T12:00:00Z');
  });

  /* Null es «para siempre», que es lo que son todas las concedidas a mano.
     No puede confundirse con «se acaba ya». */
  it('un plan sin caducidad deja la fecha en null', async () => {
    fingirRed(() => responder([{ insignia: 'premium', expira: null }]));
    const { concedidasDe } = await import('./publico');
    expect((await concedidasDe('abc')).caducaPlan).toBeNull();
  });

  it('sin id no sale a la red', async () => {
    fingirRed(() => responder([]));
    const { concedidasDe } = await import('./publico');
    expect(await concedidasDe('')).toEqual(VACIO);
    expect(llamadas).toHaveLength(0);
  });

  /* La vista puede no existir todavía —o `expira`, si la migración 0025 no
     está aplicada—. Que falten las insignias concedidas es aceptable; que
     reviente la carga del perfil entero, no. */
  it('si la vista no existe devuelve vacío en vez de reventar', async () => {
    fingirRed(() => responder({}, 404));
    const { concedidasDe } = await import('./publico');
    await expect(concedidasDe('abc')).resolves.toEqual(VACIO);
  });
});

describe('presenciaDe', () => {
  it('pide todas las columnas a propósito', async () => {
    fingirRed(() => responder([{ discord_id: '1', estado: 'online' }]));
    const { presenciaDe } = await import('./publico');
    const p = await presenciaDe('123456789012345678');
    // `select=*` y no una lista de columnas: nombrarlas ata la lectura a que
    // una migración esté aplicada, y si falta una, PostgREST tumba la
    // consulta entera y el perfil se queda sin estado, sin canción y sin
    // punto. No sin lo nuevo: sin nada.
    expect(llamadas[0]!.url).toContain('select=*');
    expect(llamadas[0]!.url).toContain('discord_id=eq.123456789012345678');
    expect(p.estado).toBe('online');
  });
});
