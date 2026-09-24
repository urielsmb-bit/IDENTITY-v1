import type { Profile } from '@/types/profile';

/**
 * Lo que ya construiste se queda. Lo que intentes añadir sin plan, no entra.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA REGLA, Y POR QUE ES ESTA Y NO «LIMPIAR LO DE PAGO»
 * ────────────────────────────────────────────────────────────────────────
 *
 * Lo facil era borrar los valores de pago a quien no tiene plan. Es una
 * linea de codigo y esta mal: alguien que uso sus siete dias de prueba
 * para montar su perfil se lo encontraria DESHECHO al volver. Le habriamos
 * quitado su trabajo, no una funcion.
 *
 * Asi que el candado no mira lo que hay, mira lo que CAMBIA:
 *
 *   1. Si el valor no cambia, no se toca. Nunca.
 *   2. Apagar siempre se puede, aunque no haya plan. Atrapar a alguien con
 *      un efecto que no puede quitarse seria peor que cobrarselo.
 *   3. Encender o cambiar, sin plan, no entra: se queda lo que ya estaba
 *      guardado.
 *
 * De ahi que haga falta el perfil GUARDADO y no solo el nuevo. Sin saber
 * de donde viene un valor no se puede distinguir «esto ya era suyo» de
 * «esto lo acaba de poner», y esa distincion es todo lo que hay aqui.
 *
 * ────────────────────────────────────────────────────────────────────────
 * ESTO NO ES SEGURIDAD
 * ────────────────────────────────────────────────────────────────────────
 *
 * Corre en el navegador, o sea en la maquina de quien lo quiera saltar.
 * Cierra el camino honrado —el editor y, sobre todo, las plantillas, que
 * hoy reparten `halo` y fondo de video a cualquiera que las aplique— y no
 * cierra a quien sepa falsificar una peticion.
 *
 * El candado de verdad es un disparador en la base que compare OLD contra
 * NEW y mire el plan del servidor. Este archivo esta escrito para que ese
 * dia la regla ya este decidida y probada, y solo haya que traducirla.
 *
 * ────────────────────────────────────────────────────────────────────────
 * DE DONDE SALE LA LISTA
 * ────────────────────────────────────────────────────────────────────────
 *
 * De lo que el editor YA enseña con el rombo. No de `FuncionPro`, que
 * declara ocho funciones de pago y nunca se conecto a ningun campo: cerrar
 * hoy algo que lleva meses libre no es aplicar el plan, es quitarle a la
 * gente una cosa que tenia. Si algun dia se decide cerrarlas, se añaden
 * aqui y todo lo demas sigue igual.
 *
 * Ojo con dos: `degradadoNombre` y `brilloAvatar` se editan dentro de un
 * bloque pero escriben en el PERFIL —`gradient` y `avGlow`—, no en
 * `bstyle`. Un mapeo hecho de memoria se los salta.
 */

/** Un campo de pago: como se llama y cuando se considera apagado. */
interface CampoPro {
  clave: string;
  /** Apagarlo siempre se puede, asi que hace falta saber que es «apagado». */
  apagado: (v: unknown) => boolean;
}

const noBool = (v: unknown) => !v;
const noTexto = (v: unknown) => !v || v === 'none' || v === '';
const noNumero = (v: unknown) => !v || v === 0;

/** Del perfil. */
const DEL_PERFIL: readonly CampoPro[] = [
  { clave: 'gradient', apagado: noBool },   // degradado del nombre
  { clave: 'avGlow', apagado: noBool },     // luz de la foto
  { clave: 'tilt', apagado: noBool },
  { clave: 'particles', apagado: noTexto },
  { clave: 'cursorImg', apagado: noTexto },
  { clave: 'cursorTrail', apagado: noTexto },
  { clave: 'cursorTrailFx', apagado: noTexto },
  { clave: 'cursorTrailColor', apagado: noTexto },
  { clave: 'cursorTrailDir', apagado: noTexto },
  { clave: 'cursorTrailInt', apagado: noNumero },
  { clave: 'sBlur', apagado: noNumero },
  { clave: 'sGlow', apagado: noNumero },
];

/** De cada bloque, dentro de `bstyle`. */
const DEL_BLOQUE: readonly CampoPro[] = [
  { clave: 'halo', apagado: noBool },
  { clave: 'blur', apagado: noNumero },
  { clave: 'glow', apagado: noNumero },
];

/** Dos valores son «el mismo» para esto. Compara primitivas, que es lo
 *  unico que hay en estos campos. */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  /* `undefined` y el valor por defecto de un campo que nunca se toco son
     la misma cosa para quien mira el perfil, y distinguirlos haria que
     abrir el editor y no tocar nada contara como un cambio. */
  if ((a === undefined || a === null) && (b === undefined || b === null)) return true;
  return false;
}

/** El valor que sobrevive a un campo. */
function resolver(campo: CampoPro, nuevo: unknown, antes: unknown): unknown {
  if (igual(nuevo, antes)) return nuevo;      // no ha cambiado
  if (campo.apagado(nuevo)) return nuevo;     // lo esta apagando: adelante
  return antes;                               // lo enciende o lo cambia: no
}

/**
 * Devuelve el perfil que de verdad se puede guardar.
 *
 * `guardado` es lo que hay AHORA en el perfil; `null` significa que no hay
 * nada previo —un perfil recien creado—, y entonces cualquier valor de
 * pago es nuevo por definicion y no entra.
 *
 * No muta nada: devuelve un objeto nuevo.
 */
export function sinPlanNoEntra<T extends Partial<Profile>>(
  nuevo: T,
  guardado: Partial<Profile> | null | undefined,
): T {
  const antes = (guardado ?? {}) as Record<string, unknown>;
  const n = nuevo as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...n };

  for (const campo of DEL_PERFIL) {
    if (!(campo.clave in n)) continue;
    out[campo.clave] = resolver(campo, n[campo.clave], antes[campo.clave]);
  }

  /* El fondo de video va aparte porque no es un campo, son tres que tienen
     que moverse juntos: el tipo, el archivo y su portada. Dejar el tipo
     viejo con el valor nuevo daria un perfil que pide una imagen y recibe
     un video. */
  const tipoNuevo = n.bgType;
  const tipoAntes = antes.bgType;
  if (tipoNuevo === 'video' && tipoAntes !== 'video') {
    out.bgType = tipoAntes ?? 'gradient';
    out.bgValue = antes.bgValue ?? '';
    if ('bgPoster' in n) out.bgPoster = antes.bgPoster ?? '';
  }

  /* Y los de cada bloque. Se recorren los bloques del perfil NUEVO: si una
     plantilla trae bloques que no existian, sus valores de pago tampoco
     pueden colarse. */
  const bstyleNuevo = n.bstyle as Record<string, Record<string, unknown>> | undefined;
  if (bstyleNuevo && typeof bstyleNuevo === 'object') {
    const bstyleAntes = (antes.bstyle ?? {}) as Record<string, Record<string, unknown>>;
    const salida: Record<string, Record<string, unknown>> = {};
    for (const [bloque, estilo] of Object.entries(bstyleNuevo)) {
      if (!estilo || typeof estilo !== 'object') { salida[bloque] = estilo; continue; }
      const previo = bstyleAntes[bloque] ?? {};
      const copia = { ...estilo };
      for (const campo of DEL_BLOQUE) {
        if (!(campo.clave in estilo)) continue;
        copia[campo.clave] = resolver(campo, estilo[campo.clave], previo[campo.clave]);
      }
      salida[bloque] = copia;
    }
    out.bstyle = salida;
  }

  return out as T;
}
