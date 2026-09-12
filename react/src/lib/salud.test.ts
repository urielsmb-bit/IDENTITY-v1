import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FUNCIONES } from './salud';

/**
 * La pantalla de salud, vigilada.
 *
 * Una pantalla de diagnóstico que se equivoca es peor que no tenerla: la
 * primera vez que sale en rojo algo que está bien, se deja de mirar. Y la
 * segunda ya nadie se acuerda de que existe.
 *
 * Estas pruebas cubren las dos formas de equivocarse que ya ocurrieron
 * mientras se escribía.
 */

const RAIZ = resolve(__dirname, '../..');
const FUNCS = resolve(RAIZ, '../supabase/functions');

describe('las funciones que comprueba la pantalla de salud', () => {
  const enElDisco = readdirSync(FUNCS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name);

  it('todas existen de verdad', () => {
    const inventadas = FUNCIONES.map(([n]) => n).filter((n) => !enElDisco.includes(n));
    expect(inventadas, 'comprueba funciones que no están en el repositorio').toEqual([]);
  });

  /**
   * La que ya falló.
   *
   * `discord-presencia` la llama un cron con un secreto propio, nunca un
   * navegador, y exige sesión hasta en el preflight — con razón. Al meterla
   * en la lista, la pantalla la daba por rota siempre, y una línea que
   * siempre está en rojo enseña a ignorar la pantalla entera.
   *
   * La marca es su propio comentario: si una función dice que no la llama un
   * navegador, no se comprueba desde el navegador.
   */
  it('ninguna es de las que solo llama el cron', () => {
    const soloCron = FUNCIONES.map(([n]) => n).filter((n) => {
      const fuente = readFileSync(resolve(FUNCS, n, 'index.ts'), 'utf8');
      return /no lo llama un navegador|lo llama un cron|CRON_SECRET/i.test(fuente);
    });
    expect(soloCron, 'estas no las llama un navegador: sobran aquí').toEqual([]);
  });

  it('cada una dice para qué sirve', () => {
    for (const [nombre, para] of FUNCIONES) {
      expect(para.length, `${nombre} sin explicación`).toBeGreaterThan(3);
    }
  });
});

describe('la ruta /salud', () => {
  /* Va antes del comodín de perfiles, o `sharee.fun/salud` se leería como el
     nombre de usuario «salud» y nunca llegaría a la pantalla. */
  it('está declarada antes del comodín de nombres de usuario', () => {
    const app = readFileSync(resolve(RAIZ, 'src/App.tsx'), 'utf8');
    const salud = app.indexOf('path="/salud"');
    const comodin = app.indexOf('path="/:username"');
    expect(salud, '/salud no está en el router').toBeGreaterThan(-1);
    expect(comodin).toBeGreaterThan(-1);
    expect(salud, '/salud va DESPUÉS del comodín y nunca se alcanzaría').toBeLessThan(comodin);
  });

  /* Y el servidor tiene que dejarla pasar: sin esto, `.htaccess` la manda a
     `perfil.php` como si fuera un perfil. Funciona igual, pero gasta una
     consulta a la base de datos por cada visita a una pantalla que no la
     necesita. */
  it('el .htaccess no la trata como un nombre de usuario', () => {
    const ht = readFileSync(resolve(RAIZ, 'hostinger/.htaccess'), 'utf8');
    const linea = ht.split('\n').find((l) => l.includes('REQUEST_URI') && l.includes('dashboard'));
    expect(linea, 'no está la lista de rutas reservadas').toBeTruthy();
    expect(linea, 'falta `salud` entre las rutas reservadas').toContain('salud');
  });
});
