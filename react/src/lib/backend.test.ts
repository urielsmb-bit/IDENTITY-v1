import { describe, it, expect } from 'vitest';
import { rutaDeUrl } from './backend';

/**
 * Pruebas del analizador de rutas de Storage.
 *
 * Esta funcion decide QUE ARCHIVO SE BORRA. Equivocarse aquí no es un
 * fallo de dibujo: es borrar algo que no tocaba, o dejar basura que
 * cuenta para el tope de ocho archivos por cuenta y acaba impidiendo
 * subir nada.
 *
 * La base de datos ya impide borrar carpetas ajenas —su politica exige
 * que la primera carpeta sea el uid— asi que esto no es la cerradura.
 * Pero sí es lo que evita que ni siquiera lo intentemos, y sobre todo lo
 * que evita tratar como nuestro un enlace que el usuario pegó a mano.
 */
const UID = '11111111-2222-3333-4444-555555555555';
const OTRO = '99999999-8888-7777-6666-555555555555';
const CUBO = 'media';
const BASE = `https://abc.supabase.co/storage/v1/object/public/${CUBO}/`;

describe('rutaDeUrl', () => {
  it('saca la ruta de una direccion nuestra', () => {
    expect(rutaDeUrl(`${BASE}${UID}/fondo.mp4`, UID, CUBO)).toBe(`${UID}/fondo.mp4`);
  });

  it('ignora el parametro de cache que añade subirMedio', () => {
    expect(rutaDeUrl(`${BASE}${UID}/avatar.png?v=1730000000`, UID, CUBO))
      .toBe(`${UID}/avatar.png`);
  });

  it('devuelve null para la carpeta de otra persona', () => {
    expect(rutaDeUrl(`${BASE}${OTRO}/fondo.mp4`, UID, CUBO)).toBeNull();
  });

  it('devuelve null para un enlace de Vimeo', () => {
    expect(rutaDeUrl('https://vimeo.com/1223588845', UID, CUBO)).toBeNull();
  });

  it('devuelve null para una imagen pegada de fuera', () => {
    expect(rutaDeUrl('https://otra-web.com/foto.jpg', UID, CUBO)).toBeNull();
  });

  it('devuelve null para otro cubo del mismo proyecto', () => {
    expect(rutaDeUrl(`https://abc.supabase.co/storage/v1/object/public/privado/${UID}/x.png`, UID, CUBO))
      .toBeNull();
  });

  it('no se deja engañar por un uid que solo es prefijo de otro', () => {
    // `<uid>extra/` empieza por el uid pero NO es su carpeta.
    expect(rutaDeUrl(`${BASE}${UID}extra/fondo.mp4`, UID, CUBO)).toBeNull();
  });

  it('resuelve el escapado por cientos', () => {
    expect(rutaDeUrl(`${BASE}${UID}%2Ffondo.mp4`, UID, CUBO)).toBe(`${UID}/fondo.mp4`);
  });

  it('devuelve null con una direccion vacia', () => {
    expect(rutaDeUrl('', UID, CUBO)).toBeNull();
  });

  it('no revienta con un escapado roto', () => {
    expect(rutaDeUrl(`${BASE}${UID}/%E0%A4%A.png`, UID, CUBO)).toBeNull();
  });
});
