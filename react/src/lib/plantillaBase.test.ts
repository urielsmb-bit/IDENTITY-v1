import { describe, it, expect } from 'vitest';
import { aplicarBase, coincideBase } from './plantillaBase';
import { PLANTILLAS_BASE } from '@/data/plantillasBase';
import { BLOQUES } from '@/data/bloques';
import type { Profile } from '@/types';

/**
 * Lo que se prueba aqui es la PROMESA de las plantillas.
 *
 * La promesa es doble: que elegir una no te borra nada de lo tuyo, y que la
 * composicion que te deja aguanta en cualquier pantalla. Lo segundo no se ve
 * en el editor —ahi todo cabe— y solo aparece en el telefono de otra
 * persona, que es el peor sitio para enterarse.
 */

const MIO = {
  username: 'shark',
  name: 'Uriel',
  bio: 'hola',
  avatarUrl: 'https://x/avatar.png',
  socials: [{ net: 'x', url: 'https://x.com/shark', label: 'X' }],
  audio: { title: 'una cancion' },
  bgType: 'image',
  bgValue: 'https://x/fondo.jpg',
  blocksOff: ['music'],
} as unknown as Profile;

describe('aplicarBase · lo que no toca', () => {
  for (const pl of PLANTILLAS_BASE) {
    it(`«${pl.nombre}» no escribe nada del contenido`, () => {
      const patch = aplicarBase(pl);
      for (const campo of [
        'username', 'name', 'bio', 'about', 'title', 'avatarUrl',
        'socials', 'links', 'gallery', 'audio', 'bgType', 'bgValue', 'views',
      ]) {
        expect(patch).not.toHaveProperty(campo);
      }
    });
  }

  it('cambiar de plantilla respeta los bloques que ya tenías encendidos', () => {
    const patch = aplicarBase(PLANTILLAS_BASE[0]!);
    expect(patch).not.toHaveProperty('blocksOff');
  });

  it('el primer día sí los siembra, y guarda lo oculto', () => {
    const pl = PLANTILLAS_BASE[4]!;                 // Vitrina
    const patch = aplicarBase(pl, true);
    const todos = BLOQUES.map((b) => b.id);
    expect(patch.blocksOff).toEqual(todos.filter((id) => !pl.bloques.includes(id)));
    // Y lo sembrado son ids de verdad, no nombres inventados.
    for (const id of pl.bloques) expect(todos).toContain(id);
  });
});

describe('las cinco composiciones aguantan en un teléfono', () => {
  for (const pl of PLANTILLAS_BASE) {
    it(`«${pl.nombre}» fluye en columna y declara su ancho de diseño`, () => {
      const a = pl.ajustes;
      // En columna: el lienzo libre guarda coordenadas absolutas pensadas
      // para un ancho concreto, y en una pantalla estrecha se solapan.
      expect(a.layoutMode).toBe('stack');
      // Y con ancho de diseño declarado, que es de donde la vista publica
      // saca la escala con la que encoge el conjunto entero.
      expect(a.widthMode).toBe('fixed');
      /* El tope no es redondo, es el que sale de la cuenta. El ancho de
         diseño en pixeles es `sWidthPct * 9.2`, y la vista publica encoge
         el conjunto hasta 0.42 y no mas —por debajo de ahi el perfil deja
         de leerse—. En el telefono mas estrecho que se sigue vendiendo
         (320px) quedan unos 288 libres despues del aire del heroe, asi que
         cabe un diseño de 288/0.42 ≈ 685px, o sea un 74%. Una plantilla
         mas ancha que eso no encoge lo suficiente y se sale por el lado. */
      expect(a.sWidthPct).toBeGreaterThanOrEqual(30);
      expect(a.sWidthPct).toBeLessThanOrEqual(74);
      // Sin restos de una colocacion a mano anterior.
      expect(a.pos).toEqual({});
      expect(a.canvasH).toBeNull();
      // Sin alto fijo: un alto en pixeles corta el contenido en cuanto el
      // texto ocupa una linea mas de las previstas.
      expect(a.sHeightPx).toBeNull();
    });

    it(`«${pl.nombre}» solo mide bloques que existen`, () => {
      const ids = BLOQUES.map((b) => b.id);
      for (const id of Object.keys(pl.cajas)) expect(ids).toContain(id);
      for (const caja of Object.values(pl.cajas)) {
        // El ancho de un bloque nunca pasa del de su tarjeta: por ahi es
        // por donde se desborda una columna estrecha.
        if (caja.w != null) expect(caja.w).toBeLessThanOrEqual(100);
      }
    });
  }
});

describe('coincideBase · decir la verdad sobre lo que hay puesto', () => {
  it('recién aplicada, coincide', () => {
    const pl = PLANTILLAS_BASE[1]!;
    const perfil = { ...MIO, ...aplicarBase(pl) } as Profile;
    expect(coincideBase(perfil, pl)).toBe(true);
  });

  it('con un ajuste tocado a mano, ya no', () => {
    const pl = PLANTILLAS_BASE[1]!;
    const perfil = { ...MIO, ...aplicarBase(pl), radius: 3 } as Profile;
    expect(coincideBase(perfil, pl)).toBe(false);
  });

  it('con un bloque afinado a mano, tampoco', () => {
    const pl = PLANTILLAS_BASE[0]!;                 // Clásica: sin cajas
    const perfil = { ...MIO, ...aplicarBase(pl), bstyle: { name: { size: 140 } } } as Profile;
    expect(coincideBase(perfil, pl)).toBe(false);
  });

  it('las cinco son distinguibles entre sí', () => {
    for (const pl of PLANTILLAS_BASE) {
      const perfil = { ...MIO, ...aplicarBase(pl) } as Profile;
      const coinciden = PLANTILLAS_BASE.filter((otra) => coincideBase(perfil, otra));
      expect(coinciden.map((x) => x.id)).toEqual([pl.id]);
    }
  });
});
