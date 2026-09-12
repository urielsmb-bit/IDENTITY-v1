import { describe, expect, it, vi } from 'vitest';
import { conReintento } from './useDiscord';

/**
 * El reintento de la lectura de presencia.
 *
 * Se prueba aparte del hook porque lo que puede salir mal aqui no es el
 * widget: es la REGLA de que se reintenta y que no. Un dia alguien quita
 * la comprobacion del estado «para simplificar», y a partir de ahi cada
 * perfil sin fila en la tabla hace tres peticiones en vez de una y tarda
 * cinco segundos en decir lo mismo. Eso no se ve mirando la pantalla.
 */

/** Un error como el que lanza `leer()`: lleva el codigo en `estado`. */
function errorHttp(estado: number) {
  const e = new Error('vista: ' + estado) as Error & { estado: number };
  e.estado = estado;
  return e;
}

/**
 * Corre algo saltandose las esperas, para no tardar cinco segundos.
 *
 * El resultado se recoge ANTES de mover el reloj. Si se espera a
 * despues, entre que la promesa se rompe y alguien la mira hay un hueco
 * en el que nadie la ha recogido, y eso Vitest lo canta como error
 * aunque la prueba pase.
 */
async function sinEsperas<T>(fn: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const hecho = fn().then(
      (valor) => () => valor,
      (fallo) => () => { throw fallo; },
    );
    // Se deja que avance el reloj mientras quede algo pendiente.
    for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(10_000);
    return (await hecho)();
  } finally {
    vi.useRealTimers();
  }
}

describe('conReintento', () => {
  it('no pide dos veces lo que sale bien a la primera', async () => {
    const pedir = vi.fn().mockResolvedValue('vale');
    expect(await conReintento(pedir)).toBe('vale');
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('un corte de red se reintenta, y si el segundo va, va', async () => {
    const pedir = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('vale');
    expect(await sinEsperas(() => conReintento(pedir))).toBe('vale');
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it('se rinde tras agotar las pausas, y deja pasar el fallo', async () => {
    const pedir = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(sinEsperas(() => conReintento(pedir))).rejects.toThrow('Failed to fetch');
    // El primero mas una por cada pausa. Ni una mas.
    expect(pedir).toHaveBeenCalledTimes(3);
  });

  it('un 4xx NO se reintenta: es una respuesta, no un tropiezo', async () => {
    for (const estado of [400, 401, 403, 404, 406]) {
      const pedir = vi.fn().mockRejectedValue(errorHttp(estado));
      await expect(conReintento(pedir)).rejects.toThrow(String(estado));
      expect(pedir).toHaveBeenCalledTimes(1);
    }
  });

  it('un 5xx si, que el servidor mismo lo da por pasajero', async () => {
    const pedir = vi.fn()
      .mockRejectedValueOnce(errorHttp(503))
      .mockResolvedValue('vale');
    expect(await sinEsperas(() => conReintento(pedir))).toBe('vale');
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it('«no hay fila» no es un fallo: vuelve null sin reintentar', async () => {
    const pedir = vi.fn().mockResolvedValue(null);
    expect(await conReintento(pedir)).toBeNull();
    expect(pedir).toHaveBeenCalledTimes(1);
  });
});
