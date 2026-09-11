import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EFECTOS_NOMBRE, EFECTOS_MUDADOS, efectoNombre, IDS_EFECTO } from './efectosNombre';
import { normalizarPerfil } from '@/lib/normalizar';

/**
 * Pruebas del catálogo de efectos.
 *
 * Un sistema donde el efecto es un DATO tiene una forma de romperse propia y
 * muy concreta: alguien añade la fila, la tarjeta sale en el selector, se
 * puede elegir, se guarda… y no se ve nada, porque nadie escribió el bloque
 * de CSS. No falla nada, no hay error en ninguna consola; simplemente hay un
 * efecto que no hace nada y sólo se descubre probándolos de uno en uno.
 *
 * Por eso la prueba de abajo lee la hoja de estilos de verdad. Es la única
 * que puede coger ese fallo, y es exactamente el fallo que este diseño hace
 * más fácil cometer.
 */

const CSS = readFileSync(resolve(__dirname, '../styles/efectos.css'), 'utf8');
const CSS_PERFIL = readFileSync(resolve(__dirname, '../styles/profile.css'), 'utf8');
const TODO = CSS + CSS_PERFIL;

describe('el catálogo', () => {
  it('no repite ningún id', () => {
    expect(new Set(IDS_EFECTO).size).toBe(IDS_EFECTO.length);
  });

  it('cada efecto tiene su bloque de CSS', () => {
    const sinEstilo = EFECTOS_NOMBRE
      // «Ninguno» es la ausencia de efecto y la máquina de escribir la hace
      // un componente contando letras: ninguno de los dos tiene reglas.
      .filter((e) => e.id !== 'none' && e.id !== 'maquina')
      .filter((e) => !TODO.includes(`data-nameanim="${e.id}"`))
      .map((e) => e.id);
    expect(sinEstilo).toEqual([]);
  });

  it('no hay CSS de efectos que ya no existen', () => {
    const enCss = [...CSS.matchAll(/data-nameanim="([a-z]+)"/g)].map((m) => m[1]!);
    const huerfanos = [...new Set(enCss)].filter((id) => !IDS_EFECTO.includes(id));
    expect(huerfanos).toEqual([]);
  });

  it('los que piden capas las piden dentro de lo que pinta el componente', () => {
    for (const e of EFECTOS_NOMBRE) {
      if (e.capas != null) expect(e.capas).toBeGreaterThanOrEqual(0);
      if (e.capas != null) expect(e.capas).toBeLessThanOrEqual(3);
    }
  });

  /* Una capa que el CSS usa pero el catálogo no declara sale sin pintar, que
     es el mismo fallo del bloque que falta pero al revés y más difícil de
     ver: el efecto se ve «casi bien». */
  it('el CSS no usa más capas de las que cada efecto declara', () => {
    for (const e of EFECTOS_NOMBRE) {
      /* Hasta la coma, no hasta la llave. Varios selectores de un mismo
         bloque van separados por comas, y sin cortar ahí un `[data-c]` de
         tres líneas más abajo —de otro efecto— contaba como si fuera de
         éste. Justo eso dio un falso positivo la primera vez que corrió. */
      const usadas = [...TODO.matchAll(
        new RegExp(`data-nameanim="${e.id}"\\][^{,]*data-c="(\\d)"`, 'g'),
      )].map((m) => Number(m[1]));
      const pide = e.capas ?? 0;
      for (const c of usadas) {
        expect(c, `${e.id} usa la capa ${c} y declara ${pide}`).toBeLessThanOrEqual(pide);
      }
    }
  });

  it('el reparto es el acordado: cinco libres y el resto de pago', () => {
    const libres = EFECTOS_NOMBRE.filter((e) => !e.pro).map((e) => e.id);
    expect(libres).toEqual(['none', 'pulse', 'float', 'maquina', 'arcoiris']);
  });

  /* `pro` y `nivel` dicen cosas distintas —uno si se paga, otro cuánto hay
     dentro—, pero no pueden contradecirse: un efecto de nivel libre que se
     cobre, o un `signature` regalado, serían un error de dedo que nadie ve
     hasta que alguien se queja. */
  it('el nivel y el precio no se contradicen', () => {
    for (const e of EFECTOS_NOMBRE) {
      if (e.nivel === 'libre') expect(e.pro, `${e.id}`).toBeFalsy();
      else expect(e.pro, `${e.id}`).toBe(true);
    }
  });

  it('hay al menos tres signature, y todos traen luz o lienzo', () => {
    const firma = EFECTOS_NOMBRE.filter((e) => e.nivel === 'signature');
    expect(firma.length).toBeGreaterThanOrEqual(3);
    /* Lo que los hace signature no es el nombre del nivel: es que tengan una
       luz de verdad o que se dibujen ellos. Si alguno deja de tener las dos
       cosas, es un premium+ con etiqueta cara. */
    for (const e of firma) {
      expect(e.luz || e.lienzo, `${e.id} no tiene ni luz ni lienzo`).toBe(true);
    }
  });

  /* Los materiales se iluminan desde una `<fePointLight>` que mueve
     `lib/luz.ts` buscándolas por ese atributo. Si un filtro se escribe sin
     él, la luz se queda en la esquina y el material sale plano. */
  it('todo filtro con luz está marcado para que `luz.ts` lo encuentre', () => {
    const filtros = readFileSync(
      resolve(__dirname, '../components/profile/FiltrosEfectos.tsx'), 'utf8',
    );
    const puntos = filtros.match(/<fePointLight/g)?.length ?? 0;
    const marcados = filtros.match(/<fePointLight[^/]*data-fx-luz/g)?.length ?? 0;
    expect(puntos).toBeGreaterThan(0);
    expect(marcados).toBe(puntos);
  });
});

describe('el saneado del efecto', () => {
  it('acepta los dieciocho', () => {
    for (const id of IDS_EFECTO) {
      expect(normalizarPerfil({ username: 'shark', nameFx: id }).nameFx).toBe(id);
    }
  });

  it('un efecto inventado no pasa', () => {
    expect(normalizarPerfil({ username: 'shark', nameFx: 'rm -rf' }).nameFx).toBe('none');
    expect(normalizarPerfil({ username: 'shark', nameFx: '"><script>' }).nameFx).toBe('none');
  });

  /* Esto es una red para perfiles YA PUBLICADOS. Si falla, quien tuviera
     «Fallo de señal» abre su perfil y se lo encuentra sin efecto, sin que
     nadie haya tocado nada. */
  it('traduce los efectos retirados en vez de dejarlos en nada', () => {
    for (const [viejo, nuevo] of Object.entries(EFECTOS_MUDADOS)) {
      expect(normalizarPerfil({ username: 'shark', nameFx: viejo }).nameFx).toBe(nuevo);
      expect(efectoNombre(nuevo), `${nuevo} tiene que existir`).toBeTruthy();
    }
  });

  it('la intensidad y la velocidad se acotan y admiten no estar', () => {
    /* Sin poner: el campo NO SE ESCRIBE. Y tiene que ser así: el efecto trae
       sus valores de fábrica en su propia ficha, y un 100 guardado aquí sería
       un segundo sitio donde vive el mismo número. */
    expect(normalizarPerfil({ username: 'shark' }).fxInt).toBeUndefined();
    expect(normalizarPerfil({ username: 'shark', fxInt: 900 }).fxInt).toBe(250);
    expect(normalizarPerfil({ username: 'shark', fxVel: -4 }).fxVel).toBe(25);
    expect(normalizarPerfil({ username: 'shark', fxInt: 'mucho' }).fxInt).toBeNull();
  });
});
