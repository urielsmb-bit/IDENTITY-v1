import { describe, expect, it } from 'vitest';
import { APARIENCIA_APAGADA, PLANTILLAS_BASE } from './plantillasBase';

/**
 * Una plantilla de arranque dice DONDE van las cosas. Nada mas.
 *
 * Esto existe por un caso real: alguien pregunto como se quitaba el color
 * azul verdoso del bloque de musica y no encontraba el mando, porque nunca
 * lo habia puesto. Y no lo habria encontrado — ese tinte salia de las
 * superficies del tema `cyberpunk`, que venia de fabrica, y lo unico que el
 * editor deja cambiar es el acento, que pisa otra variable.
 *
 * La regla, entonces: un perfil nuevo empieza en cero y su dueño AÑADE. No
 * llega decorado para que tenga que ir desarmandolo a ciegas.
 *
 * Estas comprobaciones son el candado. Sin ellas la regla se cumple hasta
 * que alguien añada un brillo «que queda bien» a una plantilla, y a partir
 * de ahi vuelve a pasar lo mismo sin que nadie lo note.
 */

/** Lo que NUNCA puede fijar una plantilla: materiales, brillos, tipografias. */
const PROHIBIDO = [
  'theme', 'accent', 'colText', 'colBg', 'colIcon',
  'sOpacity', 'sBlur', 'sBorderOn', 'sBorderW', 'sColor', 'sBorderColor',
  'blockStyle', 'avBorder', 'avGlow', 'socialStyle', 'badgeStyle', 'musicStyle',
  'monoIcons', 'glowName', 'glowSocials', 'glowBadges', 'gradient', 'nameFx',
  'particles', 'tilt', 'noise', 'avatarFx', 'font', 'fontDisplay',
] as const;

describe('las plantillas de arranque solo componen', () => {
  for (const pl of PLANTILLAS_BASE) {
    it(`«${pl.nombre}» no fija apariencia`, () => {
      const suyo = pl.ajustes as Record<string, unknown>;
      const apagado = APARIENCIA_APAGADA as Record<string, unknown>;
      for (const k of PROHIBIDO) {
        /* Vale tenerlo SI coincide con el estado apagado: eso es lo que
           mete el propio `...APARIENCIA_APAGADA`, no una decision de la
           plantilla. Lo que no vale es un valor distinto. */
        if (k in suyo && suyo[k] !== apagado[k]) {
          throw new Error(
            `«${pl.nombre}» fija ${k} = ${JSON.stringify(suyo[k])}. ` +
            'Eso es apariencia, y la elige su dueño.',
          );
        }
      }
    });

    /* `surface` es el unico que se permite mover, y solo entre dos valores:
       que HAYA tarjeta o que no la haya es composicion. De que esta hecha
       —cristal, contorno, brillo— no lo es. */
    it(`«${pl.nombre}» no elige de que esta hecha la tarjeta`, () => {
      const s = (pl.ajustes as Record<string, unknown>).surface;
      expect(['solid', 'none']).toContain(s);
    });

    it(`«${pl.nombre}» apaga antes de componer`, () => {
      const suyo = pl.ajustes as Record<string, unknown>;
      /* Se aplica ENCIMA de lo que ya hay: sin esto, quien venga de otro
         diseño se queda sus brillos puestos y la plantilla nueva sale
         contaminada con restos de la vieja. */
      expect(suyo.particles).toBe('none');
      expect(suyo.glowName).toBe(false);
      expect(suyo.theme).toBe('dark');
    });
  }
});
