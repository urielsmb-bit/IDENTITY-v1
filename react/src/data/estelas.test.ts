import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ESTELAS, ESTELAS_MUDADAS, IDS_ESTELA, estela } from './estelas';
import { normalizarPerfil } from '@/lib/normalizar';

/**
 * Pruebas del catálogo de estelas.
 *
 * Dos cosas que se rompen en silencio:
 *
 *   · una estela nueva cuya forma el motor no sabe dibujar. No falla nada:
 *     cae en el `default` del `switch` y sale un círculo. Elegiste «Pétalos»
 *     y te llevas puntos, y en la consola no hay nada;
 *   · un perfil de antes con una de las seis estelas viejas. Si la
 *     traducción no está, el saneado la tira al valor por defecto y a esa
 *     persona le cambia el rastro sin que haya tocado nada.
 */

const MOTOR = readFileSync(resolve(__dirname, '../lib/estela.ts'), 'utf8');

describe('el catálogo de estelas', () => {
  it('no repite ningún id', () => {
    expect(new Set(IDS_ESTELA).size).toBe(IDS_ESTELA.length);
  });

  it('el motor sabe dibujar todas las formas que se piden', () => {
    const sinDibujo = [...new Set(ESTELAS.map((e) => e.forma))]
      .filter((f) => !MOTOR.includes(`case '${f}'`) && f !== 'punto');
    expect(sinDibujo, 'formas declaradas que el motor no dibuja').toEqual([]);
  });

  /* Cada una tiene el suyo, y ninguna es morada: el color es la mitad de lo
     que hace que se reconozcan, y quince estelas del mismo color son quince
     maneras de mover lo mismo. */
  it('cada estela tiene su propio color', () => {
    const colores = ESTELAS.map((e) => e.color.toLowerCase());
    expect(new Set(colores).size, 'hay colores repetidos').toBe(colores.length);
    for (const e of ESTELAS) {
      expect(e.color, `${e.id} sin color`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('los tiempos y las densidades son posibles', () => {
    for (const e of ESTELAS) {
      expect(e.vida, `${e.id}`).toBeGreaterThan(100);
      expect(e.paso, `${e.id}`).toBeGreaterThan(0);
      expect(e.brote, `${e.id}`).toBeGreaterThanOrEqual(1);
      expect(e.tam[0], `${e.id}`).toBeLessThanOrEqual(e.tam[1]);
    }
  });

  /* El motor recuerda un número fijo de posiciones. Una cinta que pida más
     largo del que cabe no falla: se recorta en silencio, y la estela sale
     más corta de lo que dice su ficha sin que nada lo cuente. */
  it('ninguna cinta pide más recorrido del que el motor guarda', () => {
    const tope = Number(MOTOR.match(/const TOPE_HIST = (\d+)/)?.[1]);
    expect(tope, 'TOPE_HIST no encontrado en el motor').toBeGreaterThan(0);
    for (const e of ESTELAS) {
      if (!e.cinta) continue;
      expect(e.cinta.largo, `${e.id}: largo por encima de TOPE_HIST`)
        .toBeLessThanOrEqual(tope);
      expect(e.cinta.ancho, `${e.id}`).toBeGreaterThan(0);
      expect(e.cinta.capas ?? 1, `${e.id}`).toBeGreaterThanOrEqual(1);
      expect(e.cinta.capas ?? 1, `${e.id}: más capas es pintar lo mismo otra vez`)
        .toBeLessThanOrEqual(3);
    }
  });

  /* El halo multiplica el radio de la mota. Por debajo de uno queda DENTRO
     de ella: no se ve, y se paga igual. */
  it('el halo es más ancho que la mota', () => {
    for (const e of ESTELAS) {
      if (e.brillo === undefined) continue;
      expect(e.brillo, `${e.id}`).toBeGreaterThan(1);
      expect(e.brillo, `${e.id}: un halo enorme es una mancha`).toBeLessThanOrEqual(5);
    }
  });
});

/**
 * Y una guardia sobre el motor.
 *
 * Al soltar motas queda un sobrante —el trozo de camino que no llegaba a un
 * paso entero— y `ultimoX` se deja retrasado ese sobrante para que el
 * siguiente tramo empalme. Eso significa que la distancia medida en el cuadro
 * siguiente NO es cero aunque no hayas movido el ratón.
 *
 * Si alguien vuelve a apuntar «hubo movimiento» ahí, esa distancia de nada
 * cuenta como movimiento en cada cuadro: la cinta no se vacía nunca, el bucle
 * no duerme nunca, y el rastro se queda congelado en la pantalla. No falla
 * nada y en la consola no hay nada; solo se queda pegado.
 */
describe('el motor de la estela', () => {
  it('solo apunta movimiento donde sabe que lo hubo', () => {
    const marcas = MOTOR.match(/ultimoMov = (ahora|performance\.now\(\))/g) ?? [];
    expect(marcas.length, 'hay una marca de movimiento de más: ver el bucle de soltar')
      .toBeLessThanOrEqual(2);
  });

  it('no duerme con cinta a medio vaciar', () => {
    expect(MOTOR).toMatch(/vivas === 0 && guardadas === 0/);
  });
});

describe('el saneado de la estela', () => {
  it('acepta las quince', () => {
    for (const id of IDS_ESTELA) {
      expect(normalizarPerfil({ username: 'shark', cursorTrailFx: id }).cursorTrailFx).toBe(id);
    }
  });

  it('traduce las viejas en vez de dejarlas en nada', () => {
    for (const [vieja, nueva] of Object.entries(ESTELAS_MUDADAS)) {
      expect(normalizarPerfil({ username: 'shark', cursorTrailFx: vieja }).cursorTrailFx)
        .toBe(nueva);
      expect(estela(nueva), `${nueva} tiene que existir`).toBeTruthy();
    }
  });

  it('una inventada no pasa', () => {
    expect(normalizarPerfil({ username: 'shark', cursorTrailFx: '"><script>' }).cursorTrailFx)
      .toBe('chispas');
  });

  it('el color, la intensidad y la dirección se acotan', () => {
    expect(normalizarPerfil({ username: 'shark', cursorTrailColor: '#ff0000' }).cursorTrailColor)
      .toBe('#ff0000');
    // Un color no es un hueco por el que colar CSS.
    expect(normalizarPerfil({ username: 'shark', cursorTrailColor: 'red; background:url(x)' })
      .cursorTrailColor).toBe('');
    expect(normalizarPerfil({ username: 'shark', cursorTrailInt: 900 }).cursorTrailInt).toBe(200);
    expect(normalizarPerfil({ username: 'shark', cursorTrailDir: 'volando' }).cursorTrailDir)
      .toBe('seguimiento');
  });
});
