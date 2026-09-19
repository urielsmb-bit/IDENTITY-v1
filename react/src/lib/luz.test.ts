import { describe, it, expect } from 'vitest';
import { siguientePaso } from './luz';

/**
 * El ritmo de la luz.
 *
 * Los tres materiales iluminados —obsidiana, fundido, hielo— son cadenas de
 * filtro SVG que Chrome calcula en la CPU pixel a pixel, y mover la luz
 * obliga a rehacer la cadena entera. Medido, a la medida que tiene un
 * nombre en pantalla:
 *
 *     sin filtro ........................  0,8 ms
 *     turbulencia + desplazamiento ......  6,2 ms
 *     + iluminacion difusa ..............  6,1 ms
 *     + iluminacion especular ........... 11,5 ms
 *     las dos juntas, que es lo que hay . 18,6 ms
 *
 * Dieciocho coma seis no caben en los dieciseis coma siete de un fotograma.
 * Antes habia un escalon fijo —treinta pasos por segundo en calidad alta,
 * dieciocho en media— y se quito porque «una luz que persigue al raton a
 * saltos se nota»: un numero decidido de antemano adivina la maquina en vez
 * de mirarla, y se equivoca en las dos direcciones.
 *
 * Esto mira. Y es lo unico de todo el bucle que se puede comprobar sin un
 * navegador, porque el resto necesita `requestAnimationFrame` y un bucle que
 * solo corre con la pestaña delante no se prueba.
 */
describe('luz · el ritmo se calibra solo', () => {
  /* LO MAS IMPORTANTE DE ESTE FICHERO. En una maquina que llega, esto tiene
     que devolver 33 siempre: si no, el aspecto cambiaria para todo el mundo
     y no solo para quien lo necesita. */
  it('una maquina que llega se queda en 33 y no se mueve de ahi', () => {
    expect(siguientePaso(33, 33)).toBe(33);
    expect(siguientePaso(34, 33)).toBe(33);
    expect(siguientePaso(36, 33)).toBe(33);
  });

  it('el ruido normal del navegador no cuenta como ir mal', () => {
    // Hasta un 35 % por encima es ruido, no una maquina que no llega.
    expect(siguientePaso(44, 33)).toBe(33);
  });

  it('una maquina que no llega ensancha el hueco', () => {
    expect(siguientePaso(60, 33)).toBeGreaterThan(33);
    expect(siguientePaso(60, 33)).toBe(43);
  });

  /* Si se ensanchara sin tope, la luz acabaria dando saltos de medio
     segundo, que es peor que el problema que viene a resolver. */
  it('nunca se ensancha mas alla del tope', () => {
    let p = 33;
    for (let i = 0; i < 40; i++) p = siguientePaso(9999, p);
    expect(p).toBe(100);
  });

  /* Y tiene que poder volver: la causa puede irse sola —otra pestaña que
     suelta la CPU, una ventana que se hace pequeña, un video que acaba— y
     una luz que se quedara lenta para siempre por un mal rato seria un
     castigo permanente por algo temporal. */
  it('vuelve a apretar cuando la maquina se recupera', () => {
    expect(siguientePaso(33, 100)).toBeLessThan(100);
    let p = 100;
    for (let i = 0; i < 40; i++) p = siguientePaso(33, p);
    expect(p).toBe(33);
  });

  it('no baja nunca del suelo, que es el ritmo de siempre', () => {
    expect(siguientePaso(1, 33)).toBe(33);
    expect(siguientePaso(0, 33)).toBe(33);
  });

  /* Ni oscilar entre dos valores: si al ensanchar la medida cayera justo en
     la zona de volver, la luz iria cambiando de ritmo sola para siempre. */
  it('no se queda oscilando entre dos ritmos', () => {
    // Una maquina que tarda 50 ms haga lo que haga.
    let p = 33;
    const vistos: number[] = [];
    for (let i = 0; i < 30; i++) {
      p = siguientePaso(50, p);
      vistos.push(p);
    }
    const ultimos = vistos.slice(-8);
    expect(new Set(ultimos).size).toBe(1);
    expect(ultimos[0]).toBeGreaterThanOrEqual(43);
  });
});
