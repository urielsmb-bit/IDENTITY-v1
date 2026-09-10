import { describe, it, expect } from 'vitest';
import { tienePlan } from './insignias';

/**
 * De donde sale el plan.
 *
 * No hay campo `plan` ni cobro: lo que decide es la insignia del diamante,
 * que concede el equipo escribiendo en `insignias_concedidas` con la clave
 * de servicio. Lo que se prueba aqui es que eso siga siendo asi — que el
 * dueño de un perfil no pueda darse premium a si mismo por ningun camino.
 */
describe('quien tiene el plan', () => {
  it('lo tiene quien lleva el diamante concedido', () => {
    expect(tienePlan({ concedidas: ['premium'] })).toBe(true);
  });

  it('no lo tiene quien no lleva ninguna', () => {
    expect(tienePlan({})).toBe(false);
    expect(tienePlan({ concedidas: [] })).toBe(false);
  });

  it('no lo dan otras insignias', () => {
    expect(tienePlan({ concedidas: ['verified', 'staff', 'donar'] })).toBe(false);
  });

  /* `badgesOff` esconde insignias del perfil publico. Esconder el diamante
     no puede quitarte lo que has pagado: son dos cosas distintas, y por eso
     esta funcion mira lo CONCEDIDO y no lo que se enseña. */
  it('esconder el diamante no quita el plan', () => {
    expect(tienePlan({ concedidas: ['premium'] })).toBe(true);
  });

  /* Ninguno de estos numeros los escribe quien edita su perfil, pero
     tampoco conceden el plan por muchos que sean: el diamante no se gana
     con visitas. */
  it('ni la antiguedad ni las visitas lo conceden', () => {
    expect(
      tienePlan({ creado: '2020-01-01', vistas: 1_000_000, nota: 5, numNotas: 999 }),
    ).toBe(false);
  });
});
