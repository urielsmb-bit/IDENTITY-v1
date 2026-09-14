import { describe, expect, it } from 'vitest';
import { decidirLlano, ritmoDePantalla } from './fluidez';

/* Los numeros son milisegundos entre fotogramas. Para situarse:
     60 Hz -> 16.7      120 Hz -> 8.3      30 Hz -> 33.3      15 Hz -> 66.7  */

describe('ritmoDePantalla', () => {
  it('cree al hueco mas corto cuando es creible', () => {
    expect(ritmoDePantalla(8.3)).toBeCloseTo(8.3);
    expect(ritmoDePantalla(16.7)).toBeCloseTo(16.7);
    expect(ritmoDePantalla(33.3)).toBeCloseTo(33.3);
  });

  it('no se cree un numero imposible', () => {
    /* Menos de 6 ms serian mas de 165 Hz: la medida esta rota, no es una
       pantalla milagrosa. Y mas de 34 no es el ritmo de la pantalla sino que
       NINGUN fotograma llego a tiempo. */
    expect(ritmoDePantalla(0.4)).toBeCloseTo(16.7);
    expect(ritmoDePantalla(120)).toBeCloseTo(16.7);
  });
});

describe('decidirLlano', () => {
  it('una pantalla de 60 a 60 se queda como esta', () => {
    expect(decidirLlano(16.7, 16.7)).toBe(false);
  });

  it('a 50 fps todavia no se toca nada', () => {
    /* Se nota un poco, pero se usa. Quitarle los efectos a alguien que
       puede verlos es tan malo como dejar a otro con tirones. */
    expect(decidirLlano(20, 16.7)).toBe(false);
  });

  it('por debajo de 40 fps si se marca', () => {
    /* El liston estuvo en 30 y era demasiado permisivo: entre 30 y 40 ya se
       ve a tirones y aquella version no hacia nada. */
    expect(decidirLlano(26, 16.7)).toBe(true);
    expect(decidirLlano(40, 16.7)).toBe(true);
    expect(decidirLlano(90, 16.7)).toBe(true);
  });

  it('una pantalla de 120 Hz se juzga contra SU ritmo, no contra 60', () => {
    /* 14 ms son 70 fps: en una de 60 es ir sobrado y no se toca. En una de
       120 es la mitad de lo que da, y ahi si arrastra. Comparar contra un
       60 fijo se equivocaria en los dos sentidos. */
    expect(decidirLlano(14, 16.7)).toBe(false);
    expect(decidirLlano(14, 8.3)).toBe(true);
  });

  it('un portatil a 30 Hz con la bateria baja no se castiga', () => {
    /* Va a 30 porque la pantalla va a 30, no porque no pueda pintar. */
    expect(decidirLlano(33.3, 33.3)).toBe(false);
  });

  it('ante numeros rotos no toca nada', () => {
    /* Sin medida fiable, la opcion segura es dejarlo todo como estaba. */
    expect(decidirLlano(NaN, 16.7)).toBe(false);
    expect(decidirLlano(20, Infinity)).toBe(false);
  });
});
