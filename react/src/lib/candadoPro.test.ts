import { describe, it, expect } from 'vitest';
import { sinPlanNoEntra } from './candadoPro';
import type { Profile } from '@/types/profile';

/**
 * El candado del plan.
 *
 * Se prueba a conciencia porque las dos formas de equivocarse aqui son
 * caras y ninguna avisa: si deja pasar de mas, se cobra por algo que se
 * coge gratis; si limpia de mas, alguien abre su perfil y se lo encuentra
 * deshecho. La segunda es la que mas duele y la que menos se nota al
 * programar, porque solo le pasa a quien ya tenia algo.
 */

/* Perfiles de mentira: solo los campos que mira cada prueba. El indice
   suelto es para poder escribir `theme` o `bio` sin montar un Profile
   entero, que son cien campos y ninguno importa aqui. */
type Suelto = Partial<Profile> & Record<string, unknown>;
const perfil = (x: Record<string, unknown> = {}) => x as Suelto;

describe('candado del plan · lo que ya estaba', () => {
  /* La promesa entera del archivo, en un test. */
  it('un valor que no cambia se queda, aunque sea de pago', () => {
    const antes = perfil({ gradient: true, tilt: true, sGlow: 40 });
    const r = sinPlanNoEntra(perfil({ gradient: true, tilt: true, sGlow: 40 }), antes);
    expect(r).toMatchObject({ gradient: true, tilt: true, sGlow: 40 });
  });

  it('guardar el perfil sin tocar nada no deshace la prueba de siete dias', () => {
    const suyo = {
      gradient: true, avGlow: true, tilt: true,
      particles: 'nieve', sBlur: 18, sGlow: 40,
      cursorImg: 'https://cdn.sharee.fun/c.png',
      bstyle: { card: { halo: true, blur: 20, glow: 60 } },
    };
    /* Cambia algo que NO es de pago, que es lo que hace cualquiera al
       volver: se retoca la bio y se guarda. */
    const r = sinPlanNoEntra(perfil({ ...suyo, bio: 'hola' }), perfil(suyo));
    expect(r).toMatchObject({ ...suyo, bio: 'hola' });
  });

  it('apagar siempre se puede, aunque no haya plan', () => {
    const antes = perfil({ gradient: true, tilt: true, particles: 'nieve', sGlow: 40 });
    const r = sinPlanNoEntra(
      perfil({ gradient: false, tilt: false, particles: 'none', sGlow: 0 }),
      antes,
    );
    expect(r).toMatchObject({ gradient: false, tilt: false, particles: 'none', sGlow: 0 });
  });
});

describe('candado del plan · lo que intenta entrar', () => {
  it('encender algo de pago no entra', () => {
    const r = sinPlanNoEntra(
      perfil({ gradient: true, avGlow: true, tilt: true }),
      perfil({ gradient: false, avGlow: false, tilt: false }),
    );
    expect(r).toMatchObject({ gradient: false, avGlow: false, tilt: false });
  });

  /* Subir un valor que ya estaba encendido tambien es usar el plan. */
  it('cambiar la intensidad de algo encendido tampoco entra', () => {
    const r = sinPlanNoEntra(perfil({ sGlow: 90 }), perfil({ sGlow: 40 }));
    expect(r.sGlow).toBe(40);
  });

  it('un perfil recien creado no puede nacer con nada de pago', () => {
    const r = sinPlanNoEntra(perfil({ gradient: true, particles: 'matrix' }), null);
    expect(r.gradient).toBeUndefined();
    expect(r.particles).toBeUndefined();
  });

  it('lo que no es de pago pasa tal cual', () => {
    const r = sinPlanNoEntra(
      perfil({ nameSize: 40, bio: 'x', theme: 'neon' }),
      perfil({ nameSize: 20, bio: '', theme: 'dark' }),
    );
    expect(r).toMatchObject({ nameSize: 40, bio: 'x', theme: 'neon' });
  });
});

describe('candado del plan · los bloques', () => {
  it('el halo de un bloque no se enciende sin plan', () => {
    const r = sinPlanNoEntra(
      perfil({ bstyle: { card: { halo: true, mt: 8 } } }),
      perfil({ bstyle: { card: { halo: false, mt: 4 } } }),
    );
    expect(r.bstyle).toEqual({ card: { halo: false, mt: 8 } });
  });

  /* El agujero que esto viene a cerrar: dos de las tres plantillas
     publicadas llevan `halo`, y aplicarlas lo regalaba. */
  it('una plantilla que trae bloques nuevos con halo tampoco lo cuela', () => {
    const r = sinPlanNoEntra(
      perfil({ bstyle: { card: { halo: true }, avatar: { halo: true, glow: 70 } } }),
      perfil({ bstyle: {} }),
    );
    expect(r.bstyle).toEqual({ card: { halo: undefined }, avatar: { halo: undefined, glow: undefined } });
  });

  it('un bloque que ya tenia halo lo conserva al aplicar otra plantilla', () => {
    const r = sinPlanNoEntra(
      perfil({ bstyle: { card: { halo: true, mt: 10 } } }),
      perfil({ bstyle: { card: { halo: true, mt: 2 } } }),
    );
    expect(r.bstyle).toEqual({ card: { halo: true, mt: 10 } });
  });
});

describe('candado del plan · el fondo de video', () => {
  it('no se puede poner un video sin plan, y el fondo anterior se respeta', () => {
    const r = sinPlanNoEntra(
      perfil({ bgType: 'video', bgValue: 'https://cdn/x.mp4', bgPoster: 'https://cdn/p.webp' }),
      perfil({ bgType: 'image', bgValue: 'https://cdn/foto.jpg', bgPoster: '' }),
    );
    expect(r).toMatchObject({ bgType: 'image', bgValue: 'https://cdn/foto.jpg', bgPoster: '' });
  });

  /* Los tres campos van juntos o no van: un tipo `image` con el valor de
     un mp4 es un perfil roto, no un perfil limitado. */
  it('quien YA tiene un video puede cambiarlo por otro', () => {
    const r = sinPlanNoEntra(
      perfil({ bgType: 'video', bgValue: 'https://cdn/nuevo.mp4' }),
      perfil({ bgType: 'video', bgValue: 'https://cdn/viejo.mp4' }),
    );
    expect(r).toMatchObject({ bgType: 'video', bgValue: 'https://cdn/nuevo.mp4' });
  });

  it('y puede quitarlo', () => {
    const r = sinPlanNoEntra(
      perfil({ bgType: 'gradient', bgValue: '' }),
      perfil({ bgType: 'video', bgValue: 'https://cdn/x.mp4' }),
    );
    expect(r).toMatchObject({ bgType: 'gradient', bgValue: '' });
  });
});

describe('candado del plan · no rompe nada', () => {
  it('no muta lo que recibe', () => {
    const nuevo = perfil({ gradient: true, bstyle: { card: { halo: true } } });
    const antes = perfil({ gradient: false, bstyle: { card: { halo: false } } });
    sinPlanNoEntra(nuevo, antes);
    expect((nuevo as Record<string, unknown>).gradient).toBe(true);
    expect((antes as Record<string, unknown>).gradient).toBe(false);
  });

  it('aguanta un perfil sin bstyle y sin nada', () => {
    expect(() => sinPlanNoEntra(perfil({}), perfil({}))).not.toThrow();
    expect(() => sinPlanNoEntra(perfil({}), null)).not.toThrow();
    expect(() => sinPlanNoEntra(perfil({ bstyle: null }), null)).not.toThrow();
  });
});
