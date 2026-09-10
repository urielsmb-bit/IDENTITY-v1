import { describe, it, expect } from 'vitest';
import {
  tituloTarjeta,
  descripcionTarjeta,
  imagenTarjeta,
  linea,
} from './tarjeta';

/**
 * Estas cuatro funciones las llaman DOS runtimes distintos: la función del
 * borde que escribe las etiquetas `og:` que lee Discord, y la
 * previsualización del editor que te enseña cómo va a quedar.
 *
 * Si dijeran cosas distintas, la previsualización sería mentira — y una
 * previa que miente es peor que no tener ninguna. Por eso el sitio es uno
 * solo y por eso está probado.
 */

describe('el título de la tarjeta', () => {
  it('lleva el nombre y el @usuario', () => {
    expect(tituloTarjeta({ username: 'shark', name: 'Uriel' }))
      .toBe('Uriel (@shark) · sharee');
  });

  it('sin nombre, usa el usuario en su lugar', () => {
    // Un «(@shark) · sharee» suelto, empezando por paréntesis, no se lee.
    expect(tituloTarjeta({ username: 'shark' })).toBe('shark (@shark) · sharee');
  });

  it('un nombre kilométrico no se lleva la tarjeta entera', () => {
    const t = tituloTarjeta({ username: 'a', name: 'x'.repeat(500) });
    expect(t.length).toBeLessThan(90);
  });

  it('los saltos de línea se aplanan', () => {
    // En un atributo HTML un salto de línea rompe el renglón del título.
    expect(tituloTarjeta({ username: 'a', name: 'Uri\nel' })).toBe('Uri el (@a) · sharee');
  });
});

describe('la descripción', () => {
  it('primero la biografía', () => {
    expect(descripcionTarjeta({ username: 'a', bio: 'hago cosas', title: 'Dev' }))
      .toBe('hago cosas');
  });

  it('sin biografía, el oficio', () => {
    expect(descripcionTarjeta({ username: 'a', title: 'Dev' })).toBe('Dev');
  });

  it('sin nada, una frase que al menos diga de quién es', () => {
    // Un `og:description` vacío deja la tarjeta con un hueco donde debería
    // estar el motivo para pulsar.
    expect(descripcionTarjeta({ username: 'shark' }))
      .toBe('El perfil de @shark en sharee.');
  });

  it('una biografía de mil caracteres se recorta', () => {
    expect(descripcionTarjeta({ username: 'a', bio: 'y'.repeat(1000) }).length).toBe(160);
  });

  it('una biografía de sólo espacios cuenta como vacía', () => {
    expect(descripcionTarjeta({ username: 'a', bio: '   \n  ', title: 'Dev' })).toBe('Dev');
  });
});

describe('la imagen', () => {
  it('acepta https', () => {
    const u = 'https://x.supabase.co/storage/v1/object/public/media/a/avatar.png';
    expect(imagenTarjeta(u)).toBe(u);
  });

  it('rechaza `media:`, que vive sólo en el navegador de su dueño', () => {
    // Esa foto nunca sale de su máquina: como imagen de una tarjeta no existe.
    expect(imagenTarjeta('media:abc123')).toBe('');
  });

  it('rechaza http a secas', () => {
    // Una imagen sin cifrar en una página cifrada no la carga nadie.
    expect(imagenTarjeta('http://x/a.png')).toBe('');
  });

  it('rechaza lo que no es una dirección', () => {
    expect(imagenTarjeta('javascript:alert(1)')).toBe('');
    expect(imagenTarjeta(undefined)).toBe('');
    expect(imagenTarjeta(null)).toBe('');
    expect(imagenTarjeta({})).toBe('');
  });
});

describe('linea', () => {
  it('junta los espacios seguidos en uno', () => {
    expect(linea('a   b\n\nc', 50)).toBe('a b c');
  });

  it('aguanta lo que no es texto', () => {
    expect(linea(null, 10)).toBe('');
    expect(linea(undefined, 10)).toBe('');
    expect(linea(42, 10)).toBe('42');
  });
});
