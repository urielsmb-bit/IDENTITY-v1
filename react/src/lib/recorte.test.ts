import { describe, it, expect } from 'vitest';
import { segundosDePista } from './validar';

/**
 * Los segundos del recorte de musica.
 *
 * Esto se prueba porque un numero malo aqui no se ve romperse: el
 * reproductor se va a buscar a un sitio del que no vuelve y el bloque de
 * musica sencillamente no suena, sin error y sin nada que mirar. Y los
 * valores llegan de un perfil guardado, o sea de fuera.
 */
describe('recorte · los segundos de la pista', () => {
  it('un numero normal pasa tal cual', () => {
    expect(segundosDePista(42)).toBe(42);
    expect(segundosDePista('42')).toBe(42);
  });

  /* Cero es «entera» y es el valor por defecto: quien no toca nada tiene lo
     de siempre. Por eso todo lo que no sea un segundo valido cae aqui. */
  it('lo que no es un segundo valido cae en cero, que es «entera»', () => {
    expect(segundosDePista(undefined)).toBe(0);
    expect(segundosDePista(null)).toBe(0);
    expect(segundosDePista('')).toBe(0);
    expect(segundosDePista('mucho')).toBe(0);
    expect(segundosDePista(NaN)).toBe(0);
    expect(segundosDePista(-5)).toBe(0);
    expect(segundosDePista(-0.4)).toBe(0);
  });

  it('se queda con el segundo entero, sin decimales', () => {
    expect(segundosDePista(12.9)).toBe(12);
    expect(segundosDePista(0.9)).toBe(0);
  });

  /* Seis horas es el limite de YouTube. Sin techo, un numero absurdo
     —o uno manipulado a mano en el perfil— manda el reproductor a buscar a
     un sitio del que no vuelve. */
  it('no pasa del tope de seis horas', () => {
    expect(segundosDePista(6 * 60 * 60)).toBe(21600);
    expect(segundosDePista(6 * 60 * 60 + 1)).toBe(21600);
    expect(segundosDePista(999999999)).toBe(21600);
    expect(segundosDePista(Infinity)).toBe(0);
  });
});
