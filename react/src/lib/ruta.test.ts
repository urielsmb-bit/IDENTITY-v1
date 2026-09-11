import { describe, it, expect } from 'vitest';
import { rutaSegura } from './utils';

/**
 * El «vuelve aquí» de después de entrar.
 *
 * `/entrar?volver=…` lleva el destino en la barra de direcciones, así que lo
 * escribe quien quiera. Si se acepta una dirección entera, el resultado es un
 * redirector abierto: un enlace que empieza en sharee.fun —y que por eso se
 * comparte y se pulsa— y termina en el sitio de otro. Es la pieza con la que
 * se montan las páginas de phishing convincentes.
 *
 * Se prueba aparte porque la regla estaba escrita tres veces —el camino del
 * correo, el de Discord y el de Google— y una de las tres se había quedado
 * sin ella.
 */
describe('a donde se puede volver despues de entrar', () => {
  it('deja pasar una ruta de la propia pagina', () => {
    expect(rutaSegura('/dashboard')).toBe('/dashboard');
    expect(rutaSegura('/analytics?dias=7')).toBe('/analytics?dias=7');
    expect(rutaSegura('/')).toBe('/');
  });

  it('no deja salir a otro dominio', () => {
    expect(rutaSegura('https://evil.example')).toBe('/dashboard');
    expect(rutaSegura('http://evil.example/login')).toBe('/dashboard');
  });

  /* La de verdad. `//evil.example` PARECE una ruta —empieza por barra— pero
     el navegador la lee como «el mismo esquema, otro servidor»: es una
     dirección absoluta disfrazada, y es la forma con la que se cuela por
     casi todas las comprobaciones escritas a ojo. */
  it('no deja pasar la absoluta disfrazada de ruta', () => {
    expect(rutaSegura('//evil.example')).toBe('/dashboard');
    expect(rutaSegura('//evil.example/robar')).toBe('/dashboard');
    expect(rutaSegura('///evil.example')).toBe('/dashboard');
  });

  it('no deja pasar un esquema ejecutable', () => {
    expect(rutaSegura('javascript:alert(1)')).toBe('/dashboard');
    expect(rutaSegura('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
  });

  it('no deja pasar una ruta sin barra, que se pegaria al origen', () => {
    // `origin + 'evil.example'` daría «https://sharee.funevil.example».
    expect(rutaSegura('evil.example')).toBe('/dashboard');
    expect(rutaSegura('dashboard')).toBe('/dashboard');
  });

  it('trata lo vacio y lo que no es texto como «a ningun sitio»', () => {
    expect(rutaSegura('')).toBe('/dashboard');
    expect(rutaSegura(null)).toBe('/dashboard');
    expect(rutaSegura(undefined)).toBe('/dashboard');
    expect(rutaSegura(123)).toBe('/dashboard');
    expect(rutaSegura({ toString: () => '//evil.example' })).toBe('/dashboard');
  });

  it('admite otro destino por defecto', () => {
    expect(rutaSegura('https://evil.example', '/')).toBe('/');
  });
});
