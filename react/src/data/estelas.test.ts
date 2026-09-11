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
