/**
 * Favoritas y usadas recientemente.
 *
 * Viven en `localStorage` a proposito y no en la base: son de QUIEN MIRA,
 * no de la plantilla. Marcar una favorita no es un dato publico ni le
 * cambia nada a su autor, y guardarlo en el servidor obligaria a tener
 * cuenta para algo que no la necesita. Si alguien entra desde otro
 * navegador, no las ve; es el precio correcto por no pedir sesion.
 *
 * Todo va envuelto en `try`: en una ventana privada, con las cookies
 * bloqueadas o con el almacenamiento lleno, `localStorage` LANZA en vez
 * de devolver vacio, y una galeria no puede caerse por no poder recordar
 * un corazon.
 */
const FAV = 'identity.plantillas.fav.v1';
const USADAS = 'identity.plantillas.usadas.v1';
const MAX_USADAS = 24;

function leer(clave: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(clave) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function escribir(clave: string, v: string[]) {
  try {
    localStorage.setItem(clave, JSON.stringify(v));
  } catch {
    /* sin sitio o sin permiso: se pierde el recuerdo, no la pagina */
  }
}

export const favoritas = () => leer(FAV);

export function alternarFavorita(id: string): string[] {
  const v = leer(FAV);
  const nueva = v.includes(id) ? v.filter((x) => x !== id) : [id, ...v];
  escribir(FAV, nueva);
  return nueva;
}

export const usadas = () => leer(USADAS);

/** La ultima usada primero, sin repetidas y sin crecer sin fin. */
export function apuntarUsada(id: string): string[] {
  const nueva = [id, ...leer(USADAS).filter((x) => x !== id)].slice(0, MAX_USADAS);
  escribir(USADAS, nueva);
  return nueva;
}
