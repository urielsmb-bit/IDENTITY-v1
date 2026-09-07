import type { Profile } from '@/types';
import { BLOQUES } from '@/data/bloques';
import { BASE_PERSONALIZADA, type PlantillaBase } from '@/data/plantillasBase';

/**
 * Elegir una plantilla: que cambia y que se respeta.
 *
 * Una plantilla es el ASPECTO, y solo el aspecto. Cambiarla NO toca ni una
 * letra de lo que has escrito —ni el nombre, ni la biografia, ni tus redes,
 * ni tu fondo, ni tu musica— y tampoco decide que bloques quieres enseñar:
 * eso es tuyo, y quien se pasea por las cinco a ver cual le gusta no puede
 * perder por el camino los bloques que habia encendido.
 *
 * La unica excepcion es el primer dia. Cuando aun no habias elegido
 * ninguna, la plantilla siembra tambien sus bloques: es lo que hace que
 * elegir «Vitrina» enseñe una vitrina y no una tarjeta vacia con el aspecto
 * de una vitrina.
 */
export function aplicarBase(
  plantilla: PlantillaBase,
  /** true solo la primera vez, cuando el perfil aun no tenia plantilla. */
  sembrarBloques = false,
): Partial<Profile> {
  const patch: Partial<Profile> = {
    ...plantilla.ajustes,
    /* Las cajas se SUSTITUYEN, no se funden. Fundirlas dejaba hibridos
       —el ancho de una plantilla con el relleno de la otra— que no son el
       diseño de nadie y que ademas nadie sabe deshacer. Una plantilla
       coloca los bloques; si coloca solo la mitad, no los coloca. */
    bstyle: { ...plantilla.cajas },
    base: plantilla.id,
  };

  if (sembrarBloques) {
    /* Se guarda lo OCULTO, no lo visible: asi un bloque que se añada al
       catalogo mañana aparece encendido en los perfiles que ya existen en
       vez de quedarse invisible para siempre. */
    patch.blocksOff = BLOQUES
      .map((b) => b.id)
      .filter((id) => !plantilla.bloques.includes(id));
  }

  return patch;
}

/**
 * ¿El perfil sigue siendo tal cual lo dejo su plantilla?
 *
 * Sirve para decirlo en voz alta en el editor —«Clásica · modificada»— en
 * vez de enseñar una tarjeta marcada como si nada hubiera cambiado. No es
 * un aviso de error: tocar la plantilla es exactamente lo que se espera que
 * pase despues de elegirla.
 */
export function coincideBase(perfil: Profile, plantilla: PlantillaBase): boolean {
  const p = perfil as unknown as Record<string, unknown>;

  for (const [campo, valor] of Object.entries(plantilla.ajustes)) {
    if (!igual(p[campo], valor)) return false;
  }

  return igual(perfil.bstyle ?? {}, plantilla.cajas);
}

/** La plantilla activa, o `null` si el diseño ya no es de ninguna. */
export function baseActual(perfil: Profile | null): string {
  return perfil?.base || BASE_PERSONALIZADA;
}

/* Los valores son numeros, cadenas, nulos y dos mapas (`pos`, `bstyle`).
   Para los mapas hace falta comparar el contenido, y son pequeños: un
   `JSON.stringify` con las claves ordenadas cuesta menos que escribir una
   comparacion profunda a mano y no se equivoca. */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  return estable(a) === estable(b);
}

function estable(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as object).sort(([m], [n]) => (m < n ? -1 : 1)))
      : x,
  );
}
