import { describe, it, expect } from 'vitest';
import { avatarDe } from './avatar';
import type { Profile } from '@/types';

const perfil = (x: Partial<Profile>) => avatarDe(x);

/**
 * Las cuatro reglas del avatar.
 *
 * No son cuatro casos de una funcion: son la promesa que se le hace a quien
 * conecta Discord —que no le vamos a tocar la foto que eligio— y a quien
 * todavia no ha elegido ninguna —que no va a tener un hueco—. Por eso se
 * prueban aunque la funcion quepa en una pantalla.
 */
describe('que cara le toca a un perfil', () => {
  const MIA = 'https://x/la-mia.png';
  const DISCORD = 'https://cdn.discordapp.com/avatars/1/abc.png';

  it('si pusiste foto, manda la tuya aunque tengas Discord', () => {
    const a = perfil({ username: 'yo', avatarUrl: MIA, discordAvatar: DISCORD });
    expect(a.url).toBe(MIA);
    expect(a.deDiscord).toBe(false);
  });

  it('si conectaste Discord sin foto, hereda la de Discord', () => {
    const a = perfil({ username: 'yo', discordAvatar: DISCORD });
    expect(a.url).toBe(DISCORD);
    expect(a.deDiscord).toBe(true);
  });

  it('si quitas la tuya, vuelve la de Discord', () => {
    const a = perfil({ username: 'yo', avatarUrl: '', discordAvatar: DISCORD });
    expect(a.url).toBe(DISCORD);
  });

  it('sin ninguna de las dos, la inicial', () => {
    const a = perfil({ username: 'shark', name: 'sharkiii' });
    expect(a.url).toBe('');
    expect(a.signo).toBe('S');
  });

  it('sin nombre visible, la inicial del @usuario', () => {
    expect(perfil({ username: 'nuevo_2026' }).signo).toBe('N');
  });

  it('el emoji que pusiste gana a la inicial: lo elegiste tu', () => {
    expect(perfil({ username: 'pepe', name: 'Pepe', emoji: '🦈' }).signo).toBe('🦈');
  });

  it('un perfil sin nada no se queda sin signo', () => {
    expect(perfil({}).signo).toBe('?');
  });
});

describe('el color de la inicial', () => {
  it('es el mismo para la misma persona, siempre', () => {
    const a = perfil({ username: 'shark' }).color;
    const b = perfil({ username: 'shark', name: 'otro nombre' }).color;
    expect(a).toBe(b);
  });

  it('sale del @usuario y no del nombre, que se cambia', () => {
    expect(perfil({ username: 'shark', name: 'A' }).color)
      .toBe(perfil({ username: 'shark', name: 'B' }).color);
  });

  const tonoDe = (u: string) =>
    Number(/hsl\((\d+)/.exec(perfil({ username: u }).color)?.[1]);

  /* Lo que se vigila NO es que dos nombres cualesquiera caigan lejos: eso
     ningun hash lo puede prometer, y pedirselo es escribir una prueba que
     falla sola algun dia. Lo que se vigila es el AGRUPAMIENTO, que es el
     fallo que hubo: sin la vuelta de mezcla de `tono`, los tres usuarios de
     la base salian en 206, 214 y 145 —los tres azules, 69 grados de nada—
     y una rejilla de perfiles se veia de un solo color. */
  it('los usuarios de verdad no salen todos del mismo color', () => {
    const tonos = ['shark', 'iamerick', 'arlettex3'].map(tonoDe);
    expect(tonos.every(Number.isFinite)).toBe(true);
    expect(Math.max(...tonos) - Math.min(...tonos)).toBeGreaterThan(100);
  });

  it('una docena de nombres recorre casi toda la rueda', () => {
    const sectores = new Set(
      ['ana', 'luis', 'maria', 'pedro', 'juan', 'sofia',
       'carlos', 'elena', 'diego', 'lucia', 'pablo', 'marta']
        .map((u) => Math.floor(tonoDe(u) / 60)),
    );
    expect(sectores.size).toBeGreaterThanOrEqual(4);
  });

  it('la luz es fija, para que el blanco de encima se lea siempre', () => {
    for (const u of ['a', 'bb', 'ccc', 'dddd', 'eeeee']) {
      expect(perfil({ username: u }).color).toMatch(/ 52% 44%\)$/);
    }
  });
});
