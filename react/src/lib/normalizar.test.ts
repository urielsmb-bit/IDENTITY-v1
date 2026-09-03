import { describe, it, expect } from 'vitest';
import { normalizarPerfil } from './normalizar';
import { color, medio, incrustable, numero, texto, deLista, enlace } from './validar';
import { safeUrl } from './utils';

/**
 * Pruebas del saneado.
 *
 * De todo el proyecto, esto es lo que más falta hacía: por aquí pasa TODO
 * perfil que no sea de fiar —el de otra persona traído del servidor, y el
 * propio traído de `localStorage`, que cualquiera puede editar a mano— antes
 * de convertirse en HTML y en CSS de una página.
 *
 * Las de abajo no son pruebas de que «funciona»; cada una es un ataque o un
 * dato roto concreto que no debe pasar.
 */

describe('color()', () => {
  it('acepta un hexadecimal normal', () => {
    expect(color('#A855F7')).toBe('#A855F7');
  });

  it('no deja colar una expresión de CSS por el hueco del color', () => {
    // `--u-acento: red; background: url(...)` cerraría la declaración y
    // abriría otra: lo que empieza como un color acaba pidiendo una imagen a
    // un servidor ajeno con la dirección de quien visita.
    expect(color('red; background:url(//x.com/a.png)')).not.toContain('url');
    expect(color('#fff; }')).not.toContain('}');
  });

  it('cae al valor por defecto cuando le dan basura', () => {
    expect(color('no-soy-un-color', '#000000')).toBe('#000000');
    expect(color(null, '#000000')).toBe('#000000');
    expect(color(undefined, '#000000')).toBe('#000000');
  });
});

describe('medio()', () => {
  it('deja pasar https y las URI de datos de imagen', () => {
    expect(medio('https://cdn.ejemplo.com/a.png')).toBe('https://cdn.ejemplo.com/a.png');
    expect(medio('data:image/png;base64,AAAA')).toContain('data:image/png');
  });

  it('bloquea javascript: en el hueco de una imagen', () => {
    // `<img src>` no ejecuta javascript:, pero este mismo valor se usa en
    // fondos y en enlaces, y ahí sí.
    expect(medio('javascript:alert(1)')).toBe('');
    expect(medio('JaVaScRiPt:alert(1)')).toBe('');
  });

  it('bloquea las URI de datos que no son imagen', () => {
    expect(medio('data:text/html,<script>alert(1)</script>')).toBe('');
  });
});

describe('incrustable()', () => {
  it('no deja incrustar un sitio cualquiera', () => {
    // Un iframe a un dominio arbitrario dentro del perfil de alguien es una
    // pantalla entera bajo control ajeno.
    expect(incrustable('https://sitio-cualquiera.com/x')).toBe('');
  });
});

describe('numero()', () => {
  it('recorta a los límites en vez de aceptar cualquier cosa', () => {
    expect(numero(9999, 0, 100, 0)).toBe(100);
    expect(numero(-50, 0, 100, 0)).toBe(0);
  });

  it('no deja pasar NaN ni Infinity', () => {
    // Infinity cae al valor por defecto y no al máximo. Es lo correcto:
    // un infinito no es «muchísimo», es un dato roto, y recortarlo a 100
    // sería inventarse una intención que nadie tuvo.
    expect(numero(NaN, 0, 100, 7)).toBe(7);
    expect(numero(Infinity, 0, 100, 7)).toBe(7);
    expect(numero('hola', 0, 100, 7)).toBe(7);
  });
});

describe('texto()', () => {
  it('corta por el tope', () => {
    expect(texto('a'.repeat(500), 10)).toHaveLength(10);
  });

  it('convierte lo que no es texto en cadena vacía', () => {
    expect(texto(null)).toBe('');
    expect(texto({ a: 1 })).toBe('');
    expect(texto([1, 2])).toBe('');
  });
});

describe('safeUrl()', () => {
  // Es el portero de verdad: TODOS los `href` que pintan una dirección
  // escrita por alguien pasan por aquí. Si algo se rompe, se rompe aquí.
  it('deja pasar lo que puede ir en un enlace', () => {
    expect(safeUrl('https://ejemplo.com')).toBe('https://ejemplo.com');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeUrl('#seccion')).toBe('#seccion');
  });

  it('le pone https a lo que se escribe sin esquema', () => {
    expect(safeUrl('ejemplo.com/perfil')).toBe('https://ejemplo.com/perfil');
  });

  it('manda a ninguna parte todo lo demás', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(safeUrl('vbscript:msgbox(1)')).toBe('#');
    expect(safeUrl('')).toBe('#');
    expect(safeUrl(null)).toBe('#');
  });
});

describe('enlace()', () => {
  it('conserva las direcciones normales', () => {
    expect(enlace('https://ejemplo.com/x')).toBe('https://ejemplo.com/x');
    expect(enlace('ejemplo.com/x')).toBe('ejemplo.com/x');
    expect(enlace('/dentro-del-sitio')).toBe('/dentro-del-sitio');
  });

  it('tira los esquemas que ejecutan cosas', () => {
    expect(enlace('javascript:alert(1)')).toBe('');
    expect(enlace('data:text/html,x')).toBe('');
    expect(enlace('vbscript:x')).toBe('');
  });

  it('no se deja partir el esquema con espacios', () => {
    // `java\nscript:` y `java\tscript:` pasan un `startsWith` ingenuo y el
    // navegador los ejecuta igual.
    expect(enlace('java\nscript:alert(1)')).toBe('');
    expect(enlace('java\tscript:alert(1)')).toBe('');
    expect(enlace('  javascript:alert(1)')).toBe('');
  });

  it('no confunde una absoluta disfrazada con una relativa', () => {
    // `//otro.com` es absoluta: hereda el esquema y sale del sitio.
    expect(enlace('//otro.com/x')).toBe('');
  });
});

describe('deLista()', () => {
  it('sólo deja lo que está en la lista', () => {
    expect(deLista('b', ['a', 'b'], 'a')).toBe('b');
    expect(deLista('z', ['a', 'b'], 'a')).toBe('a');
  });
});

describe('normalizarPerfil()', () => {
  it('no se inventa campos que no le dieron', () => {
    // Su trabajo es sanear lo que llega, no rellenar lo que falta: para eso
    // está el segundo parámetro. Conviene tenerlo escrito porque el tipo de
    // retorno dice `Profile` y eso invita a suponer lo contrario.
    const p = normalizarPerfil({});
    expect(p.username).toBeUndefined();
  });

  it('rellena a partir de los valores por defecto que le pasen', () => {
    const p = normalizarPerfil({}, { username: 'base', name: 'Base' });
    expect(p.username).toBe('base');
    expect(p.name).toBe('Base');
  });

  it('aguanta lo que no es ni un objeto', () => {
    // Llega de `JSON.parse` de localStorage: puede ser cualquier cosa.
    for (const basura of [null, undefined, 0, 'texto', [], true]) {
      const p = normalizarPerfil(basura, { username: 'base' });
      expect(p.username).toBe('base');
    }
  });

  it('conserva los valores buenos en vez de aplanarlo todo', () => {
    // Esta es la prueba del fallo que ya ocurrio una vez: con los catalogos
    // vacios, `deLista` no encontraba ningun valor legal y sanear un perfil
    // le borraba el tema, la fuente y la forma del avatar.
    const p = normalizarPerfil({
      username: 'ejemplo',
      name: 'Ejemplo',
      theme: 'cyberpunk',
      avShape: 'circle',
      align: 'center',
    });
    expect(p.username).toBe('ejemplo');
    expect(p.name).toBe('Ejemplo');
    expect(p.theme).toBe('cyberpunk');
    expect(p.avShape).toBe('circle');
    expect(p.align).toBe('center');
  });

  it('limpia el nombre de usuario a lo que puede ir en una URL', () => {
    const p = normalizarPerfil({ username: '  Hola Mundo!! <script>  ' });
    expect(p.username).toMatch(/^[a-z0-9_]*$/);
  });

  it('no deja que las listas dejen de ser listas', () => {
    const p = normalizarPerfil({ socials: 'no soy una lista', blocksOff: 42 });
    expect(Array.isArray(p.socials)).toBe(true);
    expect(Array.isArray(p.blocksOff)).toBe(true);
  });

  it('descarta los enlaces con esquemas peligrosos', () => {
    const p = normalizarPerfil({
      socials: [{ net: 'x', url: 'javascript:alert(1)', label: 'X' }],
    });
    for (const s of p.socials) {
      expect(s.url.toLowerCase().startsWith('javascript:')).toBe(false);
    }
  });

  it('no se traga un avatar con javascript:', () => {
    const p = normalizarPerfil({ avatarUrl: 'javascript:alert(1)' });
    expect(p.avatarUrl).toBe('');
  });

  it('es idempotente: sanear lo ya saneado no lo cambia', () => {
    // Importa porque un perfil pasa por aquí varias veces —al cargarlo, al
    // guardarlo, al recibirlo del servidor—. Si cada pasada lo alterara, el
    // perfil se iría desdibujando solo.
    const una = normalizarPerfil({ username: 'ejemplo', name: 'Ejemplo', theme: 'cyberpunk' });
    const dos = normalizarPerfil(una);
    expect(dos).toEqual(una);
  });
});
