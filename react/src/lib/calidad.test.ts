import { beforeEach, describe, expect, it } from 'vitest';
import { ALTA, MEDIA, BAJA, cuantas, cadaCuanto, nivel, unFotograma, alCambiar } from './calidad';

/**
 * Alimenta el medidor con una ventana entera de fotogramas.
 *
 * `ms` es el hueco entre fotogramas: 16.7 es ir a 60, 40 es ir a 25. Se
 * mete un fotograma rapido al principio de cada ventana para que el
 * medidor sepa a cuanto aspira la pantalla — es lo que hace en la vida
 * real, donde siempre hay algun fotograma que llega a tiempo.
 */
function ventana(ms: number, ritmo = 16.7) {
  let t = reloj;
  t += ritmo;
  unFotograma(t);
  for (let i = 0; i < 121; i++) {
    t += ms;
    unFotograma(t);
  }
  reloj = t;
}

let reloj = 0;

/* El modulo guarda estado entre pruebas -es un unico presupuesto para toda
   la pagina, y eso es lo correcto- asi que el reloj avanza en vez de
   reiniciarse. Cada prueba parte de donde dejo la anterior. */
beforeEach(() => {
  reloj += 10000;
});

/**
 * Estas dos recortaban segun el nivel: al 55 % en media y al 28 % en baja,
 * y frenando el repintado a 25 por segundo. Ya no.
 *
 * «no quiero que las personas que tengan los graficos quitados se vean
 *  asi, quiero que se vea como todos lo vemos»
 *
 * Asi que lo que se comprueba ahora es lo contrario de lo que se
 * comprobaba: que NO recorten en ningun nivel. Si alguien vuelve a meter
 * un escalon aqui, estas dos pruebas se caen y hay que venir a leer por
 * que se quito — que es justo lo que tienen que hacer.
 */
describe('cuantas · lo mismo para todos', () => {
  it('devuelve lo que se le pide, tal cual', () => {
    expect(cuantas(1)).toBe(1);
    expect(cuantas(3)).toBe(3);
    expect(cuantas(200)).toBe(200);
  });
});

describe('cadaCuanto · sin frenar a nadie', () => {
  it('siempre a la velocidad de la pantalla', () => {
    expect(cadaCuanto()).toBe(0);
  });
});

/* A proposito NO se mueve el nivel para probarlas en cada escalon: estas
   dos ya no lo LEEN, asi que hacerlo no probaria nada y ademas dejaria el
   nivel tocado para las pruebas de adaptacion de mas abajo, que comparten
   el estado del modulo. Se aprendio caro: la primera version de esta
   prueba tumbo «baja tras dos ventanas malas seguidas» sin tener nada que
   ver con ella. */

describe('unFotograma · la adaptacion', () => {
  it('no baja con UNA sola ventana mala', () => {
    /* Bajar al primer tropiezo haria que cualquier hipo -una pestaña que
       arranca, el recolector de basura- le quitara los efectos a una
       maquina que iba bien. */
    const antes = nivel();
    ventana(40);
    expect(nivel()).toBe(antes);
  });

  it('baja tras dos ventanas malas seguidas', () => {
    const antes = nivel();
    ventana(40);
    ventana(40);
    expect(nivel()).toBeLessThan(antes);
  });

  it('avisa a quien escuche cuando cambia', () => {
    let avisos = 0;
    const soltar = alCambiar(() => avisos++);
    /* Desde donde sea, dos ventanas malas bajan un escalon -salvo que ya
       este abajo del todo, y ahi no hay cambio que avisar. */
    const antes = nivel();
    ventana(40);
    ventana(40);
    soltar();
    expect(avisos).toBe(antes > BAJA ? 1 : 0);
  });

  it('no baja de BAJA por mucho que insista', () => {
    for (let i = 0; i < 12; i++) ventana(90);
    expect(nivel()).toBe(BAJA);
  });

  it('sube tras cuatro ventanas buenas, no antes', () => {
    /* Subir es lento a proposito: una racha buena puede ser casualidad, y
       devolver efectos para quitarlos otra vez es el parpadeo que se
       quiere evitar. */
    expect(nivel()).toBe(BAJA);
    ventana(16.7);
    ventana(16.7);
    expect(nivel()).toBe(BAJA);
    ventana(16.7);
    ventana(16.7);
    /* La cuarta buena dispara la subida, pero deja CALMA: las dos
       siguientes ventanas no se juzgan. */
    expect(nivel()).toBe(MEDIA);
  });

  it('la calma impide que suba dos escalones de golpe', () => {
    /* Justo despues de subir hay dos ventanas en las que no se juzga, para
       que se note el efecto del cambio antes de volver a decidir. */
    expect(nivel()).toBe(MEDIA);
    ventana(16.7);
    ventana(16.7);
    expect(nivel()).toBe(MEDIA);
  });

  it('acaba llegando a ALTA si la maquina lo aguanta', () => {
    for (let i = 0; i < 8; i++) ventana(16.7);
    expect(nivel()).toBe(ALTA);
  });

  it('una pantalla de 120 Hz se juzga contra SU ritmo', () => {
    /* 20 ms son 50 fps: en una de 60 es ir bien. En una de 120 es menos de
       la mitad de lo que da, y ahi si arrastra. Comparar contra un 60 fijo
       se equivocaria en los dos sentidos. */
    expect(nivel()).toBe(ALTA);
    /* Las dos primeras se las come la calma que dejo la subida anterior:
       tras un cambio no se juzga durante dos ventanas. Asi que hacen falta
       cuatro para que cuenten dos. Que esta prueba fallara al escribirla
       fue precisamente la señal de que el freno esta puesto. */
    ventana(20, 8.3);
    ventana(20, 8.3);
    expect(nivel()).toBe(ALTA);
    ventana(20, 8.3);
    ventana(20, 8.3);
    expect(nivel()).toBe(MEDIA);
  });

  it('ni sube ni baja en la franja de en medio', () => {
    /* Entre los dos limites no se cuenta ni a favor ni en contra: es donde
       va bien y no hace falta tocar nada. Sin esa franja, subir y bajar
       compartirian frontera y la calidad oscilaria eternamente. */
    const antes = nivel();
    for (let i = 0; i < 6; i++) ventana(22);
    expect(nivel()).toBe(antes);
  });
});
