import { describe, it, expect } from 'vitest';
import { diasDePrueba, tienePlan } from './insignias';

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
      tienePlan({ creado: '2020-01-01', vistas: 1_000_000 }),
    ).toBe(false);
  });
});

/**
 * La cuenta atras de la prueba de siete dias.
 *
 * Lo que se prueba aqui no es la aritmetica: es CUANDO hay que callarse.
 * Un numero solo tiene sentido si al plan le queda poco. Quien no tiene
 * plan y quien lo tiene para siempre se pintan igual —sin cuenta atras— y
 * por eso los dos devuelven null.
 */
describe('cuanto queda de prueba', () => {
  const ahora = Date.parse('2026-09-12T12:00:00Z');
  const dentroDe = (ms: number) => new Date(ahora + ms).toISOString();
  const DIA = 86_400_000;

  it('no hay cuenta atras si el plan es para siempre', () => {
    // `expira` a null es lo que la base guarda para «para siempre».
    expect(diasDePrueba({ concedidas: ['premium'], caducaPlan: null }, ahora)).toBeNull();
    expect(diasDePrueba({ concedidas: ['premium'] }, ahora)).toBeNull();
  });

  it('no hay cuenta atras si no hay plan', () => {
    // Una fecha suelta sin el diamante no cuenta: primero hay que tenerlo.
    expect(diasDePrueba({ concedidas: [], caducaPlan: dentroDe(3 * DIA) }, ahora)).toBeNull();
    expect(diasDePrueba({ caducaPlan: dentroDe(3 * DIA) }, ahora)).toBeNull();
  });

  it('cuenta los dias que faltan', () => {
    const con = (ms: number) => diasDePrueba({ concedidas: ['premium'], caducaPlan: dentroDe(ms) }, ahora);
    expect(con(7 * DIA)).toBe(7);
    expect(con(3 * DIA)).toBe(3);
    expect(con(DIA)).toBe(1);
  });

  /* Hacia ARRIBA. A hora y media del final todavia funciona, y decirle a
     alguien que le quedan cero dias de algo que funciona es mentirle en la
     direccion que molesta. */
  it('redondea hacia arriba: lo que queda de hoy es un dia', () => {
    expect(diasDePrueba({ concedidas: ['premium'], caducaPlan: dentroDe(90 * 60_000) }, ahora)).toBe(1);
    expect(diasDePrueba({ concedidas: ['premium'], caducaPlan: dentroDe(DIA + 1000) }, ahora)).toBe(2);
  });

  /* La vista no devuelve las vencidas, asi que esto no deberia pasar. Pasa
     si el reloj del navegador va adelantado, y entonces cero, no negativo. */
  it('nunca devuelve un numero negativo', () => {
    expect(diasDePrueba({ concedidas: ['premium'], caducaPlan: dentroDe(-5 * DIA) }, ahora)).toBe(0);
  });

  it('aguanta una fecha que no es una fecha', () => {
    expect(diasDePrueba({ concedidas: ['premium'], caducaPlan: 'el martes' }, ahora)).toBeNull();
  });
});
