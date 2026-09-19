import { describe, it, expect } from 'vitest';
import { INSIGNIAS_DISCORD, insigniasDe, urlInsignia } from './insigniasDiscord';

/**
 * La tabla de insignias de Discord.
 *
 * Esto se prueba porque es donde un error NO SE VE. Un bit equivocado no
 * rompe nada: sencillamente enseña la insignia que no es, o no enseña la
 * que si, y en un perfil ajeno nadie lo nota. `public_flags` es un solo
 * numero y los bits estan repartidos sin orden -el 3 es cazador de bugs y
 * el 14 es cazador de bugs nivel 2- asi que equivocarse al copiarlos es lo
 * mas facil del mundo.
 */
describe('insignias de Discord', () => {
  it('sin nada, ninguna', () => {
    expect(insigniasDe(0, false)).toEqual([]);
    expect(insigniasDe(0, null)).toEqual([]);
  });

  /* Lo que llega de fuera no siempre es un numero. Con `undefined` el `&`
     daria cero por su cuenta, pero con una cadena daria cosas raras sin
     avisar de nada. */
  it('aguanta lo que no es un numero', () => {
    expect(insigniasDe(undefined, false)).toEqual([]);
    expect(insigniasDe(null, false)).toEqual([]);
    expect(insigniasDe('4194304', false)).toEqual([]);
    expect(insigniasDe(NaN, false)).toEqual([]);
    expect(insigniasDe(Infinity, false)).toEqual([]);
  });

  it('lee un bit suelto', () => {
    const r = insigniasDe(1 << 22, false);
    expect(r.map((b) => b.id)).toEqual(['activo']);
  });

  it('lee varios a la vez, y en el orden de la tabla', () => {
    // Apoyo desde el principio (512) + desarrollador activo (4194304)
    const r = insigniasDe((1 << 9) | (1 << 22), false);
    expect(r.map((b) => b.id)).toEqual(['pionero', 'activo']);
  });

  /* Nitro no tiene bit: va por `premium_type`, que es otro campo y otra
     fuente. Si algun dia alguien le pusiera un bit a la fila de Nitro,
     esta prueba lo cazaria. */
  it('el Nitro no sale de los bits sino de su propio campo', () => {
    expect(insigniasDe(0, true).map((b) => b.id)).toEqual(['nitro']);
    expect(insigniasDe(0xffffffff, false).map((b) => b.id)).not.toContain('nitro');
  });

  it('el Nitro solo cuenta si es exactamente true', () => {
    // `null` es «todavia no se sabe», y eso no es «si».
    expect(insigniasDe(0, null)).toEqual([]);
    expect(insigniasDe(0, undefined)).toEqual([]);
    expect(insigniasDe(0, 1)).toEqual([]);
  });

  it('cada fila tiene su icono y su nombre, y no se repiten', () => {
    for (const b of INSIGNIAS_DISCORD) {
      expect(b.id).toMatch(/^[a-z0-9]+$/);
      expect(b.nombre.length).toBeGreaterThan(3);
      /* Las claves del CDN de Discord son hexadecimal de 32. Una mal
         copiada da una imagen rota, que es justo lo que no se ve venir. */
      expect(b.icono).toMatch(/^[0-9a-f]{32}$/);
    }
    const ids = INSIGNIAS_DISCORD.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const iconos = INSIGNIAS_DISCORD.map((b) => b.icono);
    expect(new Set(iconos).size).toBe(iconos.length);
    const bits = INSIGNIAS_DISCORD.filter((b) => b.bit !== undefined).map((b) => b.bit);
    expect(new Set(bits).size).toBe(bits.length);
  });

  it('la direccion del icono es la del CDN de Discord', () => {
    expect(urlInsignia('abc')).toBe('https://cdn.discordapp.com/badge-icons/abc.png');
  });
});
