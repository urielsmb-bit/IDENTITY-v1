import { describe, expect, it } from 'vitest';
import { BLOQUES } from './bloques';

/**
 * Los bloques que ya traen caja no pueden recibir otra.
 *
 * Musica y Discord se pintan dentro de su propio recuadro —fondo, borde y
 * radio de fabrica—. El selector «Caja del bloque» les añadia OTRA encima,
 * y quedaba una caja dentro de otra con el borde de la de dentro cruzando
 * el relleno de la de fuera. Alguien lo vio y pregunto como se quitaba.
 *
 * No se quitaba: lo unico ajustable era la de fuera.
 *
 * Esta comprobacion es el candado. Sin ella, el dia que alguien reparta el
 * grupo `CAJA` a un bloque mas «porque los demas lo tienen», la caja doble
 * vuelve sin que nadie lo note hasta que lo ve un usuario.
 */
const CON_CAJA_PROPIA = ['music', 'discord'];

/** Los que AÑADEN una caja. Son los que no pueden estar en esos bloques. */
const AÑADEN_CAJA = ['superficie', 'heredarCaja'];

describe('los bloques con caja propia', () => {
  for (const id of CON_CAJA_PROPIA) {
    const b = BLOQUES.find((x) => x.id === id);

    it(`«${id}» existe`, () => {
      expect(b).toBeDefined();
    });

    it(`«${id}» no ofrece añadir una segunda caja`, () => {
      const todos = (b?.grupos ?? []).flatMap((g) => g.controles);
      for (const c of AÑADEN_CAJA) {
        expect(todos, `«${id}» ofrece «${c}», que dibuja una caja sobre la que ya tiene`)
          .not.toContain(c);
      }
    });

    it(`«${id}» si deja ajustar la que tiene`, () => {
      const todos = (b?.grupos ?? []).flatMap((g) => g.controles);
      /* Lo que se pidio: quitarla o hacerla transparente, y color, borde,
         tamaños y radio. Si alguno desaparece, el bloque vuelve a tener
         una caja que no se puede tocar. */
      for (const c of ['cajaPropia', 'colorCaja', 'opacidadCaja', 'colorBorde', 'grosorBorde', 'radio', 'relleno']) {
        expect(todos, `a «${id}» le falta el mando «${c}»`).toContain(c);
      }
    });
  }
});
