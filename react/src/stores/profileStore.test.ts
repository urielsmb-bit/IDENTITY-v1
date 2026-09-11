import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Pruebas del tope del cajón de perfiles.
 *
 * Esto guardaba en `localStorage` todos los perfiles que visitaras, para
 * siempre. Y la forma de romperse no era «se llena»: era que al llenarse,
 * `write` se traga el error de cuota en silencio y deja de guardarse TAMBIÉN
 * tu propio perfil. El editor sigue funcionando, no avisa de nada, y al
 * recargar te faltan los últimos cambios.
 *
 * O sea que lo que se prueba aquí no es un ahorro de espacio: es que tu
 * perfil no se pierda por haber mirado los de otros.
 */

const LLAVE = 'identity.profiles.v2';

function almacen() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
    clear: () => datos.clear(),
    key: (i: number) => [...datos.keys()][i] ?? null,
    get length() {
      return datos.size;
    },
  } as Storage;
}

function perfil(username: string, relleno = 0) {
  return { username, name: username, bio: 'x'.repeat(relleno) } as never;
}

function guardados(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(LLAVE) || '{}');
}

beforeEach(() => {
  vi.stubGlobal('localStorage', almacen());
  vi.resetModules();
});

describe('el cajón de perfiles', () => {
  it('se queda con los diez últimos que miraste, no con todos', async () => {
    const { useProfileStore } = await import('./profileStore');
    for (let i = 0; i < 25; i++) {
      useProfileStore.getState().receiveFromServer(perfil('gente' + i));
    }
    const fuera = Object.keys(guardados());
    expect(fuera).toHaveLength(10);
    // Los últimos, no los primeros: si se quedaran los primeros, volver a un
    // perfil que acabas de ver no encontraría nada en el cajón.
    expect(fuera).toContain('gente24');
    expect(fuera).not.toContain('gente0');
  });

  it('el tuyo no se cae aunque mires a cien personas', async () => {
    const { useProfileStore } = await import('./profileStore');
    /* `setMine` es lo que marca cual es el tuyo; `save` por si solo no lo
       hace. Sin esa marca, tu propio perfil entra en la poda como el de un
       desconocido cualquiera, que es exactamente lo que hay que evitar. */
    useProfileStore.getState().save(perfil('shark'));
    useProfileStore.getState().setMine('shark');
    expect(guardados().shark).toBeTruthy();

    for (let i = 0; i < 100; i++) {
      useProfileStore.getState().receiveFromServer(perfil('gente' + i));
    }
    expect(guardados().shark, 'tu perfil tiene que seguir ahi').toBeTruthy();
  });

  /* Diez perfiles ligeros caben; UNO con una foto incrustada no. El saneado
     admite `data:` de hasta ocho megas, así que el tope de cantidad por sí
     solo no protege de nada. */
  it('también hay tope de peso, no solo de cantidad', async () => {
    const { useProfileStore } = await import('./profileStore');
    for (let i = 0; i < 6; i++) {
      useProfileStore.getState().receiveFromServer(perfil('pesado' + i, 400_000));
    }
    const bytes = (localStorage.getItem(LLAVE) || '').length;
    expect(bytes).toBeLessThan(1_300_000);
    expect(Object.keys(guardados()).length).toBeLessThan(6);
  });

  it('renombrar tu perfil no lo convierte en el de un desconocido', async () => {
    const { useProfileStore } = await import('./profileStore');
    /* `setMine` es lo que marca cual es el tuyo; `save` por si solo no lo
       hace. Sin esa marca, tu propio perfil entra en la poda como el de un
       desconocido cualquiera, que es exactamente lo que hay que evitar. */
    useProfileStore.getState().save(perfil('shark'));
    useProfileStore.getState().setMine('shark');
    for (let i = 0; i < 20; i++) {
      useProfileStore.getState().receiveFromServer(perfil('gente' + i));
    }
    useProfileStore.getState().save(perfil('sharkiii'), 'shark');

    const fuera = guardados();
    expect(fuera.sharkiii, 'el nombre nuevo se queda').toBeTruthy();
    expect(fuera.shark, 'el viejo se va').toBeFalsy();
  });
});
